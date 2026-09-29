<?php

namespace WConvert\Protection;

use WConvert\Storage\OptionStore;
use WP_Error;

defined('ABSPATH') || exit;

/** Site-owned protection configuration. Secrets never appear in read responses. */
final class Settings
{
    public const OPTION = 'wconvert_protection';
    public const PROVIDERS = ['none', 'turnstile', 'recaptcha', 'hcaptcha'];

    public function __construct(private readonly OptionStore $options) {}

    /** @return array{provider: string, site_key: string, secret: string, rules: array<string, mixed>} */
    public function read(): array
    {
        $saved = $this->options->get(self::OPTION, []);
        $saved = is_array($saved) ? $saved : [];
        return [
            'provider' => in_array($saved['provider'] ?? '', self::PROVIDERS, true) ? $saved['provider'] : 'none',
            'site_key' => is_string($saved['site_key'] ?? null) ? $saved['site_key'] : '',
            'secret' => is_string($saved['secret'] ?? null) ? $saved['secret'] : '',
            'rules' => is_array($saved['rules'] ?? null) ? $saved['rules'] : [],
        ];
    }

    /** A change of provider or keys invalidates earlier unprotected grants. */
    public function contract(string $contract): string
    {
        $saved = $this->read();
        return $saved['provider'] === 'none' ? $contract : hash('sha256', $contract . wp_json_encode($saved));
    }

    /** @return array<string, mixed> */
    public function publicSettings(): array
    {
        $saved = $this->read();
        return [
            'site_hostname' => (string) wp_parse_url(home_url('/'), PHP_URL_HOST),
            'provider' => $saved['provider'], 'site_key' => $saved['site_key'], 'has_secret' => $saved['secret'] !== '',
            'rules_available' => (bool) apply_filters('wconvert_protection_rules_available', false),
            'rules_configured' => $saved['rules'] !== [],
            'rule_fields' => apply_filters('wconvert_protection_rule_fields', [], $saved['rules']),
        ];
    }

    /** @param array<string, mixed> $body */
    public function save(array $body): ?WP_Error
    {
        $old = $this->read();
        $provider = $body['provider'] ?? null;
        if (!is_string($provider) || !in_array($provider, self::PROVIDERS, true)) {
            return new WP_Error('wconvert_protection_settings', __('Choose a supported protection provider.', 'wconvert'), ['status' => 422]);
        }
        $site = $body['site_key'] ?? '';
        $secret = $body['secret'] ?? '';
        if (!is_string($site) || !is_string($secret) || strlen($site) > 256 || strlen($secret) > 256
            || preg_match('/[^a-zA-Z0-9_-]/', $site . $secret)) {
            return new WP_Error('wconvert_protection_keys', __('Enter the site key and secret key supplied by your provider.', 'wconvert'), ['status' => 422]);
        }
        if ($secret === '' && $provider === $old['provider']) { $secret = $old['secret']; }
        if ($provider !== 'none' && ($site === '' || $secret === '')) {
            return new WP_Error('wconvert_protection_keys', __('Both keys are required before protection can be enabled.', 'wconvert'), ['status' => 422]);
        }
        $rules = $old['rules'];
        if (array_key_exists('rules', $body)) {
            if (!is_array($body['rules'])) { return new WP_Error('wconvert_protection_rules', __('Invalid filter settings.', 'wconvert'), ['status' => 422]); }
            if ($body['rules'] === []) { $rules = []; }
            else {
                $rules = apply_filters('wconvert_protection_validate_rules', null, $body['rules']);
                if ($rules instanceof WP_Error) { return $rules; }
                if (!is_array($rules)) { return new WP_Error('wconvert_protection_rules_unavailable', __('These filters require WConvert Pro.', 'wconvert'), ['status' => 422]); }
            }
        }
        $this->options->set(self::OPTION, ['provider' => $provider, 'site_key' => $provider === 'none' ? '' : $site,
            'secret' => $provider === 'none' ? '' : $secret, 'rules' => $rules]);
        return null;
    }
}
