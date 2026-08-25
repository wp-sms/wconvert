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
 * Goal and within an Optin over time.
 *
 * **There is no "left without converting" figure either.** It is already
 * `impressions − conversions − dismissals`, and naming it invites a screen
 * reporting two numbers where one is the arithmetic of the other
 * (CONTEXT.md, Dismissal).
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
            $held = array_filter($optins, static fn (array $o): bool => $o['goal'] === $goal);

            // A Goal no Optin holds has nothing to report. This is also what
            // makes a corrected Goal MOVE a history rather than split it: the
            // Goal it was corrected away from keeps no card at all.
            if ($held === []) {
                continue;
            }

            $cards[] = self::card($goal, $range, $byGoal[$goal->value] ?? [], $held, $byOptin);
        }

        return ['from' => $range->from, 'to' => $range->to, 'goals' => $cards];
    }

    /**
     * One Goal's card, with its own Optins inside it.
     *
     * @param list<array<string, mixed>> $rows
     * @param array<string, array{name: string, goal: Goal, deleted: bool}> $held
     * @param array<string, list<array<string, mixed>>> $byOptin
     * @return array<string, mixed>
     */
    private static function card(Goal $goal, StatRange $range, array $rows, array $held, array $byOptin): array
    {
        $kind = $goal->headlineKind();
        $headline = GoalReport::headline($goal, $rows);
        $conversions = GoalReport::total(StatKind::Conversion, $rows);

        return [
            'goal' => $goal->value,
            'label' => $goal->label(),
            'headline_label' => $goal->headlineLabel(),
            'headline' => $headline,
            // `conversions − lead_magnet_delivered` is the delivery failure
            // count, and it has no second metric behind it (ADR 0020). Null
            // where the headline IS conversions — the arithmetic would be zero
            // by construction — and null while nothing writes the headline
            // kind, because every Conversion would otherwise read as a failed
            // delivery.
            'delivery_failures' => $kind !== StatKind::Conversion && $kind->hasWriter()
                ? max(0, $conversions - $headline)
                : null,
            // Why the number above is zero, where it is zero for a reason the
            // merchant cannot act on. It disappears when the job that writes
            // the kind ships.
            'note' => $kind->hasWriter() ? null : __(
                'Nothing records this yet, so it reads zero against real conversions. The job that counts it has not shipped.',
                'wconvert'
            ),
            ...self::counts($rows),
            'by_day' => self::series($goal, $range, $rows),
            'optins' => self::optinRows($goal, $held, $byOptin),
        ];
    }

    /**
     * The three numbers that do not move when the Goal does, and the rate over
     * two of them.
     *
     * An [[Impression]] is one Optin appearing to one visitor and a
     * [[Dismissal]] is a deliberate close; neither depends on what the
     * merchant was hoping for. **Conversion rate is conversions ÷
     * impressions** — the Conversion kind and not the headline kind, so a
     * lead-magnet Optin's rate measures what visitors did rather than what the
     * delivery job managed afterwards.
     *
     * `null` rather than zero where nothing was shown: a rate over no
     * denominator is undefined, and 0% is a claim that visitors saw it and
     * did not act.
     *
     * @param list<array<string, mixed>> $rows
     * @return array{impressions: int, dismissals: int, conversion_rate: float|null}
     */
    private static function counts(array $rows): array
    {
        $impressions = GoalReport::impressions($rows);
        $conversions = GoalReport::total(StatKind::Conversion, $rows);

        return [
            'impressions' => $impressions,
            'dismissals' => GoalReport::total(StatKind::Dismiss, $rows),
            'conversion_rate' => $impressions === 0 ? null : round($conversions / $impressions, 4),
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
     * Newest first, off the ULID — the id already sorts chronologically, so
     * this is the Optin list's own order and not a ranking by any number on
     * the row.
     *
     * @param array<string, array{name: string, goal: Goal, deleted: bool}> $held
     * @param array<string, list<array<string, mixed>>> $byOptin
     * @return list<array<string, mixed>>
     */
    private static function optinRows(Goal $goal, array $held, array $byOptin): array
    {
        $live = array_filter($held, static fn (array $optin): bool => !$optin['deleted']);

        krsort($live);

        $rows = [];

        foreach ($live as $id => $optin) {
            $counters = $byOptin[$id] ?? [];

            $rows[] = [
                'id' => $id,
                'name' => $optin['name'],
                'headline' => GoalReport::headline($goal, $counters),
                ...self::counts($counters),
            ];
        }

        return $rows;
    }

    /**
     * Every Optin whose counts this build can interpret, by id.
     *
     * An Optin holding a `goal` outside {@see Goal} is dropped **with its
     * counts**, rather than being filed under a card that would have to
     * invent a headline for it. That is the same posture
     * {@see GoalReport::byDay()} takes towards an unknown `kind`: what is
     * outside a closed set is a row no version of this code wrote, and
     * guessing at it is how a wrong number gets reported confidently.
     *
     * @param iterable<array<string, mixed>> $rows
     * @return array<string, array{name: string, goal: Goal, deleted: bool}>
     */
    private static function interpretable(iterable $rows): array
    {
        $optins = [];

        foreach ($rows as $row) {
            $goal = Goal::tryFrom((string) ($row['goal'] ?? ''));

            if ($goal === null) {
                continue;
            }

            $optins[(string) ($row['id'] ?? '')] = [
                'name' => (string) ($row['name'] ?? ''),
                'goal' => $goal,
                'deleted' => ($row['deleted_at'] ?? null) !== null,
            ];
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
     * @param array<string, array{name: string, goal: Goal, deleted: bool}> $optins
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

            $byGoal[$optins[$optinId]['goal']->value][] = $row;
            $byOptin[$optinId][] = $row;
        }

        return [$byGoal, $byOptin];
    }
}
