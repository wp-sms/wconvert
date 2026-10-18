<?php

namespace WConvert\Pro\License;

use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Support\Request;

defined('ABSPATH') || exit;

/**
 * Everything {@see LicenseState} needs to know, read once.
 *
 * A value, so the state model is pure: what WordPress and the SDK say is
 * gathered here by whoever builds it, and nothing in `LicenseState` reaches
 * back out for more.
 *
 * @since 0.1.0
 */
final class LicenseFacts
{
    /**
     * @param array<string, mixed>|null $license The SDK's stored `license` section.
     * @param string|null $key The decrypted key; null when there is none or it no longer decrypts.
     * @param int $now Unix time.
     * @param string $installed Pro's installed version.
     * @param string $here This site's domain.
     * @param array{was: string, now: string}|null $domainChange The SDK's `domainChange()`.
     * @param array<string, mixed>|null $manifest The SDK's cached update manifest.
     * @param bool $fileMods Whether WordPress may install files (`wp_is_file_mod_allowed()`).
     * @param string $updateUrl WordPress's nonce'd upgrade link for Pro.
     * @param int|null $updatesCheckedAt When WordPress last checked for updates.
     * @param string $store The store's base URL.
     * @param bool $managed Whether the key comes from wp-config.php (`WCONVERT_LICENSE_KEY`).
     * @param string $contact `WCONVERT_LICENSE_CONTACT`: 'Acme Studio <help@acme.studio>', a name, or an address.
     * @param array{error_code: string|null, retry_at: int}|null $autoActivation The SDK's last failed wp-config activation.
     */
    public function __construct(
        public readonly ?array $license,
        public readonly ?string $key,
        public readonly int $now,
        public readonly string $installed,
        public readonly string $here,
        public readonly ?array $domainChange = null,
        public readonly ?array $manifest = null,
        public readonly bool $fileMods = true,
        public readonly string $updateUrl = '',
        public readonly ?int $updatesCheckedAt = null,
        public readonly string $store = SdkConfig::DEFAULT_STORE,
        public readonly bool $managed = false,
        public readonly string $contact = '',
        public readonly ?array $autoActivation = null,
    ) {
    }

    /**
     * Read what this request knows, without asking the store anything.
     *
     * For the licence UI, the key is decrypted here: null means none is stored or
     * it no longer decrypts (rotated salts, veronalabs/wp-premium-sdk#29), and
     * `getLicenseData()` — which fatals on exactly that — is never called.
     */
    public static function fromSite(PremiumServiceProvider $sdk): self
    {
        $license = $sdk->store()->get('license');
        $basename = plugin_basename(WCONVERT_PRO_MAIN_FILE);
        $updates = get_site_transient('update_plugins');
        $contact = defined(SdkConfig::CONTACT_CONSTANT) ? constant(SdkConfig::CONTACT_CONSTANT) : '';

        return new self(
            license: $license,
            key: $license === null ? null : $sdk->licenseManager()->getLicenseKey(),
            now: time(),
            installed: WCONVERT_PRO_VERSION,
            here: Request::normaliseDomain(Request::currentDomain()),
            domainChange: $sdk->licenseManager()->domainChange(),
            manifest: $sdk->pluginUpdater()->cachedManifest(),
            fileMods: wp_is_file_mod_allowed('wconvert_pro_update'),
            updateUrl: wp_nonce_url(self_admin_url('update.php?action=upgrade-plugin&plugin=' . rawurlencode($basename)), 'upgrade-plugin_' . $basename),
            updatesCheckedAt: is_object($updates) && isset($updates->last_checked) ? (int) $updates->last_checked : null,
            store: SdkConfig::storeUrl(),
            managed: $sdk->keySource()->constantKey() !== null,
            contact: is_string($contact) ? $contact : '',
            autoActivation: $sdk->autoActivator()->lastFailure(),
        );
    }
}
