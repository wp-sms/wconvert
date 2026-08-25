<?php

namespace WConvert\Lead;

defined('ABSPATH') || exit;

/**
 * The lead log, read — and the one place its headline number is decided.
 *
 * **Grouping is presentation, never the count** (ADR 0021). The merchant can
 * collapse Sarah's two rows into one reading "2 submissions"; the number at
 * the top of the screen does not move, because it is submissions in both modes
 * and it is fetched by the same call either way.
 *
 * That is enforced by shape rather than by discipline. The log has exactly one
 * total, and it is read here, before the toggle is even looked at — so there
 * is no wiring in which a group count could reach the headline, and no second
 * number for a screen to mistake for a count of people. **"Unique leads" is
 * not a number this system can honestly produce**, and the log must not imply
 * that it can.
 *
 * @since 0.1.0
 */
final class LeadLog
{
    /**
     * What one read returns at most, grouped or not.
     *
     * A cap rather than a page size the caller picks: the log drags a `fields`
     * blob per row, and the grouping view is an aggregate over the whole table
     * however few rows come back from it (ADR 0001).
     */
    public const MAX_ROWS = 200;

    public function __construct(
        private readonly LeadRepository $leads,
    ) {
    }

    /**
     * @return array{submissions: int, grouped: bool, leads: list<array<string, mixed>>, groups: list<array<string, mixed>>}
     */
    public function read(?string $optinId, bool $grouped, int $limit): array
    {
        // FIRST, and unconditionally. The headline is not a function of the
        // toggle, so it is not computed in a branch the toggle chooses.
        $submissions = $this->leads->submissions($optinId);
        $limit = max(1, min($limit, self::MAX_ROWS));

        return [
            'submissions' => $submissions,
            'grouped' => $grouped,
            'leads' => $grouped
                ? []
                : array_map(
                    static fn (Lead $lead): array => $lead->toArray(),
                    $this->leads->page($optinId, $limit)
                ),
            'groups' => $grouped
                ? array_map(
                    static fn (LeadGroup $group): array => $group->toArray(),
                    $this->leads->groups($optinId, $limit)
                )
                : [],
        ];
    }
}
