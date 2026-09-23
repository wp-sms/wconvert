<?php

namespace WConvert\Lead;

defined('ABSPATH') || exit;

/** A short lived capability kept only in the mounted page's memory. */
final class CaptureGrant
{
    public const LIFETIME = 1800;

    public function __construct(private readonly string $key) {}

    public function issue(string $optin, string $contract, int $now): string
    {
        $body = bin2hex(random_bytes(32)) . '.' . ($now + self::LIFETIME) . '.' . $optin . '.' . $contract;
        return $body . '.' . hash_hmac('sha256', $body, $this->key);
    }

    /** @return array{receipt: string, expires: int}|null */
    public function verify(string $token, string $optin, string $contract, int $now): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 5 || !ctype_xdigit($parts[0]) || strlen($parts[0]) !== 64 || !ctype_digit($parts[1])
            || $parts[2] !== $optin || $parts[3] !== $contract || (int) $parts[1] <= $now || (int) $parts[1] > $now + self::LIFETIME) { return null; }
        $body = implode('.', array_slice($parts, 0, 4));
        if (!hash_equals(hash_hmac('sha256', $body, $this->key), $parts[4])) { return null; }
        return ['receipt' => 'wconvert_capture_' . hash('sha256', $parts[0]), 'expires' => (int) $parts[1]];
    }
}
