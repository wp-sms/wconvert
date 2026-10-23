<?php

namespace WConvert\Pro\Module\Destinations;

defined('ABSPATH') || exit;

/**
 * **Standard Webhooks signing**, and nothing of our own invention.
 *
 * The receiver checks `webhook-signature` against `{id}.{timestamp}.{body}`
 * with the libraries the specification publishes for every language, so a
 * developer verifies a WConvert webhook in three lines and no one has to trust
 * a scheme we made up. The timestamp is what Typeform's and Tally's signatures
 * lack: without it, a captured request replays forever (ADR 0148).
 *
 * Pure, and tested against the specification's own test vector.
 *
 * @since 0.1.0
 */
final class WebhookSignature
{
    private const PREFIX = 'whsec_';

    /** A new signing secret: `whsec_` and 32 random bytes, base64. */
    public static function secret(): string
    {
        return self::PREFIX . base64_encode(random_bytes(32));
    }

    public static function isSecret(string $value): bool
    {
        if (!str_starts_with($value, self::PREFIX)) return false;
        $bytes = base64_decode(substr($value, strlen(self::PREFIX)), true);
        return is_string($bytes) && strlen($bytes) >= 24;
    }

    /**
     * The `webhook-signature` header for one attempt. Sign the exact bytes that
     * are sent: encode the body once and reuse that string.
     */
    public static function sign(string $secret, string $id, int $timestamp, string $body): string
    {
        $key = base64_decode(substr($secret, strlen(self::PREFIX)), true);
        if (!str_starts_with($secret, self::PREFIX) || !is_string($key) || $key === '') throw new \InvalidArgumentException(__('Not a signing secret.', 'wconvert-pro'));
        return 'v1,' . base64_encode(hash_hmac('sha256', $id . '.' . $timestamp . '.' . $body, $key, true));
    }
}
