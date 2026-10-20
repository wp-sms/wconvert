<?php

namespace WConvert\Template\Catalog;

use WConvert\Support\JsonManifest;

defined('ABSPATH') || exit;

/**
 * The plugin version that introduced each vocabulary entry (ADR 0156).
 *
 * A published design declares `requires.plugin`, and the publisher computes it
 * from what the design actually uses — never from the build's own version,
 * which made every rebuild demand the newest plugin. That computation needs
 * every node, param, content key, role, choice, token and field to say when it
 * arrived, so each one is stamped here.
 *
 * The stamps live in their own file, beside the manifest rather than inside
 * it, because the renderer and the admin import `manifest.json` and nothing
 * in a browser needs to know when a choice was added.
 *
 * `tests/unit/Template/Catalog/VocabularySinceTest.php` fails when a manifest
 * entry has no stamp, so a vocabulary addition cannot ship without saying
 * which release a design using it needs. Stamps are only ever added, never
 * changed: an installed reader compares against the number it was built with.
 */
final class VocabularySince
{
    public const PATH = 'resources/templates/since.json';

    /** Every capability a v3 design may declare, and the release that first read it. */
    public const CAPABILITIES = [
        'template-tree:2' => '1.0.0', 'template-tree:3' => '1.0.0', 'success-actions:1' => '1.0.0',
        'enquiry-choice:1' => '1.0.0', 'campaign-starts:1' => '1.0.0', 'paid-campaign-rules:1' => '1.0.0',
        'capture-journey:1' => '1.0.0', 'question-journey:1' => '1.0.0', 'pack-images:1' => '1.0.0',
        'commerce-products:1' => '1.0.0', 'result-product-filters:1' => '1.0.0', 'result-product-filters:2' => '1.0.0',
        'quiz-product-actions:1' => '1.0.0',
    ];

    /**
     * @param array<string, mixed> $manifest
     * @param array<string, string> $stamps
     */
    public function __construct(private readonly array $manifest, private readonly array $stamps)
    {
    }

    public static function load(string $pluginDir = WCONVERT_DIR): self
    {
        $dir = rtrim($pluginDir, '/');
        $stamps = JsonManifest::load($dir . '/' . self::PATH, 'template vocabulary stamps');
        unset($stamps['_note']);
        /** @var array<string, string> $stamps */
        return new self(JsonManifest::load($dir . '/resources/templates/manifest.json', 'template manifest'), $stamps);
    }

    /**
     * Every addressable vocabulary entry, as the key its stamp is filed under.
     *
     * @return list<string>
     */
    public function entries(): array
    {
        $keys = [];
        foreach (['layouts', 'nodes'] as $section) {
            foreach ($this->manifest[$section] ?? [] as $type => $definition) {
                $keys[] = 'node:' . $type;
                foreach (['params' => 'param', 'content' => 'content'] as $field => $prefix) {
                    foreach ($definition[$field] ?? [] as $name) $keys[] = $prefix . ':' . $type . '.' . $name;
                }
                foreach ($definition['roles'] ?? [] as $role) $keys[] = 'role:' . $type . '.' . $role;
                foreach ($definition['choices'] ?? [] as $param => $values) {
                    foreach ($values as $value) $keys[] = 'choice:' . $type . '.' . $param . '.' . $value;
                }
            }
        }
        foreach (array_keys($this->manifest['tokens'] ?? []) as $token) $keys[] = 'token:' . $token;
        foreach ($this->manifest['choices'] ?? [] as $token => $values) {
            foreach ($values as $value) $keys[] = 'token-choice:' . $token . '.' . $value;
        }
        foreach ($this->manifest['fields'] ?? [] as $field) $keys[] = 'field:' . $field;
        return array_values(array_unique($keys));
    }

    /** @return list<string> entries with no stamp, for the test and the stamping script */
    public function missing(): array
    {
        return array_values(array_diff($this->entries(), array_keys($this->stamps)));
    }

    /**
     * The lowest plugin version that can read this design: the newest stamp of
     * anything it uses, and of every capability it declares.
     *
     * @param array<string, mixed> $template a design with `tree` and `tokens`
     * @param list<string> $capabilities
     */
    public function requiredBy(array $template, array $capabilities): string
    {
        $used = [];
        $this->tokens(is_array($template['tokens'] ?? null) ? $template['tokens'] : [], $used);
        foreach ($template['tree']['steps'] ?? [] as $step) {
            if (is_array($step['content'] ?? null)) $this->walk($step['content'], $used);
        }
        $version = '1.0.0';
        foreach (array_unique($used) as $key) {
            $since = $this->stamps[$key] ?? null;
            // An unstamped entry is a build error, not a guess: the test above
            // keeps the file complete, so reaching this means it was skipped.
            if (!is_string($since)) throw new \RuntimeException('Unstamped vocabulary entry: ' . $key);
            if (version_compare($since, $version, '>')) $version = $since;
        }
        foreach ($capabilities as $capability) {
            $since = self::CAPABILITIES[$capability] ?? null;
            if ($since === null) throw new \RuntimeException('Unknown capability: ' . $capability);
            if (version_compare($since, $version, '>')) $version = $since;
        }
        return $version;
    }

    /**
     * @param array<mixed> $bag
     * @param list<string> $used
     */
    private function tokens(array $bag, array &$used): void
    {
        foreach ($bag as $token => $value) {
            $used[] = 'token:' . $token;
            if (is_string($value) && in_array($value, $this->manifest['choices'][$token] ?? [], true)) $used[] = 'token-choice:' . $token . '.' . $value;
        }
    }

    /**
     * @param array<string, mixed> $node
     * @param list<string> $used
     */
    private function walk(array $node, array &$used): void
    {
        $type = (string) ($node['type'] ?? '');
        $definition = $this->manifest['layouts'][$type] ?? $this->manifest['nodes'][$type] ?? [];
        $used[] = 'node:' . $type;
        foreach ($node as $key => $value) {
            if (in_array($key, ['type', 'id', 'children', 'start', 'end'], true)) continue;
            if ($key === 'role') { $used[] = 'role:' . $type . '.' . $value; continue; }
            if (in_array($key, $definition['content'] ?? [], true)) $used[] = 'content:' . $type . '.' . $key;
            if (in_array($key, $definition['params'] ?? [], true)) $used[] = 'param:' . $type . '.' . $key;
            // A value outside the list is normalised away, so it needs nothing.
            $choice = is_bool($value) ? ($value ? 'true' : 'false') : (is_scalar($value) ? (string) $value : null);
            if ($choice !== null && in_array($choice, $definition['choices'][$key] ?? [], true)) $used[] = 'choice:' . $type . '.' . $key . '.' . $choice;
            if (in_array($key, ['tokens', 'narrow'], true) && is_array($value)) $this->tokens($value, $used);
        }
        if ($type === 'field' && is_string($node['name'] ?? null)) $used[] = 'field:' . $node['name'];
        foreach (['children', 'start', 'end'] as $key) {
            foreach (is_array($node[$key] ?? null) ? $node[$key] : [] as $child) {
                if (is_array($child)) $this->walk($child, $used);
            }
        }
    }
}
