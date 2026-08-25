<?php

namespace WConvert\Tests\Unit\Retention;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Database\Connection;
use WConvert\Lead\LeadRepository;
use WConvert\Retention\LeadPruner;
use WConvert\Retention\RetentionPeriod;
use WConvert\Support\Ulid;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * The retention pruning job.
 *
 * **It is registered from day one and has nothing to do.** That is the whole
 * shape of the decision (ADR 0018): retention ships as keep-forever, so the
 * job exists, runs on schedule, finds no period configured, and returns —
 * rather than arriving later in a release that changes what a running site
 * does to a merchant's data.
 */
#[CoversClass(LeadPruner::class)]
final class LeadPrunerTest extends TestCase
{
    private FakeConnection $db;

    private RetentionPeriod $retention;

    private LeadPruner $pruner;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestSchedule'] = [];

        $this->db = new FakeConnection();
        $this->retention = new RetentionPeriod(new FakeOptionStore());
        $this->pruner = new LeadPruner(new LeadRepository($this->db), $this->retention);
    }

    /**
     * The seam #25 named, first half: **no period set is a no-op.**
     *
     * Not "a delete that matches nothing" — no statement at all. A prune with
     * no boundary has no honest `WHERE` clause to carry, and the shape of the
     * one it would reach for is `DELETE FROM wconvert_leads`.
     */
    public function testWithNoPeriodConfiguredItIssuesNoStatementAtAll(): void
    {
        $removed = $this->pruner->run();

        $this->assertSame(0, $removed);
        $this->assertSame([], $this->db->deletes);
        $this->assertSame([], $this->db->statements);
    }

    /**
     * The second half: **a period set is a range delete.**
     *
     * Over the primary key rather than over `created_at`, and they name the
     * same rows: a ULID's leading 48 bits are the minting time, stamped in the
     * same statement as `created_at`, which is why `ORDER BY id` already is
     * `ORDER BY created_at` everywhere else in this codebase. Only one of the
     * two is an index `wconvert_leads` already has — the other would have been
     * a third write per capture, bought for a job that runs once a day
     * (ADR 0002).
     */
    public function testAConfiguredPeriodIsARangeDeleteOverThePrimaryKey(): void
    {
        $this->retention->set(30);
        $this->db->removes = 12;

        $removed = $this->pruner->run();

        $this->assertSame(12, $removed);
        $this->assertCount(1, $this->db->deletes);
        $this->assertSame(Connection::TABLE_LEADS, $this->db->deletes[0]['table']);
        $this->assertSame('DELETE FROM %i WHERE id < %s', $this->db->deletes[0]['sql']);
    }

    /**
     * The boundary it deletes below is this moment less the configured period,
     * to the day.
     */
    public function testTheBoundaryIsTheConfiguredPeriodBackFromNow(): void
    {
        $this->retention->set(30);

        $before = (int) floor(microtime(true) * 1000);
        $this->pruner->run();
        $after = (int) floor(microtime(true) * 1000);

        $boundary = Ulid::timeOf((string) $this->db->deletes[0]['params'][0]);

        $this->assertNotNull($boundary);
        $this->assertGreaterThanOrEqual($before - (30 * 86400000), $boundary);
        $this->assertLessThanOrEqual($after - (30 * 86400000), $boundary);
    }

    /**
     * **The job is scheduled whether or not there is anything for it to do.**
     *
     * Scheduling it only once a period is configured would mean the first
     * merchant to set one waits for a job that has never existed, and would
     * put the registration behind a settings write — which is the one place
     * nobody looks when the prune turns out never to have run.
     */
    public function testTheJobIsScheduledFromDayOneWithNoPeriodConfigured(): void
    {
        $this->pruner->hooks();

        $this->assertNull($this->retention->days());
        $this->assertIsInt(wp_next_scheduled(LeadPruner::HOOK));
    }

    public function testASecondBootDoesNotScheduleItTwice(): void
    {
        $this->pruner->hooks();
        $first = wp_next_scheduled(LeadPruner::HOOK);

        $this->pruner->hooks();

        $this->assertSame($first, wp_next_scheduled(LeadPruner::HOOK));
    }

    /**
     * And the schedule actually runs the prune, rather than registering a hook
     * nothing listens on.
     */
    public function testTheScheduledHookRunsThePrune(): void
    {
        $this->retention->set(30);
        $this->db->removes = 3;

        $this->pruner->hooks();
        do_action(LeadPruner::HOOK);

        $this->assertCount(1, $this->db->deletes);
    }
}
