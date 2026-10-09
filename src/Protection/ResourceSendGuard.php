<?php

namespace WConvert\Protection;

use WConvert\Database\Connection;
use WConvert\Destination\PushResult;
use WConvert\Destination\PushOutcome;

defined('ABSPATH') || exit;

/** Serialize sends for one recipient/resource without deduplicating capture records. */
final class ResourceSendGuard
{
    public const WINDOW = 600;
    public function __construct(private readonly Connection $db, private readonly Diagnostics $diagnostics) {}

    /** @param callable(): PushResult $send */
    public function send(string $email, string $resource, callable $send): PushResult
    {
        if ($email === '' || $resource === '') { return $send(); }
        $key = 'wconvert_mail_' . hash_hmac('sha256', strtolower($email) . '|' . $resource, wp_salt('auth'));
        return $this->db->transaction(function () use ($key, $send): PushResult {
            $this->db->upsert(Connection::TABLE_OPTIONS,
                'INSERT INTO %i (option_name, option_value, autoload) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE option_name = VALUES(option_name)',
                $key, (string) wp_json_encode(['expires' => 0]), 'off');
            $row = $this->db->row(Connection::TABLE_OPTIONS, 'SELECT option_value FROM %i WHERE option_name = %s FOR UPDATE', $key);
            $value = json_decode((string) ($row['option_value'] ?? ''), true);
            if (($value['expires'] ?? 0) > time()) {
                $this->diagnostics->record('send_limited');
                return PushResult::skipped('A resource email was already accepted for this recipient and resource within ten minutes.');
            }
            $result = $send();
            if ($result->outcome === PushOutcome::Success) {
                $this->db->update(Connection::TABLE_OPTIONS, ['option_value' => (string) wp_json_encode(['expires' => time() + self::WINDOW])], ['option_name' => $key]);
            }
            return $result;
        });
    }

    public function prune(): void
    {
        $rows = $this->db->results(Connection::TABLE_OPTIONS,
            'SELECT option_name, option_value FROM %i WHERE option_name LIKE %s ORDER BY option_id ASC LIMIT 500', 'wconvert_mail_%');
        foreach ($rows as $row) {
            $value = json_decode((string) $row['option_value'], true);
            if (preg_match('/^wconvert_mail_[a-f0-9]{64}$/D', (string) $row['option_name']) === 1 && ($value['expires'] ?? 0) <= time()) {
                // Compare the value as well: pruning must not remove a reservation renewed concurrently.
                $this->db->delete(Connection::TABLE_OPTIONS, 'DELETE FROM %i WHERE option_name = %s AND option_value = %s', $row['option_name'], $row['option_value']);
                wp_cache_delete((string) $row['option_name'], 'options');
            }
        }
    }
}
