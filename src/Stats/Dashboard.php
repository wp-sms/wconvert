<?php

namespace WConvert\Stats;

use WConvert\Goal\Goal;
use WConvert\Goal\GoalReport;
use WConvert\Optin\OptinRepository;

defined('ABSPATH') || exit;

/**
 * The analytics screen: what each [[Goal]] is producing, and what each
 * [[Optin]] did.
 *
 * ============================================================================
 * PER-GOAL CARDS, NEVER A LEADERBOARD.
 * ============================================================================
 * "Click-throughs to the offer" and "conversions on Optins that capture an
 * email" are different acts, and ranking them against each other means
 * nothing. So there is **no site-wide conversion rate anywhere in this
 * payload**, and there is no flat list of Optins to sort: an Optin's row lives
 * INSIDE its Goal's card, which is what makes a cross-Goal ranking
 * unexpressible rather than merely discouraged. Comparison is offered within a
 * Goal and within an Optin over time — both carry their own daily series.
 *
 * **There is no "left without converting" figure either.** It is already
 * `impressions − conversions − dismissals`, and naming it invites a screen
 * reporting two numbers where one is the arithmetic of the other
 * (CONTEXT.md, Dismissal).
 *
 * **`conversions − lead_magnet_delivered` is not an instance of that rule**,
 * and this paragraph used to say it was. It is on the payload as of #31, as
 * `delivery_failures` on the lead-magnet card and `null` everywhere else —
 * because `conversions` is not a field here at all, so the subtraction is new
 * information rather than a restatement of two numbers already on screen. The
 * check is written out at {@see self::deliveryFailures()}, which is also where
 * the clamp and the null are argued.
 *
 * ============================================================================
 * TWO READS, AND THE JOIN IS HERE RATHER THAN IN SQL.
 * ============================================================================
 * Every number derives from `wconvert_stats` interpreted through
 * `wconvert_optins`, and **nothing joins `wconvert_leads` to produce a count**
 * — that derivation is the one ADR 0018 depends on not existing, since erasure
 * `DELETE`s Lead rows and a metric read from them would let a single erasure
 * request rewrite a merchant's history.
 *
 * The two tables meet in PHP rather than in a `JOIN`, which is a decision with
 * its own record: a Goal is tens of rows of fact denormalised onto thousands
 * of counters, {@see \WConvert\Database\Connection} has been widened twice and
 * says the third should be read as pressure to stop, and the interpretation
 * belongs in one place rather than half in SQL (ADR 0034).
 *
 * **{@see self::of()} is pure and takes rows**, the same arrangement
 * {@see GoalReport} has with the arithmetic and {@see StatDay} has with the
 * site's timezone. {@see self::read()} is the half that fetches.
 *
 * @since 0.1.0
 */
final class Dashboard
{
    public function __construct(
        private readonly StatsRepository $stats,
        private readonly OptinRepository $optins,
    ) {
    }

    /**
     * The screen, over one window.
     *
     * @return array<string, mixed>
     */
    public function read(StatRange $range): array
    {
        return self::of($range, $this->stats->inRange($range), $this->optins->interpretations());
    }

    /**
     * The same screen, as arithmetic.
     *
     * `$optinRows` carries **every** Optin, soft-deleted ones included — which
     * is one half of the rule below and the reason
     * {@see OptinRepository::interpretations()} has no `WHERE` and no `LIMIT`.
     *
     * @param iterable<array<string, mixed>> $statRows  `(optin_id, stat_date, kind, count)`.
     * @param iterable<array<string, mixed>> $optinRows `(id, name, goal, deleted_at)`.
     * @return array<string, mixed>
     */
    public static function of(StatRange $range, iterable $statRows, iterable $optinRows): array
    {
        $optins = self::interpretable($optinRows);
        [$byGoal, $byOptin] = self::bucket($range, $statRows, $optins);

        $cards = [];

        foreach (Goal::cases() as $goal) {
            $held = array_filter($optins, static fn (InterpretedOptin $o): bool => $o->goal === $goal);

            // A Goal no Optin holds has nothing to report. This is also what
            // makes a corrected Goal MOVE a history rather than split it: the
            // Goal it was corrected away from keeps no card at all.
            if ($held === []) {
                continue;
            }

            $cards[] = self::card($goal, $range, $byGoal[$goal->value] ?? [], $held, $byOptin);
        }

        // `days` travels so the screen can say which window is selected
        // without spelling {@see StatRange::DEFAULT_DAYS} a second time in a
        // bundle with nothing asserting the two agree.
        return ['from' => $range->from, 'to' => $range->to, 'days' => $range->days(), 'goals' => $cards];
    }

