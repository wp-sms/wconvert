<?php

namespace WConvert\Template\Catalog;

use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

/** Explicit admin requests fetch data; normal library reads use local copies only. */
final class TemplateCatalog
{
    // phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- validation messages for an administrator, caught upstream and returned as a WP_Error that the admin renders as text; escaping here would print the entities.
    public const CACHE_OPTION = 'wconvert_template_catalog_cache';
    public const SOURCE_OPTION = 'wconvert_template_catalog_url';
    /** Fifty focused packs of up to twelve setups can cover a 500-campaign library. */
    public const MAX_PACKS = 50;

    public function __construct(
        private readonly OptionStore $options,
        private readonly CatalogTransport $transport,
        private readonly PackValidator $validator,
        private readonly InstalledPacks $installed,
    ) {
    }

    /** @return array<string, mixed> */
    public function status(): array
    {
        $source = $this->source();
        $cache = $this->options->get(self::CACHE_OPTION, []);
        if (!is_array($cache) || ($cache['source'] ?? '') !== $source) $cache = [];
        $installed = $this->installed->packs();
        $latest = [];
        foreach ($installed as $pack) $latest[$pack['id']] ??= $pack;
        $packs = [];
        foreach ($cache['packs'] ?? [] as $entry) {
            $local = $latest[$entry['id']] ?? null;
            $entry['installed_version'] = $local['version'] ?? null;
            $entry['state'] = $local === null ? 'available' : (version_compare($entry['version'], $local['version'], '>') ? 'update' : 'installed');
            unset($entry['url'], $entry['sha256']);
            $packs[$entry['id']] = $entry;
        }
        foreach ($latest as $id => $local) {
            if (isset($packs[$id])) continue;
            $packs[$id] = ['id' => $id, 'name' => $local['name'], 'description' => $local['description'], 'version' => $local['version'], 'installed_version' => $local['version'], 'state' => 'installed'];
        }
        return ['configured' => $source !== '', 'source' => $source, 'checked_at' => $cache['checked_at'] ?? null, 'packs' => array_values($packs)];
    }

    /** @return array<string, mixed> */
    public function refresh(): array
    {
        $source = $this->source();
        PackValidator::check($source !== '', __('A catalog service has not been configured on this site yet.', 'wconvert'));
        $json = $this->transport->get($source);
        $index = json_decode($json, true, 12);
        $discovery = is_array($index) && ($index['schema'] ?? null) === 2;
        if ($discovery) $index = DiscoveryRelease::read($index, $source, $this->transport);
        PackValidator::check(is_array($index) && ($index['schema'] ?? null) === 1 && is_array($index['packs'] ?? null) && array_is_list($index['packs']) && count($index['packs']) <= self::MAX_PACKS, __('The catalog format is unsupported. Your local library has not changed.', 'wconvert'));
        $seen = [];
        foreach ($index['packs'] as $entry) {
            PackValidator::check(is_array($entry) && PackValidator::identifier($entry['id'] ?? null) && !isset($seen[$entry['id']]) && PackValidator::version($entry['version'] ?? null), __('The catalog contains invalid pack information.', 'wconvert'));
            $seen[$entry['id']] = true;
            foreach (['name' => 120, 'description' => 1000] as $key => $limit) {
                PackValidator::check(is_string($entry[$key] ?? null) && strlen($entry[$key]) <= $limit && !preg_match('/[<>\x00-\x1f]/', $entry[$key]), __('The catalog contains invalid text.', 'wconvert'));
            }
            PackValidator::check(is_string($entry['sha256'] ?? null) && preg_match('/^[a-f0-9]{64}$/D', $entry['sha256']) === 1 && is_string($entry['url'] ?? null), __('The catalog is missing a verified pack address.', 'wconvert'));
            if (isset($entry['preview_url'])) {
                PackValidator::check(is_string($entry['preview_url']) && strlen($entry['preview_url']) <= 2048, __('Invalid public preview address.', 'wconvert'));
                DiscoveryRelease::sameOrigin($source, $entry['preview_url']);
            }
            if (isset($entry['access'])) PackValidator::check(in_array($entry['access'], ['free', 'premium'], true), __('Invalid pack access.', 'wconvert'));
            // Pack requests stay on the configured service, with no redirects.
            $origin = wp_parse_url($source);
            $target = wp_parse_url($entry['url']);
            PackValidator::check(is_array($origin) && is_array($target) && !isset($target['user']) && !isset($target['pass']) && !isset($target['fragment']) && ($origin['scheme'] ?? '') === ($target['scheme'] ?? '') && ($origin['host'] ?? '') === ($target['host'] ?? '') && ($origin['port'] ?? null) === ($target['port'] ?? null), __('A pack address does not belong to this catalog service.', 'wconvert'));
        }
        $this->options->set(self::CACHE_OPTION, ['source' => $source, 'checked_at' => gmdate('c'), 'packs' => $index['packs'], 'collections' => $discovery ? $index['collections'] : [], 'release' => $discovery ? $index['release'] : null]);
        return $this->status();
    }

