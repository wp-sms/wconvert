<?php

namespace WConvert\Queue;

defined('ABSPATH') || exit;

/**
 * {@see Queue} over Action Scheduler.
 *
 * One group, so a merchant looking at Tools → Scheduled Actions can see
 * WConvert's work as WConvert's.
 *
 * **`$unique` stays false.** Uniqueness in Action Scheduler is per (hook,
 * args), and two captures by the same person into the same Optin are two
 * Leads with two ids, so the args differ and there is nothing to collapse.
 * Turning it on would only cost a lookup per dispatch to answer no.
 *
 * The bundled copy is deliberately **not php-scoped**: Action Scheduler
 * version-negotiates at boot so the newest copy on the site wins, and that is
 * the intended pattern rather than an accident of packaging. Our copy may end
 * up running WooCommerce's and WSMS's jobs, and theirs may end up running
 * ours. The cost is that AS releases have to be tracked rather than pinned and
 * forgotten (#4).
 *
 * @since 0.1.0
 */
final class ActionSchedulerQueue implements Queue
{
    public const GROUP = 'wconvert';

    /**
     * @param array<string, scalar> $args
     */
    public function dispatch(string $hook, array $args): void
    {
        $this->assertEnqueued(as_enqueue_async_action($hook, [$args], self::GROUP));
    }

    /**
     * @param array<string, scalar> $args
     */
    public function schedule(int $timestamp, string $hook, array $args): void
    {
        $this->assertEnqueued(as_schedule_single_action($timestamp, $hook, [$args], self::GROUP));
    }

    private function assertEnqueued(int $actionId): void
    {
        // Action Scheduler uses zero when the store rejects an action. Treat
        // that as a failed operation rather than reporting a job that does not
        // exist; callers decide whether the surrounding operation can proceed.
        if ($actionId === 0) {
            throw new QueueFailure('WConvert could not enqueue a scheduled action.');
        }
    }
}
