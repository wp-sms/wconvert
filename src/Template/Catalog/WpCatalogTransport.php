<?php

namespace WConvert\Template\Catalog;

defined('ABSPATH') || exit;

final class WpCatalogTransport implements CatalogTransport, CatalogImageTransport
{
    /**
     * Fixed and identical on every site: it names the plugin so the service
     * can count design downloads an administrator started (ADR 0156), and
     * nothing else — no WordPress version, site address, licence, campaign or
     * lead data.
     */
    public const USER_AGENT = 'WConvert template catalog';

    public function get(string $url, int $limit = PackValidator::MAX_BYTES): string
    {
        return $this->request($url, $limit, 'application/json')['body'];
    }

    public function revalidate(string $url, ?string $etag): ?array
    {
        $answer = $this->request($url, CatalogIndex::MAX_POINTER_BYTES, 'application/json', $etag);
        return $answer['status'] === 304 ? null : ['body' => $answer['body'], 'etag' => $answer['etag']];
    }

    public function image(string $url, int $bytes): string
    {
        PackValidator::check($bytes > 0 && $bytes <= VerifiedAssets::MAX_BYTES, __('Image exceeds the download budget.', 'wconvert'));
        return $this->request($url, $bytes, 'image/png, image/jpeg, image/webp')['body'];
    }

    /** @return array{status: int, body: string, etag: string|null} */
    private function request(string $url, int $limit, string $accept, ?string $etag = null): array
    {
        $parts = wp_parse_url($url);
        $local = wp_get_environment_type() === 'local'
            && ($parts['host'] ?? '') === wp_parse_url(home_url(), PHP_URL_HOST)
            && ($parts['scheme'] ?? '') === 'http';
        PackValidator::check(is_array($parts) && !isset($parts['user']) && !isset($parts['pass']) && !isset($parts['fragment'])
            && (($parts['scheme'] ?? '') === 'https' || $local), __('The catalog needs a secure HTTPS address.', 'wconvert'));
        $headers = ['Accept' => $accept];
        if ($etag !== null && preg_match('/^(?:W\/)?"[\x21\x23-\x7e]{1,128}"$/D', $etag) === 1) $headers['If-None-Match'] = $etag;
        $response = wp_safe_remote_get($url, [
            'timeout' => 15,
            'redirection' => 0,
            'limit_response_size' => $limit + 1,
            'headers' => $headers,
            'user-agent' => self::USER_AGENT,
        ]);
        // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- validation messages for an administrator, caught upstream and returned as a WP_Error that the admin renders as text; escaping here would print the entities.
        if ($response instanceof \WP_Error) throw new \RuntimeException(__('The catalog could not be reached. Installed designs are still available. Retry when the connection returns.', 'wconvert'));
        $status = (int) wp_remote_retrieve_response_code($response);
        if ($status === 304 && isset($headers['If-None-Match'])) return ['status' => 304, 'body' => '', 'etag' => $etag];
        PackValidator::check($status === 200, __('The catalog could not be reached. Installed designs are still available. Retry when the connection returns.', 'wconvert'));
        $body = wp_remote_retrieve_body($response);
        PackValidator::check(strlen($body) <= $limit, __('The catalog response is too large.', 'wconvert'));
        $tag = wp_remote_retrieve_header($response, 'etag');
        return ['status' => 200, 'body' => $body, 'etag' => is_string($tag) && $tag !== '' ? $tag : null];
    }
}
