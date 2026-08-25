<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\Optin;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * The three writes that move an Optin between states, and the one derived
 * thing every one of them has to leave correct.
 */
#[CoversClass(OptinRepository::class)]
#[CoversClass(PublishedSet::class)]
final class OptinRepositoryTest extends TestCase
{
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
            RuleVocabulary::fromManifest(__DIR__ . '/../../..')
        );
    }

    /**
     * @param array<string, mixed> $config
     */
    private function anOptin(array $config = ['targeting' => ['include' => [['type' => 'post', 'value' => 12]]]]): Optin
    {
        return $this->repository->create('Spring sale', 'grow_email_list', $config);
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
}
