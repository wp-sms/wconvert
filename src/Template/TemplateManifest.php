<?php

namespace WConvert\Template;

use WConvert\Support\JsonManifest;

defined('ABSPATH') || exit;

/**
 * The template vocabulary manifest — one JSON file, the closed list of every
 * member a template may name (ADR 0010).
 *
 * Four sections: `layouts`, `nodes`, `tokens` and `roles`, plus the closed set
 * of `fields` a `field` node may capture. It carries no HTML and no CSS,
 * because a template carries neither — which is what makes validation against
 * it the whole of the sanitisation story here. `wp_kses` does not apply to
 * templates at all.
 *
 * **PHP reads this at runtime**, through {@see TemplateVocabulary}, to validate
 * a tree on the way in. The LOADER does not import it: an unrecognised node is
 * skipped structurally by the renderer's own switch, so a whole-manifest import
 * would put the vocabulary into the byte budget for a lookup nothing performs.
 * `tests/js/renderer-manifest-parity.test.ts` asserts the renderer implements
 * exactly what this declares, the same arrangement {@see \WConvert\Rules\RuleManifest}
 * has and for the same reason.
 *
 * @since 0.1.0
 */
final class TemplateManifest
{
    public const PATH = 'resources/templates/manifest.json';

    /**
     * The manifest, decoded — fail-closed, which is
     * {@see \WConvert\Support\JsonManifest}'s whole reason for existing.
     *
     * @return array<string, mixed>
     */
    public static function load(string $pluginDir = WCONVERT_DIR): array
    {
        return JsonManifest::load(rtrim($pluginDir, '/') . '/' . self::PATH, 'template manifest');
    }
}
