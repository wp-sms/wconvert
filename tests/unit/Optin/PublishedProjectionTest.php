<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\PublishedProjection;
use WConvert\Rules\RuleVocabulary;

/**
 * The published set: the projection of every published, non-deleted Optin
 * (ADR 0003).
 *
 * The exclusion set is the part later tickets extend — a suspended Optin joins
 * it in the degradation ticket — so its shape is pinned here rather than left
 * to be rediscovered.
 */
#[CoversClass(PublishedProjection::class)]
final class PublishedProjectionTest extends TestCase
{
    private static function vocabulary(): RuleVocabulary
    {
        return RuleVocabulary::fromManifest(__DIR__ . '/../../..');
    }

    /**
     * @param iterable<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    private static function build(iterable $rows, ?\DateTimeZone $siteZone = null): array
    {
        return PublishedProjection::build($rows, self::vocabulary(), $siteZone ?? new \DateTimeZone('UTC'));
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private static function row(array $overrides = []): array
    {
        return array_merge([
            'id' => '01JQ0000000000000000000001',
            'goal' => 'grow_email_list',
            'config' => '{"targeting":{"include":[{"type":"url","value":"/draft"}]},"note":"working draft"}',
            'published_config' => '{"targeting":{"include":[{"type":"post","value":12}]},"display_type":"popup"}',
            'published_at' => '2026-08-24 10:00:00',
            'deleted_at' => null,
        ], $overrides);
    }

    public function testAPublishedRowProjectsItsTargetingSeparablyFromItsPayload(): void
    {
        $set = self::build([self::row()]);

        $this->assertSame([[
            'id' => '01JQ0000000000000000000001',
            // Beside the payload, never inside it: PHP resolves the cart URL
            // from it at enqueue and the browser never sees it (ADR 0025).
            'goal' => 'grow_email_list',
            'targeting' => ['include' => [['type' => 'post', 'value' => 12]]],
            'payload' => ['display_type' => 'popup', 'triggers' => [], 'conditions' => []],
        ]], $set);
    }

    /**
     * The set is derived from `published_config`, never from `config`. Leaking
     * the working draft onto the page is the whole reason the two columns are
     * separate — a merchant editing an Optin must not be publishing as they
     * type.
     */
    public function testTheWorkingDraftNeverReachesTheSet(): void
    {
        $set = self::build([self::row()]);

        $this->assertStringNotContainsString('working draft', json_encode($set) ?: '');
        $this->assertStringNotContainsString('/draft', json_encode($set) ?: '');
    }

    /**
     * The exclusion set, stated as one list because that is what later tickets
     * extend: a suspended Optin joins it in the degradation ticket.
     *
     * @return iterable<string, array{array<string, mixed>}>
     */
    public static function excludedRows(): iterable
    {
        yield 'never published' => [self::row(['published_config' => null, 'published_at' => null])];
        yield 'unpublished, last live version kept' => [self::row(['published_at' => null])];
        yield 'soft-deleted' => [self::row(['deleted_at' => '2026-08-24 11:00:00'])];
        yield 'soft-deleted while published' => [
            self::row(['deleted_at' => '2026-08-24 11:00:00', 'published_at' => '2026-08-24 10:00:00']),
        ];
    }

