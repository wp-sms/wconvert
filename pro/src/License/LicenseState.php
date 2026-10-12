<?php

namespace WConvert\Pro\License;

use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\License\KeySource;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Support\Request;

defined('ABSPATH') || exit;

/**
 * The licence, as one answer every surface reads (ADR 0143).
 *
 * @since 0.1.0
 */
final class LicenseState
{
    /** The states in which this site gets no update (ADR 0143); `UpdateGate` reads the same list. */
    public const NO_UPDATES = ['none', 'key_unreadable', 'moved', 'copy', 'disabled', 'expired', 'trial_ended'];

    private const CHECKOUT = 'https://wconvert.io/pro/';

    private const SUPPORT = 'https://wconvert.io/support/';

    /**
     * Every status the store or the SDK records for a licence that stopped for
     * a reason other than its date. `invalid` is the SDK's own word for most
     * refusals — a key the store no longer knows among them.
     */
    private const STOPPED_STATUSES = ['disabled', 'suspended', 'revoked', 'blocked', 'cancelled', 'invalid'];

    /** Amber from here: the renewal window, in whole days (the prototype's 14). */
    private const RENEWAL_WINDOW_DAYS = 14;

    /**
     * Whether this site is offered updates — the one answer `UpdateGate` and
     * the License page share, read before any managed redaction.
     */
    public static function updatesAllowed(LicenseFacts $facts): bool
    {
        return !in_array(self::full($facts)['state'], self::NO_UPDATES, true);
    }

    /** @return array<string, mixed> */
    public static function payload(LicenseFacts $facts): array
    {
        $payload = self::full($facts);

        return $facts->managed ? self::redact($payload, $facts->contact) : $payload + ['managed' => null];
    }

    /**
     * What a client sees of a licence an agency manages: whether updates work,
     * and who to call. Every other detail is dropped HERE, so the browser never
     * receives what the page must not show (ADR 0143, decision 9).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private static function redact(array $payload, string $contact): array
    {
        $state = $payload['state'];

        if ($state !== 'none') {
            $state = in_array($state, self::NO_UPDATES, true) ? 'stopped' : 'active';
        }

        return [
            'state' => $state,
            // A wp-config key's refusal is the agency's to fix and the client's
            // to pass on, so it survives; a licence's own codes do not.
            'error_code' => $state === 'none' ? $payload['error_code'] : '',
            'retry_at' => $payload['retry_at'],
            'plan' => null,
            'expires_at' => null,
            'days_left' => null,
            'renewal' => null,
            'sites' => [],
            'key' => ['masked' => null, 'source' => KeySource::CONSTANT],
            'buyer' => null,
            'domain_change' => null,
            'updates' => $payload['updates'],
            'last_checked_at' => null,
            'last_success_at' => null,
            'reach' => $payload['reach'],
            'urls' => ['support' => self::SUPPORT],
            'managed' => self::contact($contact),
        ];
    }

    /**
     * `Acme Studio <help@acme.studio>`, `Acme Studio`, or `help@acme.studio`.
     *
     * @return array{by: string|null, email: string|null}
     */
    private static function contact(string $contact): array
    {
        $contact = trim($contact);

        if (preg_match('/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/', $contact, $m) === 1) {
            return ['by' => $m[1] !== '' ? $m[1] : null, 'email' => $m[2]];
        }

        if (str_contains($contact, '@') && !str_contains($contact, ' ')) {
            return ['by' => null, 'email' => $contact];
        }

        return ['by' => $contact !== '' ? $contact : null, 'email' => null];
    }

