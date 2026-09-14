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
        // Collect-only is an explicit promise not to forward future captures.
        if (($config['capture_mode'] ?? null) === 'local') return [];
        $bound = $config[self::KEY] ?? null;
        $ids = [];

        foreach (is_array($bound) ? $bound : [] as $id) {
            if (is_string($id) && \WConvert\Support\Ulid::isOne($id) && !in_array($id, $ids, true)) {
                $ids[] = $id;
            }
        }

        return $ids;
    }

    /**
     * @param array<string, mixed>|null $config
     */
    public static function binds(?array $config, string $destinationId): bool
    {
        return in_array($destinationId, self::ids($config), true);
    }
}
