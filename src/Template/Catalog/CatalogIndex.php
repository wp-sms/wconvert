<?php

namespace WConvert\Template\Catalog;

use WConvert\Template\TemplateFacets;

defined('ABSPATH') || exit;

/**
 * The v3 catalogue index: a mutable pointer, an immutable release, and the
 * pages of compact entries the release lists (ADR 0156).
 *
 * ============================================================================
 * ONE BAD ENTRY COSTS ONE ENTRY.
 * ============================================================================
 * A page is content-addressed, so its bytes either match or the whole refresh
 * stops. Inside verified bytes, though, an entry this reader cannot place is
 * dropped and counted rather than refusing the page: the reader that ships in
 * free-v1 will meet entries written years later, and a key or value it has
 * never heard of must cost that one design, never the library.
 *
 * Nothing here is ever rendered or registered. An entry is a card's worth of
 * facts; the design itself is a separate object, validated strictly when an
 * administrator previews or installs it ({@see DesignObject}).
 */
final class CatalogIndex
{
    public const MAJOR = 3;
    public const MAX_POINTER_BYTES = 65536;
    public const MAX_PAGES = 16;
    /** The whole index — every page together — that one refresh will hold. */
    public const MAX_INDEX_BYTES = 1048576;
    public const MAX_ENTRIES = 4000;
    public const WITHDRAWAL_REASONS = ['rights', 'quality', 'broken', 'other'];
    /**
     * Other plugins a design can depend on. Never a WConvert module or plan —
     * those are `tier` — so a missing one reads "unavailable", which outranks
     * "locked". A name this reader does not know is also "unavailable".
     */
    public const PREREQUISITES = ['woocommerce'];

    /**
     * @return array{release: string, withdrawn: list<array{id: string, revision: int|null, reason: string}>, popularity: string|null, latest_major: int}
     */
    public static function pointer(string $json): array
    {
        PackValidator::check(strlen($json) <= self::MAX_POINTER_BYTES, __('The catalog response is too large.', 'wconvert'));
        $pointer = json_decode($json, true, 8);
        PackValidator::check(is_array($pointer) && ($pointer['schema'] ?? null) === self::MAJOR && self::digest($pointer['release'] ?? null), __('The catalog format is unsupported. Your local library has not changed.', 'wconvert'));
        $withdrawn = [];
        foreach (array_slice(is_array($pointer['withdrawn'] ?? null) ? $pointer['withdrawn'] : [], 0, 5000) as $row) {
            if (!is_array($row) || !PackValidator::identifier($row['id'] ?? null)) continue;
            $withdrawn[] = [
                'id' => $row['id'],
                'revision' => DesignObject::revision($row['revision'] ?? null) ? $row['revision'] : null,
                'reason' => in_array($row['reason'] ?? null, self::WITHDRAWAL_REASONS, true) ? $row['reason'] : 'other',
            ];
        }
        return [
            'release' => $pointer['release'],
            'withdrawn' => $withdrawn,
            'popularity' => self::digest($pointer['popularity'] ?? null) ? $pointer['popularity'] : null,
            'latest_major' => is_int($pointer['latest_major'] ?? null) && $pointer['latest_major'] > self::MAJOR ? $pointer['latest_major'] : self::MAJOR,
        ];
    }