    /** @return array<string, mixed> */
    private static function full(LicenseFacts $facts): array
    {
        $license = $facts->license;

        if ($license === null || empty($license['license_key'])) {
            // Not activated. With a wp-config key that is a refusal the SDK
            // will retry, and the page names both (P3).
            return [
                'state' => 'none',
                'error_code' => (string) ($facts->autoActivation['error_code'] ?? ''),
                'retry_at' => $facts->autoActivation['retry_at'] ?? null,
                'plan' => null,
                'expires_at' => null,
                'days_left' => null,
                'renewal' => null,
                'sites' => [],
                'key' => ['masked' => null, 'source' => null],
                'buyer' => null,
                'domain_change' => null,
                'updates' => self::updates($facts, false),
                'last_checked_at' => null,
                'last_success_at' => null,
                'reach' => 'ok',
                'urls' => self::urls([], [], $facts->store),
            ];
        }

        $renewal = is_array($license['renewal'] ?? null) ? $license['renewal'] : [];
        $trial = !empty($renewal['is_trial']);
        $expires = self::text($license['expires_at'] ?? null);
        // A trial ends on its own date, which the store sends beside the licence's.
        $ends = $trial ? (self::text($renewal['trial_ends_at'] ?? null) ?? $expires) : $expires;
        $daysLeft = self::daysUntil($ends, $facts->now);
        $mode = self::renewalMode($renewal, $expires);
        $state = self::resolve($license, $renewal, $mode, $ends, $daysLeft, $facts->now);
        $change = $facts->domainChange;
        $sites = self::sites($license, $facts->here);

        // Before every date: on a site the licence is not on, nothing else it
        // says applies here. And before even that, a key that cannot be read.
        if ($change !== null) {
            $state = (($license['site'] ?? [])['is_counted'] ?? null) === false ? 'copy' : 'moved';
        }

        if ($facts->key === null) {
            $state = 'key_unreadable';
        }

        $lastChecked = isset($license['last_validated_at']) ? (int) $license['last_validated_at'] : null;
        $lastSuccess = isset($license['last_success_at']) ? (int) $license['last_success_at'] : null;

        return [
            'state' => $state,
            'error_code' => (string) ($license['error_code'] ?? ''),
            'retry_at' => null,
            'plan' => self::plan($license),
            'expires_at' => $expires,
            'days_left' => $daysLeft,
            'renewal' => [
                'mode' => $mode,
                'trial_ends_at' => $trial ? $ends : null,
                'grace_ends_at' => self::text($renewal['grace_ends_at'] ?? null),
                'offer' => self::offer($renewal),
            ],
            'sites' => $sites,
            'domain_change' => $change === null ? null : [
                'was' => $change['was'],
                'now' => $change['now'],
                // Staging pushed live: moving will use a seat the copy never did.
                'was_dev' => in_array(true, array_map(static fn (array $site): bool => $site['dev'] && $site['domain'] === $change['was'], $sites), true),
            ],
            'last_checked_at' => $lastChecked,
            'last_success_at' => $lastSuccess,
            // The SDK stamps a check on every attempt and a success only when
            // the store answered (a refusal is an answer), so a later attempt
            // than answer is a store that did not reply.
            'reach' => $lastChecked !== null && $lastSuccess !== null && $lastChecked > $lastSuccess ? 'unreachable' : 'ok',
            'key' => ['masked' => self::maskKey($facts->key), 'source' => (string) ($license['source'] ?? 'manual')],
            'buyer' => self::buyer($license),
            'updates' => self::updates($facts, !in_array($state, self::NO_UPDATES, true)),
            'urls' => self::urls($license, $renewal, $facts->store),
        ];
    }

