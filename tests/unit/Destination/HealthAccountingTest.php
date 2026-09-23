<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\ConnectionStore;
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

/**
 * **Health accounting — the distinction the whole delivery-state design rests
 * on, and the one that inverts under a naive implementation.**
 *
 * A terminal per-[[Lead]] failure is not an outage. A malformed address does
 * not mean the vendor is down, so `consecutive_failures` must stay at zero and
 * the Lead must land in the bounded ring instead. Counting every failure the
 * same way — which is what any implementation does if nobody writes this test
 * — turns a hundred bad addresses into a hundred consecutive outages
 * (ADR 0008).
 */
final class HealthAccountingTest extends TestCase
{
    private FakeOptionStore $options;

    private FakeConnection $db;

    private FakeQueue $queue;

    private FakeDestinationType $type;

    private DestinationStore $destinations;

    private HealthStore $health;

    private DeliveryFailures $failures;

    private string $leadId;

    private string $destinationId;

    protected function setUp(): void
    {
        $this->options = new FakeOptionStore();
        $this->db = new FakeConnection();
        $this->queue = new FakeQueue();
        $this->type = new FakeDestinationType();

        $this->destinations = new DestinationStore($this->options);
        $this->health = new HealthStore($this->options);
        $this->failures = new DeliveryFailures($this->options);

        $this->leadId = Ulid::generate();
        $this->db->rows[$this->leadId] = [
            'id' => $this->leadId,
            'optin_id' => '01OPTIN',
            'email' => 'sarah@example.com',
            'phone' => null,
            'fields' => (string) json_encode(['answers' => ['name' => 'Sarah'], 'capture' => ['submissions' => ['primary' => ['values' => ['name' => 'Sarah', 'email' => 'sarah@example.com']]]]]),
            'created_at' => '2026-08-25 10:00:00',
        ];

        $this->destinationId = $this->destinations->save(null, 'fake', 'Fake', null, [])->id;
    }

    private function worker(): PushWorker
    {
        $registry = (new DestinationRegistry(new FakeProPresence(), new FakeSitePresence()))
            ->register($this->type);

        $optins = new OptinRepository(
            $this->db,
            new PublishedSet($this->options),
            RuleVocabulary::fromManifest(dirname(__DIR__, 3)),
            new MilestoneStore($this->options)
        );

        return new PushWorker(
            $registry,
            $this->destinations,
            new ConnectionStore($this->options),
            new LeadRepository($this->db),
            $optins,
            $this->health,
            $this->failures,
            $this->queue,
            // Real, over the same fakes. The counting rules are proven in
            // {@see DeliveryCountingTest}; what this file needs is a collaborator
            // that behaves rather than one that records.
            new DeliveryCount($optins, new StatsRepository($this->db))
        );
    }

    private function push(int $attempt = 1): void
    {
        $this->worker()->run((new PushJob($this->leadId, $this->destinationId, $attempt))->toArgs());
    }

    /**
     * A terminal per-Lead failure is **invisible to health** and lands in the
     * ring.
     */
    public function testATerminalFailureLeavesTheFailureCountAtZero(): void
    {
        $this->type->answers = [PushResult::terminal('That address does not exist.')];

        $this->push();

        self::assertSame(0, $this->health->of($this->destinationId)->consecutiveFailures);
        self::assertNull($this->health->of($this->destinationId)->lastError);

        $ring = $this->failures->all();
        self::assertCount(1, $ring);
        self::assertSame($this->leadId, $ring[0]['lead']);
        self::assertSame($this->destinationId, $ring[0]['destination']);
        self::assertSame('That address does not exist.', $ring[0]['error']);

        self::assertSame([], $this->queue->jobs, 'A terminal failure is never retried.');
    }

    public function testStoredFailureKeepsTheReasonWithoutCopyingLeadValues(): void
    {
        $this->type->answers = [PushResult::terminal('Provider rejected sarah@example.com for Sarah: invalid subscriber.')];

        $this->push();

        $error = $this->failures->all()[0]['error'];
        self::assertSame('Provider rejected [email] for [personal data]: invalid subscriber.', $error);
        self::assertStringNotContainsString('sarah@example.com', $error);
        self::assertStringNotContainsString('Sarah', $error);
    }

    /**
     * A real outage **does** move health, and goes back on the queue.
     */
    public function testARetryableFailureCountsAsAnOutageAndIsRescheduled(): void
    {
        $this->type->answers = [PushResult::retryable('Gateway timeout')];

        $this->push();

        $health = $this->health->of($this->destinationId);
        self::assertSame(1, $health->consecutiveFailures);
        self::assertSame('Gateway timeout', $health->lastError);
        self::assertNotNull($health->lastErrorAt);

        self::assertSame([], $this->failures->all(), 'It has not failed terminally yet.');

        self::assertCount(1, $this->queue->jobs);
        self::assertSame(PushJob::HOOK, $this->queue->jobs[0]['hook']);
        self::assertSame(2, $this->queue->jobs[0]['args']['attempt']);
        self::assertNotNull($this->queue->jobs[0]['at'], 'Retries are scheduled, not immediate.');
    }

    /**
     * Retries exhausted is the OTHER route into the ring: the failure was
     * retryable every time and is terminal now.
     */
    public function testAnExhaustedRetryLandsInTheRing(): void
    {
        $this->type->answers = [PushResult::retryable('Gateway timeout')];

        $this->push(PushJob::MAX_ATTEMPTS);

        self::assertCount(1, $this->failures->all());
        self::assertSame([], $this->queue->jobs, 'There is nothing left to retry.');
        self::assertSame(1, $this->health->of($this->destinationId)->consecutiveFailures);
    }

    /**
     * A landing clears the count — which is what makes `consecutiveFailures`
     * an outage signal rather than a lifetime total.
     */
    public function testASuccessClearsTheFailureCountAndStampsTheSuccess(): void
    {
        $this->type->answers = [PushResult::retryable('Gateway timeout')];
        $this->push();
        $this->push(2);

        self::assertSame(2, $this->health->of($this->destinationId)->consecutiveFailures);

        $this->type->answers = [PushResult::success('contact-1')];
        $this->push(3);

        $health = $this->health->of($this->destinationId);
        self::assertSame(0, $health->consecutiveFailures);
        self::assertNull($health->lastError);
        self::assertNotNull($health->lastSuccessAt);
    }

    /**
     * A skip is not a failure and not a success. It touches nothing — which is
     * what keeps a [[Lead]] with no email hitting an email-only Destination
     * out of an outage warning (ADR 0008).
     */
    public function testASkipTouchesNeitherHealthNorTheRing(): void
    {
        $this->type->answers = [PushResult::skipped('No email on this Lead.')];

        $this->push();

        self::assertSame(0, $this->health->of($this->destinationId)->consecutiveFailures);
        self::assertNull($this->health->of($this->destinationId)->lastSuccessAt);
        self::assertSame([], $this->failures->all());
        self::assertSame([], $this->queue->jobs);
    }

    /**
     * A Lead erased or pruned between capture and job is a Lead that must not
     * be pushed — and its absence is not a delivery failure, so nothing is
     * recorded about it (ADR 0018).
     */
    public function testAnErasedLeadIsNotAFailure(): void
    {
        unset($this->db->rows[$this->leadId]);

        $this->push();

        self::assertSame(0, $this->health->of($this->destinationId)->consecutiveFailures);
        self::assertSame([], $this->failures->all());
        self::assertSame([], $this->type->pushed);
    }
}
