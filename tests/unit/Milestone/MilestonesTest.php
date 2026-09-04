<?php

namespace WConvert\Tests\Unit\Milestone;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Milestone\EditedPart;
use WConvert\Milestone\FirstEdit;
use WConvert\Milestone\Milestones;
use WConvert\Milestone\MilestoneStore;
use WConvert\Stats\StatsRepository;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * The five milestones, assembled for one screen.
 *
 * ============================================================================
 * IT READS FOUR SOURCES AND OWNS ONE.
 * ============================================================================
 * Two milestones come out of {@see MilestoneStore}, two out of the daily
 * counters as a `MIN`, and the fifth out of [[Destination]] health — **which
 * this class reads and does not restate**. Success and failure are already
 * recorded per Destination and already drawn on the Destinations screen
 * (ADR 0008), so what travels here is whether anything has landed and whether
 * anything is failing, and the numbers stay where they already are. A second
 * path to Destination health would be a second thing to keep in step with a
 * store that is deliberately allowed to be sloppy.
 */
#[CoversClass(Milestones::class)]
final class MilestonesTest extends TestCase
{
    private FakeOptionStore $options;

    private FakeConnection $db;

    private MilestoneStore $store;

    protected function setUp(): void
    {
        $this->options = new FakeOptionStore();
        $this->db = new FakeConnection();
        $this->store = new MilestoneStore($this->options);
    }

    /**
     * The ids {@see self::configure()} minted, in the order it was given them.
     *
     * @var list<string>
     */
    private array $ids = [];

    /**
     * Configure real Destinations, so `configured` is answered by the store a
     * merchant actually writes to rather than by a list handed to the reader.
     */
    private function configure(string ...$labels): void
    {
        $store = new DestinationStore($this->options);

        foreach ($labels as $label) {
            $this->ids[] = $store->save(null, 'lead_magnet_email', $label, null, [])->id;
        }
    }

    /**
     * The earliest day each kind was counted, as MySQL would answer it.
     *
     * A `GROUP BY` is a result set that exists nowhere in the table, so
     * {@see FakeConnection} takes a canned answer rather than modelling one —
     * which is the same reason `bin/verify-stats.php` proves the arithmetic
     * against a real database.
     *
     * @param array<string, string> $firstDays
     */
    private function counted(array $firstDays): void
    {
        $rows = [];

        foreach ($firstDays as $kind => $day) {
            $rows[] = ['kind' => $kind, 'first_day' => $day];
        }

        $this->db->answers = [$rows];
    }

    /**
     * Every store is stood up over a fake, so this reads exactly what a real
     * install would — there is no pure half taking half of what it needs.
     *
     * @return array<string, mixed>
     */
    private function read(): array
    {
        return (new Milestones(
            $this->store,
            new StatsRepository($this->db),
            new HealthStore($this->options),
            new DestinationStore($this->options)
        ))->read();
    }

    public function testAFreshInstallHasReachedNothing(): void
    {
        $this->assertSame(
            [
                'first_publish' => null,
                'first_impression' => null,
                'first_conversion' => null,
                'first_edit' => null,
                'destinations' => ['configured' => false, 'landed' => false, 'failing' => false],
            ],
            $this->read()
        );
    }

    public function testThePublishedAndTheCountedArriveFromDifferentPlaces(): void
    {
        $this->store->recordFirstPublish('2026-03-04');
        $this->counted(['impression' => '2026-03-05', 'conversion' => '2026-03-09']);

        $read = $this->read();

        $this->assertSame('2026-03-04', $read['first_publish']);
        $this->assertSame('2026-03-05', $read['first_impression']);
        $this->assertSame('2026-03-09', $read['first_conversion']);
    }

    /**
     * A kind the counters hold that is not one of the two milestones does not
     * appear. Dismissals and lead-magnet deliveries have their own screen and
     * are not steps on the way to a first [[Conversion]].
     */
    public function testOnlyTwoOfTheFourCountedKindsAreMilestones(): void
    {
        $this->counted([
            'impression' => '2026-03-05',
            'conversion' => '2026-03-09',
            'dismiss' => '2026-03-06',
            'lead_magnet_delivered' => '2026-03-10',
        ]);

        $this->assertSame(
            ['first_publish', 'first_impression', 'first_conversion', 'first_edit', 'destinations'],
            array_keys($this->read())
        );
    }

