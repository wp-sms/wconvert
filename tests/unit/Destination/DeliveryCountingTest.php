<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\ConnectionStore;
use WConvert\Destination\DeliveryFailures;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Destination\LeadMagnet\DeliveryCount;
use WConvert\Destination\LeadMagnet\LeadMagnetDestinationType;
use WConvert\Destination\PushJob;
use WConvert\Destination\PushResult;
use WConvert\Destination\PushWorker;
use WConvert\Destination\Wsms\WsmsDestinationType;
use WConvert\Lead\LeadRepository;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\StatKind;
use WConvert\Stats\StatsRepository;
use WConvert\Support\Ulid;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeDestinationType;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeQueue;
use WConvert\Tests\Unit\Support\FakeSitePresence;

/**
 * **Exactly one `lead_magnet_delivered` per [[Lead]], and only where it means
 * something.**
 *
 * ============================================================================
 * EXACTLY-ONCE IS THE SHAPE OF THE JOB CHAIN, NOT A STORED FLAG.
 * ============================================================================
 * "Once per Lead on first success" reads like it needs a per-Lead marker, and
 * `wconvert_leads` has no column for one — it has no lifecycle at all, which is
 * what ADR 0002 exists to protect. It does not need one:
 * {@see PushWorker::record()} re-queues **only** on a retryable failure and
 * stops at `PushOutcome::Success`, so a chain reaches Success at most once.
 *
 * That is why the second test below is named for what is actually true. The
 * literal claim — "a retry after a success writes none" — would be tested by
 * re-running a job with identical arguments, and under this design that WOULD
 * write a second row. Writing the test that way and watching it fail would be
 * right; writing it and asserting the false thing would be worse than not
 * having it. What holds is that nothing puts the job back, so nothing replays
 * it. The two seams that can — bulk re-push, and Action Scheduler resetting a
 * stuck action — are accepted, recorded in ADR 0008, and clamped by the
 * dashboard.
 *
 * ============================================================================
 * BOTH SCOPES, BECAUSE ONE OF THEM IS EASY TO MISS.
 * ============================================================================
 * By [[Goal]] is the acceptance criterion and sounds complete on its own. It is
 * not: a merchant can bind the WSMS push *and* the delivery email to one
 * lead-magnet Optin, which is an entirely ordinary configuration, and counting
 * the WSMS success as a delivery would report two deliveries per Conversion and
 * a negative failure count on the card.
 */
#[CoversClass(DeliveryCount::class)]
#[CoversClass(PushWorker::class)]
final class DeliveryCountingTest extends TestCase
{
    private const OPTIN = '01OPTIN';

    private FakeOptionStore $options;

    private FakeConnection $db;

    private FakeQueue $queue;

    private DestinationStore $destinations;

    private string $leadId;

    protected function setUp(): void
    {
        $this->options = new FakeOptionStore();
        $this->db = new FakeConnection();
        $this->queue = new FakeQueue();
        $this->destinations = new DestinationStore($this->options);

        $this->leadId = Ulid::generate();
        $this->db->rows[$this->leadId] = [
            'id' => $this->leadId,
            'optin_id' => self::OPTIN,
            'email' => 'sarah@example.com',
            'phone' => null,
            'fields' => (string) json_encode(['answers' => ['name' => 'Sarah'], 'capture' => ['submissions' => ['primary' => ['values' => ['name' => 'Sarah', 'email' => 'sarah@example.com']]]]]),
            'created_at' => '2026-08-25 10:00:00',
        ];
    }

    /**
     * The Optin row the Goal is read from.
     *
     * `FakeConnection` answers a single-row read from {@see FakeConnection::$rows}
     * by the first bound parameter, which is the id — the same way the Lead above
     * is found.
     */
    private function optinHolds(string $goal): void
    {
        $this->db->rows[self::OPTIN] = ['id' => self::OPTIN, 'name' => 'Guide download', 'goal' => $goal];
    }

    /**
     * A worker over one type, answering whatever the test told it to.
     *
     * The type's ID is what the Destination is stored under, so the type-scoping
     * rule is exercised through the real registry rather than by calling
     * {@see DeliveryCount} directly.
     */
    private function push(string $typeId, PushResult ...$answers): void
    {
        $type = new FakeDestinationType($typeId);
        $type->answers = $answers === [] ? [PushResult::success('ref')] : array_values($answers);

        $registry = (new DestinationRegistry(new FakeProPresence(), new FakeSitePresence()))->register($type);

        $optins = new OptinRepository(
            $this->db,
            new PublishedSet($this->options),
            RuleVocabulary::fromManifest(dirname(__DIR__, 3)),
            new MilestoneStore($this->options)
        );

        $worker = new PushWorker(
            $registry,
            $this->destinations,
            new ConnectionStore($this->options),
            new LeadRepository($this->db),
            $optins,
            new HealthStore($this->options),
            new DeliveryFailures($this->options),
            $this->queue,
            new DeliveryCount($optins, new StatsRepository($this->db))
        );

        $destinationId = $this->destinations->save(null, $typeId, 'Bound', null, [])->id;

        foreach ($type->answers as $attempt => $ignored) {
            unset($ignored);

            $worker->run((new PushJob($this->leadId, $destinationId, $attempt + 1))->toArgs());
        }
    }