    /**
     * One Goal's card, with its own Optins inside it.
     *
     * @param list<array<string, mixed>> $rows
     * @param array<string, InterpretedOptin> $held
     * @param array<string, list<array<string, mixed>>> $byOptin
     * @return array<string, mixed>
     */
    private static function card(Goal $goal, StatRange $range, array $rows, array $held, array $byOptin): array
    {
        // Hoisted, so one Goal's slice is walked once rather than twice: the
        // failure count and the numbers below both want the same map, and
        // {@see GoalReport::totals()} produces every kind in one pass on
        // purpose.
        $totals = GoalReport::totals($rows);

        return [
            'goal' => $goal->value,
            'label' => $goal->label(),
            'headline_label' => $goal->headlineLabel(),
            'delivery_failures' => self::deliveryFailures($goal, $totals),
            ...self::numbers($goal, $range, $rows, $totals),
            'optins' => self::optinRows($goal, $range, $held, $byOptin),
        ];
    }

    /**
     * `conversions − lead_magnet_delivered`, clamped at zero — **or null on
     * every other Goal.**
     *
     * ========================================================================
     * NULL RATHER THAN ABSENT, BECAUSE THE ADMIN CANNOT BRANCH ON A GOAL.
     * ========================================================================
     * `GoalParityTest::testNoGoalIsSpelledInTheAdminBundle` scans every
     * `.ts`/`.tsx` under `resources/admin/src` and fails on any Goal enum
     * value, so a card cannot know which Goal it is drawing. A server-nulled
     * field is therefore the only shape available: the bundle renders the row
     * where there is a number and omits it where there is not, and never asks
     * why. It is the same constraint the `note` this replaces was built
     * around.
     *
     * **On the card only, never on an Optin row.** {@see self::numbers()} is
     * spread into both, and this is one figure for the Goal rather than a
     * second metric per row — the Optin table has no column for it and could
     * not head one without spelling the Goal.
     *
     * ========================================================================
     * IT IS NEW INFORMATION, WHICH IS WHY THE OLD OBJECTION DOES NOT HOLD.
     * ========================================================================
     * This class used to refuse the figure as *"the same
     * arithmetic-of-two-numbers-already-shown shape"* as the "left without
     * converting" count. **That was wrong, and worth checking rather than
     * repeating.** `conversions` is not a field on this payload at all —
     * {@see self::numbers()} emits `headline`, `impressions`, `dismissals`,
     * `conversion_rate` and `by_day`, and on a lead-magnet card `headline` is
     * *deliveries*. So one operand is the headline and the other is nowhere on
     * screen. "Left without converting" is `impressions − conversions −
     * dismissals`, whose three operands are all on the card; this is not that
     * shape. (`conversions` is loosely recoverable from
     * `conversion_rate × impressions`, rounded to 4dp and never displayed,
     * which is not a number on screen either.)
     *
     * **The clamp is not defensive padding.** A Conversion at 23:58 and its
     * delivery at 00:01 land on different `stat_date`s, so on the one-day
     * window this would print a negative number most mornings without it. It
     * also absorbs the two replay seams
     * {@see \WConvert\Destination\LeadMagnet\DeliveryCount} names.
     *
     * A count here is *not yet delivered* rather than *failed*: a Conversion
     * whose push is still queued or backing off is in it. That is the honest
     * reading of the subtraction and the copy on the card says so.
     *
     * @param array<string, int> $totals Every kind's total for this Goal's slice.
     */
    private static function deliveryFailures(Goal $goal, array $totals): ?int
    {
        if ($goal->headlineKind() !== StatKind::LeadMagnetDelivered) {
            return null;
        }

        return max(
            0,
            ($totals[StatKind::Conversion->value] ?? 0) - ($totals[StatKind::LeadMagnetDelivered->value] ?? 0)
        );
    }

