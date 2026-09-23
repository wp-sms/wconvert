<?php

namespace WConvert\Destination;

use WConvert\Database\Connection;
use WConvert\Lead\JourneyCapture;
use WConvert\Lead\CaptureGrant;
use WConvert\Queue\Queue;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/** Initial handoff uses frozen routes and recovers a commit-to-queue interruption. */
final class SubmissionDispatcher
{
    public const RECOVER = 'wconvert_recover_submissions';
    public const CHECKPOINT = 'wconvert_submission_checkpoint';

    public function __construct(private readonly Connection $db, private readonly Queue $queue,
        private readonly DestinationStore $destinations, private readonly DestinationRegistry $registry, private readonly HealthStore $health) {}

    public function hooks(): void
    {
        add_action(JourneyCapture::ACCEPTED, [$this, 'dispatch'], 10, 2);
        add_action(self::RECOVER, [$this, 'recover']);
        if (!wp_next_scheduled(self::RECOVER)) { wp_schedule_event(time() + 60, 'hourly', self::RECOVER); }
    }

    public function dispatch(string $leadId, string $submissionId): void
    {
        $this->db->transaction(function () use ($leadId, $submissionId): void {
            $row = $this->db->row(Connection::TABLE_LEADS, 'SELECT fields FROM %i WHERE id = %s FOR UPDATE', $leadId);
            if ($row === null) { return; }
            $data = json_decode((string) $row['fields'], true);
            $submission = $data['capture']['submissions'][$submissionId] ?? null;
            if (!is_array($submission) || ($submission['handoff'] ?? null) !== 'pending') { return; }
            foreach ($submission['destination_ids'] as $id) {
                $destination = $this->destinations->find($id);
                if ($destination === null || !$this->registry->isDispatchable($destination->type)) {
                    $data['capture']['submissions'][$submissionId]['unavailable_routes'][] = $id;
                    if ($destination !== null) { $this->health->skipped($id, current_time('mysql')); }
                    continue;
                }
                $this->queue->dispatch(PushJob::HOOK, (new PushJob($leadId, $id, 1, $submissionId))->toArgs());
            }
            $data['capture']['submissions'][$submissionId]['handoff'] = 'complete';
            $this->db->update(Connection::TABLE_LEADS, ['fields' => (string) wp_json_encode($data)], ['id' => $leadId]);
        });
    }

    public function recover(): void
    {
        $cursor = (string) get_option(self::CHECKPOINT, '');
        $rows = $this->db->results(Connection::TABLE_LEADS, 'SELECT id, fields FROM %i WHERE id > %s ORDER BY id ASC LIMIT 100', $cursor);
        foreach ($rows as $row) {
            $data = json_decode((string) $row['fields'], true);
            try {
                foreach ($data['capture']['submissions'] ?? [] as $id => $submission) {
                    if (($submission['handoff'] ?? null) === 'pending') { $this->dispatch((string) $row['id'], $id); }
                }
            } catch (\Throwable) {
                update_option(self::CHECKPOINT, $cursor, false);
                return;
            }
            $cursor = (string) $row['id'];
        }
        $overlap = Ulid::floorAt((time() - CaptureGrant::LIFETIME) * 1000);
        update_option(self::CHECKPOINT, count($rows) === 100 ? $cursor : min($cursor, $overlap), false);
        if (count($rows) === 100) { $this->queue->dispatch(self::RECOVER, ['after' => $cursor]); }
        // Receipts contain no answers. Expired tokens cannot authenticate a replay.
        $expired = $this->db->results(Connection::TABLE_OPTIONS,
            'SELECT option_name, option_value FROM %i WHERE option_name LIKE %s ORDER BY option_id ASC LIMIT 200', 'wconvert_capture_%');
        foreach ($expired as $receipt) {
            $value = json_decode((string) $receipt['option_value'], true);
            if (preg_match('/^wconvert_capture_[a-f0-9]{64}$/D', (string) $receipt['option_name']) === 1 && is_array($value) && ($value['expires'] ?? PHP_INT_MAX) <= time()) {
                $this->db->delete(Connection::TABLE_OPTIONS, 'DELETE FROM %i WHERE option_name = %s', $receipt['option_name']);
                wp_cache_delete((string) $receipt['option_name'], 'options');
            }
        }
    }
}
