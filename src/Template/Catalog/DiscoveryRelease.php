<?php

namespace WConvert\Template\Catalog;

defined('ABSPATH') || exit;

/** A bounded immutable discovery release; all pages validate before cache commit. */
final class DiscoveryRelease
{
    /** @param array<string, mixed> $manifest
     * @return array<string, mixed> */
    public static function read(array $manifest, string $source, CatalogTransport $transport): array
    {
        PackValidator::check(($manifest['schema'] ?? null) === 2 && self::digest($manifest['release'] ?? null), __('Update required: unsupported discovery release.', 'wconvert'));
        PackValidator::keys($manifest, ['schema', 'release', 'pages']);
        $pages = $manifest['pages'] ?? null;
        PackValidator::check(is_array($pages) && array_is_list($pages) && count($pages) > 0 && count($pages) <= 16, __('The discovery release has too many pages.', 'wconvert'));
        $packs = []; $collections = []; $bytes = 0; $seen = [];
        foreach ($pages as $reference) {
            PackValidator::check(is_array($reference) && self::digest($reference['sha256'] ?? null) && is_string($reference['url'] ?? null), __('Invalid discovery page.', 'wconvert'));
            PackValidator::keys($reference, ['url', 'sha256']);
            self::sameOrigin($source, $reference['url']);
            PackValidator::check(!isset($seen[$reference['url']]), __('Repeated discovery page.', 'wconvert')); $seen[$reference['url']] = true;
            $json = $transport->get($reference['url']);
            PackValidator::check(strlen($json) <= PackValidator::MAX_BYTES, __('The discovery page is too large.', 'wconvert'));
            $bytes += strlen($json);
            PackValidator::check($bytes <= 2097152 && hash_equals($reference['sha256'], hash('sha256', $json)), __('The discovery release changed. Refresh again.', 'wconvert'));
            $page = json_decode($json, true, 24);
            PackValidator::check(is_array($page) && ($page['schema'] ?? null) === 2 && ($page['release'] ?? null) === $manifest['release'] && is_array($page['packs'] ?? null) && array_is_list($page['packs']) && is_array($page['collections'] ?? null) && array_is_list($page['collections']), __('Discovery pages belong to different releases or use an unsupported format.', 'wconvert'));
            PackValidator::keys($page, ['schema', 'release', 'packs', 'collections']);
            $packs = array_merge($packs, $page['packs']); $collections = array_merge($collections, $page['collections']);
            PackValidator::check(count($packs) <= TemplateCatalog::MAX_PACKS && count($collections) <= 100, __('This discovery release is too large.', 'wconvert'));
        }
        $ids = [];
        foreach ($collections as $collection) {
            self::collection($collection);
            PackValidator::check(!isset($ids[$collection['id']]), __('Repeated discovery collection.', 'wconvert')); $ids[$collection['id']] = true;
            foreach ($collection['items'] as $item) {
                $pack = null;
                foreach ($packs as $candidate) if (($candidate['id'] ?? null) === $item['pack_id']) $pack = $candidate;
                PackValidator::check($pack !== null && ($pack['sha256'] ?? null) === $item['pack_digest'], __('A collection references a different pack release.', 'wconvert'));
            }
        }
        return ['schema' => 1, 'packs' => $packs, 'collections' => $collections, 'release' => $manifest['release']];
    }

    /** @param mixed $collection */
    private static function collection($collection): void
    {
        PackValidator::check(is_array($collection) && PackValidator::identifier($collection['id'] ?? null) && self::digest($collection['revision'] ?? null), __('Invalid collection identity.', 'wconvert'));
        PackValidator::keys($collection, ['id', 'revision', 'name', 'description', 'cover', 'priority', 'business_types', 'markets', 'items', 'event']);
        foreach (['name' => 120, 'description' => 1000] as $key => $bound) PackValidator::check(is_string($collection[$key] ?? null) && strlen($collection[$key]) <= $bound && !preg_match('/[<>\x00-\x1f]/', $collection[$key]), __('Invalid collection text.', 'wconvert'));
        PackValidator::check(in_array($collection['cover'] ?? null, ['sale', 'launch', 'services', 'reading'], true) && is_int($collection['priority'] ?? null) && abs($collection['priority']) <= 1000, __('Unsupported collection presentation.', 'wconvert'));
        foreach (['business_types', 'markets'] as $key) {
            PackValidator::check(is_array($collection[$key] ?? null) && array_is_list($collection[$key]) && count($collection[$key]) <= 20, __('Invalid collection audience.', 'wconvert'));
            foreach ($collection[$key] as $id) PackValidator::check(is_string($id) && ($key === 'business_types' ? in_array($id, ['stores', 'services', 'publishers'], true) : preg_match('/^[A-Z]{2}$/D', $id) === 1), __('Invalid collection audience.', 'wconvert'));
        }
        $items = $collection['items'] ?? null;
        PackValidator::check(is_array($items) && array_is_list($items) && count($items) > 0 && count($items) <= 100, __('Invalid collection members.', 'wconvert'));
        $seen = [];
        foreach ($items as $item) {
            PackValidator::check(is_array($item) && PackValidator::identifier($item['setup_id'] ?? null) && PackValidator::identifier($item['pack_id'] ?? null) && self::digest($item['pack_digest'] ?? null) && in_array($item['stage'] ?? null, ['any', 'before', 'during', 'after'], true), __('Invalid collection setup reference.', 'wconvert'));
            PackValidator::keys($item, ['pack_id', 'pack_digest', 'setup_id', 'stage']);
            $key = $item['pack_id'] . ':' . $item['setup_id'];
            PackValidator::check(!isset($seen[$key]), __('Repeated collection setup.', 'wconvert')); $seen[$key] = true;
        }
        if (isset($collection['event'])) {
            $event = $collection['event'];
            PackValidator::check(is_array($event) && PackValidator::identifier($event['family'] ?? null), __('Invalid event family.', 'wconvert'));
            PackValidator::keys($event, ['family', 'start', 'end_exclusive', 'feature_start', 'feature_end_exclusive']);
            foreach (['start', 'end_exclusive', 'feature_start', 'feature_end_exclusive'] as $key) {
                $value = $event[$key] ?? null; $date = is_string($value) ? \DateTimeImmutable::createFromFormat('!Y-m-d', $value) : false;
                PackValidator::check($date !== false && $date->format('Y-m-d') === $value, __('Invalid event date.', 'wconvert'));
            }
            PackValidator::check($event['start'] < $event['end_exclusive'] && $event['feature_start'] < $event['feature_end_exclusive'] && $event['feature_start'] <= $event['start'] && $event['feature_end_exclusive'] <= $event['end_exclusive'], __('Invalid event date window.', 'wconvert'));
        }
    }

    public static function sameOrigin(string $source, string $target): void
    {
        $a = wp_parse_url($source); $b = wp_parse_url($target);
        PackValidator::check(is_array($a) && is_array($b) && !isset($b['user']) && !isset($b['pass']) && !isset($b['fragment']) && ($a['scheme'] ?? '') === ($b['scheme'] ?? '') && ($a['host'] ?? '') === ($b['host'] ?? '') && ($a['port'] ?? null) === ($b['port'] ?? null), __('A discovery address does not belong to this catalog service.', 'wconvert'));
    }

    /** @param mixed $value */
    private static function digest($value): bool { return is_string($value) && preg_match('/^[a-f0-9]{64}$/D', $value) === 1; }
}
