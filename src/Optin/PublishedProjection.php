<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * Rows in, published set out — pure (ADR 0003).
 *
 * @since 0.1.0
 */
final class PublishedProjection
{
    /**
     * @param iterable<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    public static function build(iterable $rows): array
    {
        $set = [];

        foreach ($rows as $row) {
            $entry = self::project($row);

            if ($entry !== null) {
                $set[] = $entry;
            }
        }

        return $set;
    }

    /**
     * Every reason an Optin is not in the published set, in one place.
     *
     * This list is what later tickets extend rather than fork: an Optin
     * holding a Condition marked `on_absence: suspend` that this install
     * cannot evaluate joins it (ADR 0027) — though from the enqueue filter
     * rather than from here, since suspension is computed against the live
     * registry and this projection is built at publish time.
     *
     * @param array<string, mixed> $row
     */
    private static function isExcluded(array $row): bool
    {
        // Not published, or unpublished since. `published_at` is the marker
        // rather than the presence of `published_config`: unpublishing keeps
        // the last live version so republishing is not a retype.
        if (($row['published_at'] ?? null) === null) {
            return true;
        }

        // Soft-deleted. An Optin is never hard-deleted, because analytics
        // interprets its counts by joining this table at read (ADR 0020), so
        // "deleted" has to mean something the front end honours on its own.
        return ($row['deleted_at'] ?? null) !== null;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>|null
     */
    private static function project(array $row): ?array
    {
        if (self::isExcluded($row)) {
            return null;
        }

        $published = json_decode((string) ($row['published_config'] ?? ''), true);

        if (!is_array($published)) {
            return null;
        }

        $targeting = $published['targeting'] ?? [];
        unset($published['targeting']);

        return [
            'id' => (string) ($row['id'] ?? ''),
            'targeting' => is_array($targeting) ? $targeting : [],
            'payload' => $published,
        ];
    }
}