    /**
     * **The part is named in PHP.** `wp i18n make-pot` cannot see a string in
     * the admin bundle, so the words for a part travel on the payload exactly
     * as a [[Goal]]'s `headline_label` does — and the bundle never has to know
     * that there are five of them.
     */
    public function testTheFirstEditCarriesTheWordsForThePartAsWellAsItsId(): void
    {
        $this->store->recordFirstEdit(new FirstEdit('2026-03-05', 'welcome-discount', EditedPart::Rules));

        $this->assertSame(
            [
                'on' => '2026-03-05',
                'playbook' => 'welcome-discount',
                'part' => 'rules',
                'part_label' => 'When and to whom it shows',
            ],
            $this->read()['first_edit']
        );
    }

    public function testADestinationThatHasLandedSomethingSaysSo(): void
    {
        $this->configure('01J0000000000000000000000A');
        (new HealthStore($this->options))->landed($this->ids[0], '2026-03-09 10:00:00');

        $this->assertSame(
            ['configured' => true, 'landed' => true, 'failing' => false],
            $this->read()['destinations']
        );
    }

    /**
     * **Configured and never reached is the state worth drawing**, because it
     * is the one a merchant can act on: leads are being captured and nothing
     * is arriving where they wanted it.
     */
    public function testADestinationConfiguredAndNeverReachedIsTheStateWorthDrawing(): void
    {
        $this->configure('01J0000000000000000000000A');

        $this->assertSame(
            ['configured' => true, 'landed' => false, 'failing' => false],
            $this->read()['destinations']
        );
    }

    /**
     * One Destination out of two being down is *failing*: the merchant has
     * something to fix either way, and which one it is belongs on the
     * Destinations screen where the error text already is.
     */
    public function testOneDestinationDownIsEnoughToBeFailing(): void
    {
        $this->configure('a', 'b');

        $health = new HealthStore($this->options);
        $health->landed($this->ids[0], '2026-03-09 10:00:00');
        $health->failed($this->ids[1], 'Connection refused', '2026-03-10 10:00:00');

        $this->assertSame(
            ['configured' => true, 'landed' => true, 'failing' => true],
            $this->read()['destinations']
        );
    }

    /**
     * **No Destination error text is on this payload.** Health is read here
     * and restated nowhere: the failure count and the last error already have
     * a screen, and copying them would put a second, staler spelling of an
     * outage on a screen with no way to act on it (ADR 0008, ADR 0042).
     */
    public function testTheErrorItselfStaysOnTheDestinationsScreen(): void
    {
        $this->configure('a');
        (new HealthStore($this->options))->failed($this->ids[0], 'A tremendously distinctive error', '2026-03-10 10:00:00');

        $this->assertStringNotContainsString(
            'A tremendously distinctive error',
            (string) json_encode($this->read())
        );
    }

    /**
     * ========================================================================
     * DELETING A DESTINATION FORGETS THAT IT EVER LANDED ANYTHING.
     * ========================================================================
     * {@see HealthStore::forget()} drops a Destination's health with the
     * Destination, because health keyed by an id nothing references is a row
     * that never goes away (ADR 0008). So `landed` is a fact about the
     * Destinations this site has **now**, and a merchant who swapped one out
     * reads false.
     *
     * That is the honest answer rather than a lost one — what they can act on
     * is whether what they have configured is receiving anything — but it is
     * exactly the shape ADR 0057 rejects `MIN(published_at)` for, so it is
     * pinned here and the copy on the screen is worded to match: *nothing has
     * reached a Destination yet* would be a claim about all time, and the
     * screen says *your Destinations* instead.
     */
    public function testDeletingADestinationForgetsThatItEverLanded(): void
    {
        $this->configure('a');
        (new HealthStore($this->options))->landed($this->ids[0], '2026-03-09 10:00:00');

        $this->assertTrue($this->read()['destinations']['landed']);

        (new DestinationStore($this->options))->delete($this->ids[0]);
        (new HealthStore($this->options))->forget($this->ids[0]);

        $this->assertSame(
            ['configured' => false, 'landed' => false, 'failing' => false],
            $this->read()['destinations'],
            'a site with no Destination is finished at its first conversion, not held short'
        );
    }

    /**
     * And the same swap with a replacement configured: the new Destination has
     * genuinely received nothing, which is worth saying.
     */
    public function testASwappedDestinationHasGenuinelyReceivedNothing(): void
    {
        $this->configure('old');
        (new HealthStore($this->options))->landed($this->ids[0], '2026-03-09 10:00:00');

        (new DestinationStore($this->options))->delete($this->ids[0]);
        (new HealthStore($this->options))->forget($this->ids[0]);
        $this->configure('new');

        $this->assertSame(
            ['configured' => true, 'landed' => false, 'failing' => false],
            $this->read()['destinations']
        );
    }
}
