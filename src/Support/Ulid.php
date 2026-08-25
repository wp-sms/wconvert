<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * A ULID — 26 characters of Crockford base32, lexicographically sortable by
 * the millisecond it was minted in.
 *
 * WSMS reaches `symfony/uid` for this through its scoped dependency tree.
 * WConvert has no runtime Composer dependency at all and this is not the
 * feature to acquire one for: an unscoped `symfony/uid` in a wp.org plugin
 * collides with every other plugin shipping its own copy, and scoping is a
 * build stage this repo does not have. Forty lines, no vendor tree.
 *
 * WHY a ULID and not `wp_posts`' auto-increment: an Optin's id is inlined into
 * the JSON payload of a publicly cached page and echoed in every analytics
 * beacon. A sequential integer there is enumerable and leaks the site's total
 * post count (ADR 0001).
 *
 * @since 0.1.0
 */
final class Ulid
{
    /** Crockford base32 — no I, L, O or U, so a transcribed id cannot be misread. */
    private const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    public const LENGTH = 26;

    public static function generate(): string
    {
        return self::encodeTime((int) floor(microtime(true) * 1000)) . self::encodeRandomness();
    }

    /**
     * 48 bits of millisecond timestamp as the leading 10 characters — the half
     * that makes ids sort chronologically, so `ORDER BY id` is `ORDER BY
     * created_at` without the column.
     */
    private static function encodeTime(int $milliseconds): string
    {
        $encoded = '';

        for ($i = 0; $i < 10; $i++) {
            $encoded = self::ALPHABET[$milliseconds & 31] . $encoded;
            $milliseconds >>= 5;
        }

        return $encoded;
    }

    /**
     * 80 bits of randomness as the trailing 16 characters, from
     * random_bytes(): the id is public, so it is minted from a CSPRNG rather
     * than from mt_rand().
     */
    private static function encodeRandomness(): string
    {
        $encoded = '';
        $accumulator = 0;
        $pending = 0;

        // 80 bits in, five at a time out. 80 divides by 5, so the accumulator
        // is empty at the end and there is no padding character to strip.
        foreach (str_split(random_bytes(10)) as $byte) {
            $accumulator = ($accumulator << 8) | ord($byte);
            $pending += 8;

            while ($pending >= 5) {
                $pending -= 5;
                $encoded .= self::ALPHABET[($accumulator >> $pending) & 31];
            }
        }

        return $encoded;
    }
}
