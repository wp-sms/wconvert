<?php

namespace WConvert\Queue;

defined('ABSPATH') || exit;

/**
 * The queue, as a seam.
 *
 * Behind it is **Action Scheduler, bundled in the FREE plugin** — a core
 * dependency, needed regardless of ESPs. That reverses the obvious reading of
 * the free/premium split, on evidence: WSMS's own `bin/build.sh` copies
 * `vendor/woocommerce/action-scheduler` into the *free* stage, and three free
 * features want a scheduler with no ESP in sight. Splitting it would force the
 * free tier to carry a WP-Cron fallback that runs on the great majority of
 * installs while the well-specified path runs on the minority (#4).
 *
 * It stays behind an interface for the reason every other WordPress
 * touchpoint here does: the unit suite has no Action Scheduler, and a class
 * that reaches a global function cannot be tested without one.
 *
 * **There is no `cancel()`, and that is not an omission.** Nothing in WConvert
 * is designed to depend on cancelling or looking up a queued push (#4).
 *
 * This used to give a second reason — *"Action Scheduler cannot be queried by
 * argument content"* — and **that stopped being true** (#31). AS 4.1 hashes
 * arguments into a queryable column: `ActionScheduler_DBStore::hash_args()`,
 * the `partial_args_matching` option and `as_has_scheduled_action()` all rest
 * on it. WSMS's own `ActionSchedulerQueue::cancel()` still returns `false`
 * with a "for now" comment, which is worth knowing and is not evidence either
 * way. The interface is unchanged, because the reason above never depended on
 * the stale one — but a justification that has expired is how a sound decision
 * gets reversed for the wrong reason later. The same claim is corrected in
 * ADR 0007 and ADR 0008, where the argument that DOES hold is retention: AS
 * prunes completed actions after 31 days, so it stores durable attempts and
 * never durable outcomes.
 *
 * @since 0.1.0
 */
interface Queue
{
    /**
     * Run this as soon as a worker can take it.
     *
     * @param array<string, scalar> $args Scalars only: they are stored as JSON in Action Scheduler's own tables.
     */
    public function dispatch(string $hook, array $args): void;

    /**
     * Run this no earlier than `$timestamp`.
     *
     * Used by retry backoff and by {@see \WConvert\Destination\BulkRePush}'s
     * stagger, which are the only two things in WConvert that are not
     * immediate.
     *
     * @param array<string, scalar> $args
     */
    public function schedule(int $timestamp, string $hook, array $args): void;
}