    /**
     * Every `lead_magnet_delivered` upsert this run issued.
     *
     * Read off {@see FakeConnection::$upserts} rather than off a modelled row
     * count, because that fake deliberately does NOT apply an upsert to its
     * rows: the statement's whole claim is that the DATABASE resolves the
     * collision, and a fake that added the increments up itself would make the
     * test agree with the fake rather than with MySQL. `bin/verify-stats.php` is
     * where the counting is proven.
     *
     * @return list<array{table: string, sql: string, params: list<mixed>}>
     */
    private function deliveryUpserts(): array
    {
        return array_values(array_filter(
            $this->db->upserts,
            static fn (array $upsert): bool => in_array(
                StatKind::LeadMagnetDelivered->value,
                $upsert['params'],
                true
            )
        ));
    }

    public function testASuccessfulDeliveryCountsOne(): void
    {
        $this->optinHolds('deliver_lead_magnet');

        $this->push(LeadMagnetDestinationType::ID);

        $this->assertCount(1, $this->deliveryUpserts());
        $this->assertContains(self::OPTIN, $this->deliveryUpserts()[0]['params']);
    }

    /**
     * **A retry after a failure writes one, not two.** The first attempt is an
     * outage and goes back on the queue; the second lands. Only the landing is
     * a delivery.
     */
    public function testARetryAfterAFailureWritesOneDeliveryRatherThanTwo(): void
    {
        $this->optinHolds('deliver_lead_magnet');

        $this->push(
            LeadMagnetDestinationType::ID,
            PushResult::retryable('The site’s mail transport refused the message.'),
            PushResult::success()
        );

        $this->assertCount(1, $this->deliveryUpserts());
    }

    /**
     * **A success never reschedules, so the queue cannot replay it.**
     *
     * This is the honest half of "a retry after a success writes none" — see
     * the class docblock. Exactly-once is a property of the chain stopping, so
     * what a test can assert is that it stopped.
     */
    public function testASuccessLeavesNothingOnTheQueueToReplay(): void
    {
        $this->optinHolds('deliver_lead_magnet');

        $this->push(LeadMagnetDestinationType::ID);

        $this->assertSame([], $this->queue->jobs);
    }

    /**
     * A failed delivery is not a delivery. The retry goes back on the queue and
     * no count is written for the attempt.
     */
    public function testAFailedDeliveryCountsNothing(): void
    {
        $this->optinHolds('deliver_lead_magnet');

        $this->push(LeadMagnetDestinationType::ID, PushResult::retryable('down'));

        $this->assertSame([], $this->deliveryUpserts());
        $this->assertNotSame([], $this->queue->jobs, 'a retryable failure goes back on the queue');
    }

    /**
     * **Goal scoping.** A delivery Destination bound to an Optin whose Goal is
     * not measured in deliveries writes nothing — there is no card that would
     * read the row.
     */
    public function testADeliveryOnAnOptinWithAnotherGoalCountsNothing(): void
    {
        $this->optinHolds('grow_email_list');

        $this->push(LeadMagnetDestinationType::ID);

        $this->assertSame([], $this->deliveryUpserts());
    }

    /**
     * **Type scoping — the trap.** The same lead-magnet Optin, pushed to WSMS.
     * A merchant binding both to one Optin is ordinary, and counting this would
     * double the number on the card and drive the failure count negative.
     */
    public function testAWsmsSuccessOnALeadMagnetOptinCountsNothing(): void
    {
        $this->optinHolds('deliver_lead_magnet');

        $this->push(WsmsDestinationType::ID);

        $this->assertSame([], $this->deliveryUpserts());
    }

    /**
     * An Optin whose row cannot be read — or whose `goal` column holds
     * something this build cannot interpret — counts nothing rather than
     * guessing. {@see \WConvert\Goal\Goal::tryFrom()} is the one place the
     * closed set is enforced over a `VARCHAR` (ADR 0019).
     */
    public function testAnUninterpretableGoalCountsNothing(): void
    {
        $this->optinHolds('goal_from_a_later_version');

        $this->push(LeadMagnetDestinationType::ID);

        $this->assertSame([], $this->deliveryUpserts());
    }
}
