<?php

namespace WConvert\Goal;

use WConvert\Stats\StatKind;

defined('ABSPATH') || exit;

/**
 * Reading the daily counters through the [[Goal]] that gives them meaning.
 *
 * ============================================================================
 * THE INTERPRETATION IS APPLIED AT READ, NEVER STAMPED AT WRITE.
 * ============================================================================
 * A row in `wconvert_stats` is `(optin_id, kind, stat_date, count)` and carries
 * **no `goal`, no `had_email`, no `had_phone` and no display type**. Everything
 * needed to interpret it is read from `wconvert_optins` at report time, which
 * is never erased and only ever soft-deleted (ADR 0020).
 *
 * A Goal is fixed after first publication (ADR 0085). Another Goal starts a
 * separate Optin, so this read cannot silently reinterpret published history.
 *
 * **Pure, and it takes rows rather than a repository.** What is here is the
 * arithmetic, which is the half that can be proven without a database — the
 * same arrangement {@see \WConvert\Stats\StatDay} has with the site's
 * timezone and {@see \WConvert\Optin\PublishedProjection} has with the rule
 * vocabulary.
 *
 * This originally read "the join that produces them is SQL and belongs to the
 * screen that draws it". **It is not SQL.** #28 wrote that screen and read the
 * two tables with two statements, joining them in PHP: a Goal is tens of rows
 * of fact, and a `JOIN` would denormalise it onto thousands of counters while
 * costing {@see \WConvert\Database\Connection} a third widening (ADR 0034).
 * The half that belongs to the screen is {@see \WConvert\Stats\Dashboard},
 * which is where the two meet.
 *
 * @since 0.1.0
 */
final class GoalReport
{
    /**
     * The headline number, over whatever range the rows cover.
     *
     * Which kind that is comes from {@see Goal::headlineKind()} — the
     * declaration that makes a Goal more than a filter at creation time.
     *
     * @param iterable<array<string, mixed>> $rows `(stat_date, kind, count)`, as the counters hold them.
     */
    public static function headline(Goal $goal, iterable $rows): int
    {
        return array_sum(self::byDay($goal, $rows));
    }

    /**
     * The same number, per day.
     *
     * A day the rows mention with no count of the headline kind reports **0
     * rather than being absent**, and the lead-magnet Goal is where that
     * matters: a delivery happens after the Conversion and from a different
     * process, so a day can carry Conversions and no deliveries at all — a
     * mail transport that was down, or pushes still backing off. Zero is the
     * true number there; a gap in the series would read as missing data.
     *
     * @param iterable<array<string, mixed>> $rows
     * @return array<string, int>
     */
    public static function byDay(Goal $goal, iterable $rows): array
    {
        $days = [];

        foreach ($rows as $row) {
            $day = (string) ($row['stat_date'] ?? '');
            $kind = StatKind::tryFrom((string) ($row['kind'] ?? ''));

            // An unknown kind is a row no version of this code wrote: the set
            // is closed in PHP over a VARCHAR column, so what is outside it is
            // not a count to add (ADR 0019).
            if ($kind === null) {
                continue;
            }

            $days[$day] ??= 0;

            if ($kind === $goal->headlineKind()) {
                $days[$day] += (int) ($row['count'] ?? 0);
            }
        }

        return $days;
    }

    /**
     * Every kind's total, keyed by kind, in **one pass**.
     *
     * The reads here with no [[Goal]] in them, and that is the point: an
     * [[Impression]] is one Optin appearing to one visitor and a [[Dismissal]]
     * is a deliberate close, and neither depends on what the merchant was
     * hoping for. They are the numbers a Goal correction leaves alone, sitting
     * beside a headline the Goal chose.
     *
     * One pass and a map rather than a method per kind, because the card wants
     * three of them at once: a named accessor per kind would walk the same
     * rows three times and would still not name the fourth.
     *
     * A kind with no rows is **absent rather than zero** — the caller says
     * what a missing kind means, and for the headline it means 0
     * ({@see self::byDay()}).
     *
     * @param iterable<array<string, mixed>> $rows
     * @return array<string, int>
     */
    public static function totals(iterable $rows): array
    {
        $totals = [];

        foreach ($rows as $row) {
            $kind = StatKind::tryFrom((string) ($row['kind'] ?? ''));

            // An unknown kind is a row no version of this code wrote
            // (ADR 0019), the same reading {@see self::byDay()} takes.
            if ($kind === null) {
                continue;
            }

            $totals[$kind->value] = ($totals[$kind->value] ?? 0) + (int) ($row['count'] ?? 0);
        }

        return $totals;
    }
}
