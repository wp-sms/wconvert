<?php

namespace WConvert\Queue;

defined('ABSPATH') || exit;

/**
 * {@see Queue} over Action Scheduler.
 *
 * One group, so a merchant looking at Tools → Scheduled Actions can see
 * WConvert's work as WConvert's.
 *
 * Pending jobs are unique by hook and arguments. Accepted submission identity
 * keeps email and SMS independent; ordinary retries never repeat an earlier job.
 * Completed actions do not prevent an explicit merchant resend.
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
    private bool $storageChecked = false;

    /**
     * @param array<string, scalar> $args
     */
    public function dispatch(string $hook, array $args): void
    {
        $this->requireTransactionalStore();
        $id = as_enqueue_async_action($hook, [$args], self::GROUP, true);
        if ($id === 0 && as_has_scheduled_action($hook, [$args], self::GROUP)) { return; }
        $this->assertEnqueued($id);
    }

    /**
     * @param array<string, scalar> $args
     */
    public function schedule(int $timestamp, string $hook, array $args): void
    {
        $this->assertEnqueued(as_schedule_single_action($timestamp, $hook, [$args], self::GROUP));
    }

    private function requireTransactionalStore(): void
    {
        if ($this->storageChecked || !class_exists(\ActionScheduler::class)) { return; }
        $store = \ActionScheduler::store();
        if ($store instanceof \ActionScheduler_HybridStore) {
            $store = \Action_Scheduler\Migration\Controller::instance()->get_migration_config_object()->get_destination_store();
        }
        if (!($store instanceof \ActionScheduler_DBStore)) {
            throw new QueueFailure('Submission handoff requires the Action Scheduler database store.');
        }
        global $wpdb;
        // A one-off read of the schema itself, which no WordPress API exposes;
        // its answer is cached in this object for the request.
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- see above.
        $rows = $wpdb->get_col($wpdb->prepare(
            'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (%s, %s)',
            $wpdb->prefix . 'actionscheduler_actions', $wpdb->prefix . 'actionscheduler_groups'
        ));
        if (count($rows) !== 2 || array_filter($rows, static fn ($engine): bool => strtoupper((string) $engine) !== 'INNODB') !== []) {
            throw new QueueFailure('Submission handoff requires transactional Action Scheduler storage.');
        }
        $this->storageChecked = true;
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
