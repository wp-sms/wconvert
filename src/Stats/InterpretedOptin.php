<?php

namespace WConvert\Stats;

use WConvert\Goal\Goal;

defined('ABSPATH') || exit;

/**
 * One [[Optin]], as the analytics screen needs to read it — **everything
 * needed to interpret a count, and nothing else.**
 *
 * A row in `wconvert_stats` carries no `goal`, no `had_email` and no display
 * type; what a count MEANS is read from `wconvert_optins` at report time
 * (ADR 0020). This is that half of the read, given a name because it travels
 * through {@see Dashboard} as a set and the three fields on it always travel
 * together.
 *
 * The pattern {@see \WConvert\Optin\PublishedOptin} already sets: one Optin as
 * one consumer needs it, rather than the whole row dragged through a screen
 * that wants three columns of it.
 *
 * **`deleted` is a fact and not a filter.** A soft-deleted Optin's counts stay
 * in its Goal's totals — a merchant tidying up in March must not watch
 * February's goal total fall — and it is the per-Optin LIST it drops out of.
 * Holding the flag rather than having been excluded on the way in is what lets
 * one read serve both.
 *
 * @since 0.1.0
 */
final class InterpretedOptin
{
    public function __construct(
        public readonly string $id,
        public readonly string $name,
        public readonly Goal $goal,
        public readonly bool $deleted,
    ) {
    }

    /**
     * One row of {@see \WConvert\Optin\OptinRepository::interpretations()}, or
     * null where this build cannot interpret it.
     *
     * **An Optin holding a `goal` outside {@see Goal} produces nothing**,
     * rather than being filed under a card that would have to invent a
     * headline for it. That is the same posture
     * {@see \WConvert\Goal\GoalReport::byDay()} takes towards an unknown
     * `kind`: what is outside a closed set is a row no version of this code
     * wrote, and guessing at it is how a wrong number gets reported
     * confidently.
     *
     * @param array<string, mixed> $row
     */
    public static function fromRow(array $row): ?self
    {
        $goal = Goal::tryFrom((string) ($row['goal'] ?? ''));

        if ($goal === null) {
            return null;
        }

        return new self(
            (string) ($row['id'] ?? ''),
            (string) ($row['name'] ?? ''),
            $goal,
            ($row['deleted_at'] ?? null) !== null
        );
    }
}
