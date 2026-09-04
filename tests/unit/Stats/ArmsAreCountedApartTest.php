<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Stats\Dashboard;
use WConvert\Stats\StatRange;

/**
 * =============================================================================
 * TWO ARMS ARE TWO OPTINS, SO THEY ARE ALREADY TWO SETS OF COUNTERS.
 * =============================================================================
 * This is the half of ADR 0045 that spends most of its words: **the counters
 * need nothing.** `wconvert_stats` is keyed `(optin_id, stat_date, kind)`, and
 * a [[Variant]] that IS an [[Optin]] gets per-arm impressions, conversions and
 * dismissals out of the key that is already there — no `variant_id`, no
 * widened key, no second table.
 *
 * That claim is easy to *state* and easy to break by accident, because the
 * thing that would break it is a change one table over: an arithmetic that
 * summed a parent's arms into the parent, or a report that read a test as one
 * row. So it is asserted through the SCREEN rather than through the schema —
 * `tests/unit/Database/SchemaTest.php` holds the four columns and the absent
 * secondary index, and this holds that the numbers a merchant reads off two
 * arms are not each other's.
 *
 * There is deliberately **no A/B branch anywhere in the reporting code** for
 * this to test around. An arm is an Optin, so it arrives here as one; that is
 * the whole design, and what these assert is that nothing has quietly started
 * treating it as something else.
 */
#[CoversClass(Dashboard::class)]
final class ArmsAreCountedApartTest extends TestCase
{
    private const PARENT = '01JQ0000000000000000000001';

    private const ARM_B = '01JQ0000000000000000000002';

    private static function range(): StatRange
    {
        return StatRange::lastDays(2, '2026-08-25');
    }

    /**
     * Interleaved days on both arms — 400/40 against 200/20, which is the same
     * conversion rate reached from different volumes, and 100/1 against 100/9,
     * which is the same volume reaching different rates.
     *
     * @return list<array<string, string>>
     */
    private static function counters(): array
    {
        return [
            ['optin_id' => self::PARENT, 'stat_date' => '2026-08-24', 'kind' => 'impression', 'count' => '400'],
            ['optin_id' => self::ARM_B, 'stat_date' => '2026-08-24', 'kind' => 'impression', 'count' => '200'],
            ['optin_id' => self::PARENT, 'stat_date' => '2026-08-24', 'kind' => 'conversion', 'count' => '40'],
            ['optin_id' => self::ARM_B, 'stat_date' => '2026-08-24', 'kind' => 'conversion', 'count' => '20'],
            ['optin_id' => self::PARENT, 'stat_date' => '2026-08-25', 'kind' => 'impression', 'count' => '100'],
            ['optin_id' => self::ARM_B, 'stat_date' => '2026-08-25', 'kind' => 'impression', 'count' => '100'],
            ['optin_id' => self::PARENT, 'stat_date' => '2026-08-25', 'kind' => 'conversion', 'count' => '1'],
            ['optin_id' => self::ARM_B, 'stat_date' => '2026-08-25', 'kind' => 'conversion', 'count' => '9'],
            ['optin_id' => self::PARENT, 'stat_date' => '2026-08-25', 'kind' => 'dismiss', 'count' => '7'],
            ['optin_id' => self::ARM_B, 'stat_date' => '2026-08-25', 'kind' => 'dismiss', 'count' => '3'],
        ];
    }

    /**
     * @return list<array<string, string|null>>
     */
    private static function optins(?string $armBDeletedAt = null): array
    {
        return [
            [
                'id' => self::PARENT,
                'name' => 'Spring sale',
                'goal' => 'grow_email_list',
                'deleted_at' => null,
            ],
            [
                'id' => self::ARM_B,
                'name' => 'Spring sale (B)',
                'goal' => 'grow_email_list',
                'deleted_at' => $armBDeletedAt,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private static function card(array $payload): array
    {
        /** @var list<array<string, mixed>> $cards */
        $cards = $payload['goals'];

        foreach ($cards as $card) {
            if ($card['goal'] === 'grow_email_list') {
                return $card;
            }
        }

        self::fail('no card for the grow_email_list Goal');
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private static function rowFor(array $payload, string $id): array
    {
        /** @var list<array<string, mixed>> $rows */
        $rows = self::card($payload)['optins'];

        foreach ($rows as $row) {
            if ($row['id'] === $id) {
                return $row;
            }
        }

        self::fail("no row for {$id}");
    }

    /** The seam: two arms, and per-arm totals that are not each other's. */
    public function testEachArmReportsItsOwnImpressionsConversionsAndDismissals(): void
    {
        $payload = Dashboard::of(self::range(), self::counters(), self::optins());

        $a = self::rowFor($payload, self::PARENT);
        $b = self::rowFor($payload, self::ARM_B);

        $this->assertSame(500, $a['impressions']);
        $this->assertSame(300, $b['impressions']);
        $this->assertSame(41, $a['headline'], 'submissions on arm A alone');
        $this->assertSame(29, $b['headline'], 'and on arm B alone');
        $this->assertSame(7, $a['dismissals']);
        $this->assertSame(3, $b['dismissals']);
    }

    /**
     * The number the whole test is run to compare. 8.2% against 9.7% is only a
     * comparison if the denominators are the arms' own.
     */
    public function testTheTwoArmsConversionRatesAreTheirOwn(): void
    {
        $payload = Dashboard::of(self::range(), self::counters(), self::optins());

        $this->assertSame(0.082, self::rowFor($payload, self::PARENT)['conversion_rate']);
        $this->assertSame(0.0967, self::rowFor($payload, self::ARM_B)['conversion_rate']);
    }

    /**
     * ========================================================================
     * AND THE LOSER, AFTER THE TEST IS OVER — WITH NO SPECIAL CASE ANYWHERE.
     * ========================================================================
     * Declaring a winner soft-deletes the arm that lost, and a soft-deleted
     * Optin already has exactly the right behaviour: its counts stay in its
     * [[Goal]]'s total and its ROW drops out of the per-Optin list (ADR 0020).
     * A merchant who ended a test in March must not watch February's goal total
     * fall, and the arm they stopped running must not still be listed as
     * something they are running.
     *
     * Asserted here as well as in `DashboardTest` because this is the caller
     * ADR 0020 says is *"the one most likely to look like an exception"* — the
     * one somebody would be tempted to write a branch for.
     */
    public function testTheTidiedAwayLoserKeepsItsCountsAndLosesItsRow(): void
    {
        $running = self::card(Dashboard::of(self::range(), self::counters(), self::optins()));
        $ended = self::card(Dashboard::of(
            self::range(),
            self::counters(),
            self::optins('2026-08-26 09:00:00')
        ));

        $this->assertSame($running['impressions'], $ended['impressions'], '800, before and after');
        $this->assertSame($running['headline'], $ended['headline'], '70 submissions, before and after');

        // Newest first, by id — the dashboard's own order, and a ULID's
        // leading bits are the moment the row was made, so arm B leads.
        $this->assertSame(
            [self::ARM_B, self::PARENT],
            array_column($running['optins'], 'id')
        );
        $this->assertSame(
            [self::PARENT],
            array_column($ended['optins'], 'id'),
            'the arm that lost is not something the merchant is still running'
        );
    }
}
