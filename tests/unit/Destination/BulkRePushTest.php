<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\BulkRePush;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Destination\PushJob;
use WConvert\Lead\LeadRepository;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Support\Ulid;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeDestinationType;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeQueue;
use WConvert\Tests\Unit\Support\FakeSitePresence;

/**
 * **Bulk re-push: the whole of operational recovery, and the reason there is
 * no `wconvert_lead_deliveries` table.**
 *
 * The support case it answers is concrete — an expired API key silently
 * dropping three days of leads — and the answer is "re-push every Lead for
 * Optins bound to this Destination since `last_success_at`". It is only
 * affordable because `push()` is idempotent: without that, replaying a window
 * would duplicate every Lead that *did* land inside it (ADR 0008).
 */
final class BulkRePushTest extends TestCase
{
    private FakeOptionStore $options;

    private FakeConnection $db;

    private FakeQueue $queue;

    private string $bound;

    private string $unbound;

    private string $destinationId;

    protected function setUp(): void
    {
        $this->options = new FakeOptionStore();
        $this->db = new FakeConnection();
        $this->queue = new FakeQueue();

        $this->destinationId = (new DestinationStore($this->options))
            ->save(null, 'fake', 'Fake', null, [])->id;

        $this->bound = Ulid::generate();
        $this->unbound = Ulid::generate();

        $this->db->rows[$this->bound] = [
            'id' => $this->bound,
            'published_config' => (string) json_encode(['destinations' => [$this->destinationId]]),
        ];
        $this->db->rows[$this->unbound] = [
            'id' => $this->unbound,
            'published_config' => (string) json_encode(['destinations' => [Ulid::generate()]]),
        ];
    }

    /**
     * @param list<string> $leadIds
     */
    private function replay(array $leadIds): \WConvert\Destination\RePushReport
    {
        // One page of Leads for the one bound Optin, short of a full page, so
        // the keyset walk stops after it.
        $this->db->answers = [
            [['id' => $this->bound, 'published_config' => $this->db->rows[$this->bound]['published_config']],
             ['id' => $this->unbound, 'published_config' => $this->db->rows[$this->unbound]['published_config']]],
            array_map(fn (string $id): array => [
                'id' => $id,
                'optin_id' => 'x',
                'email' => 'sarah@example.com',
                'phone' => null,
                'fields' => (string) json_encode(['answers' => [], 'capture' => ['submissions' => ['primary' => ['destination_ids' => [$this->destinationId], 'values' => ['email' => 'sarah@example.com']]]]]),
                'created_at' => '2026-08-25 10:00:00',
            ], $leadIds),
        ];

        $registry = (new DestinationRegistry(new FakeProPresence(), new FakeSitePresence()))
            ->register(new FakeDestinationType());

        return (new BulkRePush(
            $registry,
            new DestinationStore($this->options),
            new OptinRepository($this->db, new PublishedSet($this->options), RuleVocabulary::fromManifest(dirname(__DIR__, 3)), new MilestoneStore($this->options)),
            new LeadRepository($this->db),
            new HealthStore($this->options),
            $this->queue
        ))->run($this->destinationId);
    }

    public function testItReplaysOnlyTheOptinsBoundToThisDestination(): void
    {
        $report = $this->replay([Ulid::generate(), Ulid::generate()]);

        self::assertSame(2, $report->jobs);
        self::assertCount(2, $this->queue->jobs);

        // The keyset read named the bound Optin and nothing else.
        $optinReads = array_values(array_filter(
            $this->db->reads,
            static fn (array $read): bool => str_contains($read['sql'], 'wconvert_leads') || str_contains($read['sql'], 'optin_id')
        ));

        self::assertNotSame([], $optinReads);
        foreach ($optinReads as $read) {
            self::assertContains($this->bound, $read['params']);
            self::assertNotContains($this->unbound, $read['params']);
        }
    }

    /**
     * **The replay window opens at `last_success_at`**, expressed as a range
     * over the PRIMARY KEY: a ULID's leading 48 bits are the minting time, so
     * `id > floorAt(cutoff)` names the same rows `created_at > cutoff` would
     * and costs no index `wconvert_leads` does not already have (ADR 0033).
     */
    public function testTheWindowOpensAtTheLastSuccess(): void
    {
        (new HealthStore($this->options))->landed($this->destinationId, '2026-08-20 12:00:00');

        $this->replay([Ulid::generate()]);

        $leadRead = null;

        foreach ($this->db->reads as $read) {
            if (str_contains($read['sql'], 'id > %s')) {
                $leadRead = $read;
            }
        }

        self::assertNotNull($leadRead, 'The replay is a keyset walk from a boundary.');

        $boundary = Ulid::floorAt((int) (strtotime('2026-08-20 12:00:00 UTC') - \WConvert\Lead\CaptureGrant::LIFETIME) * 1000);
        self::assertContains($boundary, $leadRead['params']);
    }

    /**
     * **Staggered against the type's declared throughput** — which is what
     * replaces a rate limiter class in v1. Organic capture cannot approach any
     * vendor's limit; only this can (ADR 0008).
     */
    public function testItStaggersAgainstTheTypesDeclaredThroughput(): void
    {
        // FakeDestinationType declares 30 jobs a minute.
        $report = $this->replay(array_map(static fn (): string => Ulid::generate(), range(1, 31)));

        self::assertSame(31, $report->jobs);

        $first = $this->queue->jobs[0]['at'];
        $thirtyFirst = $this->queue->jobs[30]['at'];

        self::assertNotNull($first);
        self::assertNotNull($thirtyFirst);
        self::assertSame(60, $thirtyFirst - $first, 'The 31st job waits a minute behind the first thirty.');
        self::assertSame(PushJob::HOOK, $this->queue->jobs[0]['hook']);
        self::assertSame(1, $this->queue->jobs[0]['args']['attempt']);
    }
}
