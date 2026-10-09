<?php

namespace WConvert\Queue;

use WConvert\Destination\PushJob;

defined('ABSPATH') || exit;

/** A bounded view of WConvert outcomes in Action Scheduler's own logs. */
final class RecentPushHistory
{
    private const PREFIX = 'wconvert-outcome-v1:';
    private static int $current = 0;

    public static function hooks(): void
    {
        add_action('action_scheduler_before_execute', [self::class, 'begin'], 1, 1);
        add_action('action_scheduler_after_execute', [self::class, 'end'], 99, 0);
        add_action('action_scheduler_failed_execution', [self::class, 'end'], 99, 0);
    }

    public static function begin(int $id): void { self::$current = $id; }
    public static function end(): void { self::$current = 0; }

    public static function record(string $outcome, int $attempt): void
    {
        if (self::$current <= 0 || !class_exists(\ActionScheduler::class)) return;
        if (!in_array($outcome, ['accepted', 'retry_scheduled', 'needs_attention', 'skipped'], true)) return;
        \ActionScheduler::logger()->log(self::$current, self::PREFIX . wp_json_encode(['outcome' => $outcome, 'attempt' => $attempt]));
    }

    /** @return list<array<string, mixed>> */
    public static function recent(string $destinationId, int $limit = 25): array
    {
        if (!class_exists(\ActionScheduler::class)) return [];
        $limit = max(1, min(100, $limit));
        $store = \ActionScheduler::store();
        // AS cannot index nested argument fields. Bound the candidate page.
        $ids = $store->query_actions(['hook' => PushJob::HOOK, 'group' => ActionSchedulerQueue::GROUP,
            'per_page' => 100, 'orderby' => 'date', 'order' => 'DESC']);
        $rows = [];
        foreach ($ids as $id) {
            $action = $store->fetch_action($id);
            $args = $action->get_args();
            $job = PushJob::fromArgs(is_array($args[0] ?? null) ? $args[0] : []);
            if ($job === null || $job->destinationId !== $destinationId) continue;
            $outcome = null;
            $at = null;
            foreach (\ActionScheduler::logger()->get_logs($id) as $entry) {
                $message = $entry->get_message();
                if (!str_starts_with($message, self::PREFIX)) continue;
                $decoded = json_decode(substr($message, strlen(self::PREFIX)), true);
                if (is_array($decoded) && in_array($decoded['outcome'] ?? null, ['accepted', 'retry_scheduled', 'needs_attention', 'skipped'], true)) {
                    $outcome = $decoded['outcome'];
                    $at = $entry->get_date()->format('Y-m-d H:i:s');
                }
            }
            $status = $store->get_status($id);
            $rows[] = ['id' => (int) $id, 'lead' => $job->leadId, 'submission' => $job->submissionId,
                'attempt' => $job->attempt, 'at' => $at, 'status' => $status, 'outcome' => $outcome ?? ($status === 'pending' ? 'queued' : ($status === 'in-progress' ? 'running' : 'unknown'))];
            if (count($rows) >= $limit) break;
        }
        return $rows;
    }
}