    /**
     * @return array{pages: list<string>, i18n: array<string, string>, taxonomy: array<string, list<array{id: string, label: string}>>, collections: list<array<string, mixed>>}
     */
    public static function release(string $json): array
    {
        PackValidator::check(strlen($json) <= PackValidator::MAX_BYTES, __('The catalog response is too large.', 'wconvert'));
        $release = json_decode($json, true, 16);
        PackValidator::check(is_array($release) && ($release['schema'] ?? null) === self::MAJOR, __('The catalog format is unsupported. Your local library has not changed.', 'wconvert'));
        $pages = $release['pages'] ?? null;
        PackValidator::check(is_array($pages) && array_is_list($pages) && count($pages) >= 1 && count($pages) <= self::MAX_PAGES
            && count(array_filter($pages, [self::class, 'digest'])) === count($pages) && count(array_unique($pages)) === count($pages), __('The catalog release lists invalid pages.', 'wconvert'));
        $i18n = [];
        foreach (is_array($release['i18n'] ?? null) ? $release['i18n'] : [] as $locale => $sha) {
            if (is_string($locale) && preg_match('/^[a-z]{2,3}(?:_[A-Z]{2})?$/D', $locale) === 1 && self::digest($sha)) $i18n[$locale] = $sha;
        }
        $taxonomy = [];
        foreach (is_array($release['taxonomy'] ?? null) ? $release['taxonomy'] : [] as $group => $terms) {
            if (!is_string($group) || !PackValidator::identifier($group) || !is_array($terms)) continue;
            foreach (array_slice($terms, 0, 500) as $term) {
                if (is_array($term) && PackValidator::identifier($term['id'] ?? null) && self::text($term['label'] ?? null, 80)) $taxonomy[$group][] = ['id' => $term['id'], 'label' => $term['label']];
            }
        }
        $collections = [];
        foreach (array_slice(is_array($release['collections'] ?? null) ? $release['collections'] : [], 0, 200) as $collection) {
            $read = self::collection($collection);
            if ($read !== null) $collections[$read['id']] ??= $read;
        }
        return ['pages' => $pages, 'i18n' => $i18n, 'taxonomy' => $taxonomy, 'collections' => array_values($collections)];
    }

    /**
     * @param array<string, list<string>> $facetVocabulary the manifest's facet values
     * @return array{designs: list<array<string, mixed>>, setups: list<array<string, mixed>>, skipped: int}
     */
    public static function page(string $json, array $facetVocabulary = []): array
    {
        PackValidator::check(strlen($json) <= PackValidator::MAX_BYTES, __('The catalog response is too large.', 'wconvert'));
        $page = json_decode($json, true, 16);
        PackValidator::check(is_array($page) && ($page['schema'] ?? null) === self::MAJOR, __('The catalog format is unsupported. Your local library has not changed.', 'wconvert'));
        $designs = []; $setups = []; $skipped = 0;
        foreach (is_array($page['designs'] ?? null) ? $page['designs'] : [] as $row) {
            $entry = self::design($row, $facetVocabulary);
            if ($entry === null) $skipped++; else $designs[] = $entry;
        }
        foreach (is_array($page['setups'] ?? null) ? $page['setups'] : [] as $row) {
            $entry = self::setup($row);
            if ($entry === null) $skipped++; else $setups[] = $entry;
        }
        return ['designs' => $designs, 'setups' => $setups, 'skipped' => $skipped];
    }

    /** @return array<string, int> downloads by design id */
    public static function popularity(string $json): array
    {
        $data = strlen($json) <= PackValidator::MAX_BYTES ? json_decode($json, true, 4) : null;
        if (!is_array($data) || ($data['schema'] ?? null) !== self::MAJOR || !is_array($data['downloads'] ?? null)) return [];
        $counts = [];
        foreach ($data['downloads'] as $id => $count) {
            if (is_string($id) && PackValidator::identifier($id) && is_int($count) && $count >= 0) $counts[$id] = $count;
        }
        return $counts;
    }

    /**
     * A translated sidecar maps ids to display words. Anything unexpected is
     * simply untranslated; English stays in the entries themselves.
     *
     * @return array<string, array{name?: string, description?: string}>
     */
    public static function translations(string $json): array
    {
        $data = strlen($json) <= PackValidator::MAX_BYTES ? json_decode($json, true, 6) : null;
        if (!is_array($data) || ($data['schema'] ?? null) !== self::MAJOR || !is_array($data['designs'] ?? null)) return [];
        $words = [];
        foreach ($data['designs'] as $id => $row) {
            if (!is_string($id) || !PackValidator::identifier($id) || !is_array($row)) continue;
            foreach (['name' => 120, 'description' => 1000] as $key => $limit) {
                if (self::text($row[$key] ?? null, $limit)) $words[$id][$key] = $row[$key];
            }
        }
        return $words;
    }