    /** @return array<string, mixed> */
    public function preview(string $id, bool $useInstalled = false): array
    {
        if ($useInstalled) {
            foreach ($this->installed->packs() as $pack) {
                if ($pack['id'] === $id) return $this->view($pack);
            }
        }
        $json = $this->download($id);
        $pack = $this->validator->decode($json);
        $pack['digest'] = hash('sha256', $json);
        $this->prepareImages($pack);
        return $this->view($this->installed->withImages($pack));
    }

    /** @return array<string, mixed> */
    public function install(string $id, string $digest): array
    {
        $json = $this->download($id);
        PackValidator::check(hash_equals(hash('sha256', $json), $digest), __('This pack changed after you previewed it. Preview it again before installing.', 'wconvert'));
        $pack = $this->validator->decode($json);
        $pack['digest'] = hash('sha256', $json);
        $this->prepareImages($pack);
        $this->installed->install($json);
        return $this->status();
    }

    /** @param array<string, mixed> $pack
     * @return array<string, mixed>
     */
    private function view(array $pack): array
    {
        $templates = [];
        foreach ($pack['templates'] as $template) {
            $template['id'] = InstalledPacks::designId($pack, $template['id']);
            $templates[] = $template;
        }
        $starts = [];
        foreach ($pack['playbooks'] ?? [] as $entry) {
            $starts[] = ['id' => InstalledPacks::designId($pack, $entry['id']), 'name' => $entry['name'],
                'goal' => $entry['goal'], 'goal_label' => \WConvert\Goal\Goal::from($entry['goal'])->label(),
                'template_id' => InstalledPacks::designId($pack, $entry['template_id'])];
        }
        return ['id' => $pack['id'], 'name' => $pack['name'], 'version' => $pack['version'], 'digest' => $pack['digest'], 'templates' => $templates, 'starting_points' => $starts];
    }

    /** Only exact installed pack releases can supply featured setup references.
     * @return list<array<string, mixed>>
     */
    public function collections(): array
    {
        $cache = $this->options->get(self::CACHE_OPTION, []);
        if (!is_array($cache) || ($cache['source'] ?? '') !== $this->source()) return [];
        $packs = $this->installed->packs(); $collections = [];
        foreach ($cache['collections'] ?? [] as $collection) {
            $items = [];
            foreach ($collection['items'] as $item) {
                foreach ($packs as $pack) {
                    if ($pack['id'] !== $item['pack_id'] || $pack['digest'] !== $item['pack_digest']) continue;
                    foreach ($pack['playbooks'] ?? [] as $setup) if ($setup['id'] === $item['setup_id']) $items[] = ['setup_id' => InstalledPacks::designId($pack, $setup['id']), 'stage' => $item['stage']];
                    break;
                }
            }
            if (!$items) continue;
            $collection['items'] = $items;
            $collection['id'] = 'catalog-' . $collection['id'];
            $collections[] = $collection;
        }
        return $collections;
    }

    private function download(string $id): string
    {
        $cache = $this->options->get(self::CACHE_OPTION, []);
        PackValidator::check(is_array($cache) && ($cache['source'] ?? '') === $this->source(), __('Refresh the catalog before previewing this pack.', 'wconvert'));
        foreach ($cache['packs'] ?? [] as $entry) {
            if ($entry['id'] !== $id) continue;
            $json = $this->transport->get($entry['url']);
            PackValidator::check(hash_equals($entry['sha256'], hash('sha256', $json)), __('The downloaded pack did not match the catalog. Refresh and try again.', 'wconvert'));
            $pack = $this->validator->decode($json);
            PackValidator::check($pack['id'] === $entry['id'] && $pack['version'] === $entry['version'], __('The downloaded pack has the wrong identity.', 'wconvert'));
            return $json;
        }
        throw new \RuntimeException(__('This pack is no longer listed. Refresh the catalog.', 'wconvert'));
    }

    /** @param array<string, mixed> $pack */
    private function prepareImages(array $pack): void
    {
        // Premium delivery remains closed until the real licence adapter exists.
        foreach ($pack['assets'] as $asset) PackValidator::check($asset['access'] === 'free', __('Premium image downloads are not connected yet.', 'wconvert'));
        $origin = wp_parse_url($this->source());
        $this->installed->prepareImages($pack, function (array $asset) use ($origin): string {
            if (!$this->transport instanceof CatalogImageTransport || !is_array($origin) || !isset($origin['scheme'], $origin['host'])) throw new \RuntimeException(__('Image installation is unavailable.', 'wconvert'));
            // No author-supplied URL: use the configured catalog origin only.
            $url = $origin['scheme'] . '://' . $origin['host'] . (isset($origin['port']) ? ':' . $origin['port'] : '')
                . '/assets/' . VerifiedAssets::key($asset);
            return $this->transport->image($url, $asset['bytes']);
        });
    }

    /**
     * Whether this site has a catalog to offer at all. No catalog is configured
     * by default, so the admin hides Template packs rather than open a screen
     * that can only say so.
     */
    public static function configured(OptionStore $options): bool
    {
        $value = $options->get(self::SOURCE_OPTION, '');
        return is_string($value) && $value !== '';
    }

    private function source(): string
    {
        $value = $this->options->get(self::SOURCE_OPTION, '');
        return is_string($value) ? $value : '';
    }
    // phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
}
