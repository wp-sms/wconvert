<?php

namespace WConvert\Lead;

use WConvert\Database\Connection;
use WConvert\Stats\StatDay;
use WConvert\Stats\StatKind;
use WConvert\Stats\StatsRepository;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/** Serializes each journey's accepted requests before handing work to the queue. */
final class JourneyCapture
{
    public const ACCEPTED = 'wconvert_submission_accepted';

    public function __construct(private readonly Connection $db, private readonly StatsRepository $stats) {}

    /** @param array{receipt: string, expires: int} $grant
     * @param array<string, mixed> $tree
     * @param array{purpose: string, destination_ids: list<string>} $setting
     * @return array{id: string, submission: string, first: bool, replay: bool}
     */
    public function accept(string $optinId, string $contract, array $grant, array $tree, string $submissionId, Submission $submitted, array $setting): array
    {
        $result = $this->db->transaction(function () use ($optinId, $contract, $grant, $tree, $submissionId, $submitted, $setting): array {
            $key = $grant['receipt'];
            $this->db->upsert(Connection::TABLE_OPTIONS,
                'INSERT INTO %i (option_name, option_value, autoload) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE option_name = VALUES(option_name)',
                $key, (string) wp_json_encode(['expires' => $grant['expires'], 'lead' => null]), 'off');
            $row = $this->db->row(Connection::TABLE_OPTIONS, 'SELECT option_value FROM %i WHERE option_name = %s FOR UPDATE', $key);
            $receipt = json_decode((string) ($row['option_value'] ?? ''), true);
            if (!is_array($receipt) || ($receipt['revoked'] ?? false) || ($receipt['expires'] ?? 0) <= time()) { throw new CaptureConflict('expired'); }
            $leadId = $receipt['lead'] ?? null;
            $stored = is_string($leadId) ? $this->db->row(Connection::TABLE_LEADS,
                'SELECT id, optin_id, email, phone, fields, created_at FROM %i WHERE id = %s FOR UPDATE', $leadId) : null;
            if ($leadId !== null && $stored === null) { throw new CaptureConflict('erased'); }
            $data = $stored === null ? ['answers' => [], 'capture' => ['contract' => $contract, 'receipt_key' => $key, 'expires' => $grant['expires'], 'submissions' => []]]
                : json_decode((string) $stored['fields'], true);
            if (!is_array($data) || ($data['capture']['contract'] ?? null) !== $contract) { throw new CaptureConflict('changed'); }
            $values = array_filter(['email' => $submitted->email, 'phone' => $submitted->phone, ...$submitted->fields], static fn ($value): bool => $value !== null);
            ksort($values);
            $hash = hash('sha256', (string) wp_json_encode($values));
            $accepted = $data['capture']['submissions'];
            $primary = ($tree['submissions'][0]['id'] ?? '') === $submissionId;
            if (isset($accepted[$submissionId])) {
                if (!hash_equals($accepted[$submissionId]['request_hash'], $hash)) { throw new CaptureConflict('fixed'); }
                return ['id' => $leadId, 'submission' => $submissionId, 'first' => $primary, 'replay' => true];
            }
            if (($stored === null && !$primary) || ($stored !== null && $primary) || count($accepted) >= 2) { throw new CaptureConflict('order'); }
            foreach ($accepted as $snapshot) {
                if (array_intersect(array_keys($snapshot['values']), array_diff(array_keys($values), ['consent_text'])) !== []) { throw new CaptureConflict('fixed'); }
            }
            $now = gmdate('Y-m-d\TH:i:s\Z');
            $data['capture']['submissions'][$submissionId] = [
                'accepted_at' => $now, 'request_hash' => $hash, 'consent_ids' => $tree['submissions'][array_search($submissionId, array_column($tree['submissions'], 'id'), true)]['consents'], 'purpose' => $setting['purpose'],
                'values' => $values, 'destination_ids' => $setting['destination_ids'],
                'handoff' => $setting['destination_ids'] === [] ? 'complete' : 'pending',
            ];
            $data['answers'] += $submitted->fields;
            if ($setting['purpose'] !== 'request') {
                $prefix = $setting['purpose'] === 'email_marketing' ? 'email' : 'sms';
                $data['answers'][$prefix . '_accepted_at'] = $now;
                $data['answers'][$prefix . '_consent_text'] = $submitted->fields['consent_text'] ?? '';
            }
            $email = $stored['email'] ?? $submitted->email;
            $phone = $stored['phone'] ?? $submitted->phone;
            if ($stored === null) {
                $leadId = Ulid::generate();
                $this->db->insert(Connection::TABLE_LEADS, [
                    'id' => $leadId, 'optin_id' => $optinId, 'email' => $email, 'phone' => $phone,
                    'fields' => (string) wp_json_encode($data), 'created_at' => current_time('mysql'),
                ]);
                $this->db->update(Connection::TABLE_OPTIONS, ['option_value' => (string) wp_json_encode(['expires' => $grant['expires'], 'lead' => $leadId])], ['option_name' => $key]);
                $this->stats->increment($optinId, StatKind::Conversion, StatDay::today());
            } else {
                $this->db->update(Connection::TABLE_LEADS, ['email' => $email, 'phone' => $phone, 'fields' => (string) wp_json_encode($data)], ['id' => $leadId]);
            }
            if ($setting['purpose'] !== 'request') { $this->stats->increment($optinId, StatKind::Conversion, StatDay::today(), 'channel:' . $setting['purpose']); }
            return ['id' => $leadId, 'submission' => $submissionId, 'first' => $primary, 'replay' => false];
        });
        wp_cache_delete($grant['receipt'], 'options');
        // A queue outage cannot undo an accepted capture. The pending snapshot is recoverable.
        if (!$result['replay']) {
            try { do_action(self::ACCEPTED, $result['id'], $submissionId); }
            catch (\Throwable) { error_log('WConvert: accepted submission is awaiting queue handoff.'); }
        }
        return $result;
    }
}
