<?php

namespace WConvert\Template\Catalog;

defined('ABSPATH') || exit;

final class WpCatalogTransport implements CatalogTransport, CatalogImageTransport
{
    public function get(string $url): string
    {
        return $this->request($url, PackValidator::MAX_BYTES, 'application/json');
    }

    public function image(string $url, int $bytes): string
    {
        PackValidator::check($bytes > 0 && $bytes <= VerifiedAssets::MAX_BYTES, __('Image exceeds the download budget.', 'wconvert'));
        return $this->request($url, $bytes, 'image/png, image/jpeg, image/webp');
    }

    private function request(string $url, int $limit, string $accept): string
    {
        $parts = wp_parse_url($url);
        $local = wp_get_environment_type() === 'local'
            && ($parts['host'] ?? '') === wp_parse_url(home_url(), PHP_URL_HOST)
            && ($parts['scheme'] ?? '') === 'http';
        PackValidator::check(is_array($parts) && !isset($parts['user']) && !isset($parts['pass']) && !isset($parts['fragment'])
            && (($parts['scheme'] ?? '') === 'https' || $local), __('The catalog needs a secure HTTPS address.', 'wconvert'));
        $response = wp_safe_remote_get($url, [
            'timeout' => 15,
            'redirection' => 0,
            'limit_response_size' => $limit + 1,
            'headers' => ['Accept' => $accept],
            // No WordPress version, site URL, licence, campaign or lead data.
            'user-agent' => 'WConvert template catalog',
        ]);
        if ($response instanceof \WP_Error) throw new \RuntimeException(__('The catalog could not be reached. Installed designs are still available. Retry when the connection returns.', 'wconvert'));
        PackValidator::check(wp_remote_retrieve_response_code($response) === 200, __('The catalog could not be reached. Installed designs are still available. Retry when the connection returns.', 'wconvert'));
        $body = wp_remote_retrieve_body($response);
        PackValidator::check(strlen($body) <= $limit, __('The catalog response is too large.', 'wconvert'));
        return $body;
    }
}
