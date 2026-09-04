<?php

namespace WConvert\Milestone;

use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

/**
 * The two milestones nothing else in WConvert can answer, in **one
 * non-autoloaded option** — and the record-once rule, which lives here rather
 * than at either call site.
 *
 * ============================================================================
 * WHY THERE IS STORAGE AT ALL, AND WHAT WAS REJECTED FIRST.
 * ============================================================================
 * Five milestones instrument activation through first conversion (#94). Three
 * of them are already answerable and are **not** here, because a derived fact
 * that needs no write is the better answer:
 *
 * - **First [[Impression]]** and **first [[Conversion]]** are
 *   `MIN(stat_date)` over `wconvert_stats`, which already holds a row per
 *   Optin per day per kind, is never pruned and is never deleted
 *   ({@see \WConvert\Stats\StatsRepository::firstDays()}, ADR 0019).
 * - **[[Destination]] success and failure** are already recorded per
 *   Destination in {@see \WConvert\Destination\HealthStore} and already drawn
 *   on the Destinations screen. This module READS that store and adds no
 *   second path to it (ADR 0008).
 *
 * The two below cannot be derived, and the near-misses are worth naming
 * because both look derivable:
 *
 * - **The first publish** is not `MIN(published_at)`.
 *   {@see \WConvert\Optin\OptinRepository::unpublish()} sets that column back
 *   to `NULL`, so the minimum over it moves FORWARDS when a merchant takes
 *   their oldest Optin down — which is the milestone resetting itself, and is
 *   exactly what "deactivating and reactivating does not reset a milestone
 *   that already happened" forbids. `published_config` survives an unpublish
 *   and would answer *whether* a site has ever published, but it carries no
 *   date, and the milestone is a date.
 * - **The first edit** has no home at all. Nothing anywhere records that a
 *   config changed; `wconvert_optins` has no `updated_at` and is not getting
 *   one (ADR 0001, and the ticket's own "no new table or column").
 *
 * ============================================================================
 * AN OPTION, AND NOT THE OTHER THREE TABLE-FREE SHAPES.
 * ============================================================================
 * - **A transient** can be evicted at any moment when an object cache is
 *   backing it. A milestone that vanishes is not a milestone (ADR 0019 made
 *   the same call about counters).
 * - **An existing option.** `wconvert_published_set` is derived state rebuilt
 *   WHOLE on every publish (ADR 0003), so anything else stored inside it is
 *   destroyed by the next write. Riding along there would have been a bug that
 *   only appeared on the second publish.
 * - **An existing table** means a column, which the ticket rules out and which
 *   would need sign-off besides.
 *
 * **`update_option` is a read-modify-write with no row lock**, which ADR 0019
 * refused for counters and {@see \WConvert\Destination\HealthStore} accepted
 * for health. This is the accepting case, and more comfortably than health is:
 * there is nothing here to increment, both writes are guarded on the value
 * being ABSENT, and two racing first-publishes are writing the same day
 * anyway. The worst a lost write can do is leave a milestone unrecorded until
 * the next publish or the next edit.
 *
 * ============================================================================
 * NOTHING HERE LEAVES THE SITE, AND NOTHING HERE NAMES A VISITOR.
 * ============================================================================
 * `readme.txt` promises no licence key, no analytics sent anywhere and no
 * visitor identifier, and this module must not put an asterisk on that
 * sentence. What is stored is a date, a date, a Playbook id and one of five
 * words — all of them facts about the SITE. There is no visitor id because
 * WConvert mints none (ADR 0017), and there is no user id because which
 * administrator pressed publish is not what any of this is asking.
 * `NothingLeavesTheSiteTest` reads the stored value back and asserts what is
 * absent, the way `bin/verify-stats.php` does with the options table.
 *
 * @since 0.1.0
 */
final class MilestoneStore
{
    public const OPTION = 'wconvert_milestones';

    /** The day an [[Optin]] was first published, as a `Y-m-d` on the site's own clock. */
    private const FIRST_PUBLISH = 'first_publish';

    /** {@see FirstEdit}, as an array. */
    private const FIRST_EDIT = 'first_edit';

    public function __construct(
        private readonly OptionStore $options,
    ) {
    }

    public function firstPublish(): ?string
    {
        $day = $this->all()[self::FIRST_PUBLISH] ?? null;

        return is_string($day) && $day !== '' ? $day : null;
    }

    public function firstEdit(): ?FirstEdit
    {
        return FirstEdit::fromStored($this->all()[self::FIRST_EDIT] ?? null);
    }

    /**
     * The day an Optin was first published — **and never the day one was
     * published again**.
     *
     * The guard is here rather than at the call site, which is the same
     * arrangement {@see \WConvert\Optin\OptinRepository} uses for the
     * published-set rebuild: there is no record-anyway path to reach for by
     * mistake, so "recorded once" is a property of the code rather than of
     * everyone's memory.
     *
     * It returns early rather than writing an identical value, so a site
     * publishing every week is not rewriting an option that cannot change.
     */
    public function recordFirstPublish(string $day): void
    {
        if ($this->firstPublish() !== null) {
            return;
        }

        $this->write(self::FIRST_PUBLISH, $day);
    }

    /** The first override of a [[Playbook]]'s suggestion, and never the second. */
    public function recordFirstEdit(FirstEdit $edit): void
    {
        if ($this->firstEdit() !== null) {
            return;
        }

        $this->write(self::FIRST_EDIT, $edit->toArray());
    }

    /**
     * @return array<string, mixed>
     */
    private function all(): array
    {
        $stored = $this->options->get(self::OPTION, []);

        return is_array($stored) ? $stored : [];
    }

    /**
     * Read whole, one key replaced, written whole — because
     * {@see OptionStore} deliberately expresses no partial update, and because
     * two milestones sharing one option must not erase each other.
     *
     * @param mixed $value
     */
    private function write(string $key, $value): void
    {
        $this->options->set(self::OPTION, [$key => $value] + $this->all());
    }
}
