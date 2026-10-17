<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * The same dates a year later, for Copy to next year (#279).
 *
 * ============================================================================
 * THE STRING IS SHIFTED, NEVER AN INSTANT.
 * ============================================================================
 * A [[Schedule]] is the merchant's wall time in the site timezone (ADR 0050).
 * "02:30 on 29 March" next year is still 02:30, whichever side of a DST change
 * either date falls on; adding 365 days' worth of seconds would move it an
 * hour. So the year digits move and nothing is ever resolved against a zone.
 *
 * 29 February has no next-year twin and becomes 28 February, which keeps the
 * day inside the same month rather than spilling into March.
 */
final class NextYear
{
    /** `Y-m-d H:i`, a year later, or null when it is not one. */
    public static function wall(?string $wall): ?string
    {
        if ($wall === null || !preg_match('/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/D', $wall, $parts)) {
            return null;
        }
        $day = self::day($parts[1]);
        return $day === null ? null : $day . ' ' . $parts[2];
    }

    /** `Y-m-d`, a year later, or null when it is not one. */
    public static function day(string $day): ?string
    {
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $day);
        if ($parsed === false || $parsed->format('Y-m-d') !== $day) {
            return null;
        }
        [$year, $month, $date] = array_map('intval', explode('-', $day));
        $next = $year + 1;
        if ($month === 2 && $date === 29) {
            $date = 28;
        }
        return sprintf('%04d-%02d-%02d', $next, $month, $date);
    }

    /**
     * The name with `$year` replaced by the year after.
     *
     * A name with no `$year` in it gets the next year appended after
     * `$separator`, or is kept as it is when `$separator` is null: an
     * occasion needs a new name, a campaign inside it does not.
     */
    public static function name(string $name, int $year, ?string $separator = ' '): string
    {
        $next = (string) ($year + 1);
        $renamed = preg_replace('/(?<!\d)' . $year . '(?!\d)/', $next, $name, -1, $count);
        if ($count > 0 && is_string($renamed)) {
            return $renamed;
        }
        return $separator === null ? $name : rtrim($name, " \t-") . $separator . $next;
    }
}
