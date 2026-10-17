<?php

namespace WConvert\Discovery;

use WP_Error;

defined('ABSPATH') || exit;

/**
 * The one writer of the site's occasions (ADR 0112, ADR 0149 §4).
 *
 * The settings form, Copy to next year and Import all change the same option,
 * so all three go through one lease and one revision bump here. Two writers
 * with two locks would let a copy and a form save each read revision 4 and
 * each write revision 5.
 */
final class OccasionStore
{
    private const LOCK = 'wconvert_picker_lock_occasions';

    /** @return array{schema: int, revision: int, items: list<array<string, string>>} */
    public function read(): array
    {
        $document = get_option(PickerDocuments::OCCASIONS, null);
        $items = is_array($document) && is_array($document['items'] ?? null) ? array_values($document['items']) : [];
        return ['schema' => 1, 'revision' => is_array($document) ? (int) ($document['revision'] ?? 0) : 0, 'items' => $items];
    }

    /** @return list<string> */
    public function ids(): array
    {
        return array_values(array_filter(array_map(static fn ($item) => is_array($item) ? ($item['id'] ?? null) : null, $this->read()['items']), 'is_string'));
    }

    /** @return array<string, string>|null */
    public function find(string $id): ?array
    {
        foreach ($this->read()['items'] as $item) {
            if (($item['id'] ?? null) === $id) return $item;
        }
        return null;
    }

    /**
     * Replace the items with what `$change` makes of the current ones.
     *
     * @param callable(list<array<string, string>>): mixed $change Throws \InvalidArgumentException to refuse.
     * @param int|null $revision The revision the caller read, or null when the server is the caller.
     * @return array<string, mixed>|WP_Error The saved document.
     */
    public function write(callable $change, ?int $revision = null): array|WP_Error
    {
        return self::leased(self::LOCK, function () use ($change, $revision) {
            $current = $this->read();
            if ($revision !== null && $revision !== $current['revision']) return self::conflict();
            $next = ['schema' => 1, 'revision' => $current['revision'] + 1, 'items' => PickerDocuments::validateOccasions($change($current['items']))];
            return update_option(PickerDocuments::OCCASIONS, $next, false) === false ? self::saveFailed() : $next;
        });
    }

    /**
     * Run `$work` while holding `$lock`.
     *
     * add_option provides an atomic, bounded write lock for a shared site
     * document or a per-user one. Finally releases it even on validation failure.
     *
     * @template T
     * @param callable(): (T|WP_Error) $work
     * @return T|WP_Error
     */
    public static function leased(string $lock, callable $work): mixed
    {
        $lease = ['at' => time(), 'token' => wp_generate_uuid4()];
        if (!add_option($lock, $lease, '', false)) {
            $previous = get_option($lock, []);
            $since = (int) ($previous['at'] ?? 0);
            // A crashed worker must not permanently block settings. Return a
            // conflict after clearing an expired lease; do not proceed unlocked.
            if ($since < time() - 60) self::unlock($lock, is_array($previous) ? $previous : []);
            return new WP_Error('wconvert_picker_busy', __('Another change is being saved. Retry in a moment.', 'wconvert'), ['status' => 409]);
        }
        try {
            return $work();
        } catch (\InvalidArgumentException $error) {
            return new WP_Error('wconvert_picker_invalid', $error->getMessage(), ['status' => 400]);
        } finally { self::unlock($lock, $lease); }
    }

    public static function conflict(): WP_Error
    {
        return new WP_Error('wconvert_picker_conflict', __('These settings changed in another window. Reload them before saving.', 'wconvert'), ['status' => 409]);
    }

    public static function saveFailed(): WP_Error
    {
        return new WP_Error('wconvert_picker_save_failed', __('Could not save. Your previous settings are intact.', 'wconvert'), ['status' => 500]);
    }

    /** Delete only our lease; a stalled worker cannot release a later writer.
     * @param array<string, mixed> $lease
     */
    private static function unlock(string $key, array $lease): void
    {
        global $wpdb;
        // Compare-and-delete: only the lease this request took, never one a
        // later request now holds. delete_option() has no condition on the
        // value, so it cannot express that; the caches are cleared below.
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- see above.
        $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name = %s AND option_value = %s", $key, maybe_serialize($lease)));
        wp_cache_delete($key, 'options'); wp_cache_delete('notoptions', 'options');
    }
}
