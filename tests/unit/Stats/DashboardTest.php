<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Stats\Dashboard;
use WConvert\Stats\StatRange;

/**
 * The analytics screen, assembled — and the four decisions it exists to hold.
 *
 * **A [[Conversion]] is interpreted at read** (ADR 0020).
 * `tests/unit/Goal/GoalReportTest.php` proves the arithmetic of that against
 * one Optin's rows; this proves it through the whole screen, where the Goal
 * arrives from a second table and a correction moves a card rather than a
 * number.
 *
 * **Soft-deleted Optins keep their counts and lose their row.** Two
 * assertions, opposite directions, one row — a merchant tidying up in March
 * must not watch February's goal total fall, and the list must still be a list
 * of what they are running.
 *
 * **Per-goal cards, never a leaderboard**, and no site-wide conversion rate.
 * The payload's SHAPE is what holds that: an Optin's row lives inside its
 * Goal's card, so there is no flat list to sort across Goals.
 *
 * **And no "left without converting"**, which is already
 * `impressions − conversions − dismissals`.
 */
#[CoversClass(Dashboard::class)]
final class DashboardTest extends TestCase
{
    private const OPTIN = '01JQ0000000000000000000001';

    private static function range(): StatRange
    {
        return StatRange::between('2026-08-23', '2026-08-25');
    }

    /**
     * Three days of counters on one Optin, exactly as the table holds them.
     *
     * @return list<array<string, string>>
     */
    private static function counters(): array
    {
        return [
            ['optin_id' => self::OPTIN, 'stat_date' => '2026-08-23', 'kind' => 'impression', 'count' => '400'],
            ['optin_id' => self::OPTIN, 'stat_date' => '2026-08-23', 'kind' => 'conversion', 'count' => '40'],
            ['optin_id' => self::OPTIN, 'stat_date' => '2026-08-23', 'kind' => 'lead_magnet_delivered', 'count' => '37'],
            ['optin_id' => self::OPTIN, 'stat_date' => '2026-08-24', 'kind' => 'impression', 'count' => '500'],
            ['optin_id' => self::OPTIN, 'stat_date' => '2026-08-24', 'kind' => 'conversion', 'count' => '50'],
            ['optin_id' => self::OPTIN, 'stat_date' => '2026-08-24', 'kind' => 'lead_magnet_delivered', 'count' => '45'],
            ['optin_id' => self::OPTIN, 'stat_date' => '2026-08-25', 'kind' => 'impression', 'count' => '100'],
            ['optin_id' => self::OPTIN, 'stat_date' => '2026-08-25', 'kind' => 'conversion', 'count' => '10'],
            ['optin_id' => self::OPTIN, 'stat_date' => '2026-08-25', 'kind' => 'lead_magnet_delivered', 'count' => '8'],
        ];
    }

