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

    /** How many deleted ids are remembered; the oldest are forgotten first. */
    private const RETIRED = 500;

    /** @return array{schema: int, revision: int, items: list<array<string, string>>, retired: list<string>} */
    public function read(): array
    {
        $document = get_option(PickerDocuments::OCCASIONS, null);
        $items = is_array($document) && is_array($document['items'] ?? null) ? array_values($document['items']) : [];
        $retired = is_array($document) && is_array($document['retired'] ?? null) ? array_values(array_filter($document['retired'], 'is_string')) : [];
        return ['schema' => 1, 'revision' => is_array($document) ? (int) ($document['revision'] ?? 0) : 0, 'items' => $items, 'retired' => $retired];
    }

    /**
     * Every id an occasion has had here, live or deleted.
     *
     * ========================================================================
     * A DELETED ID IS NEVER GIVEN OUT AGAIN.
     * ========================================================================
     * Deleting an occasion writes no campaign (ADR 0149 §5): its campaigns
     * keep the id and read as unlinked only because nothing answers to it. A
     * new occasion under the same id — an import of the same file, say —
     * would quietly take back every campaign nobody had saved since. So the
     * ids of deleted occasions are kept beside the live ones, and minting
     * avoids both.
     *
     * @return list<string>
     */
    public function taken(): array
    {
        $document = $this->read();
        return [...array_column($document['items'], 'id'), ...$document['retired']];
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
     * An occasion `$change` drops is retired ({@see self::taken()}), and one
     * it adds under a retired id is refused.
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
            $items = PickerDocuments::validateOccasions($change($current['items']));
            $before = array_column($current['items'], 'id');
            $after = array_column($items, 'id');
            if (array_intersect(array_diff($after, $before), $current['retired']) !== []) {
                // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- a validation message for an administrator, caught upstream and returned as a WP_Error that the admin renders as text.
                throw new \InvalidArgumentException(__('That occasion was deleted. Add it as a new occasion.', 'wconvert'));
            }
            $retired = array_slice(array_values(array_unique([...$current['retired'], ...array_diff($before, $after)])), -self::RETIRED);
            $next = ['schema' => 1, 'revision' => $current['revision'] + 1, 'items' => $items, 'retired' => $retired];
            return update_option(PickerDocuments::OCCASIONS, $next, false) === false ? self::saveFailed() : $next;
        });
    }

    /**
     * Add an occasion, renaming its id until it is free — of live occasions
     * and of deleted ones, whose campaigns still carry it. Copy, Import and an
     * agent's save-occasion all add this way.
     *
     * @param array<string, string> $occasion
     * @return array<string, string>|WP_Error The occasion as saved, under the id it got.
     */
    public function add(array $occasion): array|WP_Error
    {
        $taken = $this->taken();
        $saved = $this->write(static function (array $items) use (&$occasion, $taken): array {
            $taken = [...$taken, ...array_column($items, 'id')];
            $base = $occasion['id'];
            for ($n = 2; in_array($occasion['id'], $taken, true); $n++) {
                $suffix = '-' . $n;
                $occasion['id'] = substr($base, 0, 64 - strlen($suffix)) . $suffix;
            }
            return [...$items, $occasion];
        });
        return $saved instanceof WP_Error ? $saved : $occasion;
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