    /**
     * @param mixed $row
     * @param array<string, list<string>> $facetVocabulary
     * @return array<string, mixed>|null
     */
    private static function design($row, array $facetVocabulary): ?array
    {
        if (!is_array($row) || !self::identity($row) || !self::text($row['name'] ?? null, 120)) return null;
        $requires = self::requirements($row['requires'] ?? null);
        if ($requires === null) return null;
        return [
            'id' => $row['id'], 'revision' => $row['revision'], 'sha256' => $row['sha256'], 'bytes' => $row['bytes'],
            'name' => $row['name'],
            // Kept as written so the reader can say "unsupported" about it,
            // never silently coerced into a format or plan it can serve.
            'format' => is_string($row['format'] ?? null) ? $row['format'] : '',
            'tier' => is_string($row['tier'] ?? null) ? $row['tier'] : '',
            'family' => PackValidator::identifier($row['family'] ?? null) ? $row['family'] : null,
            'aliases' => self::identifiers($row['aliases'] ?? null, 10),
            'slug' => is_string($row['slug'] ?? null) && preg_match('/^[a-z0-9][a-z0-9-]{0,79}$/D', $row['slug']) === 1 ? $row['slug'] : $row['id'],
            'requires' => $requires,
            'prerequisites' => self::prerequisites($row['prerequisites'] ?? null),
            'tags' => self::tags($row['tags'] ?? null),
            'facets' => self::facets($row['facets'] ?? null, $facetVocabulary),
            // One digest names both densities: thumbs/<sha>.webp and thumbs/<sha>@2x.webp.
            'thumb' => self::digest($row['thumb'] ?? null) ? $row['thumb'] : null,
        ];
    }

    /**
     * @param mixed $row
     * @return array<string, mixed>|null
     */
    private static function setup($row): ?array
    {
        if (!is_array($row) || !self::identity($row) || !self::text($row['name'] ?? null, 120)) return null;
        $design = $row['design'] ?? null;
        if (!is_array($design) || !PackValidator::identifier($design['id'] ?? null) || !DesignObject::revision($design['revision'] ?? null)) return null;
        $requires = self::requirements($row['requires'] ?? null);
        if ($requires === null || !is_string($row['goal'] ?? null)) return null;
        return [
            'id' => $row['id'], 'revision' => $row['revision'], 'sha256' => $row['sha256'], 'bytes' => $row['bytes'],
            'name' => $row['name'], 'goal' => $row['goal'],
            'tier' => is_string($row['tier'] ?? null) ? $row['tier'] : '',
            'design' => ['id' => $design['id'], 'revision' => $design['revision']],
            'requires' => $requires,
            'prerequisites' => self::prerequisites($row['prerequisites'] ?? null),
            // Editorial examples, as on a bundled Playbook. A row from before
            // they were published simply has none.
            'business_types' => array_values(array_intersect(self::identifiers($row['business_types'] ?? null, 3), ['stores', 'services', 'publishers'])),
        ];
    }

    /**
     * Tolerant per collection: one unreadable collection is left out.
     *
     * @param mixed $collection
     * @return array<string, mixed>|null
     */
    private static function collection($collection): ?array
    {
        if (!is_array($collection) || !PackValidator::identifier($collection['id'] ?? null) || !self::digest($collection['revision'] ?? null)
            || !self::text($collection['name'] ?? null, 120) || !self::text($collection['description'] ?? null, 1000)) return null;
        $items = [];
        foreach (array_slice(is_array($collection['items'] ?? null) ? $collection['items'] : [], 0, 200) as $item) {
            if (!is_array($item)) continue;
            $stage = in_array($item['stage'] ?? 'any', ['any', 'before', 'during', 'after'], true) ? ($item['stage'] ?? 'any') : 'any';
            if (PackValidator::identifier($item['setup'] ?? null)) $items[] = ['setup' => $item['setup'], 'stage' => $stage];
            elseif (PackValidator::identifier($item['design'] ?? null)) $items[] = ['design' => $item['design'], 'stage' => $stage];
        }
        if ($items === []) return null;
        $read = [
            'id' => $collection['id'], 'revision' => $collection['revision'], 'name' => $collection['name'], 'description' => $collection['description'],
            'cover' => in_array($collection['cover'] ?? null, ['sale', 'launch', 'services', 'reading'], true) ? $collection['cover'] : 'launch',
            'priority' => is_int($collection['priority'] ?? null) ? max(-1000, min(1000, $collection['priority'])) : 0,
            'business_types' => array_values(array_intersect(self::identifiers($collection['business_types'] ?? null, 20), ['stores', 'services', 'publishers'])),
            'markets' => array_values(array_filter(is_array($collection['markets'] ?? null) ? array_slice($collection['markets'], 0, 20) : [], static fn ($code): bool => is_string($code) && preg_match('/^[A-Z]{2}$/D', $code) === 1)),
            'items' => $items,
        ];
        $event = $collection['event'] ?? null;
        if (is_array($event) && PackValidator::identifier($event['family'] ?? null)) {
            $dates = [];
            foreach (['start', 'end_exclusive', 'feature_start', 'feature_end_exclusive'] as $key) {
                $value = $event[$key] ?? null; $date = is_string($value) ? \DateTimeImmutable::createFromFormat('!Y-m-d', $value) : false;
                if ($date === false || $date->format('Y-m-d') !== $value) { $dates = null; break; }
                $dates[$key] = $value;
            }
            if ($dates !== null && $dates['start'] < $dates['end_exclusive'] && $dates['feature_start'] < $dates['feature_end_exclusive']
                && $dates['feature_start'] <= $dates['start'] && $dates['feature_end_exclusive'] <= $dates['end_exclusive']) {
                $read['event'] = ['family' => $event['family']] + $dates;
            }
        }
        return $read;
    }

