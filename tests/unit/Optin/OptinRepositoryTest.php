<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\Optin;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\OptinDesign;

/**
 * The three writes that move an Optin between states, and the one derived
 * thing every one of them has to leave correct.
 */
#[CoversClass(OptinRepository::class)]
#[CoversClass(PublishedSet::class)]
final class OptinRepositoryTest extends TestCase
{
    public function testAnUnpublishedTestParentCannotChangeItsGoalEither(): void
    {
        $parent = $this->repository->create('Draft test', 'grow_email_list', []);
        $variant = $this->repository->createVariant($parent->id);
        $this->assertNotNull($variant);
        $this->assertFalse($this->repository->find($parent->id)?->canChangeGoal());
        $this->assertNull($this->repository->saveDraft($parent->id, null, 'grow_sms_list', null));
        $this->assertSame('grow_email_list', $this->repository->find($parent->id)?->goal);
    }

    private FakeConnection $db;

    private FakeOptionStore $options;

    private PublishedSet $publishedSet;

    private OptinRepository $repository;

    protected function setUp(): void
    {
        $this->db = new FakeConnection();
        $this->options = new FakeOptionStore();
        $this->publishedSet = new PublishedSet($this->options);
        $this->repository = new OptinRepository(
            $this->db,
            $this->publishedSet,
            RuleVocabulary::fromManifest(__DIR__ . '/../../..'),
            new MilestoneStore($this->options)
        );
    }

    /**
     * @param array<string, mixed> $config
     */
    private function anOptin(array $config = ['targeting' => ['include' => [['type' => 'post', 'value' => 12]]]]): Optin
    {
        return $this->repository->create('Spring sale', 'promote_offer', $config + ['template' => OptinDesign::template(), 'display_rules' => \WConvert\Rules\DisplayPlan::immediate()]);
    }

    public function testPublishPromotesTheDraftAndRebuildsTheSetInOneCall(): void
    {
        $optin = $this->anOptin();

        $this->assertSame([], $this->publishedSet->all(), 'a new Optin is a draft');

        $published = $this->repository->publish($optin->id);

        $this->assertNotNull($published);
        $this->assertSame($optin->config, $published->publishedConfig);
        $this->assertNotNull($published->publishedAt);
        $this->assertSame([$optin->id], array_column($this->publishedSet->all(), 'id'));
    }

    /**
     * A later edit to `config` is a draft again until it is published, so the
     * set must still be serving the version that was published.
     */
    public function testEditingTheDraftDoesNotChangeWhatTheSiteIsServing(): void
    {
        $optin = $this->anOptin();
        $this->repository->publish($optin->id);

        $this->repository->saveDraft($optin->id, null, null, ['targeting' => [], 'headline' => 'unpublished words']);

        $this->assertStringNotContainsString('unpublished words', json_encode($this->publishedSet->all()) ?: '');
    }

    public function testSavedChangesCanBePromotedWithoutUnpublishing(): void
    {
        $optin = $this->anOptin();
        $this->assertFalse($optin->toArray()['has_unpublished_changes']);
        $live = $this->repository->publish($optin->id);
        $this->assertNotNull($live);
        $this->assertFalse($live->toArray()['has_unpublished_changes']);

        $config = $live->config;
        $config['template']['tree']['steps'][0]['content']['children'][0]['text'] = 'VIEW OFFER';
        $saved = $this->repository->saveDraft($optin->id, null, null, $config);
        $this->assertNotNull($saved);
        $this->assertTrue($saved->toArray()['has_unpublished_changes'], 'case-only edits are saved changes');
        $this->assertSame($live->publishedConfig, $saved->publishedConfig);
        $this->assertSame($live->publishedAt, $saved->publishedAt);
        $this->assertStringNotContainsString('VIEW OFFER', json_encode($this->publishedSet->all()) ?: '');

        $updated = $this->repository->publish($optin->id);
        $this->assertNotNull($updated);
        $this->assertSame($config, $updated->publishedConfig);
        $this->assertFalse($updated->toArray()['has_unpublished_changes']);
        $this->assertSame([$optin->id], array_column($this->publishedSet->all(), 'id'));
        $this->assertStringContainsString('VIEW OFFER', json_encode($this->publishedSet->all()) ?: '');
    }

