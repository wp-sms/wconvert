<?php

namespace WConvert\Pro\License;

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
        public readonly string $store = 'https://my.wconvert.io',
        public readonly bool $managed = false,
        public readonly string $contact = '',
    ) {
    }
}
