<?php

namespace WConvert\Rules;

use WConvert\Support\JsonManifest;

defined('ABSPATH') || exit;

/**
 * The rule manifest — one JSON file, read by both runtimes (ADR 0005).
 *
 * One section per axis: `targeting`, `triggers`, `conditions`. Every entry
 * carries `kind`, `tier`, `consent_category` and `on_absence`.
 *
 * Targeting's last two are `null`, and that is a statement rather than a gap:
 * it is evaluated on the server, writes nothing to the visitor's device, and
 * is never degraded away — so it has no WP Consent API category to declare and
 * no absence behaviour to choose. A Trigger or a Condition must name both.
 *
 * **PHP reads this at runtime**, through {@see RuleVocabulary}, to partition
 * an Optin's flat rule list into `triggers` and `conditions` at publish time.
 * That is the whole of PHP's business with the client axes — it never
 * evaluates one. `bin/check-loader.mjs` reads the same file for the
 * identifiers it calls premium, so that scan cannot drift from what the
 * manifest says (ADR 0029, check b).
 *
 * **The loader does NOT import this file**, and that is a correction to
 * ADR 0005's "the JS build imports it" recorded inline in the ADR itself: a
 * whole-manifest import inlines every entry into free's bundle, premium ones
 * included, which is precisely the leak ADR 0029's check (b) scans for. Free's
 * loader modules declare their own kind and consent category; the manifest
 * stays the source of truth, and the TypeScript parity tests assert the two
 * agree.
 *
 * @since 0.1.0
 */
final class RuleManifest
{
    public const PATH = 'resources/rules/manifest.json';

    /**
     * The manifest, decoded — fail-closed, which is
     * {@see \WConvert\Support\JsonManifest}'s whole reason for existing.
     *
     * @return array<string, array<string, array<string, mixed>>>
     */
    public static function load(string $pluginDir = WCONVERT_DIR): array
    {
        /** @var array<string, array<string, array<string, mixed>>> $decoded */
        $decoded = JsonManifest::load(rtrim($pluginDir, '/') . '/' . self::PATH, 'rule manifest');

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