    /**
     * The one thing that matters most, highest first: whatever stops updates,
     * then whatever will, then how the licence renews. The prototype's order.
     *
     * @param array<string, mixed> $license
     * @param array<string, mixed> $renewal
     */
    private static function resolve(array $license, array $renewal, string $mode, ?string $ends, ?int $daysLeft, int $now): string
    {
        $status = (string) ($license['status'] ?? 'active');
        $endTime = $ends === null ? false : strtotime($ends);
        $ended = $endTime !== false && $endTime <= $now;
        $trial = !empty($renewal['is_trial']);

        // Every way the store stops a licence that is not its date. Nexus sends
        // refunded, blocked and cancelled as `key_disabled` (`License::
        // statusErrorCode()`), and the SDK folds several into `invalid`, so both
        // the status and the code are read.
        if (in_array($status, self::STOPPED_STATUSES, true) || in_array($license['error_code'] ?? '', ['key_disabled', 'license_suspended'], true)) {
            return 'disabled';
        }

        if ($trial && $ended) {
            return 'trial_ended';
        }

        // The status stays `active` through Nexus's recovery grace — which
        // runs PAST the renewal date — and only the renewal block says the
        // charge failed (veronalabs/nexus RenewalOfferService). So it is read
        // before the date, until the grace runs out or the store says expired.
        $grace = strtotime((string) ($renewal['grace_ends_at'] ?? ''));

        if ($status !== 'expired' && ($renewal['state'] ?? '') === 'payment_failed' && ($grace === false || $grace > $now)) {
            return 'payment_failed';
        }

        if ($status === 'expired' || $ended) {
            return 'expired';
        }

        if (self::overLimit($license)) {
            return 'over_limit';
        }

        if ($trial) {
            return 'trial';
        }

        if (in_array($mode, ['manual', 'cancelled'], true) && $daysLeft !== null && $daysLeft <= self::RENEWAL_WINDOW_DAYS) {
            return 'expiring';
        }

        return $mode === 'auto' ? 'active' : $mode;
    }

    /**
     * More counted sites than the plan holds, with this one among them — the
     * SDK's rule (`LicenseManager::isOverLimit()`). Five of five is full, not
     * over; a staging copy holds no seat; an unlimited plan has no ceiling.
     *
     * @param array<string, mixed> $license
     */
    private static function overLimit(array $license): bool
    {
        $max = (int) ($license['max_activations'] ?? 0);
        $site = is_array($license['site'] ?? null) ? $license['site'] : [];

        if ($max <= 0 || ($site['is_counted'] ?? null) === false) {
            return false;
        }

        $count = (int) ($license['activation_count'] ?? 0);

        return ($site['active'] ?? null) === false ? $count >= $max : $count > $max;
    }

    /**
     * How the licence goes on after its end date: it renews itself (a
     * subscription with a card behind it), the subscription was cancelled, it
     * has no end date, or somebody has to renew it by hand.
     *
     * @param array<string, mixed> $renewal Nexus's renewal block.
     */
    private static function renewalMode(array $renewal, ?string $expires): string
    {
        if ($expires === null) {
            return 'lifetime';
        }

        if (!empty($renewal['auto_renews'])) {
            return 'auto';
        }

        return in_array($renewal['subscription_status'] ?? null, ['cancelled', 'canceled'], true) ? 'cancelled' : 'manual';
    }

    /**
     * The coupon Nexus mints for a renewal: its code, the percentage when it
     * is one, and when it runs out.
     *
     * @param array<string, mixed> $renewal
     * @return array{code: string, percent: int|null, until: string|null}|null
     */
    private static function offer(array $renewal): ?array
    {
        $offer = is_array($renewal['offer'] ?? null) ? $renewal['offer'] : null;

        if ($offer === null || empty($offer['code'])) {
            return null;
        }

        return [
            'code' => (string) $offer['code'],
            'percent' => ($offer['discount_type'] ?? '') === 'percentage' ? (int) round((float) ($offer['discount_value'] ?? 0)) : null,
            'until' => self::text($offer['expires_at'] ?? null),
        ];
    }

    /**
     * The installed version, what the store offers, and WordPress's own
     * upgrade link — only when there is something to install, the licence
     * still entitles this site to it, and the host lets WordPress write files.
     *
     * @return array{installed: string, latest: string, file_mods: bool, update_url: string|null, checked_at: int|null}
     */
    private static function updates(LicenseFacts $facts, bool $entitled): array
    {
        $manifest = $facts->manifest ?? [];
        $offered = !empty($manifest['update_available']) && is_array($manifest['manifest'] ?? null)
            ? (string) ($manifest['manifest']['version'] ?? '')
            : '';
        $latest = $offered !== '' ? $offered : $facts->installed;
        $installable = $entitled && $facts->fileMods && $facts->updateUrl !== '' && version_compare($latest, $facts->installed, '>');

        return [
            'installed' => $facts->installed,
            'latest' => $latest,
            'file_mods' => $facts->fileMods,
            'update_url' => $installable ? $facts->updateUrl : null,
            'checked_at' => $facts->updatesCheckedAt,
        ];
    }