    /**
     * The numbers a card and an Optin row both carry, over one set of rows.
     *
     * **Conversion rate is conversions ÷ impressions** — the Conversion kind
     * and not the headline kind, so a lead-magnet Optin's rate measures what
     * visitors did rather than what the delivery job managed afterwards. An
     * [[Impression]] is one Optin appearing to one visitor and a [[Dismissal]]
     * is a deliberate close; neither moves when the Goal does.
     *
     * `null` rather than zero where nothing was shown: a rate over no
     * denominator is undefined, and 0% is a claim that visitors saw it and did
     * not act.
     *
     * @param list<array<string, mixed>> $rows
     * @param array<string, int> $totals `GoalReport::totals($rows)`, hoisted by the caller so one slice is walked once.
     * @return array{headline: int, impressions: int, dismissals: int, conversion_rate: float|null, by_day: array<string, int>}
     */
    private static function numbers(Goal $goal, StatRange $range, array $rows, array $totals): array
    {
        $impressions = $totals[StatKind::Impression->value] ?? 0;
        $conversions = $totals[StatKind::Conversion->value] ?? 0;

        return [
            'headline' => $totals[$goal->headlineKind()->value] ?? 0,
            'impressions' => $impressions,
            'dismissals' => $totals[StatKind::Dismiss->value] ?? 0,
            'conversion_rate' => $impressions === 0 ? null : round($conversions / $impressions, 4),
            'by_day' => self::series($goal, $range, $rows),
        ];
    }

    /**
     * The headline number per day, over every day in the window.
     *
     * Seeded from the range rather than from the rows, so a day nothing
     * happened on reports 0 rather than being absent — the quiet days are
     * exactly the ones a merchant is reading for.
     *
     * @param list<array<string, mixed>> $rows
     * @return array<string, int>
     */
    private static function series(Goal $goal, StatRange $range, array $rows): array
    {
        $days = array_fill_keys($range->eachDay(), 0);

        foreach (GoalReport::byDay($goal, $rows) as $day => $count) {
            $days[$day] = $count;
        }

        return $days;
    }

    /**
     * The per-Optin list, **soft-deleted Optins absent**.
     *
     * The other half of the rule: their counts are already in the card's
     * totals above, because a merchant tidying up in March must not watch
     * February's goal total fall (ADR 0020). What they lose is the row, which
     * is a list of things the merchant is still running.
     *
     * Each row carries its own daily series, which is what "comparison is
     * offered within an Optin over time" means — otherwise the only way to
     * compare an Optin with itself would be to move the whole screen's window
     * and remember the last number.
     *
     * Newest first, off the ULID — the id already sorts chronologically, so
     * this is the Optin list's own order and not a ranking by any number on
     * the row.
     *
     * @param array<string, InterpretedOptin> $held
     * @param array<string, list<array<string, mixed>>> $byOptin
     * @return list<array<string, mixed>>
     */
    private static function optinRows(Goal $goal, StatRange $range, array $held, array $byOptin): array
    {
        $live = array_filter($held, static fn (InterpretedOptin $optin): bool => !$optin->deleted);

        // SORT_STRING, because a ULID is base32 text: under SORT_REGULAR an
        // all-digit one would be compared as a number against its neighbours.
        krsort($live, SORT_STRING);

        $rows = [];

        foreach ($live as $id => $optin) {
            $own = $byOptin[$id] ?? [];

            $rows[] = [
                'id' => $optin->id,
                'name' => $optin->name,
                ...self::numbers($goal, $range, $own, GoalReport::totals($own)),
            ];
        }

        return $rows;
    }

    /**
     * Every Optin whose counts this build can interpret, by id.
     *
     * @param iterable<array<string, mixed>> $rows
     * @return array<string, InterpretedOptin>
     */
    private static function interpretable(iterable $rows): array
    {
        $optins = [];

        foreach ($rows as $row) {
            $optin = InterpretedOptin::fromRow($row);

            if ($optin !== null) {
                $optins[$optin->id] = $optin;
            }
        }

        return $optins;
    }

    /**
     * The counters, bucketed by the Goal their Optin currently holds and by
     * the Optin itself.
     *
     * **This is the join, and it is one pass.** A stat row naming an Optin
     * this build cannot interpret is dropped here rather than counted into
     * some total — including a row whose Optin is missing entirely, which
     * cannot happen, because an Optin is soft-deleted and never removed
     * (ADR 0020).
     *
     * The range is re-applied even though the read already filtered on it, so
     * that {@see self::of()} answers for the window it was handed whatever
     * rows it was given.
     *
     * @param iterable<array<string, mixed>> $rows
     * @param array<string, InterpretedOptin> $optins
     * @return array{0: array<string, list<array<string, mixed>>>, 1: array<string, list<array<string, mixed>>>}
     */
    private static function bucket(StatRange $range, iterable $rows, array $optins): array
    {
        $byGoal = [];
        $byOptin = [];

        foreach ($rows as $row) {
            $optinId = (string) ($row['optin_id'] ?? '');

            if (!isset($optins[$optinId]) || !$range->covers((string) ($row['stat_date'] ?? ''))) {
                continue;
            }

            $byGoal[$optins[$optinId]->goal->value][] = $row;
            $byOptin[$optinId][] = $row;
        }

        return [$byGoal, $byOptin];
    }
}
