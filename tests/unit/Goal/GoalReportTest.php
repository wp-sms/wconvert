<?php

namespace WConvert\Tests\Unit\Goal;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\Goal;
use WConvert\Goal\GoalReport;
use WConvert\Stats\StatKind;

/**
 * **A [[Conversion]] is interpreted at read, never frozen at write**
 * (ADR 0020).
 *
 * A row in `wconvert_stats` is `(optin_id, kind, stat_date, count)` and
 * carries no `goal` at all. Everything needed to interpret it is read from
 * `wconvert_optins` at report time — which is what makes the sentence
 * ADR 0020 has been carrying as a paragraph literally true: **changing an
 * Optin's Goal restates its entire history.**
 *
 * That will look like a bug to someone. It is the decision, and it is the
 * price of making a Goal freely correctable: the frozen alternative means a
 * permanent split in the numbers every time somebody fixes a typo.
 */
#[CoversClass(GoalReport::class)]
final class GoalReportTest extends TestCase
{
    /**
     * Three days of counters on one Optin, exactly as the table holds them —
     * no goal, no discriminators, nothing but which act and how many.
     *
     * @return list<array<string, string>>
     */
    private static function history(): array
    {
        return [
            ['stat_date' => '2026-08-23', 'kind' => 'impression', 'count' => '400'],
            ['stat_date' => '2026-08-23', 'kind' => 'conversion', 'count' => '40'],
            ['stat_date' => '2026-08-23', 'kind' => 'lead_magnet_delivered', 'count' => '37'],
            ['stat_date' => '2026-08-24', 'kind' => 'impression', 'count' => '500'],
            ['stat_date' => '2026-08-24', 'kind' => 'conversion', 'count' => '50'],
            ['stat_date' => '2026-08-24', 'kind' => 'lead_magnet_delivered', 'count' => '45'],
            ['stat_date' => '2026-08-25', 'kind' => 'impression', 'count' => '100'],
            ['stat_date' => '2026-08-25', 'kind' => 'conversion', 'count' => '10'],
            ['stat_date' => '2026-08-25', 'kind' => 'lead_magnet_delivered', 'count' => '8'],
        ];
    }

    public function testAnEmailListGoalReportsItsSubmissions(): void
    {
        $this->assertSame(100, GoalReport::headline(Goal::GrowEmailList, self::history()));
    }

    /**
     * The one Goal whose headline is not `conversion`. The delivery happens
     * *after* the Conversion, from a different process, and can fail on its
     * own — so `conversions − lead_magnet_delivered` is the delivery failure
     * count with no second metric behind it (ADR 0008, ADR 0020).
     */
    public function testTheLeadMagnetGoalReportsItsDeliveries(): void
    {
        $this->assertSame(90, GoalReport::headline(Goal::DeliverLeadMagnet, self::history()));
    }

    /**
     * **The whole point.** The same rows, read under a corrected Goal, give a
     * different number for EVERY day — not a split at the moment of the edit.
     *
     * The counters were never touched: correcting a mis-set Goal makes an
     * Optin's whole history right rather than splitting it permanently in two
     * (ADR 0020).
     */
    public function testCorrectingAGoalRestatesTheEntireHistoryRatherThanSplittingIt(): void
    {
        $before = GoalReport::byDay(Goal::GrowEmailList, self::history());
        $after = GoalReport::byDay(Goal::DeliverLeadMagnet, self::history());

        $this->assertSame(['2026-08-23' => 40, '2026-08-24' => 50, '2026-08-25' => 10], $before);
        $this->assertSame(['2026-08-23' => 37, '2026-08-24' => 45, '2026-08-25' => 8], $after);

        // Every day moved, including the ones that were counted long before
        // anybody corrected anything.
        foreach (array_keys($before) as $day) {
            $this->assertNotSame($before[$day], $after[$day], "{$day} was left on the old interpretation");
        }
    }

    /**
     * The denominator is the same whatever the Goal, because an [[Impression]]
     * is one Optin appearing to one visitor and that does not depend on what
     * the merchant was hoping they would do (CONTEXT.md, Impression).
     */
    public function testTheDenominatorDoesNotMoveWhenTheGoalDoes(): void
    {
        $this->assertSame(1000, GoalReport::totals(self::history())[StatKind::Impression->value]);
    }

    /**
     * One pass, and every kind the rows carry. The card wants three of these
     * at once, so a named accessor per kind would walk the same rows three
     * times and still not name the fourth.
     */
    public function testEveryKindIsTotalledInOnePass(): void
    {
        $this->assertSame(
            ['impression' => 1000, 'conversion' => 100, 'lead_magnet_delivered' => 90],
            GoalReport::totals(self::history())
        );
    }

    /**
     * **A kind with no rows is absent rather than zero**, so the caller says
     * what missing means. For the headline it means 0; for a [[Dismissal]]
     * nobody performed it means the same, and both readings are the caller's
     * to make rather than this method's to guess.
     */
    public function testAKindWithNoRowsIsAbsentRatherThanZero(): void
    {
        $totals = GoalReport::totals([['stat_date' => '2026-08-25', 'kind' => 'conversion', 'count' => '10']]);

        $this->assertSame(['conversion' => 10], $totals);
        $this->assertArrayNotHasKey(StatKind::Dismiss->value, $totals);
    }

    /** And an unknown kind is not totalled either, for the reason byDay() gives. */
    public function testAnUnknownKindIsNotTotalled(): void
    {
        $this->assertSame(
            ['conversion' => 10],
            GoalReport::totals([
                ['stat_date' => '2026-08-25', 'kind' => 'conversion', 'count' => '10'],
                ['stat_date' => '2026-08-25', 'kind' => 'telepathy', 'count' => '999'],
            ])
        );
    }

    /**
     * A kind with no rows is zero rather than absent. `lead_magnet_delivered`
     * has no writer yet — the job that writes it arrives with its own ticket,
     * and the beacon refuses it because a browser cannot have watched a
     * delivery (ADR 0020) — so a lead-magnet Optin reports **0 deliveries
     * against real conversions**, which is the honest number for a feature
     * that has not shipped.
     */
    public function testAKindNothingHasWrittenYetReportsZeroRatherThanNothing(): void
    {
        $rows = [['stat_date' => '2026-08-25', 'kind' => 'conversion', 'count' => '10']];

        $this->assertSame(0, GoalReport::headline(Goal::DeliverLeadMagnet, $rows));
        $this->assertSame(['2026-08-25' => 0], GoalReport::byDay(Goal::DeliverLeadMagnet, $rows));
    }

    /**
     * A kind this build has never heard of is ignored rather than counted.
     * `kind` is `VARCHAR(32)` and the set is closed in PHP, so a value outside
     * it is a row no version of this code wrote (ADR 0019).
     */
    public function testARowNamingAKindThisBuildDoesNotKnowIsNotCounted(): void
    {
        $rows = [
            ['stat_date' => '2026-08-25', 'kind' => 'conversion', 'count' => '10'],
            ['stat_date' => '2026-08-25', 'kind' => 'telepathy', 'count' => '999'],
        ];

        $this->assertSame(10, GoalReport::headline(Goal::GrowEmailList, $rows));
    }
}