    /**
     * @param array<string, mixed> $row
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('excludedRows')]
    public function testExcludedRowsProduceNoEntry(array $row): void
    {
        $this->assertSame([], self::build([$row]));
    }

    public function testTheSetHoldsOnlyTheRowsThatSurvive(): void
    {
        $set = self::build([
            self::row(['id' => '01JQ0000000000000000000001']),
            self::row(['id' => '01JQ0000000000000000000002', 'published_at' => null]),
            self::row(['id' => '01JQ0000000000000000000003', 'deleted_at' => '2026-08-24 11:00:00']),
            self::row(['id' => '01JQ0000000000000000000004']),
        ]);

        $this->assertSame(
            ['01JQ0000000000000000000001', '01JQ0000000000000000000004'],
            array_column($set, 'id')
        );
    }

    /**
     * ADR 0005: rules are partitioned into `triggers` and `conditions` **at
     * publish time**, not at evaluation time. Kind is a fixed property of the
     * type, so the manifest already knows the answer and the client should not
     * re-derive it per page view.
     */
    /**
     * A `published_config` carrying **everything an authored Optin can hold**,
     * so that a test about what travels is asked against a config that has
     * something to withhold.
     *
     * The pinning test below used to build its own, and it left out the one
     * key that was actually leaking. That is the failure mode of a fixture
     * written beside the rule it is checking: it agrees with the rule.
     *
     * @return array<string, mixed>
     */
    private static function everythingAnOptinCanHold(): array
    {
        return [
            'targeting' => ['include' => [['type' => 'url', 'value' => '/*']]],
            'rules' => [['type' => 'page_load']],
            'template' => ['tree' => ['steps' => []], 'tokens' => []],
            'display_type' => 'floating_bar',
            'placement' => 'block_start',
            // The shape `resources/loader/src/types.ts` declares and
            // `frequency.ts` reads — which this fixture did NOT carry until
            // the allowance gained an author. It said
            // `['once_per' => 'session']`, a key nothing has ever
            // read on either side, and the test passed anyway because it
            // asserts which keys travel rather than what is in them.
            'frequency' => ['maxImpressions' => 3],
            'priority' => 10,
            // Everything below is authoring state. None of it renders.
            'template_id' => 'centred-card',
            'playbook_id' => 'welcome-discount',
            'destination_hint' => ['types' => ['wsms'], 'fields' => ['email']],
            // **The key this fixture was missing**, and the reason the pinning
            // test passed while the projection shipped it. See
            // `testTheDestinationsAnOptinBindsNeverReachTheBrowser()`.
            'destinations' => ['01JQ0000000000000000000009'],
        ];
    }

    /**
     * **The keys a payload may carry, pinned.**
     *
     * The projection used to ship `published_config` WHOLE minus a denylist,
     * which fails open: a key added to `config` for the builder's benefit
     * reached every visitor of every matching page unless somebody remembered
     * to add it to the strip list. `template_id` rode the payload that way
     * from the day it was written, `destination_hint` did the same the day it
     * was, and `destinations` was still doing it when the pre-release audit
     * found it.
     *
     * It is an ALLOWLIST now, so the failure direction is reversed twice over:
     * forgetting withholds rather than publishes, and adding a key to the
     * payload fails this test until somebody writes it down — the same way
     * `SchemaTest::INDEX_BUDGET` makes a new index a decision in a diff. The
     * budget it protects is real — ≤2KB gzipped per page, measured
     * (ADR 0010).
     */
    public function testReopenConfigurationReachesTheVisitorOutsideTheTemplate(): void
    {
        $set = self::build([self::row(['published_config' => json_encode(['display_type' => 'popup', 'teaser' => ['label' => 'Return to offer']])])]);
        self::assertSame(['label' => 'Return to offer'], $set[0]['payload']['teaser']);
    }

    public function testThePayloadCarriesOnlyTheKeysSomebodyWroteDown(): void
    {
        $config = self::everythingAnOptinCanHold();

        $payload = self::build([self::row(['published_config' => (string) json_encode($config)])])[0]['payload'];

        $this->assertSame(
            ['template', 'display_type', 'placement', 'frequency', 'priority', 'triggers', 'conditions'],
            array_keys($payload),
            'a key reaching the browser is a decision; add it here and say why it renders'
        );
    }

    /**
     * ========================================================================
     * THE [[DESTINATION]] IDS AN OPTIN BINDS NEVER REACH A VISITOR.
     * ========================================================================
     * They did. `destinations` was not on the old denylist and is stripped
     * nowhere else between `published_config` and the `<script>` tag —
     * verified by reading the whole path — so every published Optin with a
     * Destination bound shipped those ULIDs to every visitor of every matching
     * page. The loader has no field for them, so they were bytes with no
     * reader rather than a working leak; nothing made that true on purpose.
     *
     * Asserted against the **serialised** entry rather than against its keys,
     * because the question is whether the id reaches the page at all — a
     * nested copy under some future key would pass a key check and still be on
     * the page.
     *
     * The capture path re-reads the binding from the server's own published
     * copy and trusts the client for nothing but the values a person typed
     * (ADR 0004), so there is nothing this costs the browser.
     */
    public function testTheDestinationsAnOptinBindsNeverReachTheBrowser(): void
    {
        $config = self::everythingAnOptinCanHold();

        $this->assertContains(
            '01JQ0000000000000000000009',
            $config['destinations'],
            'the fixture has to carry a binding for this test to be about anything'
        );

        $entry = self::build([self::row(['published_config' => (string) json_encode($config)])])[0];

        $this->assertStringNotContainsString('01JQ0000000000000000000009', json_encode($entry) ?: '');
        $this->assertArrayNotHasKey('destinations', $entry['payload']);
    }

