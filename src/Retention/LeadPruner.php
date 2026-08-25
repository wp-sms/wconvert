<?php

namespace WConvert\Retention;

use WConvert\Lead\LeadRepository;

defined('ABSPATH') || exit;

/**
 * The retention pruning job.
 *
 * **It exists from day one and has nothing to do** (ADR 0018). Retention ships
 * as keep-forever, so this runs on schedule, finds no period configured, and
 * returns — rather than arriving later in a release that changes what a
 * running site does to a merchant's data. A merchant who sets a period gets a
 * job that has been running all along.
 *
 * ## Why WP-Cron and not Action Scheduler
 *
 * ADR 0018 wrote this as "the Action Scheduler job bundled by ADR 0007", and
 * ADR 0007 bundles no such thing — WConvert has no runtime Composer dependency
 * at all, and the Destinations that will need Action Scheduler's per-item
 * durability arrive with #30. The premise is corrected inline in ADR 0018.
 *
 * The correction is not a downgrade. Action Scheduler earns its place where
 * there are many jobs, each retryable, each carrying an outcome worth
 * recovering — a push per (Lead × Destination). This is **one site-wide job
 * running one statement**. It has no per-item grain to retry, and a run it
 * misses is made up by the next one, because the boundary is computed from the
 * moment the job runs rather than from the moment it was scheduled. Reaching
 * for a queue would be reaching for durability that a `DELETE` over a range
 * does not need.
 *
 * @since 0.1.0
 */
final class LeadPruner
{
    /** @since 0.1.0 */
    public const HOOK = 'wconvert_prune_leads';

    public function __construct(
        private readonly LeadRepository $leads,
        private readonly RetentionPeriod $retention,
    ) {
    }

    public function hooks(): void
    {
        // Wrapped rather than passed directly: `run()` returns the number it
        // removed, which is what a caller wants and what a WordPress action
        // callback must not have. The count goes nowhere here because there is
        // nowhere for it to go — Destination health, which is where a job's
        // outcome will eventually be readable, arrives with #30 (ADR 0008).
        add_action(self::HOOK, function (): void {
            $this->run();
        });

        // Scheduled whether or not a period is configured. Registering it on
        // the settings write instead would mean the first merchant to set a
        // period waits for a job that has never existed — and would put the
        // registration in the one place nobody looks when the prune turns out
        // never to have run.
        if (wp_next_scheduled(self::HOOK) === false) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', self::HOOK);
        }
    }

    /**
     * @return int Leads removed.
     */
    public function run(): int
    {
        $boundary = $this->retention->boundary((int) floor(microtime(true) * 1000));

        // **No period, no statement.** Not a delete that matches nothing: a
        // prune with no boundary has no honest `WHERE` clause to carry, and
        // the shape of the one it would reach for is `DELETE FROM
        // wconvert_leads`.
        if ($boundary === null) {
            return 0;
        }

        return $this->leads->pruneBefore($boundary);
    }
}
