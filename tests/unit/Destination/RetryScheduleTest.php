<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\ConnectionStore;
use WConvert\Destination\DeclaresRetrySchedule;
use WConvert\Destination\DeliveryFailures;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Destination\LeadMagnet\DeliveryCount;
use WConvert\Destination\PushJob;
use WConvert\Destination\PushResult;
use WConvert\Destination\PushWorker;
use WConvert\Lead\LeadRepository;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\StatsRepository;
use WConvert\Support\Ulid;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeDestinationType;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeQueue;
use WConvert\Tests\Unit\Support\FakeSitePresence;

/** A type that declares its own retry delays is retried on them; every other type keeps five doubling attempts. */
final class RetryScheduleTest extends TestCase
{
    private FakeOptionStore $options;
    private FakeConnection $db;
    private FakeQueue $queue;
    private DestinationStore $destinations;
    private DeliveryFailures $failures;
    private string $leadId;

    protected function setUp(): void
    {
        $this->options = new FakeOptionStore();
        $this->db = new FakeConnection();
        $this->queue = new FakeQueue();
        $this->destinations = new DestinationStore($this->options);
        $this->failures = new DeliveryFailures($this->options);
        $this->leadId = Ulid::generate();
        $this->db->rows[$this->leadId] = ['id' => $this->leadId, 'optin_id' => '01OPTIN', 'email' => 'sarah@example.com', 'phone' => null,
            'fields' => (string) json_encode(['answers' => [], 'capture' => ['submissions' => ['primary' => ['values' => ['email' => 'sarah@example.com']]]]]),
            'created_at' => '2026-08-25 10:00:00'];
    }

    private function run_(FakeDestinationType $type, int $attempt): void
    {
        $type->answers = [PushResult::retryable('Gateway timeout')];
        $destinationId = $this->destinations->save(null, $type->id(), 'Route', null, [])->id;
        $optins = new OptinRepository($this->db, new PublishedSet($this->options), RuleVocabulary::fromManifest(dirname(__DIR__, 3)), new MilestoneStore($this->options));
        $worker = new PushWorker((new DestinationRegistry(new FakeProPresence(), new FakeSitePresence()))->register($type),
            $this->destinations, new ConnectionStore($this->options), new LeadRepository($this->db), $optins,
            new HealthStore($this->options), $this->failures, $this->queue, new DeliveryCount($optins, new StatsRepository($this->db)));
        $worker->run((new PushJob($this->leadId, $destinationId, $attempt))->toArgs());
    }

    private static function scheduled(): FakeDestinationType
    {
        return new class ('scheduled') extends FakeDestinationType implements DeclaresRetrySchedule {
            public function retryDelays(): array { return [60, 300, 1800, 7200, 21600, 86400]; }
        };
    }

    public function testADeclaredScheduleSetsEachDelay(): void
    {
        foreach ([1 => 60, 2 => 300, 3 => 1800, 4 => 7200, 5 => 21600, 6 => 86400] as $attempt => $delay) {
            $this->queue->jobs = [];
            $before = time();
            $this->run_(self::scheduled(), $attempt);
            self::assertCount(1, $this->queue->jobs, "Attempt {$attempt} is retried.");
            self::assertSame($attempt + 1, $this->queue->jobs[0]['args']['attempt']);
            self::assertGreaterThanOrEqual($before + $delay, $this->queue->jobs[0]['at']);
            self::assertLessThanOrEqual(time() + $delay, $this->queue->jobs[0]['at']);
        }
        self::assertSame([], $this->failures->all());
    }

    public function testADeclaredScheduleEndsAfterItsLastDelay(): void
    {
        $this->run_(self::scheduled(), 7);
        self::assertSame([], $this->queue->jobs, 'Seven attempts, then it needs attention.');
        self::assertCount(1, $this->failures->all());
    }

    public function testATypeWithoutAScheduleKeepsFiveDoublingAttempts(): void
    {
        $before = time();
        $this->run_(new FakeDestinationType(), 4);
        self::assertGreaterThanOrEqual($before + 480, $this->queue->jobs[0]['at'], 'Attempt 4 waits eight minutes.');
        self::assertLessThanOrEqual(time() + 480, $this->queue->jobs[0]['at']);
        $this->queue->jobs = [];
        $this->run_(new FakeDestinationType(), 5);
        self::assertSame([], $this->queue->jobs);
    }
}
