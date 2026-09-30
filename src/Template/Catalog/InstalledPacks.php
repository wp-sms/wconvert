<?php

namespace WConvert\Template\Catalog;

use WConvert\Template\TemplateSource;

defined('ABSPATH') || exit;

/**
 * Immutable JSON copies. The highest installed version supplies new designs.
 * One instance represents one request, so its validated archive snapshot is
 * shared by template, Playbook and catalog consumers and refreshed after a
 * successful install or repair.
 */
final class InstalledPacks implements TemplateSource
{
    /** @var list<array<string, mixed>>|null */
    private ?array $cachedPacks = null;

    public function __construct(private readonly string $directory, private readonly PackValidator $validator)
    {
    }

    /** @return list<array<string, mixed>> */
    public function packs(): array
    {
        if ($this->cachedPacks !== null) {
            return $this->cachedPacks;
        }

        $packs = [];
        foreach (array_slice(glob($this->directory . '/*.json') ?: [], 0, 128) as $file) {
            if (!is_readable($file) || filesize($file) > PackValidator::MAX_BYTES) continue;
            $json = file_get_contents($file);
            if ($json === false || basename($file) !== hash('sha256', $json) . '.json') continue;
            try {
                $pack = $this->validator->decode($json);
                $pack['digest'] = hash('sha256', $json);
                $packs[] = $pack;
            } catch (\RuntimeException $error) {
                // A corrupt local file must not take the bundled library down.
                continue;
            }
        }
        usort($packs, static fn (array $a, array $b): int => version_compare($b['version'], $a['version']));
        return $this->cachedPacks = $packs;
    }

    /** @return list<array<string, mixed>> */
    public function entries(): array
    {
        $seen = [];
        $entries = [];
        foreach ($this->packs() as $pack) {
            $current = !isset($seen[$pack['id']]);
            $seen[$pack['id']] = true;
            foreach ($pack['templates'] as $template) {
                // The digest keeps every original baseline addressable, including
                // two simultaneous installations of the same release identifier.
                $template['design_key'] = 'pack:' . $pack['id'] . ':' . $template['id'];
                $template['id'] = self::designId($pack, $template['id']);
                $template['catalog_current'] = $current;
                $entries[] = $template;
            }
        }
        return $entries;
    }

    /** Only the newest installed release offers new campaign starts.
     * @return list<array<string, mixed>>
     */
    public function playbooks(): array
    {
        $seen = []; $entries = [];
        foreach ($this->packs() as $pack) {
            if (isset($seen[$pack['id']])) continue;
            $seen[$pack['id']] = true;
            foreach ($pack['playbooks'] ?? [] as $entry) {
                $entry['id'] = self::designId($pack, $entry['id']);
                $entry['template_id'] = self::designId($pack, $entry['template_id']);
                $entry['collection'] = ['id' => $pack['id'], 'name' => $pack['name'], 'version' => $pack['version']];
                $entries[] = $entry;
            }
        }
        return $entries;
    }

    /** @param array<string, mixed> $pack */
    public static function designId(array $pack, string $id): string
    {
        return 'pack-' . substr($pack['digest'], 0, 24) . '-' . $id;
    }

    /** @return array<string, mixed> */
    public function install(string $json): array
    {
        $pack = $this->validator->decode($json);
        $pack['digest'] = hash('sha256', $json);
        // Writes are rare and may race another request. Refresh before every
        // version decision so an older request-local snapshot cannot replace
        // a newer release another request just installed.
        $this->cachedPacks = null;
        $files = glob($this->directory . '/*.json') ?: [];
        $path = $this->directory . '/' . $pack['digest'] . '.json';
        if (is_file($path) && hash_file('sha256', $path) === $pack['digest']) return $pack;
        PackValidator::check(count($files) < 128 || is_file($path), __('The local pack archive is full. Existing designs remain available.', 'wconvert'));
        foreach ($this->packs() as $installed) {
            if ($installed['id'] !== $pack['id']) continue;
            PackValidator::check(version_compare($pack['version'], $installed['version'], '>'), __('This pack version is already installed or has been replaced. Refresh the catalog.', 'wconvert'));
        }
        PackValidator::check(is_dir($this->directory) || @mkdir($this->directory, 0755, true), __('The template folder could not be created. Check uploads permissions and retry.', 'wconvert'));
        $temporary = @tempnam($this->directory, '.pack-');
        PackValidator::check($temporary !== false, __('The template pack could not be written.', 'wconvert'));
        try {
            PackValidator::check(@file_put_contents($temporary, $json, LOCK_EX) === strlen($json), __('The template pack could not be written.', 'wconvert'));
            PackValidator::check(@rename($temporary, $path), __('The template pack could not be installed.', 'wconvert'));
            $this->cachedPacks = null;
        } finally {
            if (is_file($temporary)) unlink($temporary);
        }
        return $pack;
    }
}
