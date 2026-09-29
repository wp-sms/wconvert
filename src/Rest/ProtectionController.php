<?php

namespace WConvert\Rest;

use WConvert\Protection\Settings;
use WConvert\Protection\Diagnostics;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

final class ProtectionController implements RestController
{
    public function __construct(private readonly Settings $settings, private readonly Diagnostics $diagnostics) {}

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/protection', [
            ['methods' => 'GET', 'callback' => [$this, 'show'], 'permission_callback' => [Routes::class, 'canManage']],
            ['methods' => 'POST', 'callback' => [$this, 'save'], 'permission_callback' => [Routes::class, 'canManage']],
        ]);
        register_rest_route(Routes::NAMESPACE, '/protection/test', [
            'methods' => 'POST', 'callback' => [$this, 'test'], 'permission_callback' => [Routes::class, 'canManage'],
        ]);
        register_rest_route(Routes::NAMESPACE, '/protection/challenge', [
            'methods' => 'GET', 'callback' => [$this, 'challenge'], 'permission_callback' => [Routes::class, 'canCapture'],
        ]);
        add_filter('rest_pre_serve_request', static function (bool $served, $result, WP_REST_Request $request): bool {
            if ($request->get_route() !== '/' . Routes::NAMESPACE . '/protection/challenge' || $request->get_method() !== 'GET') { return $served; }
            // The renderer escapes every dynamic value for its HTML context.
            if (!is_string($result->get_data())) { return $served; }
            echo $result->get_data(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            return true;
        }, 10, 3);
    }

    public function show(): WP_REST_Response
    {
        return new WP_REST_Response([...$this->settings->publicSettings(), 'diagnostics' => $this->diagnostics->read()]);
    }

    public function save(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        if (strlen($request->get_body()) > 16384) { return new WP_Error('wconvert_protection_size', __('These settings are too large.', 'wconvert'), ['status' => 413]); }
        $body = $request->get_json_params();
        if (!is_array($body)) { return new WP_Error('wconvert_protection_settings', __('Invalid settings.', 'wconvert'), ['status' => 422]); }
        return $this->settings->save($body) ?? $this->show();
    }

    public function test(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        if (strlen($request->get_body()) > 8192) { return \WConvert\Protection\Verifier::failed(); }
        if ($this->settings->read()['provider'] === 'none') {
            return new WP_Error('wconvert_protection_disabled', __('Choose and save a provider before testing.', 'wconvert'), ['status' => 422]);
        }
        $protection = new \WConvert\Protection\Protection($this->settings, $this->diagnostics, new \WConvert\Protection\Verifier());
        $body = $request->get_json_params();
        $result = $protection->start(is_array($body) ? $body : []);
        if ($result instanceof WP_Error) { return $result; }
        return new WP_REST_Response($result ?? ['verified' => true]);
    }

    /** Isolate provider challenges from shadow DOM and the parent modal's inert siblings. */
    public function challenge(): WP_REST_Response
    {
        $settings = $this->settings->read();
        $config = ['provider' => $settings['provider'], 'siteKey' => $settings['site_key'],
            'origin' => self::origin(home_url('/')), 'waiting' => __('Complete verification to continue.', 'wconvert'),
            'failed' => __('Verification is unavailable. Close this window and try again.', 'wconvert')];
        $html = '<!doctype html><html lang="' . esc_attr(get_bloginfo('language')) . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>'
            . esc_html(__('Verify your submission', 'wconvert')) . '</title><style>body{margin:0;padding:16px;font:16px/1.5 system-ui;color:#17202a;background:white}#widget{margin:16px 0}a{color:#164da0}</style></head><body><p id="status" role="status">'
            . esc_html($config['waiting']) . '</p><div id="widget"></div><script type="application/json" id="wconvert-verification-config">'
            . wp_json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)
            . '</script><script type="module" src="' . esc_url(WCONVERT_URL . 'public/protection/protection.js') . '"></script></body></html>';
        return new WP_REST_Response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8', 'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff', 'X-Frame-Options' => 'SAMEORIGIN',
            'Content-Security-Policy' => "frame-ancestors 'self'", 'Referrer-Policy' => 'no-referrer',
        ]);
    }

    private static function origin(string $url): string
    {
        $parts = wp_parse_url($url);
        return ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '') . (isset($parts['port']) ? ':' . $parts['port'] : '');
    }
}