    /**
     * Facets the publisher DERIVED from the tree with the shipping
     * {@see TemplateFacets}, so a card with no tree here can still be
     * filtered by Goal. Normalised against this install's own vocabulary:
     * a value it cannot name is dropped rather than drawn.
     *
     * @param array<string, list<string>> $offered
     * @return array<string, mixed>
     */
    private static function facets(mixed $facets, array $offered): array
    {
        $read = TemplateFacets::authored($facets, $offered);
        $read['act'] = is_array($facets) && in_array($facets['act'] ?? null, ['submit', 'click'], true) ? $facets['act'] : null;
        $read['asks_consent'] = is_array($facets) && ($facets['asks_consent'] ?? false) === true;
        return $read;
    }

    /** @param array<string, mixed> $row */
    private static function identity(array $row): bool
    {
        return PackValidator::identifier($row['id'] ?? null) && DesignObject::revision($row['revision'] ?? null)
            && self::digest($row['sha256'] ?? null) && is_int($row['bytes'] ?? null) && $row['bytes'] > 0 && $row['bytes'] <= PackValidator::MAX_BYTES;
    }

    /** @return array{plugin: string, capabilities: list<string>}|null */
    private static function requirements(mixed $requires): ?array
    {
        if (!is_array($requires) || !PackValidator::version($requires['plugin'] ?? null)) return null;
        $capabilities = is_array($requires['capabilities'] ?? null) ? array_values(array_filter(array_slice($requires['capabilities'], 0, 20), 'is_string')) : [];
        return ['plugin' => $requires['plugin'], 'capabilities' => $capabilities];
    }

    /** @return list<string> unknown names kept, so the reader can say the plugin is missing */
    private static function prerequisites(mixed $value): array
    {
        return self::identifiers($value, 8);
    }

    /** @return list<string> `group:term` pairs */
    private static function tags(mixed $value): array
    {
        if (!is_array($value)) return [];
        return array_values(array_unique(array_filter(array_slice($value, 0, 40), static fn ($tag): bool => is_string($tag) && preg_match('/^[a-z0-9][a-z0-9-]{0,59}:[a-z0-9][a-z0-9-]{0,59}$/D', $tag) === 1)));
    }

    /** @return list<string> */
    private static function identifiers(mixed $value, int $max): array
    {
        if (!is_array($value)) return [];
        return array_values(array_unique(array_filter(array_slice($value, 0, $max), [PackValidator::class, 'identifier'])));
    }

    private static function text(mixed $value, int $max): bool
    {
        return is_string($value) && trim($value) !== '' && strlen($value) <= $max && !preg_match('/[<>\x00-\x1f]/', $value);
    }

    public static function digest(mixed $value): bool
    {
        return is_string($value) && preg_match('/^[a-f0-9]{64}$/D', $value) === 1;
    }
}
