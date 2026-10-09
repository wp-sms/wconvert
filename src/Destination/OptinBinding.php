<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * **An [[Optin]] holds [[Destination]] ids and nothing more** — this is the
 * one place that fact is read.
 *
 * Nothing more is what removes the second concept. A Destination is configured
 * once, site-wide, and *includes whatever selects the target inside the remote
 * system*, so two Optins feeding one audience reference one Destination; and
 * the per-Optin field map that would normally sit beside the binding is
 * eliminated by canonical field keys (CONTEXT.md, Destination;
 * {@see CanonicalFields}).
 *
 * The binding is read from the **published** config rather than the draft,
 * because the published config is what the visitor was shown and submitted
 * into — the same rule {@see \WConvert\Lead\CaptureForm} follows for what the
 * form declares. A Destination added to a draft and not published is a
 * decision the merchant has not made yet.
 *
 * @since 0.1.0
 */
final class OptinBinding
{
    /** The key an Optin's config holds its Destination ids under. */
    public const KEY = 'destinations';

    /**
     * The Destination ids one config binds, de-duplicated and in order.
     *
     * Anything that is not a ULID is dropped rather than passed on. The list
     * comes from a merchant-edited JSON blob, and an id that cannot name a
     * Destination can only ever produce a job whose handler finds nothing.
     *
     * @param array<string, mixed>|null $config
     * @return list<string>
     */
    public static function ids(?array $config): array
    {
        // Keeping leads in WConvert only is a promise not to forward future captures.
        if (self::captureMode($config) === 'local') return [];
        $bound = $config[self::KEY] ?? null;
        $ids = [];

        foreach (is_array($bound) ? $bound : [] as $id) {
            if (is_string($id) && \WConvert\Support\Ulid::isOne($id) && !in_array($id, $ids, true)) {
                $ids[] = $id;
            }
        }

        return $ids;
    }

    /** Every route for usage/recovery, without merging optional routes into the primary signup.
     * @param array<string, mixed>|null $config
     * @return list<string>
     */
    public static function allIds(?array $config): array
    {
        $ids = self::ids($config);
        if (self::captureMode($config) === 'local') { return $ids; }
        foreach ($config['submission_settings'] ?? [] as $setting) {
            array_push($ids, ...self::ids(['capture_mode' => 'connected', 'destinations' => $setting['destination_ids'] ?? []]));
        }
        return array_values(array_unique($ids));
    }

    /**
     * Where this Optin's leads go: `local` (kept in WConvert only) or
     * `connected` (forwarded to the bound services). The one reading of
     * `capture_mode`, so no caller can default it differently.
     *
     * **Local until a service is connected** (ADR 0133). An explicit choice
     * wins; with none stored, a config that binds a Destination anywhere is
     * connected and one that binds nothing is local — so a fresh setup has
     * nothing to fix, and a client that writes routes without naming a mode
     * is not silently cut off from them. The admin's `captureModeOf()` is the
     * other spelling; `tests/fixtures/link-and-capture-rules.json` holds both.
     *
     * @param array<string, mixed>|null $config
     * @return 'local'|'connected'
     */
    public static function captureMode(?array $config): string
    {
        $mode = $config['capture_mode'] ?? null;
        if ($mode === 'local' || $mode === 'connected') return $mode;

        $routes = is_array($config[self::KEY] ?? null) ? $config[self::KEY] : [];
        foreach (is_array($config['submission_settings'] ?? null) ? $config['submission_settings'] : [] as $setting) {
            if (is_array($setting) && is_array($setting['destination_ids'] ?? null)) array_push($routes, ...$setting['destination_ids']);
        }

        return array_filter($routes, static fn ($id): bool => is_string($id) && $id !== '') === [] ? 'local' : 'connected';
    }

    /**
     * @param array<string, mixed>|null $config
     */
    public static function binds(?array $config, string $destinationId): bool
    {
        return in_array($destinationId, self::allIds($config), true);
    }
}
