<?php

namespace WConvert\Pro\License;

use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\License\LicenseManager;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Update\PluginUpdater;

defined('ABSPATH') || exit;

/**
 * Pro is offered an update only while its licence entitles it to one.
 *
 * Two halves, both ports of WSMS @530317f79, both there because of the SDK
 * (veronalabs/wp-premium-sdk#33, #34):
 *
 * 1. **The gate.** The SDK's updater adds its offer from a cached manifest and
 *    never takes it back, so an offer made while the licence was valid
 *    survives its expiry in WordPress's own `update_plugins` transient. At
 *    priority 20, after the SDK's injector, Pro's entry moves to `no_update`
 *    unless the licence is valid and its key can still be read.
 * 2. **The flush.** The licence option is rewritten on every check — a new
 *    timestamp, the key encrypted afresh — and almost none of those writes
 *    mean anything to the updater. The caches are dropped only when what the
 *    update depends on changes: which activation is stored, and its status,
 *    expiry, plan and site count. Otherwise the Plugins screen waits out a
 *    12-hour transient after an activation, or refetches on every refresh.
 *
 * A licence never gates a feature (ADR 0015); this gates the download of the
 * next version, which is what a licence is for (ADR 0143).
 *
 * @since 0.1.0
 */
final class UpdateGate
{
    public function __construct(
        private readonly LicenseManager $license,
        private readonly PluginUpdater $updater,
        private readonly string $basename,
    ) {
    }

    public function hooks(): void
    {
        add_filter('pre_set_site_transient_update_plugins', [$this, 'gate'], 20);

        $option = SdkConfig::OPTION_KEY;

        add_action('add_option_' . $option, function (string $name, $value): void {
            $this->flushWhenEntitlementChanged(null, $value);
        }, 10, 2);
        add_action('update_option_' . $option, [$this, 'flushWhenEntitlementChanged'], 10, 2);
        add_action('delete_option_' . $option, [$this, 'flush']);
    }

    /**
     * @param mixed $transient WordPress's `update_plugins` value, or false.
     * @return mixed
     */
    public function gate($transient)
    {
        // WordPress builds it as a stdClass; anything else is not ours to edit.
        if (!$transient instanceof \stdClass || !isset($transient->response) || !is_array($transient->response)) {
            return $transient;
        }

        if (!isset($transient->response[$this->basename]) || $this->entitled()) {
            return $transient;
        }

        // To no_update rather than dropped, so WordPress reports "up to date"
        // instead of asking wp.org about a slug it has never heard of.
        $noUpdate = isset($transient->no_update) && is_array($transient->no_update) ? $transient->no_update : [];
        $noUpdate[$this->basename] = $transient->response[$this->basename];
        $transient->no_update = $noUpdate;
        unset($transient->response[$this->basename]);

        return $transient;
    }

    /**
     * @param mixed $old
     * @param mixed $new
     */
    public function flushWhenEntitlementChanged($old, $new): void
    {
        if (self::entitlement($old) !== self::entitlement($new)) {
            $this->flush();
        }
    }

    public function flush(): void
    {
        delete_site_transient('update_plugins');
        $this->updater->flush();
    }

    /**
     * What the update this site is offered depends on, or null with no licence.
     *
     * The stored key cannot be compared: it is encrypted with a new nonce on
     * every write. A new activation stamps a new `activated_at`, and every
     * refresh carries the old one over, so that is the activation's identity.
     *
     * @param mixed $option The licence option.
     * @return array<string, mixed>|null
     */
    public static function entitlement($option): ?array
    {
        $license = is_array($option) ? ($option['license'] ?? null) : null;

        if (!is_array($license) || empty($license['license_key'])) {
            return null;
        }

        return [
            'activated_at' => $license['activated_at'] ?? null,
            'status' => (string) ($license['status'] ?? ''),
            'expires_at' => (string) ($license['expires_at'] ?? ''),
            'plan' => (string) ($license['tier_slug'] ?? ''),
            'sites' => [(int) ($license['activation_count'] ?? 0), (int) ($license['max_activations'] ?? 0)],
        ];
    }

    /**
     * Valid by the SDK's own test, and the key still decrypts. A site whose
     * salts were rotated reads as active and cannot be updated
     * (veronalabs/wp-premium-sdk#29), so it is not entitled.
     */
    private function entitled(): bool
    {
        return $this->license->isValid() && $this->license->getLicenseKey() !== null;
    }
}
