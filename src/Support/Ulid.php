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

    /**
     * A ULID, as a regular expression — **the one spelling of it.**
     *
     * Three callers need it and had three copies: two REST route constraints
     * and the export's query-string filter. A route constraint that drifts
     * from the alphabet above is a 404 on a legitimate id or a query on a
     * value that is not one, and neither shows up until it does.
     *
     * Unanchored, because a route constraint is spliced into a larger pattern
     * and an anchor there would end the route rather than the id. Callers that
     * match it alone anchor it themselves.
     */
    public const PATTERN = '[0-9A-HJKMNP-TV-Z]{' . self::LENGTH . '}';

    public static function isOne(string $value): bool
    {
        return preg_match('/^' . self::PATTERN . '$/', $value) === 1;
    }

    public static function generate(): string
    {
        return self::encodeTime((int) floor(microtime(true) * 1000)) . self::encodeRandomness();
    }

    /**
     * The smallest ULID that could have been minted in a given millisecond —
     * that millisecond's timestamp with the randomness at zero.
     *
     * It is a BOUNDARY rather than an id, and nothing is ever stored under it.
     * Retention pruning deletes everything captured before a cutoff, and
     * because the leading 48 bits are the minting time, `id < floorAt(cutoff)`
     * is that range expressed on the primary key — the same rows
     * `created_at < cutoff` names, reached without a second index
     * (ADR 0002, ADR 0018).
     */
    public static function floorAt(int $milliseconds): string
    {
        return self::encodeTime($milliseconds) . str_repeat(self::ALPHABET[0], self::LENGTH - 10);
    }

    /**
     * The millisecond a ULID was minted in, read back out of it.
     *
     * The lead log's grouping view is what needs this. `idx_email` covers
     * `(email, id)` — InnoDB appends the primary key to every secondary index
     * — so `MAX(id)` per group is answered from the index alone, while a
     * `MAX(created_at)` would force a row lookup and lose the covering read
     * ADR 0021 promised when it made the identity keys indexed. The time is
     * already in the id; reading it here is cheaper than fetching it again.
     *
     * Returns null for anything that is not a ULID, because the value it would
     * otherwise decode is a date, and a wrong date is worse than none.
     */
    public static function timeOf(string $ulid): ?int
    {
        if (strlen($ulid) !== self::LENGTH) {
            return null;
        }

        $milliseconds = 0;

        for ($i = 0; $i < 10; $i++) {
            $digit = strpos(self::ALPHABET, $ulid[$i]);

            if ($digit === false) {
                return null;
            }

            $milliseconds = ($milliseconds << 5) | $digit;
        }

        return $milliseconds;
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
