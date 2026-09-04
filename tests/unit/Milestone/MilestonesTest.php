<?php

namespace WConvert\Tests\Unit\Milestone;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\HealthStore;
use WConvert\Milestone\EditedPart;
use WConvert\Milestone\FirstEdit;
use WConvert\Milestone\Milestones;
use WConvert\Milestone\MilestoneStore;
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

    private MilestoneStore $store;

    /** @var array<string, string> */
    private array $firstDays = [];

    /** @var list<array<string, mixed>> */
    private array $destinations = [];

    protected function setUp(): void
    {
        $this->options = new FakeOptionStore();
        $this->store = new MilestoneStore($this->options);
    }

    /**
     * @return array<string, mixed>
     */
    private function read(): array
    {
        return Milestones::of(
            $this->store,
            $this->firstDays,
            new HealthStore($this->options),
            $this->destinations
        );
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
        $this->firstDays = ['impression' => '2026-03-05', 'conversion' => '2026-03-09'];

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
        $this->firstDays = [
            'impression' => '2026-03-05',
            'conversion' => '2026-03-09',
            'dismiss' => '2026-03-06',
            'lead_magnet_delivered' => '2026-03-10',
        ];

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
        $this->destinations = [['id' => '01J0000000000000000000000A']];
        (new HealthStore($this->options))->landed('01J0000000000000000000000A', '2026-03-09 10:00:00');

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
        $this->destinations = [['id' => '01J0000000000000000000000A']];

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
        $this->destinations = [['id' => 'a'], ['id' => 'b']];

        $health = new HealthStore($this->options);
        $health->landed('a', '2026-03-09 10:00:00');
        $health->failed('b', 'Connection refused', '2026-03-10 10:00:00');

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
        $this->destinations = [['id' => 'a']];
        (new HealthStore($this->options))->failed('a', 'A tremendously distinctive error', '2026-03-10 10:00:00');

        $this->assertStringNotContainsString(
            'A tremendously distinctive error',
            (string) json_encode($this->read())
        );
    }
}