    /**
     * **A key nobody wrote down does not travel, whatever it is called.**
     *
     * The pinning test above names the keys that DO travel, which catches a
     * key added to `SHIPPED` without a reason. This catches the other
     * direction — the one the denylist could not catch at all — by inventing a
     * key no version of this projection has ever heard of and asserting it
     * stays on the server. That is the whole difference between the two
     * spellings, stated as a test rather than as a comment.
     */
    public function testAKeyTheProjectionHasNeverHeardOfStaysOnTheServer(): void
    {
        $set = self::build([self::row(['published_config' => (string) json_encode([
            'display_type' => 'popup',
            'a_key_from_a_ticket_that_has_not_been_written_yet' => 'merchant secret',
        ])])]);

        $this->assertArrayNotHasKey('a_key_from_a_ticket_that_has_not_been_written_yet', $set[0]['payload']);
        $this->assertStringNotContainsString('merchant secret', json_encode($set) ?: '');
    }

    public function testTheFlatRuleListIsPartitionedIntoTheTwoClientAxes(): void
    {
        $set = self::build([self::row(['published_config' => (string) json_encode([
            'display_type' => 'popup',
            'rules' => [
                ['type' => 'device', 'in' => ['desktop']],
                ['type' => 'time_on_page', 'seconds' => 10],
            ],
        ])])]);

        $this->assertSame([
            'display_type' => 'popup',
            'triggers' => [['type' => 'time_on_page', 'seconds' => 10]],
            'conditions' => [['type' => 'device', 'in' => ['desktop']]],
        ], $set[0]['payload']);
    }

    /**
     * The flat list is CONSUMED, not shipped alongside its own partition. Two
     * spellings of the same rules in one payload is a second source of truth
     * the loader would have to choose between, and bytes on every page view.
     */
    public function testTheFlatRuleListDoesNotTravelBesideItsPartition(): void
    {
        $set = self::build([self::row(['published_config' => (string) json_encode([
            'rules' => [['type' => 'page_load']],
        ])])]);

        $this->assertArrayNotHasKey('rules', $set[0]['payload']);
    }

    /**
     * An Optin with no rules at all still carries both keys. The loader reads
     * "no triggers" as "never fires" (ADR 0012's zero-trigger loss), and it can
     * only read that from a key that is present and empty.
     */
    public function testBothAxesArePresentEvenWhenTheOptinHasNoRules(): void
    {
        $set = self::build([self::row(['published_config' => '{"display_type":"popup"}'])]);

        $this->assertSame(['triggers' => [], 'conditions' => []], array_intersect_key(
            $set[0]['payload'],
            ['triggers' => null, 'conditions' => null]
        ));
    }

    /**
     * The partition OVERWRITES. `published_config` is a config blob, so it can
     * carry a `triggers` key of its own — hand-written, or left by an older
     * shape — and PHP's `+` would let that win and discard the real answer
     * silently. The manifest decides what the two axes hold.
     */
    public function testAConfigCarryingItsOwnAxisKeysDoesNotBeatThePartition(): void
    {
        $set = self::build([self::row(['published_config' => (string) json_encode([
            'triggers' => [['type' => 'page_load']],
            'conditions' => 'whatever this is',
            'rules' => [['type' => 'time_on_page', 'seconds' => 10]],
        ])])]);

        $this->assertSame([
            'triggers' => [['type' => 'time_on_page', 'seconds' => 10]],
            'conditions' => [],
        ], $set[0]['payload']);
    }