    /**
     * The store's own page for each door. Where the store sends a link with
     * the licence — its page, its upgrade, a renewal with the coupon applied —
     * that wins; the rest are the account's fixed pages.
     *
     * @param array<string, mixed> $license
     * @param array<string, mixed> $renewal
     * @return array<string, string>
     */
    private static function urls(array $license, array $renewal, string $store): array
    {
        $account = (string) ($license['manage_url'] ?? '') ?: $store . '/account';

        return [
            'account' => $account,
            'renew' => (string) ($renewal['renew_url'] ?? '') ?: $account,
            'payment' => $store . '/account/billing',
            'sites' => $account,
            'upgrade' => (string) ($license['upgrade_url'] ?? '') ?: self::CHECKOUT,
            'checkout' => self::CHECKOUT,
            'support' => self::SUPPORT,
            'downloads' => $store . '/account/downloads',
        ];
    }

    /** Whole days left, rounded up the SDK's way: anything left of today is a day. */
    private static function daysUntil(?string $date, int $now): ?int
    {
        $time = $date === null ? false : strtotime($date);

        return $time === false ? null : (int) ceil(($time - $now) / DAY_IN_SECONDS);
    }

    /**
     * @param array<string, mixed> $license
     * @return array{slug: string, label: string, max: int|null}
     */
    private static function plan(array $license): array
    {
        $max = (int) ($license['max_activations'] ?? 0);

        return [
            'slug' => (string) ($license['tier_slug'] ?? ''),
            'label' => (string) ($license['plan_name'] ?? ''),
            // Nexus counts an unlimited plan's seats as zero.
            'max' => $max > 0 ? $max : null,
        ];
    }

    /**
     * @param array<string, mixed> $license
     * @return list<array{domain: string, here: bool, dev: bool, added: string|null, last_seen: string|null}>
     */
    private static function sites(array $license, string $here): array
    {
        $sites = [];

        foreach (is_array($license['sites'] ?? null) ? $license['sites'] : [] as $site) {
            if (!is_array($site) || empty($site['domain'])) {
                continue;
            }

            $sites[] = [
                'domain' => (string) $site['domain'],
                'here' => Request::normaliseDomain((string) $site['domain']) === Request::normaliseDomain($here),
                // A staging or local copy holds no seat.
                'dev' => ($site['is_counted'] ?? true) === false,
                'added' => self::text($site['activated_at'] ?? null),
                'last_seen' => self::text($site['last_check_at'] ?? null),
            ];
        }

        return $sites;
    }

    /**
     * Masked whatever the store sent: initials for the name, the first
     * letter of the mailbox (veronalabs/wp-premium-sdk#36).
     *
     * @param array<string, mixed> $license
     * @return array{name: string, email: string}|null
     */
    private static function buyer(array $license): ?array
    {
        $buyer = is_array($license['buyer'] ?? null) ? $license['buyer'] : null;
        $name = (string) ($buyer['name'] ?? $license['customer_name'] ?? '');
        $email = (string) ($buyer['email'] ?? $license['customer_email'] ?? '');

        if ($name === '' && $email === '') {
            return null;
        }

        $initials = array_map(
            static fn (string $word): string => mb_strtoupper(mb_substr($word, 0, 1)) . '***',
            preg_split('/\s+/u', trim($name), -1, PREG_SPLIT_NO_EMPTY) ?: []
        );

        return [
            'name' => implode(' ', $initials),
            'email' => self::maskEmail($email),
        ];
    }

    /** `••••AB12`: the last four, all a person needs to tell two keys apart. */
    public static function maskKey(?string $key): ?string
    {
        if ($key === null) {
            return null;
        }

        $last4 = substr((string) preg_replace('/[^A-Z0-9]/i', '', $key), -4);

        return '••••' . strtoupper($last4);
    }

    /** `s***@example.com`; an empty string for anything that is not an address. */
    public static function maskEmail(string $email): string
    {
        $at = strrpos($email, '@');

        return $at === false ? '' : mb_substr($email, 0, 1) . '***' . substr($email, $at);
    }

    private static function text(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }
}
