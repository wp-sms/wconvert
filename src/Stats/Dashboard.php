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
 * **There is no "left without converting" figure either.** A visitor can
 * dismiss, reopen and convert on the same document. These overlapping daily
 * counters cannot reconstruct abandonment (ADR 0101).
 *
 * Compatible impact counts are computed here: captured submissions, offer
 * clicks, cart clicks and appearances. Email send events remain separate
 * from requests. Analytics does not infer a delivery backlog (ADR 0089).
 *
 * ============================================================================
 * TWO TABLES, AND THE JOIN IS HERE RATHER THAN IN SQL.
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
        return self::of($range, $range->days() === 0 ? [] : $this->stats->inRange($range), $this->optins->interpretations());
    }

    /** Resolve both windows with one interpretation snapshot, without visitor data.
     * @return array<string, mixed>
     */
    public function compare(StatRange $range): array
    {
        if ($range->days() === 0) return $this->read($range) + ['complete_days' => true];
        $optins = $this->optins->interpretations();
        $current = self::of($range, $this->stats->inRange($range), $optins);
        $previous = $range->previous();
        $current['previous'] = self::of($previous, $this->stats->inRange($previous), $optins);
        $current['complete_days'] = true;
        $current['insights'] = Insights::forReport($current);
        return $current;
    }

    /**
     * The same screen, as arithmetic.
     *
     * `$optinRows` carries **every** Optin, soft-deleted ones included — which
     * is one half of the rule below and the reason
     * {@see OptinRepository::interpretations()} has no `WHERE` and no `LIMIT`.
     *
     * @param iterable<array<string, mixed>> $statRows  `(optin_id, stat_date, kind, count)`.
     * @param iterable<array<string, mixed>> $optinRows Short reporting metadata, including publication history and parent id.
     * @return array<string, mixed>
     */
    public static function of(StatRange $range, iterable $statRows, iterable $optinRows): array
    {
        $optins = self::interpretable($optinRows);
        [$byGoal, $byOptin] = self::bucket($range, $statRows, $optins);

        $cards = [];

        foreach (Goal::cases() as $goal) {
            $held = array_filter($optins, static fn (InterpretedOptin $o): bool => $o->goal === $goal && ($o->wasPublished || isset($byOptin[$o->id])));

            // A Goal no Optin holds has nothing to report.
            if ($held === []) {
                continue;
            }

            $cards[] = self::card($goal, $range, $byGoal[$goal->value] ?? [], $held, $byOptin);
        }

        // `days` travels so the screen can say which window is selected
        // without spelling {@see StatRange::DEFAULT_DAYS} a second time in a
        // bundle with nothing asserting the two agree.
        return ['from' => $range->from, 'to' => $range->to, 'days' => $range->days(), 'goals' => $cards, 'impact' => self::impact($cards)];
    }

    /** Compatible actions only; send events never inflate captured Leads.
     * @param list<array<string, mixed>> $cards
     * @return list<array<string, mixed>>
     */
    private static function impact(array $cards): array
    {
        $groups = [
            'leads' => ['label' => __('Leads captured', 'wconvert'), 'note' => __('Form submissions across all capture goals', 'wconvert')],
            'offers' => ['label' => __('Offer link clicks', 'wconvert'), 'note' => __('Clicks to linked offers or content', 'wconvert')],
            'carts' => ['label' => __('Cart return clicks', 'wconvert'), 'note' => __('Clicks back to a shopping basket, not orders', 'wconvert')],
            'impressions' => ['label' => __('Times shown', 'wconvert'), 'note' => __('Campaign appearances, including repeats', 'wconvert')],
        ];
        $impact = [];
        foreach ($groups as $id => $group) $impact[$id] = $group + ['id' => $id, 'count' => 0, 'goals' => []];
        foreach ($cards as $card) {
            $goal = Goal::from($card['goal']);
            $key = $goal->outcome()->action === 'submit' ? 'leads' : ($goal === Goal::RecoverCart ? 'carts' : 'offers');
            $impact[$key]['count'] += $card['conversions'];
            $impact[$key]['goals'][] = $card['goal'];
            $impact['impressions']['count'] += $card['impressions'];
            $impact['impressions']['goals'][] = $card['goal'];
        }
        return array_values($impact);
    }

    /**
     * One Goal's card, with its own Optins inside it.
     *
     * Goal publication requirements make the named action consistent across
     * this card. Measurement copy states the limit of the evidence (ADR 0085).
     *
     * @param list<array<string, mixed>> $rows
     * @param array<string, InterpretedOptin> $held
     * @param array<string, list<array<string, mixed>>> $byOptin
     * @return array<string, mixed>
     */
    private static function card(Goal $goal, StatRange $range, array $rows, array $held, array $byOptin): array
    {
        return [
            'goal' => $goal->value,
            'label' => $goal->label(),
            'headline_label' => $goal->headlineLabel(),
            'measurement' => $goal->outcome()->measurement,
            'proof_level' => $goal->outcome()->proofLevel,
            'action' => $goal->outcome()->action,
            'result_label' => $goal === Goal::DeliverLeadMagnet ? __('Resource requests', 'wconvert') : $goal->headlineLabel(),
            'rate_label' => $goal->rateLabel(),
            'undelivered_conversions' => self::undeliveredConversions($goal, $rows),
            ...self::numbers($goal, $range, $rows),
            'optins' => self::optinRows($goal, $range, $held, $byOptin),
        ];
    }

    /**
     * Same-period event difference, not a per-Lead pending or failed population.
     * Analytics presents both operands separately instead (ADR 0089).
     * Delayed or repeated sends can offset unrelated requests in the window.
     *
     * @param list<array<string, mixed>> $rows
     */
    private static function undeliveredConversions(Goal $goal, array $rows): ?int
    {
        if ($goal->headlineKind() !== StatKind::LeadMagnetDelivered) {
            return null;
        }

        $totals = GoalReport::totals($rows);

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
     * @return array<string, mixed>
     */
    private static function numbers(Goal $goal, StatRange $range, array $rows): array
    {
        $totals = GoalReport::totals($rows);
        $impressions = $totals[StatKind::Impression->value] ?? 0;
        $conversions = $totals[StatKind::Conversion->value] ?? 0;

        return [
            'headline' => $totals[$goal->headlineKind()->value] ?? 0,
            'conversions' => $conversions,
            'deliveries' => $goal->headlineKind() === StatKind::LeadMagnetDelivered ? ($totals[StatKind::LeadMagnetDelivered->value] ?? 0) : null,
            'impressions' => $impressions,
            'dismissals' => $totals[StatKind::Dismiss->value] ?? 0,
            'conversion_rate' => $impressions === 0 ? null : round($conversions / $impressions, 4),
            'by_day' => self::series($goal, $range, $rows),
            'conversion_by_day' => self::kindSeries(StatKind::Conversion, $range, $rows),
            'impression_by_day' => self::kindSeries(StatKind::Impression, $range, $rows),
        ];
    }

    /** @param list<array<string, mixed>> $rows
     * @return array<string, int>
     */
    private static function kindSeries(StatKind $kind, StatRange $range, array $rows): array
    {
        $days = array_fill_keys($range->eachDay(), 0);
        foreach ($rows as $row) {
            if (($row['kind'] ?? null) === $kind->value) $days[(string) $row['stat_date']] += (int) $row['count'];
        }
        return $days;
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
     * The per-Optin report includes inspectable historical rows (ADR 0089).
     * Soft-deleted counts and rows remain; publication actions do not.
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
        $ordered = $held;

        // SORT_STRING, because a ULID is base32 text: under SORT_REGULAR an
        // all-digit one would be compared as a number against its neighbours.
        krsort($ordered, SORT_STRING);

        $rows = [];

        foreach ($ordered as $id => $optin) {
            $rows[] = [
                'id' => $optin->id,
                'name' => $optin->name,
                'parent_id' => $optin->parentId,
                'status' => $optin->deleted ? 'historical' : ($optin->published ? 'published' : 'paused'),
                'published_at' => $optin->publishedAt,
                ...self::numbers($goal, $range, $byOptin[$id] ?? []),
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
