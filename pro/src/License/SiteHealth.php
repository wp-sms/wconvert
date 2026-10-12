<?php

namespace WConvert\Pro\License;

use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider;

defined('ABSPATH') || exit;

/**
 * Tools → Site Health → Info → WConvert Pro license: what support needs to
 * read, copied with the rest of the report. Ported from WP Statistics'
 * `LicenseSiteHealth`, and read from the same payload as the License page so
 * the two can never tell a different story.
 *
 * **Never the key**, not even masked. A managed licence (a key in
 * wp-config.php) shows only whether updates are on and where the key comes
 * from — no plan, dates or sites (ADR 0143, decision 9). The store's own
 * error code is shown for everybody else: it is what support asks for first.
 *
 * @since 0.1.0
 */
final class SiteHealth
{
    public const SECTION = 'wconvert-pro-license';

    public function __construct(private readonly PremiumServiceProvider $sdk)
    {
    }

    public function hooks(): void
    {
        add_filter('debug_information', [$this, 'addSection']);
    }

    /**
     * @param mixed $info
     * @return array<string, mixed>
     */
    public function addSection($info): array
    {
        $info = is_array($info) ? $info : [];

        $info[self::SECTION] = [
            'label' => __('WConvert Pro license', 'wconvert-pro'),
            'fields' => self::fields(LicenseState::current($this->sdk)),
        ];

        return $info;
    }

    /**
     * @param array<string, mixed> $license {@see LicenseState::current()}
     * @return array<string, array{label: string, value: string, debug: string}>
     */
    public static function fields(array $license): array
    {
        $field = static fn (string $label, string $value, ?string $debug = null): array => ['label' => $label, 'value' => $value, 'debug' => $debug ?? $value];
        $state = (string) $license['state'];
        $updates = $license['updates'];

        $fields = [
            'status' => $field(__('Status', 'wconvert-pro'), self::statusLabel($state), $state),
            'updates' => $field(
                __('Updates', 'wconvert-pro'),
                $updates['latest'] !== $updates['installed']
                    /* translators: 1: installed version, 2: version on offer */
                    ? sprintf(__('%1$s installed, %2$s available', 'wconvert-pro'), $updates['installed'], $updates['latest'])
                    : $updates['installed'],
                $updates['installed'] . ' / ' . $updates['latest'] . ($updates['file_mods'] ? '' : ' (file changes disabled)')
            ),
        ];

        if ($license['managed'] !== null) {
            $fields['key_source'] = $field(__('Key source', 'wconvert-pro'), __('wp-config.php', 'wconvert-pro'), 'constant');
            $by = $license['managed']['by'] ?? null;

            if ($by !== null) {
                $fields['managed_by'] = $field(__('Managed by', 'wconvert-pro'), (string) $by);
            }

            return $fields;
        }

        if ($state === 'none') {
            return $fields;
        }

        $plan = $license['plan'];
        $max = $plan['max'] ?? null;

        $fields['plan'] = $field(__('Plan', 'wconvert-pro'), (string) ($plan['label'] ?? ''), (string) ($plan['slug'] ?? ''));
        $fields['expires'] = $field(
            __('Updates and support until', 'wconvert-pro'),
            $license['expires_at'] === null ? __('Never expires', 'wconvert-pro') : self::date((string) $license['expires_at']),
            (string) ($license['expires_at'] ?? 'lifetime')
        );
        $fields['sites'] = $field(
            __('Sites', 'wconvert-pro'),
            /* translators: 1: sites using the licence, 2: sites it allows */
            $max === null ? __('Unlimited', 'wconvert-pro') : sprintf(__('%1$d of %2$d', 'wconvert-pro'), (int) $plan['used'], (int) $max),
            $max === null ? 'unlimited' : $plan['used'] . '/' . $max
        );
        $fields['key_source'] = $field(__('Key source', 'wconvert-pro'), __('License page', 'wconvert-pro'), (string) ($license['key']['source'] ?? 'manual'));

        if (($license['error_code'] ?? '') !== '') {
            $fields['error_code'] = $field(__('Store error code', 'wconvert-pro'), (string) $license['error_code']);
        }

        $last = $license['last_success_at'];
        $fields['last_success'] = $field(
            __('Last successful check', 'wconvert-pro'),
            $last === null ? __('Never', 'wconvert-pro') : self::date('@' . $last, true),
            $last === null ? 'never' : gmdate('c', (int) $last)
        );
        $fields['reach'] = $field(__('License server', 'wconvert-pro'), $license['reach'] === 'ok' ? __('Reachable', 'wconvert-pro') : __('Not reachable on the last check', 'wconvert-pro'), (string) $license['reach']);
        $fields['store'] = $field(__('Store', 'wconvert-pro'), SdkConfig::storeUrl());

        return $fields;
    }

    private static function statusLabel(string $state): string
    {
        $labels = [
            'none' => __('Not activated', 'wconvert-pro'),
            'active' => __('Active, renews automatically', 'wconvert-pro'),
            'manual' => __('Active, manual renewal', 'wconvert-pro'),
            'cancelled' => __('Active, renewal off', 'wconvert-pro'),
            'lifetime' => __('Lifetime', 'wconvert-pro'),
            'expiring' => __('Expiring soon', 'wconvert-pro'),
            'trial' => __('Trial', 'wconvert-pro'),
            'trial_ended' => __('Trial ended', 'wconvert-pro'),
            'expired' => __('Expired', 'wconvert-pro'),
            'payment_failed' => __('Payment failed', 'wconvert-pro'),
            'disabled' => __('Turned off by the store', 'wconvert-pro'),
            'over_limit' => __('Over the site limit', 'wconvert-pro'),
            'moved' => __('On another domain', 'wconvert-pro'),
            'copy' => __('Staging or local copy', 'wconvert-pro'),
            'key_unreadable' => __('Key can’t be read', 'wconvert-pro'),
            'stopped' => __('Updates stopped', 'wconvert-pro'),
        ];

        return $labels[$state] ?? $state;
    }

    private static function date(string $value, bool $withTime = false): string
    {
        $time = strtotime($value);

        if ($time === false) {
            return $value;
        }

        $format = (string) get_option('date_format') . ($withTime ? ' ' . get_option('time_format') : '');

        return (string) wp_date($format, $time);
    }
}
