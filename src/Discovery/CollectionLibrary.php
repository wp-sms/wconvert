<?php

namespace WConvert\Discovery;

use WConvert\Playbook\PlaybookLibrary;

defined('ABSPATH') || exit;

/** Curated membership is separate from the pack that delivered a setup. */
final class CollectionLibrary
{
    public function __construct(private readonly string $directory, private readonly PlaybookLibrary $playbooks, private readonly \WConvert\Template\Catalog\TemplateCatalog $catalog) {}

    /** Only reviewed exact source references survive changes to either dependency.
     * @return list<array<string, mixed>>
     */
    public function all(): array
    {
        $collections = $this->catalog->collections();
        $labelsFile = $this->directory . '/resources/collections/labels.php';
        $labels = is_file($labelsFile) ? require $labelsFile : [];
        foreach (glob($this->directory . '/resources/collections/*.json') ?: [] as $file) {
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file inside this site, never a URL.
            $collection = json_decode((string) file_get_contents($file), true);
            if (!is_array($collection) || ($collection['status'] ?? '') !== 'published') continue;
            $items = []; $stale = false;
            foreach ($collection['items'] ?? [] as $item) {
                $setup = $this->playbooks->find($item['setup_id']);
                if ($setup === null) continue;
                $pro = defined('WCONVERT_PRO_DIR') ? WCONVERT_PRO_DIR : $this->directory . '/pro/';
                $setupFile = is_file($this->directory . '/resources/playbooks/' . $setup->id . '.php') ? $this->directory . '/resources/playbooks/' . $setup->id . '.php' : (glob($pro . 'modules/*/playbooks/' . $setup->id . '.php')[0] ?? '');
                $designFile = is_file($this->directory . '/resources/templates/library/' . $setup->templateId . '.json') ? $this->directory . '/resources/templates/library/' . $setup->templateId . '.json' : (glob($pro . 'modules/*/templates/' . $setup->templateId . '.json')[0] ?? '');
                if (!is_file($setupFile) || !is_file($designFile)) continue;
                $setupHash = hash_file('sha256', $setupFile); $designHash = hash_file('sha256', $designFile);
                if (!is_string($setupHash) || !is_string($designHash) || !hash_equals($item['setup_hash'], $setupHash)
                    || !hash_equals($item['design_hash'], $designHash)) { $stale = true; break; }
                $items[] = ['setup_id' => $setup->id, 'stage' => $item['stage']];
            }
            // Do not publish a partly stale collection under its reviewed revision.
            if (!$items || $stale) continue;
            if (isset($labels[$collection['id']])) $collection = array_replace($collection, $labels[$collection['id']]);
            $collections[] = array_intersect_key($collection, array_flip([
                'id', 'revision', 'name', 'description', 'business_types', 'markets', 'priority', 'cover', 'event',
            ])) + ['items' => $items];
        }
        usort($collections, static fn (array $a, array $b): int => ($b['priority'] <=> $a['priority']) ?: strcmp($a['id'], $b['id']));
        return $collections;
    }
}
