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
 * **So changing an Optin's Goal restates its entire history.** That is not a
 * side effect of this class — it is the reason it exists rather than a `goal`
 * column existing. Correcting a mis-set Goal makes the Optin's whole history
 * right rather than splitting it permanently in two at the moment of the edit,
 * and since a Goal is freely correctable the frozen alternative means a
 * permanent split every time somebody fixes a typo. It will look like a bug to
 * someone; it is the decision.
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
     * **Every day is restated**, including the ones counted long before
     * anybody corrected anything — which is what "restates its entire history"
     * means literally, as opposed to a series that changes shape halfway
     * along.
     *
     * A day the rows mention with no count of the headline kind reports **0
     * rather than being absent**: `lead_magnet_delivered` has no writer yet,
     * so a lead-magnet Optin honestly reports no deliveries against real
     * Conversions, and a gap in the series would read as missing data instead.
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
     * How many of one kind the rows carry, over whatever range they cover.
     *
     * The one read here with no [[Goal]] in it, and that is the point: a
     * [[Dismissal]] is a Dismissal whatever the Optin was hoping for, and the
     * card reports it beside a headline the Goal chose. {@see self::headline()}
     * is this same sum taken over the kind the Goal declares.
     *
     * @param iterable<array<string, mixed>> $rows
     */
    public static function total(StatKind $kind, iterable $rows): int
    {
        $total = 0;

        foreach ($rows as $row) {
            if (StatKind::tryFrom((string) ($row['kind'] ?? '')) === $kind) {
                $total += (int) ($row['count'] ?? 0);
            }
        }

        return $total;
    }

    /**
     * The denominator of conversion rate, which does not move when the Goal
     * does.
     *
     * An [[Impression]] is one Optin appearing to one visitor, once — it does
     * not depend on what the merchant was hoping they would do next, so it is
     * the one number a Goal correction leaves alone (CONTEXT.md, Impression).
     *
     * @param iterable<array<string, mixed>> $rows
     */
    public static function impressions(iterable $rows): int
    {
        return self::total(StatKind::Impression, $rows);
    }
}
