<?php

namespace WConvert\Rules;

defined('ABSPATH') || exit;

/**
 * The rule manifest — one JSON file, read by both runtimes (ADR 0005).
 *
 * It holds one section per axis. **Only `targeting` is here yet**, because
 * only the Targeting axis has an implementation to be the source of truth
 * for; the `triggers` and `conditions` sections arrive with the loader that
 * evaluates them, since nothing is written before its subject (ADR 0029).
 *
 * Every entry carries `kind`, `tier`, `consent_category` and `on_absence`.
 * The last two are `null` for every targeting entry, and that is a statement
 * rather than a gap: Targeting is evaluated on the server, writes nothing to
 * the visitor's device, and is never degraded away — so it has no WP Consent
 * API category to declare and no absence behaviour to choose. A Trigger or a
 * Condition arriving in this file must name both.
 *
 * `bin/check-loader.mjs` reads this file for the identifiers it calls premium,
 * so that scan cannot drift from what the manifest says (ADR 0029, check b).
 *
 * @since 0.1.0
 */
final class RuleManifest
{
    public const PATH = 'resources/rules/manifest.json';

    /**
     * The manifest, decoded.
     *
     * Reading it is fail-closed in the same sense the source contract is: an
     * unreadable or unparseable manifest throws rather than degrading to an
     * empty vocabulary, because an empty vocabulary silently accepts nothing
     * and shows nothing.
     *
     * @return array<string, array<string, array<string, mixed>>>
     */
    public static function load(string $pluginDir = WCONVERT_DIR): array
    {
        $path = rtrim($pluginDir, '/') . '/' . self::PATH;
        $raw = is_readable($path) ? file_get_contents($path) : false;

        if ($raw === false) {
            throw new \RuntimeException(sprintf('WConvert rule manifest is unreadable at %s.', $path));
        }

        $decoded = json_decode($raw, true);

        if (!is_array($decoded)) {
            throw new \RuntimeException(sprintf('WConvert rule manifest at %s is not valid JSON.', $path));
        }

        /** @var array<string, array<string, array<string, mixed>>> $decoded */
        return $decoded;
    }

    /**
     * Entries in one axis, keyed by rule type.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function axis(string $axis, string $pluginDir = WCONVERT_DIR): array
    {
        $section = self::load($pluginDir)[$axis] ?? [];

        return is_array($section) ? $section : [];
    }
}
