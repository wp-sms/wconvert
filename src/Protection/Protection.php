<?php

namespace WConvert\Protection;

use WConvert\Lead\Submission;
use WP_Error;

defined('ABSPATH') || exit;

final class Protection
{
    public function __construct(public readonly Settings $settings, public readonly Diagnostics $diagnostics, private readonly Verifier $verifier) {}

    /** @param array<string, mixed> $body */
    public function honeypot(array $body): ?WP_Error
    {
        if (isset($body['website']) && $body['website'] !== '') {
            $this->diagnostics->record('honeypot');
            return new WP_Error('wconvert_form_protection', __('Please refresh the page and try again.', 'wconvert'), ['status' => 422]);
        }
        return null;
    }

    /** @param array<string, mixed> $body
     * @return array<string, mixed>|WP_Error|null A challenge to show, a refusal, or permission to issue a grant. */
    public function start(array $body): array|WP_Error|null
    {
        $settings = $this->settings->read();
        if ($settings['provider'] === 'none') { return null; }
        if (!is_string($body['verification_token'] ?? null) || $body['verification_token'] === '') {
            return ['challenge' => ['url' => rest_url('wconvert/v1/protection/challenge'), 'asset' => WCONVERT_URL . 'public/protection/protection.js',
                'title' => __('Verify your submission', 'wconvert'), 'cancel' => __('Cancel verification', 'wconvert'),
                'cancelled' => __('Verification cancelled. Submit again to retry.', 'wconvert'),
                'failed' => __('Verification failed. Please try again.', 'wconvert'),
                'loading' => __('Loading verification…', 'wconvert')]];
        }
        $error = $this->verifier->verify($settings, $body['verification_token'], (string) wp_parse_url(home_url('/'), PHP_URL_HOST));
        $this->diagnostics->record($error === null ? 'verified' : ($error->get_error_code() === 'wconvert_verification_unavailable' ? 'provider_unavailable' : 'challenge_failed'));
        return $error;
    }

    public function submission(Submission $submission, string $campaign): ?WP_Error
    {
        $rules = $this->settings->read()['rules'];
        if ($rules === []) { return null; }
        if (!apply_filters('wconvert_protection_rules_available', false)) { return Verifier::unavailable(); }
        $error = apply_filters('wconvert_protection_submission', null, $submission, $campaign, $rules);
        if ($error instanceof WP_Error) { $this->diagnostics->record('filter'); return $error; }
        return null;
    }
}
