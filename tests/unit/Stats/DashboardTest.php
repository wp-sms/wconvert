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
 * **Soft-deleted Optins retain counts and an inspectable historical row.**
 * A merchant tidying up in March must not watch February's Goal total fall
 * or lose the explanation of where it came from (ADR 0089).
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
        return StatRange::lastDays(3, '2026-08-25');
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
            'was_published' => '1',
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
     * and they are still February's numbers. Soft deletion preserves the row
     * as historical while preventing further publication/edit actions.
     */
    public function testASoftDeletedOptinKeepsItsCountsAndHistoricalRow(): void
    {
        $live = Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list'));
        $tidied = Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list', '2026-08-25 09:00:00'));

        $before = self::cardFor($live, 'grow_email_list');
        $after = self::cardFor($tidied, 'grow_email_list');

        $this->assertSame($before['headline'], $after['headline'], "the goal total did not fall when the Optin was tidied away");
        $this->assertSame($before['impressions'], $after['impressions']);
        $this->assertSame($before['by_day'], $after['by_day']);

        $this->assertSame([self::OPTIN], array_column($before['optins'], 'id'));
        $this->assertSame('historical', $after['optins'][0]['status']);
        $this->assertSame(self::OPTIN, $after['optins'][0]['id']);
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

        $this->assertSame(['from', 'to', 'days', 'goals', 'impact'], array_keys($payload));
        $this->assertArrayNotHasKey('conversion_rate', $payload);
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
     * **`conversions − lead_magnet_delivered`, on the card that means it.**
     *
     * The counters hold 100 Conversions and 90 deliveries across the window,
     * so ten people converted and have no download. That is the number ADR 0020
     * names, and it is new information rather than a restatement: `conversions`
     * is not a field on this payload at all, and on this card `headline` is
     * *deliveries*.
     */
    public function testTheLeadMagnetCardReportsConversionsWithNoDelivery(): void
    {
        $card = self::cardFor(
            Dashboard::of(self::range(), self::counters(), self::optin('deliver_lead_magnet')),
            'deliver_lead_magnet'
        );

        $this->assertSame(90, $card['headline'], 'the headline is deliveries on this Goal');
        $this->assertSame(10, $card['undelivered_conversions']);
    }

    /**
     * **Null on every other Goal, and present rather than absent.**
     *
     * `GoalParityTest::testNoGoalIsSpelledInTheAdminBundle` fails on any Goal
     * id appearing under `resources/admin/src`, so a card cannot know which
     * Goal it is drawing. A server-nulled field is therefore the only shape
     * available — the bundle renders the row where there is a number and omits
     * it where there is not, and never asks why.
     */
    public function testEveryOtherGoalReportsNullRatherThanOmittingTheField(): void
    {
        $card = self::cardFor(
            Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list')),
            'grow_email_list'
        );

        $this->assertArrayHasKey('undelivered_conversions', $card);
        $this->assertNull($card['undelivered_conversions']);
    }

    /**
     * **Clamped at zero, and the clamp is not defensive padding.**
     *
     * A Conversion at 23:58 and its delivery at 00:01 land on different
     * `stat_date`s, so on a short window deliveries genuinely can exceed
     * Conversions — every morning, for the merchants whose evening traffic
     * converts. It also absorbs the two replay seams ADR 0008 accepts. A
     * negative "conversions with no delivery yet" is not a number anybody can
     * read.
     */
    public function testMoreDeliveriesThanConversionsClampsToZeroRatherThanGoingNegative(): void
    {
        $rows = [
            ['optin_id' => self::OPTIN, 'stat_date' => '2026-08-24', 'kind' => 'conversion', 'count' => '3'],
            ['optin_id' => self::OPTIN, 'stat_date' => '2026-08-24', 'kind' => 'lead_magnet_delivered', 'count' => '5'],
        ];

        $card = self::cardFor(
            Dashboard::of(self::range(), $rows, self::optin('deliver_lead_magnet')),
            'deliver_lead_magnet'
        );

        $this->assertSame(0, $card['undelivered_conversions']);
    }

    /**
     * **The card only, never an Optin row.** `numbers()` is spread into both,
     * and this is one figure for the Goal rather than a second metric per row —
     * the Optin table has no column for it and could not head one without
     * spelling the Goal.
     */
    public function testNoOptinRowCarriesAnUndeliveredConversionCount(): void
    {
        $payload = Dashboard::of(self::range(), self::counters(), self::optin('deliver_lead_magnet'));

        foreach ($payload['goals'] as $card) {
            foreach ($card['optins'] as $row) {
                $this->assertArrayNotHasKey('undelivered_conversions', $row);
            }
        }
    }

    /**
     * **And no card carries a `note` any more.** It existed to explain a
     * headline that read zero because nothing wrote the kind; #31 shipped the
     * writer, so the sentence would now be false. A screen that apologises for
     * a feature that exists is worse than one that says nothing.
     */
    public function testNoCardCarriesTheApologyThatOutlivedItsReason(): void
    {
        $payload = Dashboard::of(self::range(), self::counters(), self::optin('deliver_lead_magnet'));

        foreach ($payload['goals'] as $card) {
            $this->assertArrayNotHasKey('note', $card);
        }
    }

    /**
     * A day nothing happened on reports 0 rather than being absent. The quiet
     * days are exactly the ones a merchant is reading for, and a gap in a
     * series reads as missing data.
     */
    public function testEveryDayInTheWindowIsInTheSeries(): void
    {
        $range = StatRange::lastDays(4, '2026-08-25');
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

    /**
     * **The window's length travels with it**, so the screen can say which one
     * is selected without spelling {@see StatRange::DEFAULT_DAYS} a second
     * time in a bundle with nothing asserting the two agree — the rule
     * `DashboardController` states about the same number.
     */
    public function testThePayloadNamesHowManyDaysItCovers(): void
    {
        $this->assertSame(3, Dashboard::of(self::range(), [], self::optin('grow_email_list'))['days']);
    }

    /**
     * **Every Optin row carries its own daily series**, which is what
     * "comparison is offered within an Optin over time" means. Without it the
     * only way to compare an Optin with itself is to move the whole screen's
     * window and remember the last number.
     */
    public function testAnOptinRowCarriesItsOwnSeriesOverTime(): void
    {
        $row = self::cardFor(
            Dashboard::of(self::range(), self::counters(), self::optin('grow_email_list')),
            'grow_email_list'
        )['optins'][0];

        $this->assertSame(['2026-08-23' => 40, '2026-08-24' => 50, '2026-08-25' => 10], $row['by_day']);
    }

    /**
     * And it is the row's OWN numbers rather than its Goal's, which is the
     * whole point of offering the comparison inside the card.
     */
    public function testAnOptinRowReportsItselfRatherThanItsGoal(): void
    {
        $rows = [
            ['optin_id' => 'B', 'stat_date' => '2026-08-24', 'kind' => 'impression', 'count' => '100'],
            ['optin_id' => 'B', 'stat_date' => '2026-08-24', 'kind' => 'conversion', 'count' => '10'],
            ['optin_id' => 'A', 'stat_date' => '2026-08-24', 'kind' => 'impression', 'count' => '900'],
            ['optin_id' => 'A', 'stat_date' => '2026-08-24', 'kind' => 'conversion', 'count' => '90'],
        ];
        $optins = [
            ['id' => 'A', 'name' => 'Older', 'goal' => 'grow_email_list', 'deleted_at' => null],
            ['id' => 'B', 'name' => 'Newer', 'goal' => 'grow_email_list', 'deleted_at' => null],
        ];

        $card = self::cardFor(Dashboard::of(self::range(), $rows, $optins), 'grow_email_list');

        $this->assertSame(100, $card['headline'], "the card is both Optins' work");
        // Newest first, off the ULID's own order — not a ranking by any number
        // on the row, which would be a leaderboard inside the card.
        $this->assertSame(['Newer', 'Older'], array_column($card['optins'], 'name'));
        $this->assertSame([10, 90], array_column($card['optins'], 'headline'));
    }
}
