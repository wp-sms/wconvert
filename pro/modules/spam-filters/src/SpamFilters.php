<?php

namespace WConvert\Pro\Module\SpamFilters;

use WConvert\Lead\Submission;
use WP_Error;

defined('ABSPATH') || exit;

/** Merchant-authored lead-quality rules. These never bypass bot verification. */
final class SpamFilters
{
    public static function hooks(): void
    {
        add_filter('wconvert_protection_rules_available', static fn (): bool => true);
        add_filter('wconvert_protection_rule_fields', [self::class, 'fields'], 10, 2);
        add_filter('wconvert_protection_validate_rules', [self::class, 'validate'], 10, 2);
        add_filter('wconvert_protection_submission', [self::class, 'check'], 10, 4);
    }

    /**
     * @param array<mixed> $fields
     * @param array<string, mixed> $rules
     * @return list<array<string, string>> */
    public static function fields(array $fields, array $rules): array
    {
        return [
            ['id' => 'blocked_domains', 'label' => __('Blocked email domains', 'wconvert'), 'help' => __('One exact domain per line (example.com). List subdomains separately.', 'wconvert'), 'value' => implode("\n", $rules['blocked_domains'] ?? [])],
            ['id' => 'blocked_emails', 'label' => __('Blocked email addresses', 'wconvert'), 'help' => __('One email address per line.', 'wconvert'), 'value' => implode("\n", $rules['blocked_emails'] ?? [])],
            ['id' => 'allowed_emails', 'label' => __('Always allow these emails', 'wconvert'), 'help' => __('One email per line. Bypasses email filters only.', 'wconvert'), 'value' => implode("\n", $rules['allowed_emails'] ?? [])],
        ];
    }

    /**
     * @param mixed $previous
     * @param array<string, mixed> $input
     * @return array<string, list<string>>|WP_Error */
    public static function validate($previous, array $input): array|WP_Error
    {
        $rules = [];
        if (array_diff(array_keys($input), ['blocked_domains', 'blocked_emails', 'allowed_emails']) !== []) { return self::invalid(); }
        foreach ($input as $key => $value) {
            if (!is_string($value) || strlen($value) > 8000) { return self::invalid(); }
            $lines = array_values(array_unique(array_filter(array_map('trim', explode("\n", strtolower($value))))));
            if (count($lines) > 100) { return self::invalid(); }
            foreach ($lines as $line) {
                if ($key === 'blocked_domains') {
                    if (strlen($line) > 253 || preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/D', $line) !== 1) { return self::invalid(); }
                } elseif (!filter_var($line, FILTER_VALIDATE_EMAIL)) { return self::invalid(); }
            }
            if ($lines !== []) { $rules[$key] = $lines; }
        }
        return $rules;
    }

    /**
     * @param mixed $previous
     * @param array<string, mixed> $rules */
    public static function check($previous, Submission $submission, string $campaign, array $rules): ?WP_Error
    {
        if ($previous instanceof WP_Error) { return $previous; }
        $email = strtolower($submission->email ?? '');
        if ($email === '' || in_array($email, $rules['allowed_emails'] ?? [], true)) { return null; }
        $domain = substr($email, (int) strrpos($email, '@') + 1);
        if (in_array($email, $rules['blocked_emails'] ?? [], true) || in_array($domain, $rules['blocked_domains'] ?? [], true)) {
            return new WP_Error('wconvert_email_filter', __('Please use a different email address.', 'wconvert'), ['status' => 422, 'field' => 'email']);
        }
        return null;
    }

    private static function invalid(): WP_Error
    {
        return new WP_Error('wconvert_filter_settings', __('Enter up to 100 valid addresses or exact domains per list, one per line. Wildcards are not supported.', 'wconvert'), ['status' => 422]);
    }
}
