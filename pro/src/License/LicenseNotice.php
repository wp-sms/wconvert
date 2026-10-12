<?php

namespace WConvert\Pro\License;

defined('ABSPATH') || exit;

/**
 * What the licence says outside its own page.
 *
 * Two places carry it: the dot and hover reason on the header's plan badge,
 * and the line under WConvert Pro on the Plugins screen. Both read this one
 * answer, built from {@see LicenseState}'s payload, so they cannot disagree —
 * and the License page's own copy is the page's, drawn from the same payload.
 *
 * Red when updates have stopped; amber when they will, or are off on this
 * site; nothing otherwise. **The bell is never part of it**: the bell belongs
 * to the notifications feature. **A managed licence reminds nobody** — the
 * agency's client is told only on the License page itself (ADR 0143).
 *
 * @since 0.1.0
 */
final class LicenseNotice
{
    /**
     * @param array<string, mixed> $payload {@see LicenseState::payload()}
     * @param (callable(string): string)|null $date Formats an ISO date for a sentence.
     * @return array{dot: 'amber'|'red'|null, title: string|null, row: string|null, cta: array{label: string, to: string}|null}
     *         `cta.to` is `page` (the License page) or a key of the payload's `urls`.
     */
    public static function for(array $payload, ?callable $date = null): array
    {
        $none = ['dot' => null, 'title' => null, 'row' => null, 'cta' => null];

        if (($payload['managed'] ?? null) !== null) {
            return $none;
        }

        $date ??= static fn (string $iso): string => (string) wp_date((string) get_option('date_format'), (int) strtotime($iso));
        $days = (int) ($payload['days_left'] ?? 0);
        $was = (string) (($payload['domain_change'] ?? [])['was'] ?? '');

        switch ($payload['state'] ?? 'none') {
            case 'none':
                return ['dot' => null, 'title' => __('Activate WConvert Pro', 'wconvert-pro'), 'row' => __('Activate your license to get updates.', 'wconvert-pro'), 'cta' => self::cta(__('Activate', 'wconvert-pro'), 'page')];

            case 'key_unreadable':
                return ['dot' => 'red', 'title' => __('Enter your license key again', 'wconvert-pro'), 'row' => __('WordPress can’t read your license key, so updates stopped.', 'wconvert-pro'), 'cta' => self::cta(__('Enter key', 'wconvert-pro'), 'page')];

            case 'disabled':
                return ['dot' => 'red', 'title' => __('This license was turned off', 'wconvert-pro'), 'row' => __('This license was turned off, so updates stopped.', 'wconvert-pro'), 'cta' => self::cta(__('Contact support', 'wconvert-pro'), 'support')];

            case 'trial_ended':
                return ['dot' => 'red', 'title' => __('Your trial ended', 'wconvert-pro'), 'row' => __('Your trial ended, so updates stopped.', 'wconvert-pro'), 'cta' => self::cta(__('Buy', 'wconvert-pro'), 'checkout')];

            case 'expired':
                return ['dot' => 'red', 'title' => __('Your license expired', 'wconvert-pro'), 'row' => __('Your license expired, so updates stopped.', 'wconvert-pro'), 'cta' => self::cta(__('Renew', 'wconvert-pro'), 'renew')];

            case 'moved':
                /* translators: %s: the domain the licence is still on */
                $title = $was === '' ? __('This site moved', 'wconvert-pro') : sprintf(__('This site moved from %s', 'wconvert-pro'), $was);

                return self::amber($title, sprintf(
                    /* translators: %s: "This site moved from example.com" */
                    __('%s, so updates are off here.', 'wconvert-pro'),
                    $title
                ), self::cta(__('Review', 'wconvert-pro'), 'page'));

            case 'copy':
                /* translators: %s: the live site this one was copied from */
                $title = $was === '' ? __('This is a copy of another site', 'wconvert-pro') : sprintf(__('This is a copy of %s', 'wconvert-pro'), $was);

                return self::amber($title, sprintf(
                    /* translators: %s: "This is a copy of example.com" */
                    __('%s, so updates are off here.', 'wconvert-pro'),
                    $title
                ), self::cta(__('Review', 'wconvert-pro'), 'page'));

            case 'payment_failed':
                $grace = (string) (($payload['renewal'] ?? [])['grace_ends_at'] ?? '');

                return self::amber(
                    __('Your payment didn’t go through', 'wconvert-pro'),
                    $grace === ''
                        ? __('Your payment didn’t go through. Update it to keep updates.', 'wconvert-pro')
                        /* translators: %s: the date the payment grace period ends */
                        : sprintf(__('Your payment didn’t go through. Update it by %s to keep updates.', 'wconvert-pro'), $date($grace)),
                    self::cta(__('Update payment', 'wconvert-pro'), 'payment')
                );

            case 'over_limit':
                $used = (int) (($payload['plan'] ?? [])['used'] ?? 0);
                $max = (int) (($payload['plan'] ?? [])['max'] ?? 0);
                /* translators: 1: sites in use, 2: sites the plan holds */
                $title = sprintf(_n('%1$d site uses a %2$d-site license', '%1$d sites use a %2$d-site license', $used, 'wconvert-pro'), $used, $max);

                return self::amber($title, $title . '.', self::cta(__('Manage sites', 'wconvert-pro'), 'page'));

            case 'expiring':
                /* translators: %d: days left */
                $title = sprintf(_n('Your license ends in %d day', 'Your license ends in %d days', $days, 'wconvert-pro'), $days);

                return self::amber($title, $title . '.', self::cta(__('Renew', 'wconvert-pro'), 'renew'));

            case 'trial':
                if ($days > 7) {
                    return $none;
                }

                /* translators: %d: days left */
                $title = sprintf(_n('Your trial ends in %d day', 'Your trial ends in %d days', $days, 'wconvert-pro'), $days);

                return self::amber($title, $title . '.', self::cta(__('Buy', 'wconvert-pro'), 'checkout'));

            default:
                return $none;
        }
    }

    /**
     * @param array{label: string, to: string} $cta
     * @return array{dot: 'amber', title: string, row: string, cta: array{label: string, to: string}}
     */
    private static function amber(string $title, string $row, array $cta): array
    {
        return ['dot' => 'amber', 'title' => $title, 'row' => $row, 'cta' => $cta];
    }

    /** @return array{label: string, to: string} */
    private static function cta(string $label, string $to): array
    {
        return ['label' => $label, 'to' => $to];
    }
}
