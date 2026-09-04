<?php

namespace WConvert\Milestone;

use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Stats\StatKind;
use WConvert\Stats\StatsRepository;

defined('ABSPATH') || exit;

/**
 * The five milestones, assembled for one screen: **activation through first
 * conversion** (#94).
 *
 * ============================================================================
 * FOUR SOURCES, AND THIS CLASS OWNS ONE OF THEM.
 * ============================================================================
 * - **First publish** and **first edit** come out of {@see MilestoneStore},
 *   which exists because neither can be derived from anything else.
 * - **First [[Impression]]** and **first [[Conversion]]** are `MIN(stat_date)`
 *   over the daily counters ({@see StatsRepository::firstDays()}), stored
 *   nowhere.
 * - **[[Destination]] success and failure** are read out of
 *   {@see HealthStore}, which already records them per Destination and already
 *   draws them on the Destinations screen (ADR 0008).
 *
 * ============================================================================
 * IT READS DESTINATION HEALTH AND DOES NOT RESTATE IT.
 * ============================================================================
 * What travels is three booleans — whether a Destination is configured at all,
 * whether anything has ever landed, whether anything is failing now. **No
 * error text and no counts**: those already have a screen with the repair
 * actions beside them, and a second, staler spelling of an outage on a screen
 * that cannot act on it is the line ADR 0042 refuses. It is also the second
 * store rule from the other side — reading health is not building a second
 * path to it, and copying its numbers would be the beginning of one.
 *
 * ============================================================================
 * IT IS ITS OWN READ AND NOT A FIELD ON THE DASHBOARD'S PAYLOAD.
 * ============================================================================
 * {@see \WConvert\Stats\Dashboard} answers for a WINDOW a merchant chose. A
 * milestone is all-time by definition, so a first conversion arriving on that
 * payload would be a number that moved when somebody changed the window —
 * which is not a milestone. Two reads, deliberately.
 *
 * ============================================================================
 * IT SAYS WHAT IS TRUE OF THE DESTINATIONS THIS SITE HAS **NOW**.
 * ============================================================================
 * `landed` is not a milestone in the sense the four dates are, and the
 * difference matters because {@see HealthStore::forget()} drops a
 * Destination's health when the Destination is deleted (ADR 0008). So a site
 * that delivered through a Destination it has since removed reads `landed`
 * false — and that is the honest answer rather than a lost fact: what a
 * merchant can act on is whether the Destinations they have configured are
 * receiving anything, and the copy on the screen says exactly that rather than
 * claiming nothing ever arrived.
 *
 * It is one read with no pure half. An earlier draft hoisted the counters and
 * the Destination list into a `static of()` for the test's convenience while
 * still taking two stores as objects, which is a seam that existed for one
 * caller and hoisted half of what it needed. The stores are all cheap to stand
 * up over a fake, so the test builds them.
 *
 * @since 0.1.0
 */
final class Milestones
{
    public function __construct(
        private readonly MilestoneStore $store,
        private readonly StatsRepository $stats,
        private readonly HealthStore $health,
        private readonly DestinationStore $destinations,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function read(): array
    {
        $edit = $this->store->firstEdit();
        $firstDays = $this->stats->firstDays();
        $landed = false;
        $failing = false;

        foreach ($this->health->all() as $entry) {
            $landed = $landed || $entry->lastSuccessAt !== null;
            $failing = $failing || $entry->consecutiveFailures > 0;
        }

        return [
            'first_publish' => $this->store->firstPublish(),
            // Named off the enum rather than spelled, so a kind renamed in one
            // place cannot leave this reading null forever.
            'first_impression' => $firstDays[StatKind::Impression->value] ?? null,
            'first_conversion' => $firstDays[StatKind::Conversion->value] ?? null,
            'first_edit' => $edit === null
                ? null
                : $edit->toArray() + ['part_label' => $edit->part->label()],
            'destinations' => [
                'configured' => $this->destinations->all() !== [],
                'landed' => $landed,
                'failing' => $failing,
            ],
        ];
    }
}
