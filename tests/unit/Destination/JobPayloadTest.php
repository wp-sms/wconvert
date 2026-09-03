<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\ConnectionStore;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Destination\PushDispatcher;
use WConvert\Destination\PushJob;
use WConvert\Lead\Lead;
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
 * **An architectural test: no [[Lead]] data ever reaches a queued job's
 * arguments.**
 *
 * The harm is not hypothetical and it is not about this plugin's own tables.
 * Job arguments live in `actionscheduler_actions` for Action Scheduler's whole
 * retention period, which **outlives any retention policy WConvert sets for
 * itself** — so an email in a job argument is an email that survives both the
 * retention prune and an honoured erasure request, sitting in another plugin's
 * table where nothing in WConvert will ever look for it (ADR 0008, ADR 0018).
 *
 * It is asserted two ways on purpose. The behavioural half dispatches a Lead
 * stuffed with personal data and reads what was queued; the structural half
 * reads {@see PushJob}'s own shape, so a field added to the job fails here even
 * if no test happens to dispatch a Lead carrying one.
 */
final class JobPayloadTest extends TestCase
{
    private const EMAIL = 'sarah.mcallister@example.com';

    private const PHONE = '+447911123456';

    private const NAME = 'Sarah McAllister';

    private const CONSENT = 'Yes, email me about new guides.';

    private FakeQueue $queue;

    private FakeConnection $db;

    private FakeOptionStore $options;

    private string $optinId;

    private string $destinationId;

    protected function setUp(): void
    {
        $this->queue = new FakeQueue();
        $this->db = new FakeConnection();
        $this->options = new FakeOptionStore();

        $this->optinId = Ulid::generate();
        $this->destinationId = (new DestinationStore($this->options))
            ->save(null, 'fake', 'Fake', null, [])->id;

        $this->db->rows[$this->optinId] = [
            'id' => $this->optinId,
            'name' => 'Guide download',
            'goal' => 'grow_list',
            'config' => '{}',
            'published_config' => (string) json_encode(['destinations' => [$this->destinationId]]),
            'published_at' => '2026-08-25 09:00:00',
            'deleted_at' => null,
        ];
    }

    private function dispatch(): void
    {
        $registry = (new DestinationRegistry(new FakeProPresence(), new FakeSitePresence()))
            ->register(new FakeDestinationType());

        (new PushDispatcher(
            $registry,
            new DestinationStore($this->options),
            new OptinRepository($this->db, new PublishedSet($this->options), RuleVocabulary::fromManifest(dirname(__DIR__, 3))),
            new HealthStore($this->options),
            $this->queue,
            new ConnectionStore($this->options)
        ))->dispatch(new Lead(
            Ulid::generate(),
            $this->optinId,
            self::EMAIL,
            self::PHONE,
            ['name' => self::NAME, 'consent_text' => self::CONSENT],
            '2026-08-25 10:00:00'
        ));
    }

    public function testAQueuedJobCarriesTwoIdsAndAnAttemptAndNothingElse(): void
    {
        $this->dispatch();

        self::assertCount(1, $this->queue->jobs);
        self::assertSame(PushJob::HOOK, $this->queue->jobs[0]['hook']);
        self::assertSame(['lead', 'destination', 'attempt'], array_keys($this->queue->jobs[0]['args']));
        self::assertSame($this->destinationId, $this->queue->jobs[0]['args']['destination']);
        self::assertNull($this->queue->jobs[0]['at'], 'A capture dispatches immediately.');
    }

    public function testNoCapturedValueAppearsAnywhereInAQueuedJob(): void
    {
        $this->dispatch();

        $serialised = (string) json_encode($this->queue->jobs);

        foreach ([self::EMAIL, self::PHONE, self::NAME, self::CONSENT, 'sarah'] as $personal) {
            self::assertStringNotContainsStringIgnoringCase(
                $personal,
                $serialised,
                'Personal data in a job argument outlives every retention policy WConvert has.'
            );
        }
    }

    /**
     * The structural half. A property added to the job — a convenience email
     * "just for logging" — fails here without anyone having to think to
     * dispatch a Lead carrying one.
     */
    public function testTheJobItselfHasNoRoomForLeadData(): void
    {
        $properties = array_map(
            static fn (\ReflectionProperty $property): string => $property->getName(),
            (new \ReflectionClass(PushJob::class))->getProperties()
        );

        sort($properties);

        self::assertSame(['attempt', 'destinationId', 'leadId'], $properties);
    }
}