    /**
     * ========================================================================
     * A SCHEDULED OPTIN IS IN THE PUBLISHED SET BEFORE ITS WINDOW OPENS.
     * ========================================================================
     * This is the assertion that catches the naive implementation, and it is
     * the reason it is written down: excluding a not-yet-started Optin passes
     * every other test in this file and every unit test in the loader, and
     * then never shows the Optin at all. The set is rebuilt on WRITE and never
     * on a timer (ADR 0003), and a full-page cache can serve the same HTML for
     * days — so an Optin absent from the projection when its window opens is
     * absent from every cached page for as long as that cache lives.
     *
     * The Optin ships, and the browser decides.
     */
    public function testANotYetStartedOptinIsInThePublishedSet(): void
    {
        $set = self::build([self::row([
            'published_config' => '{"starts_at":"2099-01-01 09:00"}',
        ])]);

        $this->assertCount(1, $set);
        $this->assertSame('01JQ0000000000000000000001', $set[0]['id']);
    }

    /**
     * And the far end, for the same reason: a page cached while the window was
     * open still holds the payload, so the entry has to stay in it and carry
     * the fact that lets that stale page work out for itself that the window
     * is shut. It leaves when the merchant unpublishes.
     */
    public function testAnOptinWhoseWindowHasClosedIsStillInThePublishedSet(): void
    {
        $set = self::build([self::row([
            'published_config' => '{"starts_at":"2020-01-01 09:00","ends_at":"2020-01-08 09:00"}',
        ])]);

        $this->assertCount(1, $set);
    }

    /**
     * **The instant is resolved once, on the server.** What travels is a
     * number the loader compares against `Date.now()`; the wall time the
     * merchant authored stays on this side, because the visitor's clock is not
     * the site's clock and a schedule that means different things in different
     * browsers is not a schedule.
     */
    public function testTheAuthoredWallTimeIsResolvedToAnInstantAgainstTheSiteZone(): void
    {
        $set = self::build(
            [self::row(['published_config' => '{"starts_at":"2026-11-27 09:00","ends_at":"2026-11-30 23:59"}'])],
            new \DateTimeZone('Asia/Kolkata')
        );

        $this->assertSame(strtotime('2026-11-27T03:30:00+00:00') * 1000, $set[0]['payload']['starts_at']);
        $this->assertSame(strtotime('2026-11-30T18:29:00+00:00') * 1000, $set[0]['payload']['ends_at']);
        $this->assertStringNotContainsString('2026-11-27 09:00', json_encode($set) ?: '');
    }

    /**
     * **Changing the site timezone re-resolves the instant.** The wall time is
     * what is stored, so the answer is recomputed from it on every rebuild
     * rather than frozen at the moment somebody pressed Publish.
     */
    public function testChangingTheSiteZoneReResolvesTheInstantOnTheNextRebuild(): void
    {
        $row = self::row(['published_config' => '{"starts_at":"2026-11-27 09:00"}']);

        $before = self::build([$row], new \DateTimeZone('UTC'));
        $after = self::build([$row], new \DateTimeZone('America/New_York'));

        $this->assertSame(strtotime('2026-11-27T09:00:00+00:00') * 1000, $before[0]['payload']['starts_at']);
        $this->assertSame(strtotime('2026-11-27T14:00:00+00:00') * 1000, $after[0]['payload']['starts_at']);
    }

    /** An Optin with no schedule pays no bytes for one. */
    public function testAnUnscheduledOptinCarriesNeitherKey(): void
    {
        $set = self::build([self::row()]);

        $this->assertArrayNotHasKey('starts_at', $set[0]['payload']);
        $this->assertArrayNotHasKey('ends_at', $set[0]['payload']);
    }

    // =========================================================================
    // THE ARM TRIPLE — THE ONE PAYLOAD KEY COMPUTED ACROSS THE WHOLE SET.
    //
    // A [[Variant]] is a whole Optin (ADR 0045), so two published arms arrive
    // as two entries and nothing in the payload said they were arms of one
    // thing. These pin what closes that, and — just as loudly — that an
    // install running no test pays nothing for it.
    // =========================================================================

    /**
     * @return list<array<string, mixed>> A parent and one child, both published.
     */
    private static function twoArms(string $childDisplayType = 'popup'): array
    {
        return [
            self::row(),
            self::row([
                'id' => '01JQ0000000000000000000002',
                'parent_id' => '01JQ0000000000000000000001',
                'published_config' => '{"display_type":"' . $childDisplayType . '"}',
            ]),
        ];
    }

