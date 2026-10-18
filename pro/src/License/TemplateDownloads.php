<?php
namespace WConvert\Pro\License;

use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Support\Request;
use WConvert\Template\Catalog\CatalogTransport;
use WConvert\Template\Catalog\CatalogImageTransport;
use WConvert\Template\Catalog\CatalogPackTransport;
use WConvert\Template\Catalog\WpCatalogTransport;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Catalog\VerifiedAssets;

defined('ABSPATH') || exit;

/** Explicit admin downloads only. Nexus decides access, never local plan/status flags. */
final class TemplateDownloads implements CatalogTransport, CatalogImageTransport, CatalogPackTransport
{
    // phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- plain admin errors rendered as text.
    private string $grant = '';
    private string $digest = '';
    private int $expires = 0;

    public function __construct(
        private readonly PremiumServiceProvider $sdk,
        private readonly WpCatalogTransport $public,
        private readonly string $origin,
    ) {}

    public function get(string $url): string { return $this->public->get($url); }

    public function pack(string $url, string $digest): string
    {
        $this->assertUrl($url);
        PackValidator::check(preg_match('/^[a-f0-9]{64}$/D', $digest) === 1 && $url === $this->origin . '/downloads/' . $digest . '.json', __('Invalid premium pack address.', 'wconvert-pro'));
        // Each preview/install is an explicit authorization, including updates.
        $this->digest = $digest;
        $this->grant = '';
        return $this->download($url, PackValidator::MAX_BYTES);
    }

    public function image(string $url, int $bytes): string
    {
        if (!str_contains($url, '/assets/premium/')) return $this->public->image($url, $bytes);
        $this->assertUrl($url);
        PackValidator::check($this->digest !== '' && preg_match('#^/assets/premium/[a-f0-9]{64}\.(png|jpg|webp)$#D', (string) wp_parse_url($url, PHP_URL_PATH)) === 1
            && $bytes > 0 && $bytes <= VerifiedAssets::MAX_BYTES, __('Invalid premium image request. Preview the pack again.', 'wconvert-pro'));
        return $this->download($url, $bytes);
    }

    private function assertUrl(string $url): void
    {
        // An editable catalogue URL alone never authorizes sending a credential.
        $parts = wp_parse_url($this->origin);
        PackValidator::check(is_array($parts) && ($parts['scheme'] ?? '') === 'https' && !empty($parts['host'])
            && !isset($parts['user']) && !isset($parts['pass']) && !isset($parts['query']) && !isset($parts['fragment']) && empty($parts['path'])
            && str_starts_with($url, $this->origin . '/') && !str_contains($url, '?') && !str_contains($url, '#'),
            __('Premium template downloads are not configured for this catalog. Installed designs are still available.', 'wconvert-pro'));
    }

    private function authorize(): void
    {
        $key = $this->sdk->keySource()->provided()['key'] ?? $this->sdk->licenseManager()->getLicenseKey();
        PackValidator::check(is_string($key) && $key !== '', __('Connect your WConvert Pro licence in Settings → License to download premium templates.', 'wconvert-pro'));
        $domain = Request::normaliseDomain(Request::currentDomain());
        $body = $this->request($this->origin . '/grants', 16384, [
            'method' => 'POST',
            'headers' => ['Content-Type' => 'application/json', 'X-License-Key' => $key],
            'body' => wp_json_encode(['domain' => $domain, 'pack' => $this->digest]),
        ]);
        $data = json_decode($body, true);
        PackValidator::check(is_array($data) && is_string($data['grant'] ?? null) && strlen($data['grant']) <= 8192
            && preg_match('/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/D', $data['grant']) === 1
            && is_int($data['expires_in'] ?? null) && $data['expires_in'] > 0 && $data['expires_in'] <= 300,
            __('Template access could not be verified. Try again later. Installed designs are still available.', 'wconvert-pro'));
        $this->grant = $data['grant'];
        $this->expires = time() + $data['expires_in'];
    }

    private function download(string $url, int $limit): string
    {
        if ($this->grant === '' || $this->expires <= time()) $this->authorize();
        try {
            return $this->request($url, $limit, ['method' => 'GET', 'headers' => ['Authorization' => 'Bearer ' . $this->grant]]);
        } catch (\RuntimeException $error) {
            // One fresh pass if expiry occurs between files. No loops on refusals/outages.
            if ($error->getCode() !== 401) throw $error;
            $this->grant = '';
            $this->authorize();
            return $this->request($url, $limit, ['method' => 'GET', 'headers' => ['Authorization' => 'Bearer ' . $this->grant]]);
        }
    }

    /** @param array<string, mixed> $args */
    private function request(string $url, int $limit, array $args): string
    {
        $this->assertUrl($url);
        // Nexus issuance backoff must not stop files covered by an existing pass.
        $scope = str_ends_with($url, '/grants') ? 'grants' : 'files';
        $retryKey = 'wconvert_template_retry_' . hash('sha256', $this->origin . '/' . $scope);
        $retryAt = (int) get_transient($retryKey);
        if ($retryAt > time()) throw new \RuntimeException(sprintf(__('Template downloads are temporarily unavailable. Try again in %d seconds. Installed designs are still available.', 'wconvert-pro'), $retryAt - time()));
        $response = wp_safe_remote_request($url, $args + ['timeout' => 15, 'redirection' => 0, 'limit_response_size' => $limit + 1, 'user-agent' => 'WConvert template downloads']);
        if ($response instanceof \WP_Error) throw new \RuntimeException(__('The template server could not be reached. Try again later. Installed designs are still available.', 'wconvert-pro'));
        $status = (int) wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        PackValidator::check(strlen($body) <= $limit, __('The template server response is too large.', 'wconvert-pro'));
        if ($status === 200) return $body;
        $error = json_decode($body, true);
        $code = is_array($error) ? ($error['error_code'] ?? '') : '';
        if (in_array($status, [429, 503], true)) {
            $seconds = min(3600, max(1, (int) wp_remote_retrieve_header($response, 'retry-after') ?: 30));
            set_transient($retryKey, time() + $seconds, $seconds);
            throw new \RuntimeException(sprintf(__('Template downloads are temporarily unavailable. Try again in %d seconds. Installed designs are still available.', 'wconvert-pro'), $seconds));
        }
        if ($this->sdk->keySource()->constantKey() !== null
            && in_array($code, ['invalid_key', 'license_expired', 'key_disabled', 'license_suspended', 'license_revoked', 'domain_not_allowed'], true)) {
            throw new \RuntimeException(__('Premium template access is unavailable. Contact the person managing your licence. Installed designs still work.', 'wconvert-pro'));
        }
        $message = match ($code) {
            'invalid_key' => __('Your licence could not be verified. Check Settings → License before downloading premium templates.', 'wconvert-pro'),
            'license_expired' => __('Renew your WConvert Pro licence to download new premium templates. Installed designs still work.', 'wconvert-pro'),
            'key_disabled', 'license_suspended', 'license_revoked' => __('This licence cannot download premium templates. Check Settings → License or contact support. Installed designs still work.', 'wconvert-pro'),
            'domain_not_allowed' => __('Activate this website in Settings → License before downloading premium templates.', 'wconvert-pro'),
            'invalid_grant' => __('Template access expired. Preview the pack again.', 'wconvert-pro'),
            'not_found' => __('This template file is no longer available. Refresh the catalog and try again.', 'wconvert-pro'),
            default => __('Template access could not be verified. Try again later. Installed designs are still available.', 'wconvert-pro'),
        };
        throw new \RuntimeException($message, $code === 'invalid_grant' && $status === 401 ? 401 : 0);
    }
    // phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
}
