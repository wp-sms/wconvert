<?php

namespace WConvert\Lead;

use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * One row of the lead log's **grouping view**: the [[Lead]]s that share an
 * identifier, collapsed for reading.
 *
 * **It is not a person, and there is no type here that is.** Identity is
 * computed at read and never stored — no person key, no person table, no
 * column (ADR 0021) — and this is the shape that computation comes back in: a
 * result set, which is structurally incapable of acquiring the lifecycle a
 * stored person would. There is nothing here to attach a status to, and that
 * is the whole reason grouping was allowed at all.
 *
 * `submissions` is what the group READS as — "2 submissions" — and never a
 * count of people. The distinction is not pedantry: identifiers are optional
 * and a person may submit under two of them, so the number of groups is a
 * count of *identifiers seen*, which is a different quantity wearing the same
 * clothes. "Unique leads" is not a number this system can honestly produce.
 *
 * @since 0.1.0
 */
final class LeadGroup
{
    private function __construct(
        public readonly string $identifier,
        public readonly int $submissions,
        public readonly string $latestId,
    ) {
    }

    /**
     * @param array<string, string|null> $row One row of the grouping aggregate.
     */
    public static function fromRow(array $row): self
    {
        return new self(
            (string) ($row['identifier'] ?? ''),
            (int) ($row['submissions'] ?? 0),
            (string) ($row['latest_id'] ?? '')
        );
    }

    /**
     * When this group was last heard from, in the site's own timezone so it
     * reads the same as a [[Lead]]'s `created_at` beside it.
     *
     * Read off the ULID rather than fetched: the leading 48 bits are the
     * minting time, and `MAX(id)` is already covered by `idx_email` /
     * `idx_phone`, so asking the database for a `MAX(created_at)` as well
     * would buy a second column and cost the covering read.
     */
    public function latestAt(): ?string
    {
        $milliseconds = Ulid::timeOf($this->latestId);

        return $milliseconds === null
            ? null
            : get_date_from_gmt(gmdate('Y-m-d H:i:s', (int) floor($milliseconds / 1000)));
    }

    /**
     * @return array{identifier: string, submissions: int, latest_id: string, latest_at: string|null}
     */
    public function toArray(): array
    {
        return [
            'identifier' => $this->identifier,
            'submissions' => $this->submissions,
            'latest_id' => $this->latestId,
            'latest_at' => $this->latestAt(),
        ];
    }
}
