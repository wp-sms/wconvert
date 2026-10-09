<?php

namespace WConvert\Protection;

use Closure;
use WP_Error;

defined('ABSPATH') || exit;

/** Verifies a provider token on the server; never accepts a browser verdict. */
final class Verifier
{
    // Server-to-server verification endpoints, called with wp_remote_post()
    // only when the site owner has chosen that provider — never loaded into a
    // page. readme.txt lists each under External services.
    private const ENDPOINTS = [
        // phpcs:ignore PluginCheck.CodeAnalysis.Offloading.OffloadedContent -- see above: an API endpoint, not offloaded content.
        'turnstile' => 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        'recaptcha' => 'https://www.google.com/recaptcha/api/siteverify',
        'hcaptcha' => 'https://api.hcaptcha.com/siteverify',
    ];
    public function __construct(private readonly ?Closure $post = null) {}

    /** @phpstan-impure
     * @param array{provider: string, site_key: string, secret: string, rules: array<string, mixed>} $settings */
    public function verify(array $settings, string $token, string $hostname): ?WP_Error
    {
        if ($token === '' || strlen($token) > 4096) { return self::failed(); }
        $url = self::ENDPOINTS[$settings['provider']] ?? null;
        if ($url === null || $settings['secret'] === '' || $settings['site_key'] === '') { return self::unavailable(); }
        $body = ['secret' => $settings['secret'], 'response' => $token];
        if ($settings['provider'] === 'hcaptcha') { $body['sitekey'] = $settings['site_key']; }
        // The browser already talks to the provider. Do not additionally forward REMOTE_ADDR.
        $response = $this->post !== null ? ($this->post)($url, $body) : wp_remote_post($url, [
            'timeout' => 8, 'redirection' => 0, 'limit_response_size' => 16384, 'body' => $body,
        ]);
        if (!is_array($response) || ($response['response']['code'] ?? null) !== 200 || !is_string($response['body'] ?? null)) { return self::unavailable(); }
        $result = json_decode($response['body'], true);
        if (!is_array($result) || !is_bool($result['success'] ?? null)) { return self::unavailable(); }
        $errors = is_array($result['error-codes'] ?? null) ? $result['error-codes'] : [];
        if (array_intersect($errors, ['missing-input-secret', 'invalid-input-secret', 'sitekey-secret-mismatch', 'internal-error', 'bad-request', 'not-using-dummy-passcode']) !== []) { return self::unavailable(); }
        if (!$result['success']) { return self::failed(); }
        // hCaptcha authenticates the supplied sitekey; its hostname is informational
        // and may be "not-provided" under load (https://docs.hcaptcha.com/).
        if ($settings['provider'] !== 'hcaptcha' && (!is_string($result['hostname'] ?? null)
            || strtolower(rtrim($result['hostname'], '.')) !== strtolower(rtrim($hostname, '.')))) { return self::failed(); }
        if ($settings['provider'] === 'turnstile' && ($result['action'] ?? null) !== 'wconvert_capture') { return self::failed(); }
        // This adapter is v2 only. A v3 key must not turn a score into an unconditional pass.
        if ($settings['provider'] === 'recaptcha' && array_key_exists('score', $result)) { return self::unavailable(); }
        return null;
    }

    public static function unavailable(): WP_Error
    {
        return new WP_Error('wconvert_verification_unavailable', __('Verification is unavailable. Please try again.', 'wconvert'), ['status' => 503]);
    }
    public static function failed(): WP_Error
    {
        return new WP_Error('wconvert_verification_failed', __('Verification failed. Please try again.', 'wconvert'), ['status' => 422]);
    }
}