    public function testRestoringTheLiveConfigClearsThePendingChangeWithoutPublishing(): void
    {
        $optin = $this->anOptin();
        $this->repository->publish($optin->id);
        $this->repository->saveDraft($optin->id, null, null, $optin->config + ['headline' => 'A change']);
        $restored = $this->repository->saveDraft($optin->id, 'A new admin name', null, $optin->config);

        $this->assertNotNull($restored);
        $this->assertFalse($restored->hasUnpublishedChanges(), 'the name is not part of the live design snapshot');
    }

    public function testIncompleteFormDraftsCannotReplaceTheLiveVersion(): void
    {
        $optin = $this->anOptin();
        $live = $this->repository->publish($optin->id);
        $set = $this->publishedSet->all();
        foreach ([
            [['type' => 'field', 'name' => 'name']],
            [['type' => 'field', 'name' => 'email'], ['type' => 'field', 'name' => 'interest', 'options' => []]],
        ] as $fields) {
            $config = ['template' => ['tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => [[
                'type' => 'stack', 'children' => [...$fields, ['type' => 'button', 'action' => 'submit']],
            ]]])]];
            $saved = $this->repository->saveDraft($optin->id, null, null, $config);
            self::assertNotNull($saved, 'the merchant can keep an unfinished draft');
            self::assertNull($this->repository->publish($optin->id));
            self::assertSame($live?->publishedConfig, $this->repository->find($optin->id)?->publishedConfig);
            self::assertSame($set, $this->publishedSet->all());
        }
    }

    public function testMissingDesignCannotBePromotedAndDoesNotStampActivation(): void
    {
        foreach ([[], ['template' => ['tree' => \WConvert\Tests\Unit\Support\JourneyFixture::tree(['steps' => []])]]] as $config) {
            $draft = $this->repository->create('Incomplete', 'grow_email_list', $config);
            $this->assertNull($this->repository->publish($draft->id));
            $this->assertNull($this->repository->find($draft->id)?->publishedAt);
        }

        $this->assertSame([], $this->publishedSet->all());
        $this->assertNull((new MilestoneStore($this->options))->firstPublish());
    }

    public function testAnIncompleteSavedUpdateCannotReplaceTheCurrentLiveSnapshot(): void
    {
        $optin = $this->anOptin();
        $live = $this->repository->publish($optin->id);
        $set = $this->publishedSet->all();
        $saved = $this->repository->saveDraft($optin->id, null, null, []);

        $this->assertNotNull($saved, 'incomplete drafts remain saveable');
        $this->assertTrue($saved->hasUnpublishedChanges());
        $this->assertNull($this->repository->publish($optin->id));
        $this->assertSame($live?->publishedConfig, $this->repository->find($optin->id)?->publishedConfig);
        $this->assertSame($set, $this->publishedSet->all());
    }

    public function testDetailComparisonUsesTheSameStoredRepresentationAsTheList(): void
    {
        $row = [
            'id' => '01TEST', 'name' => 'Test', 'goal' => 'promote_offer',
            'config' => '{"a":1,"b":2}', 'published_config' => '{ "a": 1, "b": 2 }',
            'published_at' => '2026-09-10 10:00:00', 'deleted_at' => null,
        ];
        $this->assertTrue(Optin::fromRow($row)->hasUnpublishedChanges());
        $row['published_config'] = '{"b":2,"a":1}';
        $this->assertTrue(Optin::fromRow($row)->hasUnpublishedChanges());
        $row['published_config'] = $row['config'];
        $this->assertFalse(Optin::fromRow($row)->hasUnpublishedChanges());
        $row['config'] = '{}';
        $row['published_at'] = null;
        $this->assertFalse(Optin::fromRow($row)->hasUnpublishedChanges());
        $row['published_at'] = '2026-09-10 10:00:00';
        $row['deleted_at'] = '2026-09-10 11:00:00';
        $this->assertFalse(Optin::fromRow($row)->hasUnpublishedChanges());
    }

    public function testListAndArmProjectionsCompareSnapshotsWithoutReturningTheBlobs(): void
    {
        $this->repository->summaries();
        $this->repository->armsByParent();

        foreach ($this->db->statements as $sql) {
            $this->assertStringContainsString('NOT (BINARY config <=> BINARY published_config)', $sql);
            $this->assertStringContainsString('AS has_unpublished_changes', $sql);
            $this->assertStringNotContainsString(', config,', $sql);
            $this->assertStringNotContainsString(', published_config,', $sql);
        }
    }

    public function testUnpublishDropsItFromTheSetAndKeepsTheLastLiveVersion(): void
    {
        $optin = $this->anOptin();
        $this->repository->publish($optin->id);

        $unpublished = $this->repository->unpublish($optin->id);

        $this->assertNotNull($unpublished);
        $this->assertSame([], $this->publishedSet->all());
        $this->assertNotNull($unpublished->publishedConfig, 'republishing must not be a retype');
        $this->assertNull($unpublished->publishedAt);
    }

    /**
     * The criterion, stated twice over: `deleted_at` is set, and no statement
     * this repository ever issues is a DELETE. The second half is what holds
     * when someone later adds a "purge" screen — analytics interprets
     * conversion counts by joining this table, so a removed row makes every
     * count referencing it uninterpretable (ADR 0020).
     */
    public function testDeleteStampsDeletedAtAndIssuesNoDelete(): void
    {
        $optin = $this->anOptin();
        $this->repository->publish($optin->id);

        $this->assertTrue($this->repository->delete($optin->id));

        $deleted = $this->repository->find($optin->id);
        $this->assertNotNull($deleted);
        $this->assertNotNull($deleted->deletedAt);
        $this->assertSame([], $this->publishedSet->all(), 'a deleted Optin leaves the set');

        // Matched as a statement, not as a substring: `deleted_at` is a
        // column name and appears in almost every query this repository runs.
        foreach ($this->db->statements as $sql) {
            $this->assertDoesNotMatchRegularExpression('/\bDELETE\s+FROM\b|^\s*DELETE\b/i', $sql);
        }

        $this->assertNotEmpty($this->db->writes);

        foreach ($this->db->writes as $write) {
            $this->assertNotSame([], $write['data'], 'every write is an insert or an update, never a removal');
        }
    }

    /**
     * Repositories expose projections, never `SELECT *`: dragging LONGTEXT
     * config blobs through a list exhausts PHP's memory limit at a few hundred
     * rows, which is a thing WSMS measured rather than a thing we fear
     * (ADR 0001).
     */
    public function testNoQueryEverSelectsEverything(): void
    {
        $this->anOptin();
        $this->repository->summaries();
        $this->repository->find('01A');

        foreach ($this->db->statements as $sql) {
            $this->assertStringNotContainsString('SELECT *', $sql);
        }
    }

    /**
     * Rebuilt on write, never on read. Reading the published set a hundred
     * times must not write it once — the front end reads it on every uncached
     * page load.
     */
    public function testReadingThePublishedSetNeverWritesIt(): void
    {
        $optin = $this->anOptin();
        $this->repository->publish($optin->id);

        $writesAfterPublish = $this->options->writes;

        for ($i = 0; $i < 100; $i++) {
            $this->publishedSet->all();
        }

        $this->assertSame($writesAfterPublish, $this->options->writes);
    }

    public function testAnOptinIsNeverPublishedByBeingCreated(): void
    {
        $optin = $this->anOptin();

        $this->assertFalse($optin->isPublished());
        $this->assertNull($optin->publishedConfig);
        $this->assertSame([], $this->publishedSet->all());
    }

    /**
     * ========================================================================
     * THE OTHER HALF OF THE ANALYTICS JOIN.
     * ========================================================================
     * A row in `wconvert_stats` carries no `goal` at all, so what a count
     * MEANS is read from this table at report time (ADR 0020) — which is what
     * makes correcting a mis-set Goal restate an Optin's whole history.
     *
     * **Soft-deleted Optins are in it**, and that is the point rather than an
     * oversight: their counts stay in their Goal's totals, so a merchant
     * tidying up in March does not watch February's goal total fall. It is
     * {@see \WConvert\Stats\Dashboard} that drops their ROW from the
     * per-Optin list — one read, two opposite consequences.
     */
    public function testTheAnalyticsProjectionIncludesSoftDeletedOptins(): void
    {
        $kept = $this->anOptin();
        $tidied = $this->anOptin();

        $this->repository->delete($tidied->id);

        $interpretable = array_column($this->repository->interpretations(), 'id');

        // Membership, not order. The read carries no `ORDER BY` — the caller
        // buckets by Goal and by Optin anyway, so asking the database to sort
        // a result it hands over whole is work nobody reads.
        sort($interpretable);
        $expected = [$kept->id, $tidied->id];
        sort($expected);

        $this->assertSame(
            $expected,
            $interpretable,
            'a deleted Optin whose counts are still in a total must still be interpretable'
        );
    }

    /**
     * **No `LIMIT`, and no `WHERE`.**
     *
     * {@see OptinRepository::summaries()} caps at 500 because a list view past
     * that is a scrolling problem. A cap HERE would silently drop the 501st
     * Optin's counts out of its Goal's total — a wrong number rather than a
     * short page, and one nobody can see is wrong. The same argument
     * {@see OptinRepository::names()} makes, worth more on this read.
     */
    public function testTheAnalyticsProjectionIsNeverCappedOrFiltered(): void
    {
        $this->repository->interpretations();

        $sql = end($this->db->statements) ?: '';

        $this->assertStringNotContainsString('LIMIT', $sql);
        $this->assertStringNotContainsString('WHERE', $sql);
        $this->assertStringNotContainsString('deleted_at IS NULL', $sql);
    }

    /**
     * Everything needed to interpret a count, and nothing else. The two
     * LONGTEXT columns would be dragged per row for a read that spans every
     * Optin on the install (ADR 0001).
     */
    public function testTheAnalyticsProjectionCarriesFourShortColumns(): void
    {
        $this->repository->interpretations();

        $sql = end($this->db->statements) ?: '';

        $this->assertStringContainsString('SELECT id, name, goal, deleted_at, parent_id, published_at, (published_config IS NOT NULL) AS was_published FROM %i', $sql);
        $this->assertStringNotContainsString('SELECT *', $sql);
    }

    // =========================================================================
    // A/B: STARTING A TEST, AND ENDING ONE WITHOUT DESTROYING ITS HISTORY.
    // =========================================================================

    public function testAVariantIsASecondOptinWhoseParentIsTheFirst(): void
    {
        $parent = $this->anOptin();

        $variant = $this->repository->createVariant($parent->id);

        $this->assertNotNull($variant);
        $this->assertNotSame($parent->id, $variant->id, 'a Variant is a whole Optin, with its own id');
        $this->assertSame($parent->id, $variant->parentId);
        $this->assertSame($parent->goal, $variant->goal);
        $this->assertSame($parent->config, $variant->config);
    }

    /**
     * Nobody should be asked to name a thing they think of as *the other one*.
     * The parent is arm A and is never renamed, so the first variant is B.
     */
    public function testAVariantIsNotAskedForANameAndTakesItsParentsWithALetter(): void
    {
        $parent = $this->anOptin();

        $b = $this->repository->createVariant($parent->id);
        $c = $this->repository->createVariant($parent->id);

        $this->assertNotNull($b);
        $this->assertNotNull($c);
        $this->assertSame('Spring sale (B)', $b->name);
        $this->assertSame('Spring sale (C)', $c->name);
    }

    /**
     * A letter that has been retired is never handed out again. Two rows called
     * *"Spring sale (B)"* would be two different designs under one label in the
     * [[Lead]] log, where the name is the only provenance a Lead has.
     */
    public function testALetterIsNeverReusedAfterItsArmIsTidiedAway(): void
    {
        $parent = $this->anOptin();
        $first = $this->repository->createVariant($parent->id);

        $this->repository->delete((string) $first?->id);

        $this->assertSame('Spring sale (C)', $this->repository->createVariant($parent->id)?->name);
    }

    /**
     * A variant starts where its parent's EDITOR starts, not where its site
     * does. Copying `published_config` would put a second arm on the site the
     * moment the button was pressed, which is a test starting without anybody
     * saying so.
     */
    public function testAVariantIsADraftEvenWhenItsParentIsLive(): void
    {
        $parent = $this->anOptin();
        $this->repository->publish($parent->id);

        $variant = $this->repository->createVariant($parent->id);

        $this->assertNull($variant?->publishedAt);
        $this->assertNull($variant?->publishedConfig);
        $this->assertSame([$parent->id], array_column($this->publishedSet->all(), 'id'));
    }

    /**
     * Arms are a flat set under one parent: the payload's arm triple names one
     * experiment, and a grandchild would name a parent that is itself an arm of
     * something else. There is no test that shape describes.
     */
    public function testAVariantOfAVariantIsRefused(): void
    {
        $parent = $this->anOptin();
        $variant = $this->repository->createVariant($parent->id);

        $this->assertNull($this->repository->createVariant((string) $variant?->id));
    }

    public function testTheArmsOfATestAreReadBackBeneathTheirParent(): void
    {
        $parent = $this->anOptin();
        $variant = $this->repository->createVariant($parent->id);

        $this->assertSame(
            [$variant?->id],
            array_column($this->repository->armsByParent()[$parent->id] ?? [], 'id')
        );
        // The list itself is parentless-only in SQL, which this fake models
        // the table rather than the query and cannot answer — so what is
        // asserted here is the statement it issued. A merchant never meeting
        // two campaigns is proven against a real database in
        // `bin/verify-ab-test.php`.
        $this->repository->summaries();

        $this->assertNotEmpty(array_filter(
            $this->db->statements,
            static fn (string $sql): bool => str_contains($sql, 'parent_id IS NULL')
        ));
    }

    /**
     * ========================================================================
     * THE SEAM. ENDING A TEST NEVER DELETES A ROW (ADR 0020).
     * ========================================================================
     * The losing arm is a month of the merchant's own history, and a removed
     * row makes every count naming it uninterpretable. Asserted on the ROW and
     * on the CONNECTION both: the row is still there with a `deleted_at`
     * stamp, and no `DELETE` was issued at all — which is the assertion that
     * fails on the pull request that reaches for one, rather than on the one
     * that forgets to update a comment.
     */
    public function testDeclaringAWinnerSoftDeletesTheLoserAndDeletesNoRow(): void
    {
        $parent = $this->anOptin();
        $loser = $this->repository->createVariant($parent->id);
        $this->repository->publish($parent->id);
        $this->repository->publish((string) $loser?->id);

        $this->assertTrue($this->repository->declareWinner($parent->id, $parent->id));

        $tidied = $this->repository->find((string) $loser?->id);

        $this->assertNotNull($tidied, 'the losing row stays, and its counters stay interpretable');
        $this->assertNotNull($tidied->deletedAt);
        $this->assertSame([], $this->db->deletes, 'no DELETE was ever issued');
    }

    /**
     * The winner stops having a parent and takes the campaign's name, so the
     * list shows one campaign again and the merchant is not left reading
     * *"Spring sale (B)"* forever.
     *
     * **Nothing is copied onto the parent**, which is the shape ADR 0045
     * sketched and this refuses: arm B's design on arm A's row would leave one
     * row whose counters are A's history followed by B's future, under a rate
     * that is the average of two different designs.
     */
    public function testAWinningVariantBecomesTheCampaignRatherThanBeingCopiedOntoIt(): void
    {
        $parent = $this->anOptin();
        $winner = $this->repository->createVariant($parent->id);
        $winningConfig = $parent->config + ['headline' => 'the winning words'];
        $this->repository->saveDraft((string) $winner?->id, null, null, $winningConfig);
        $this->repository->publish($parent->id);
        $this->repository->publish((string) $winner?->id);

        $this->repository->declareWinner($parent->id, (string) $winner?->id);

        $promoted = $this->repository->find((string) $winner?->id);
        $retired = $this->repository->find($parent->id);

        $this->assertNotNull($promoted);
        $this->assertNotNull($retired);

        $this->assertNull($promoted->parentId);
        $this->assertSame('Spring sale', $promoted->name);
        $this->assertSame($winningConfig, $promoted->config);

        $this->assertNotNull($retired->deletedAt, 'the arm that lost is tidied away, never removed');
        $this->assertSame(
            $parent->config,
            $retired->config,
            "and it keeps its own design, so its own counters stay readable against it"
        );
    }

    /**
     * The test is over in the only place that records it: the payload stops
     * describing one, because the winner is alone in its group. There is no
     * `finished` column to set and none to forget.
     */
    public function testEndingATestLeavesOneCampaignOnTheSite(): void
    {
        $parent = $this->anOptin();
        $winner = $this->repository->createVariant($parent->id);
        $this->repository->publish($parent->id);
        $this->repository->publish((string) $winner?->id);

        $this->repository->declareWinner($parent->id, (string) $winner?->id);

        $set = $this->publishedSet->all();

        $this->assertSame([$winner?->id], array_column($set, 'id'));
        $this->assertArrayNotHasKey('variant', $set[0]['payload']);
    }

    /**
     * ========================================================================
     * AND THE SAME RULE WHEN A CHILD WINS, WHICH IS WHERE IT ACTUALLY BROKE.
     * ========================================================================
     * The parent-wins case above is the easy half: the campaign keeps its row,
     * so it keeps its children and the count is right. When a CHILD wins it is
     * promoted to parentless — and if the losers were left hanging under the
     * old parent, the promoted row would have no children at all, so the next
     * variant of it would be named `(B)` again beside a soft-deleted `(B)`
     * that is a different design.
     *
     * That is two designs under one label in the [[Lead]] log, where the name
     * is the only provenance a Lead has (ADR 0002, ADR 0020) — so the losers
     * are re-parented onto the winner and the whole test's history follows the
     * campaign that won.
     */
    public function testALetterIsNeverReusedAfterAVariantWinsAndTheTestRestarts(): void
    {
        $parent = $this->anOptin();
        $b = $this->repository->createVariant($parent->id);
        $c = $this->repository->createVariant($parent->id);

        $this->repository->publish($parent->id);
        $this->repository->publish((string) $b?->id);
        $this->repository->publish((string) $c?->id);

        $this->repository->declareWinner($parent->id, (string) $c?->id);

        $next = $this->repository->createVariant((string) $c?->id);

        $this->assertNotNull($next);
        $this->assertSame('Spring sale (D)', $next->name);
        $this->assertNotSame(
            $b?->name,
            $next->name,
            'a retired letter beside a live one is two designs under one label in the lead log'
        );
    }

    /**
     * Which is the same fact read from the other end: a finished test is one
     * parentless campaign with every arm it ever ran beneath it, whichever arm
     * won. Nothing is orphaned under a row that is no longer a campaign.
     */
    public function testTheArmsOfAFinishedTestHangBeneathTheWinner(): void
    {
        $parent = $this->anOptin();
        $winner = $this->repository->createVariant($parent->id);

        $this->repository->publish($parent->id);
        $this->repository->publish((string) $winner?->id);

        $this->repository->declareWinner($parent->id, (string) $winner?->id);

        $this->assertSame(
            [$parent->id],
            array_column($this->repository->armsByParent(true)[(string) $winner?->id] ?? [], 'id')
        );
        $this->assertSame(
            [],
            $this->repository->armsByParent()[(string) $winner?->id] ?? [],
            'and none of them is still running'
        );
    }

    public function testDeclaringAWinnerThatIsNotAnArmOfThisTestIsRefused(): void
    {
        $parent = $this->anOptin();
        $this->repository->createVariant($parent->id);
        $other = $this->repository->create('Something else', 'grow_email_list', []);

        $this->assertFalse($this->repository->declareWinner($parent->id, $other->id));
        $this->assertNull($this->repository->find($parent->id)?->deletedAt);
    }

    public function testDeclaringAWinnerOfATestThatIsNotRunningIsRefused(): void
    {
        $parent = $this->anOptin();

        $this->assertFalse($this->repository->declareWinner($parent->id, $parent->id));
    }

}
