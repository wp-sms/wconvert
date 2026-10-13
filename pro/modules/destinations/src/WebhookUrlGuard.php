<?php

namespace WConvert\Pro\Module\Destinations;

defined('ABSPATH') || exit;

/**
 * **Where a webhook may point**: any public host on any port, and nothing on
 * the site's own network.
 *
 * A URL a merchant pastes is a request this server will make on every capture,
 * so a webhook at `http://169.254.169.254/` or at an admin panel bound to
 * localhost would turn a form into a way to reach them. `wp_safe_remote_post()`
 * refuses those too, but it also refuses every port but 80, 443 and 8080, and a
 * self-hosted n8n listens on 5678. So the check is ours: resolve the host and
 * refuse it if ANY address is loopback, private, link-local or reserved.
 *
 * It runs on save and again on every send, which narrows DNS rebinding to the
 * moment between this lookup and cURL's own rather than to the whole life of a
 * Connection. Redirects are never followed, for the same reason (ADR 0148).
 *
 * @since 0.1.0
 */
final class WebhookUrlGuard
{
    public const INVALID = 'invalid';

    public const PRIVATE = 'private';

    public const UNRESOLVED = 'unresolved';

    /** @var \Closure(string): list<string> */
    private readonly \Closure $resolve;

    /** @param (callable(string): list<string>)|null $resolve Host to addresses; DNS by default. */
    public function __construct(?callable $resolve = null)
    {
        $this->resolve = $resolve === null ? self::dns(...) : \Closure::fromCallable($resolve);
    }

    /**
     * Why this URL may not be a webhook, or null where it may.
     *
     * @return self::INVALID|self::PRIVATE|self::UNRESOLVED|null
     */
    public function refusal(string $url, bool $allowPrivate = false): ?string
    {
        $parts = wp_parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = (string) ($parts['host'] ?? '');
        if (!is_array($parts) || !in_array($scheme, ['http', 'https'], true) || $host === '') return self::INVALID;
        if ($allowPrivate) return null;
        $literal = trim($host, '[]');
        $addresses = filter_var($literal, FILTER_VALIDATE_IP) !== false ? [$literal] : ($this->resolve)(strtolower($host));
        if ($addresses === []) return self::UNRESOLVED;
        foreach ($addresses as $address) {
            if (!self::isPublic($address)) return self::PRIVATE;
        }
        return null;
    }

    /**
     * PHP's private and reserved flags, plus three ranges they let through:
     * carrier-grade NAT (`100.64.0.0/10`), benchmarking (`198.18.0.0/15`), and
     * NAT64 (`64:ff9b::/96`), whose last 32 bits are an IPv4 address that may
     * itself be loopback.
     */
    private static function isPublic(string $address): bool
    {
        if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) return false;
        $packed = inet_pton($address);
        if ($packed === false) return false;
        if (strlen($packed) === 16) {
            if (substr($packed, 0, 12) !== "\x00\x64\xff\x9b" . str_repeat("\x00", 8)) return true;
            $mapped = inet_ntop(substr($packed, 12));
            return is_string($mapped) && self::isPublic($mapped);
        }
        $long = ip2long($address);
        if ($long === false) return false;
        foreach ([['100.64.0.0', 10], ['198.18.0.0', 15]] as [$network, $bits]) {
            $mask = -1 << (32 - $bits) & 0xFFFFFFFF;
            if (($long & $mask) === (ip2long($network) & $mask)) return false;
        }
        return true;
    }

    /** @return list<string> */
    private static function dns(string $host): array
    {
        $v4 = gethostbynamel($host);
        $v6 = function_exists('dns_get_record') ? @dns_get_record($host, DNS_AAAA) : false; // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- a failed lookup warns; it is reported as UNRESOLVED.
        return array_values(array_merge(is_array($v4) ? $v4 : [],
            is_array($v6) ? array_filter(array_column($v6, 'ipv6'), 'is_string') : []));
    }
}