    /**
     * One Optin row, under whichever Goal it is currently holding.
     *
     * @return list<array<string, string|null>>
     */
    private static function optin(string $goal, ?string $deletedAt = null): array
    {
        return [[
            'id' => self::OPTIN,
            'name' => 'Newsletter footer',
            'goal' => $goal,
            'deleted_at' => $deletedAt,
        ]];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private static function cardFor(array $payload, string $goal): array
    {
        /** @var list<array<string, mixed>> $cards */
        $cards = $payload['goals'];

        foreach ($cards as $card) {
            if ($card['goal'] === $goal) {
                return $card;
            }
        }

        self::fail("no card for the {$goal} Goal");
    }

    /**
     * ========================================================================
     * THE SEAM. Correcting a Goal restates the whole history.
     * ========================================================================
     * The same counters, read twice, with nothing between the two reads but
     * the Optin's own `goal` column. Every number on the card moves and every
     * day in the series moves with it — the series does not change shape half
     * way along at the moment of the edit (ADR 0020).
     */
    public function testCorrectingAnOptinsGoalRestatesItsWholeHistory(): void
    {
        $before = Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list'));
        $after = Dashboard::of(self::range(), self::counters(), self::optin('deliver_lead_magnet'));

        $emailCard = self::cardFor($before, 'grow_email_list');
        $magnetCard = self::cardFor($after, 'deliver_lead_magnet');

        $this->assertSame(100, $emailCard['headline'], 'submissions, under the Goal it was filed under');
        $this->assertSame(90, $magnetCard['headline'], 'deliveries, under the corrected one');

        $this->assertSame(
            ['2026-08-23' => 40, '2026-08-24' => 50, '2026-08-25' => 10],
            $emailCard['by_day']
        );
        $this->assertSame(
            ['2026-08-23' => 37, '2026-08-24' => 45, '2026-08-25' => 8],
            $magnetCard['by_day'],
            'every day was restated, including the ones counted long before anybody corrected anything'
        );
    }

    /**
     * And the Goal it was corrected AWAY from keeps no card of its own. The
     * history did not split in two — it moved.
     */
    public function testTheGoalItWasCorrectedAwayFromKeepsNothing(): void
    {
        $after = Dashboard::of(self::range(), self::counters(), self::optin('deliver_lead_magnet'));

        $this->assertSame(
            ['deliver_lead_magnet'],
            array_column($after['goals'], 'goal'),
            'a Goal no Optin holds has nothing to report and gets no card'
        );
    }

    /**
     * The denominator does not move when the Goal does. An [[Impression]] is
     * one Optin appearing to one visitor, and that does not depend on what the
     * merchant was hoping they would do next (CONTEXT.md, Impression).
     */
    public function testTheDenominatorDoesNotMoveWhenTheGoalDoes(): void
    {
        $before = self::cardFor(Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list')), 'grow_email_list');
        $after = self::cardFor(Dashboard::of(self::range(), self::counters(), self::optin('promote_offer')), 'promote_offer');

        $this->assertSame(1000, $before['impressions']);
        $this->assertSame(1000, $after['impressions']);
    }

    /**
     * ========================================================================
     * THE SECOND SEAM. One row, two opposite consequences.
     * ========================================================================
     * February's numbers were counted before the merchant tidied up in March,
     * and they are still February's numbers. What the soft delete takes away
     * is the ROW — the per-Optin list is a list of what is running (ADR 0020).
     */
    public function testASoftDeletedOptinKeepsItsCountsAndLosesItsRow(): void
    {
        $live = Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list'));
        $tidied = Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list', '2026-08-25 09:00:00'));

        $before = self::cardFor($live, 'grow_email_list');
        $after = self::cardFor($tidied, 'grow_email_list');

        $this->assertSame($before['headline'], $after['headline'], "the goal total did not fall when the Optin was tidied away");
        $this->assertSame($before['impressions'], $after['impressions']);
        $this->assertSame($before['by_day'], $after['by_day']);

        $this->assertSame([self::OPTIN], array_column($before['optins'], 'id'));
        $this->assertSame([], $after['optins'], 'and the row is gone from the list of what is running');
    }

    /**
     * The card survives its last Optin being deleted, because its counts do.
     * A Goal whose total is real and whose list is empty is the honest state,
     * and dropping the card would take February's numbers with it.
     */
    public function testAGoalWhoseOnlyOptinWasDeletedStillReports(): void
    {
        $payload = Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list', '2026-08-25 09:00:00'));

        $this->assertSame(['grow_email_list'], array_column($payload['goals'], 'goal'));
        $this->assertSame(100, self::cardFor($payload, 'grow_email_list')['headline']);
    }

    /**
     * **Cards come back in the enum's own order, whatever the numbers say.**
     *
     * Sorting them by their headline would be a leaderboard, and "click-
     * throughs to the offer" ranked against "conversions on Optins that
     * capture an email" means nothing — they are different acts.
     */
    public function testCardsAreNeverOrderedByTheirNumbers(): void
    {
        $payload = Dashboard::of(
            self::range(),
            [
                ['optin_id' => 'A', 'stat_date' => '2026-08-24', 'kind' => 'conversion', 'count' => '9000'],
                ['optin_id' => 'B', 'stat_date' => '2026-08-24', 'kind' => 'conversion', 'count' => '3'],
            ],
            [
                ['id' => 'A', 'name' => 'Offer bar', 'goal' => 'promote_offer', 'deleted_at' => null],
                ['id' => 'B', 'name' => 'Newsletter', 'goal' => 'grow_email_list', 'deleted_at' => null],
            ]
        );

        // Goal::cases() order, which puts the email list first however small
        // its number is.
        $this->assertSame(['grow_email_list', 'promote_offer'], array_column($payload['goals'], 'goal'));
    }

    /**
     * **There is no site-wide conversion rate, and no flat list of Optins to
     * rank across Goals.** An Optin's row lives inside its Goal's card, which
     * is what makes the leaderboard unexpressible rather than merely
     * discouraged.
     */
    public function testThePayloadOffersNoSiteWideNumberAndNoCrossGoalList(): void
    {
        $payload = Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list'));

        $this->assertSame(['from', 'to', 'goals'], array_keys($payload));
    }

    /**
     * **And no "left without converting".** It is already
     * `impressions − conversions − dismissals`, and naming it invites a screen
     * reporting two numbers where one is the arithmetic of the other
     * (CONTEXT.md, Dismissal).
     */
    public function testNoCardReportsLeavingWithoutConverting(): void
    {
        $payload = Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list'));

        foreach ($payload['goals'] as $card) {
            foreach (array_keys($card) as $field) {
                $this->assertStringNotContainsString('left', (string) $field);
                $this->assertStringNotContainsString('abandon', (string) $field);
            }
        }
    }

    /**
     * Conversion rate is conversions over impressions — the [[Conversion]]
     * kind and not the headline kind, so a lead-magnet Optin's rate measures
     * what visitors did rather than what the delivery job managed afterwards.
     */
    public function testConversionRateIsConversionsOverImpressionsWhateverTheHeadlineIs(): void
    {
        $email = self::cardFor(Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list')), 'grow_email_list');
        $magnet = self::cardFor(Dashboard::of(self::range(), self::counters(), self::optin('deliver_lead_magnet')), 'deliver_lead_magnet');

        $this->assertSame(0.1, $email['conversion_rate']);
        $this->assertSame(0.1, $magnet['conversion_rate'], '100 conversions over 1000 impressions, not 90 deliveries');
    }

    /**
     * A rate over no denominator is undefined rather than zero. 0% is a claim
     * that visitors saw it and did not act.
     */
    public function testAnOptinNobodyHasSeenHasNoRateRatherThanAZeroOne(): void
    {
        $payload = Dashboard::of(self::range(), [], self::optin('grow_email_list'));

        $this->assertNull(self::cardFor($payload, 'grow_email_list')['conversion_rate']);
    }

    /**
     * **The lead-magnet card says why it reads zero.** Nothing writes
     * `lead_magnet_delivered` yet — the delivery job arrives with its own
     * ticket, and the beacon refuses the kind because a browser cannot have
     * watched an email send (ADR 0020). This is the first screen a merchant
     * meets that on, and a bare 0 beside real conversions reads as a bug.
     */
    public function testTheCardForAKindNothingWritesYetSaysWhyItIsZero(): void
    {
        $rows = [['optin_id' => self::OPTIN, 'stat_date' => '2026-08-24', 'kind' => 'conversion', 'count' => '10']];
        $card = self::cardFor(Dashboard::of(self::range(), $rows, self::optin('deliver_lead_magnet')), 'deliver_lead_magnet');

        $this->assertSame(0, $card['headline']);
        $this->assertNotNull($card['note']);
        // And it does NOT report ten failed deliveries, which is what the
        // arithmetic would say against a kind nothing writes.
        $this->assertNull($card['delivery_failures']);
    }

    /**
     * Every other card has neither, because `conversions − conversions` is
     * zero by construction and there is nothing to explain.
     */
    public function testACardWhoseHeadlineIsConversionsHasNoFailureCountAndNoNote(): void
    {
        $card = self::cardFor(Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list')), 'grow_email_list');

        $this->assertNull($card['delivery_failures']);
        $this->assertNull($card['note']);
    }

    /**
     * A day nothing happened on reports 0 rather than being absent. The quiet
     * days are exactly the ones a merchant is reading for, and a gap in a
     * series reads as missing data.
     */
    public function testEveryDayInTheWindowIsInTheSeries(): void
    {
        $range = StatRange::between('2026-08-22', '2026-08-25');
        $card = self::cardFor(Dashboard::of($range, self::counters(), self::optin('grow_email_list')), 'grow_email_list');

        $this->assertSame(
            ['2026-08-22' => 0, '2026-08-23' => 40, '2026-08-24' => 50, '2026-08-25' => 10],
            $card['by_day']
        );
    }

    /**
     * A counter outside the window is not counted, whatever rows this was
     * handed. The read already filters, and this answers for the window it was
     * given rather than for the query somebody ran.
     */
    public function testACounterOutsideTheWindowIsNotCounted(): void
    {
        $rows = [
            ...self::counters(),
            ['optin_id' => self::OPTIN, 'stat_date' => '2026-01-01', 'kind' => 'conversion', 'count' => '9999'],
        ];

        $this->assertSame(
            100,
            self::cardFor(Dashboard::of(self::range(), $rows, self::optin('grow_email_list')), 'grow_email_list')['headline']
        );
    }

    /**
     * **An Optin holding a Goal this build does not have is dropped with its
     * counts.** The same posture {@see \WConvert\Goal\GoalReport::byDay()}
     * takes towards an unknown `kind`: what is outside a closed set is a row
     * no version of this code wrote, and filing it under an invented headline
     * is how a wrong number gets reported confidently.
     */
    public function testAnOptinHoldingAGoalThisBuildDoesNotKnowReportsNothing(): void
    {
        $payload = Dashboard::of(self::range(), self::counters(), self::optin('increase_brand_awareness'));

        $this->assertSame([], $payload['goals']);
    }

    /**
     * The window travels with the payload, so a screen can say what it is
     * showing without having recomputed it.
     */
    public function testThePayloadNamesTheWindowItRead(): void
    {
        $payload = Dashboard::of(self::range(), [], self::optin('grow_email_list'));

        $this->assertSame('2026-08-23', $payload['from']);
        $this->assertSame('2026-08-25', $payload['to']);
    }
}