    public function testAnOptinWithNoArmsCarriesNoArmKeyAtAll(): void
    {
        $payload = self::build([self::row()])[0]['payload'];

        $this->assertArrayNotHasKey(
            PublishedProjection::ARM,
            $payload,
            'a group of one is not a test, and every install running none pays zero bytes'
        );
    }

    /**
     * The parent is arm 0 and the child is arm 1, because a ULID's leading
     * bits are the moment it was created — so the arms read A, B in the order
     * the merchant made them and a third arm never renumbers the first two.
     */
    public function testEachArmCarriesTheExperimentItsIndexAndHowManyArmsThereAre(): void
    {
        $set = self::build(self::twoArms());

        $this->assertSame(
            ['01JQ0000000000000000000001', 0, 2],
            $set[0]['payload'][PublishedProjection::ARM]
        );
        $this->assertSame(
            ['01JQ0000000000000000000001', 1, 2],
            $set[1]['payload'][PublishedProjection::ARM]
        );
    }

    /**
     * ========================================================================
     * THE COUNT IS OVER WHAT A VISITOR COULD MEET, NOT OVER WHAT EXISTS.
     * ========================================================================
     * An unpublished arm is not being served, so a browser must not be able to
     * draw it and sit looking at nothing. Two arms where one is a draft is not
     * a test at all, and the key goes away entirely.
     */
    public function testAnUnpublishedArmIsNotCounted(): void
    {
        $set = self::build([
            self::row(),
            self::row([
                'id' => '01JQ0000000000000000000002',
                'parent_id' => '01JQ0000000000000000000001',
                'published_at' => null,
            ]),
        ]);

        $this->assertCount(1, $set);
        $this->assertArrayNotHasKey(PublishedProjection::ARM, $set[0]['payload']);
    }

    /**
     * And the same read from the other end, which is what makes *declaring a
     * winner* need no `finished` flag anywhere: the loser is soft-deleted, the
     * parent is alone in its group on the rebuild that same write performs,
     * and the payload stops describing a test.
     */
    public function testSoftDeletingTheLosingArmEndsTheTestInThePayload(): void
    {
        $set = self::build([
            self::row(),
            self::row([
                'id' => '01JQ0000000000000000000002',
                'parent_id' => '01JQ0000000000000000000001',
                'deleted_at' => '2026-08-30 09:00:00',
            ]),
        ]);

        $this->assertCount(1, $set);
        $this->assertArrayNotHasKey(PublishedProjection::ARM, $set[0]['payload']);
    }

    /**
     * A child whose parent was unpublished is alone in a group named after a
     * row that is not in the set. It serves on its own, which is what
     * unpublishing the other arm means.
     */
    public function testAnArmWhoseParentIsGoneServesOnItsOwn(): void
    {
        $set = self::build([
            self::row(['published_at' => null]),
            self::row([
                'id' => '01JQ0000000000000000000002',
                'parent_id' => '01JQ0000000000000000000001',
            ]),
        ]);

        $this->assertCount(1, $set);
        $this->assertArrayNotHasKey(PublishedProjection::ARM, $set[0]['payload']);
    }

    /**
     * ========================================================================
     * WHERE AN `inline` ARM RENDERS, WHICH IS THE ONE CASE THAT IS NOT ITS OWN
     * ID.
     * ========================================================================
     * The merchant placed one block and it names the campaign. Without this,
     * half the traffic on an inline test meets nothing at all, silently.
     */
    public function testAnInlineArmRendersAtItsParentsAnchor(): void
    {
        $set = self::build(self::twoArms('inline'));

        $this->assertSame(
            '01JQ0000000000000000000001',
            $set[1]['payload'][PublishedProjection::ANCHOR]
        );
    }

    /**
     * The parent's anchor IS its own id, and an overlay never looks for one.
     * Both would be bytes on every matching page view saying nothing.
     */
    public function testNothingElseCarriesAnAnchor(): void
    {
        $set = self::build(self::twoArms('inline'));

        $this->assertArrayNotHasKey(PublishedProjection::ANCHOR, $set[0]['payload']);
        $this->assertArrayNotHasKey(PublishedProjection::ANCHOR, self::build(self::twoArms())[1]['payload']);
    }

}
