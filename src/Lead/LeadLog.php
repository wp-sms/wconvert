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
 * people total. Optional purpose counts partition the same submission scope
 * for navigation; they do not introduce an identity count. **"Unique leads" is
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

    /** Purpose chips count submissions in the same scope, never people or visible rows.
     * @return array{all: int, subscribers: int, enquiries: int}
     */
    public function counts(LeadQuery $query, ?int $knownTotal = null): array
    {
        $count = function (?string $purpose) use ($query, $knownTotal): int {
            if ($knownTotal !== null && $query->purpose === $purpose) return $knownTotal;
            $scope = new LeadQuery(optinId: $query->optinId, identifier: $query->identifier,
                leadId: $query->leadId, from: $query->from, to: $query->to,
                snapshot: $query->snapshot, groupIdentifier: $query->groupIdentifier,
                search: $query->search, purpose: $purpose);
            return $this->leads->submissions($query->optinId, $scope);
        };
        return ['all' => $count(null), 'subscribers' => $count('subscribers'), 'enquiries' => $count('enquiries')];
    }

    /**
     * @return array{submissions: int, grouped: bool, leads: list<array<string, mixed>>, groups: list<array<string, mixed>>, next_cursor: string|null, snapshot: string}
     */
    public function read(?string $optinId, bool $grouped, int $limit, ?LeadQuery $query = null): array
    {
        // FIRST, and unconditionally. The headline is not a function of the
        // toggle, so it is not computed in a branch the toggle chooses.
        $query ??= new LeadQuery(optinId: $optinId, snapshot: LeadQuery::snapshotNow());
        $submissions = $this->leads->submissions($optinId, $query);
        $limit = max(1, min($limit, self::MAX_ROWS));
        $rows = $grouped ? $this->leads->groups($optinId, $limit + 1, $query)
            : $this->leads->page($optinId, $limit + 1, $query);
        $more = count($rows) > $limit;
        $rows = array_slice($rows, 0, $limit);
        $last = $rows === [] ? null : $rows[count($rows) - 1];

        return [
            'submissions' => $submissions,
            'grouped' => $grouped,
            'leads' => $grouped ? [] : array_map(static fn ($lead): array => $lead->toArray(), $rows),
            'groups' => $grouped ? array_map(static fn ($group): array => $group->toArray(), $rows) : [],
            'next_cursor' => $more && $last !== null ? $query->nextCursor($last instanceof Lead ? $last->id : $last->latestId) : null,
            'snapshot' => $query->snapshot,
        ];
    }
}
