<?php

namespace WConvert\Frontend;

use WConvert\Optin\PublishedOptin;

defined('ABSPATH') || exit;

/**
 * How far each end of a scheduled window is from now, in words.
 *
 * ============================================================================
 * THE MAGNITUDE IS MINTED HERE; THE DIRECTION IS THE BROWSER'S.
 * ============================================================================
 * The inspector panel is composed from the loader's own module set, which has
 * no dependencies at all (ADR 0004), so it carries no `@wordpress/i18n` and
 * cannot spell *"3 days"* — that needs plural rules and a formatter, and a
 * formatter in this bundle is a dependency in the loader's graph. Every
 * merchant-facing word is therefore minted in PHP (ADR 0048), and
 * `human_time_diff()` already says this one, translated, in core.
 *
 * **Both boundaries are minted wherever they exist, without asking which side
 * of one we are on.** `human_time_diff()` is an absolute magnitude, so the
 * same number answers *"it starts in %s"* and *"it ended %s ago"*. Which
 * sentence to fill is `inspect/explain.ts`'s answer, taken on the same clock
 * reading as the verdict it explains — so the two halves cannot disagree about
 * the direction, which is the only thing they could have disagreed about.
 *
 * It reads the RESOLVED instants out of the published set rather than the wall
 * times out of `config`: those are the numbers the browser was actually handed
 * ({@see \WConvert\Optin\Schedule}), and reading the other copy would be a
 * second resolution of one schedule with nothing asserting the two agree.
 *
 * Beside {@see \WConvert\Optin\Suspension}'s `reasonsIn()` in shape, and it is
 * the same job: a per-Optin sentence fragment the panel carries verbatim.
 *
 * @since 0.1.0
 */
final class InspectorSchedules
{
    /**
     * @param iterable<array<string, mixed>> $set The published set.
     * @param int $now Unix seconds.
     * @return array<string, array{starts: string|null, ends: string|null}>
     */
    public static function forSet(iterable $set, int $now): array
    {
        $schedules = [];

        foreach (PublishedOptin::fromSet($set) as $optin) {
            $starts = self::seconds($optin->payload['starts_at'] ?? null);
            $ends = self::seconds($optin->payload['ends_at'] ?? null);

            // Absent from the map entirely, rather than present with two
            // nulls. An Optin with no schedule has not reached this gate, and
            // a key that appeared for every Optin would make "not scheduled"
            // and "scheduled, both ends unreadable" one thing.
            if ($starts === null && $ends === null) {
                continue;
            }

            $schedules[$optin->id] = [
                'starts' => $starts === null ? null : human_time_diff($now, $starts),
                'ends' => $ends === null ? null : human_time_diff($now, $ends),
            ];
        }

        return $schedules;
    }

    /**
     * The payload's milliseconds, as the seconds WordPress counts in.
     *
     * Milliseconds on the wire because `Date.now()` is what compares them and
     * a conversion in the browser is a conversion that can be forgotten; every
     * PHP clock function takes seconds, so the conversion happens once, here,
     * where it is read back.
     *
     * @param mixed $value
     */
    private static function seconds($value): ?int
    {
        return is_int($value) ? intdiv($value, 1000) : null;
    }
}
