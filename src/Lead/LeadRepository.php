<?php

namespace WConvert\Lead;

use WConvert\Database\Connection;
use WConvert\Goal\Goal;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * Storage for [[Lead]]s.
 *
 * **There is one write, and it is an insert.** Not because nothing else has
 * been needed yet, but because nothing else may ever be: a Lead has no
 * lifecycle, so an update path here is the drift `wconvert_leads`' missing
 * `status` column exists to prevent (ADR 0002).
 *
 * **There are now two removals, and neither is an update.** Erasure and
 * retention pruning both `DELETE`, which is what let ADR 0018 keep ADR 0002
 * whole rather than carve an exception into it: an eraser that blanked the
 * identifying columns would be writing to a Lead row, and the one caller
 * nobody would think to check is exactly where that door reopens. Widening
 * {@see Connection} with a `delete()` is the diff a reviewer sees;
 * `tests/unit/Lead/NoLeadIsEverUpdatedTest.php` is what keeps `update()` from
 * quietly acquiring a call site against this table.
 *
 * **Every read here is a PROJECTION, and none of them is `SELECT *`.** Two of
 * the six columns are LONGTEXT-shaped and the log lists fifty rows at a time.
 *
 * @since 0.1.0
 */
final class LeadRepository
{
    /** @var \WeakMap<LeadQuery, array{sql: literal-string, params: list<string>}> */
    private \WeakMap $scopes;
    /** Everything a Lead is. The log renders captured values, so `fields` comes too. */
    private const FULL_COLUMNS = 'id, optin_id, email, phone, fields, created_at';

    /**
     * The grouping view, as **two indexed aggregates** rather than one over
     * `COALESCE(email, phone)`.
     *
     * That is the shape ADR 0021 promised when it justified making `email` and
     * `phone` real indexed columns: InnoDB appends the primary key to every
     * secondary index, so `idx_email` covers `(email, id)` and this half is
     * answered from the index without touching a row. `COALESCE` is a function
     * over two columns and can use neither index, which would have made the
     * ADR's "nearly free" a claim the code did not honour.
     *
     * **Email wins where a Lead carries both**, and the second half takes only
     * the rows with no email — so the two halves partition the table and
     * `UNION ALL` needs no de-duplication pass.
     *
     * The consequence, stated rather than hidden: a Lead with email only and a
     * Lead with phone only are two groups even where a human knows they are
     * one person. Under-grouping cannot produce a wrong NUMBER, because the
     * headline is submissions and no screen reports a count of people — which
     * is the boundary that makes this trade safe to make at all (ADR 0021).
     *
     * No parentheses around the halves: MySQL accepts them, SQLite does not,
     * and a bare compound select means one query text runs on both — which is
     * what lets `bin/verify-lead-log.php` prove this on Playground.
     */
    private const GROUPED = 'SELECT email AS identifier, COUNT(*) AS submissions, MAX(id) AS latest_id'
        . ' FROM %i WHERE email IS NOT NULL GROUP BY email'
        . ' UNION ALL '
        . 'SELECT phone AS identifier, COUNT(*) AS submissions, MAX(id) AS latest_id'
        . ' FROM %i WHERE email IS NULL AND phone IS NOT NULL GROUP BY phone'
        . ' ORDER BY latest_id DESC LIMIT %d';

    private const GROUPED_FOR_OPTIN = 'SELECT email AS identifier, COUNT(*) AS submissions, MAX(id) AS latest_id'
        . ' FROM %i WHERE optin_id = %s AND email IS NOT NULL GROUP BY email'
        . ' UNION ALL '
        . 'SELECT phone AS identifier, COUNT(*) AS submissions, MAX(id) AS latest_id'
        . ' FROM %i WHERE optin_id = %s AND email IS NULL AND phone IS NOT NULL GROUP BY phone'
        . ' ORDER BY latest_id DESC LIMIT %d';

    public function __construct(
        private readonly Connection $db,
    ) {
        $this->scopes = new \WeakMap();
    }

    /** Resolve purpose once per read/export, without a JOIN, config blobs or a capped Campaign list.
     * @return array{sql: literal-string, params: list<string>}
     */
    private function constraints(LeadQuery $query): array
    {
        if ($query->purpose === null) return $query->constraints();
        if (isset($this->scopes[$query])) return $this->scopes[$query];
        $rows = $query->purpose === 'enquiries'
            ? $this->db->results(Connection::TABLE_OPTINS, 'SELECT id FROM %i WHERE goal = %s', Goal::CollectEnquiries->value)
            : $this->db->results(Connection::TABLE_OPTINS, 'SELECT id FROM %i WHERE goal IN (%s, %s)', Goal::GrowEmailList->value, Goal::GrowSmsList->value);
        return $this->scopes[$query] = $query->constraints(array_map(static fn (array $row): string => (string) $row['id'], $rows));
    }

    /**
     * Write one Lead, and hand it back as it landed.
     *
     * The id is a ULID like an Optin's: it is minted from a CSPRNG and sorts
     * chronologically, so `ORDER BY id` is `ORDER BY created_at` and the lead
     * log needs no index to list newest-first. `created_at` is a real column
     * regardless, because retention pruning is a range delete over it and
     * because it is the [[Consent Record]]'s timestamp — there is no second
     * one (ADR 0002, ADR 0032).
     */
    public function record(string $optinId, Submission $submission): Lead
    {
        $lead = new Lead(
            Ulid::generate(),
            $optinId,
            $submission->email,
            $submission->phone,
            $submission->fields,
            current_time('mysql')
        );

        $this->db->insert(Connection::TABLE_LEADS, [
            'id' => $lead->id,
            'optin_id' => $lead->optinId,
            'email' => $lead->email,
            'phone' => $lead->phone,
            // Cast, so an empty `fields` is `{}` and not `[]`. PHP decodes
            // both to the same empty array and would never notice, but the
            // column is a JSON OBJECT of captured values and #25's export
            // reads it as one — a row that is silently a different JSON type
            // from its neighbours is the kind of thing found much later.
            'fields' => (string) wp_json_encode((object) $lead->fields),
            'created_at' => $lead->createdAt,
        ]);

        return $lead;
    }

    /**
     * One Lead by id — what a queued push re-reads.
     *
     * The job carries a Lead id and a [[Destination]] id and no Lead data at
     * all (ADR 0008), so this is the read that turns one back into the other.
     * A `null` here is not an error: a Lead erased or pruned between capture
     * and job is a Lead that must not be pushed, and its absence says so.
     *
     * A primary-key lookup, so it costs no index this table does not have.
     */
    public function find(string $id): ?Lead
    {
        $row = $this->db->row(
            Connection::TABLE_LEADS,
            'SELECT ' . self::FULL_COLUMNS . ' FROM %i WHERE id = %s',
            $id
        );

        return $row === null ? null : Lead::fromRow($row);
    }

    /**
     * **The headline number: submissions.** Its own `COUNT(*)`, with no
     * `GROUP BY` anywhere in it.
     *
     * Deriving it by summing the grouping view would give the same answer
     * today and a different one the moment that view grows a `LIMIT` — which
     * it has — and a headline that drifts with a presentation toggle is the
     * second metric ADR 0021 exists to prevent.
     */
    public function submissions(?string $optinId, ?LeadQuery $query = null): int
    {
        if ($query !== null) {
            $filter = $this->constraints($query);
            $row = $this->db->row(Connection::TABLE_LEADS,
                'SELECT COUNT(*) AS total FROM %i WHERE ' . $filter['sql'], ...$filter['params']);
            return (int) ($row['total'] ?? 0);
        }
        $row = $optinId === null
            ? $this->db->row(Connection::TABLE_LEADS, 'SELECT COUNT(*) AS total FROM %i')
            : $this->db->row(
                Connection::TABLE_LEADS,
                'SELECT COUNT(*) AS total FROM %i WHERE optin_id = %s',
                $optinId
            );

        return (int) ($row['total'] ?? 0);
    }

    /**
     * The log itself, newest first.
     *
     * `ORDER BY id DESC` and not `ORDER BY created_at DESC`: the id is a ULID,
     * so it already sorts chronologically, and ordering on the primary key
     * needs no index of its own. Filtering by `optin_id` walks that same key
     * backwards under the `LIMIT` — an admin screen's read, deliberately not
     * paid for with a third index on a table that takes a write per capture.
     *
     * @return list<Lead>
     */
    public function page(?string $optinId, int $limit, ?LeadQuery $query = null): array
    {
        if ($query !== null) {
            $filter = $this->constraints($query);
            if ($query->before !== null) { $filter['sql'] .= $query->order === 'oldest' ? ' AND id > %s' : ' AND id < %s'; $filter['params'][] = $query->before; }
            $rows = $this->db->results(Connection::TABLE_LEADS,
                'SELECT ' . self::FULL_COLUMNS . ' FROM %i WHERE ' . $filter['sql'] . ($query->order === 'oldest' ? ' ORDER BY id ASC LIMIT %d' : ' ORDER BY id DESC LIMIT %d'),
                ...[...$filter['params'], $limit]);
            return array_map(static fn (array $row): Lead => Lead::fromRow($row), $rows);
        }
        $rows = $optinId === null
            ? $this->db->results(
                Connection::TABLE_LEADS,
                'SELECT ' . self::FULL_COLUMNS . ' FROM %i ORDER BY id DESC LIMIT %d',
                $limit
            )
            : $this->db->results(
                Connection::TABLE_LEADS,
                'SELECT ' . self::FULL_COLUMNS . ' FROM %i WHERE optin_id = %s ORDER BY id DESC LIMIT %d',
                $optinId,
                $limit
            );

        return array_map(static fn (array $row): Lead => Lead::fromRow($row), $rows);
    }

    /**
     * The grouping view — {@see self::GROUPED} for why it is two aggregates.
     *
     * @return list<LeadGroup>
     */
    public function groups(?string $optinId, int $limit, ?LeadQuery $query = null): array
    {
        if ($query !== null) {
            $filter = $this->constraints($query);
            // HAVING pages whole groups. A WHERE cursor would split a group's
            // events, repeat it on later pages, and change its submission count.
            $having = $query->before === null ? '' : ($query->order === 'oldest' ? ' HAVING MAX(id) > %s' : ' HAVING MAX(id) < %s');
            $params = [...$filter['params'], ...($query->before === null ? [] : [$query->before])];
            $rows = $this->db->results(Connection::TABLE_LEADS,
                'SELECT email AS identifier, COUNT(*) AS submissions, MAX(id) AS latest_id FROM %i WHERE '
                . $filter['sql'] . ' AND email IS NOT NULL GROUP BY email' . $having . ' UNION ALL '
                . 'SELECT phone AS identifier, COUNT(*) AS submissions, MAX(id) AS latest_id FROM %i WHERE '
                . $filter['sql'] . ' AND email IS NULL AND phone IS NOT NULL GROUP BY phone' . $having
                . ($query->order === 'oldest' ? ' ORDER BY latest_id ASC LIMIT %d' : ' ORDER BY latest_id DESC LIMIT %d'), ...[...$params, ...$params, $limit]);
            return array_map(static fn (array $row): LeadGroup => LeadGroup::fromRow($row), $rows);
        }
        $rows = $optinId === null
            ? $this->db->results(Connection::TABLE_LEADS, self::GROUPED, $limit)
            : $this->db->results(Connection::TABLE_LEADS, self::GROUPED_FOR_OPTIN, $optinId, $optinId, $limit);

        return array_map(static fn (array $row): LeadGroup => LeadGroup::fromRow($row), $rows);
    }

    /**
     * Every Lead carrying one email address, oldest first — what the personal
     * data exporter hands back, and what the eraser is about to remove.
     *
     * Oldest first because it is a person's own history being read to them,
     * and a history reads forwards. The log reads backwards for the opposite
     * reason: a merchant wants what just came in.
     *
     * @return list<Lead>
     */
    public function forEmail(string $email, int $limit, int $offset): array
    {
        return array_map(
            static fn (array $row): Lead => Lead::fromRow($row),
            $this->db->results(
                Connection::TABLE_LEADS,
                'SELECT ' . self::FULL_COLUMNS . ' FROM %i WHERE email = %s ORDER BY id ASC LIMIT %d OFFSET %d',
                $email,
                $limit,
                $offset
            )
        );
    }

    /**
     * The next batch of Leads after an id, oldest first — how the CSV export
     * walks the whole log.
     *
     * **Keyset, not `OFFSET`.** An offset walk re-reads and discards every row
     * before it, so exporting the last page of a large log costs a scan of the
     * whole log; and a Lead inserted mid-export shifts every later page by one,
     * which duplicates a row in the file. Both go away when the cursor is the
     * primary key the rows are already ordered by.
     *
     * @return list<Lead>
     */
    public function since(?string $optinId, string $afterId, int $limit, ?LeadQuery $query = null): array
    {
        if ($query !== null) {
            $filter = $this->constraints($query);
            $rows = $this->db->results(Connection::TABLE_LEADS,
                'SELECT ' . self::FULL_COLUMNS . ' FROM %i WHERE ' . $filter['sql'] . ' AND id > %s ORDER BY id ASC LIMIT %d',
                ...[...$filter['params'], $afterId, $limit]);
            return array_map(static fn (array $row): Lead => Lead::fromRow($row), $rows);
        }
        $rows = $optinId === null
            ? $this->db->results(
                Connection::TABLE_LEADS,
                'SELECT ' . self::FULL_COLUMNS . ' FROM %i WHERE id > %s ORDER BY id ASC LIMIT %d',
                $afterId,
                $limit
            )
            : $this->db->results(
                Connection::TABLE_LEADS,
                'SELECT ' . self::FULL_COLUMNS
                    . ' FROM %i WHERE optin_id = %s AND id > %s ORDER BY id ASC LIMIT %d',
                $optinId,
                $afterId,
                $limit
            );

        return array_map(static fn (array $row): Lead => Lead::fromRow($row), $rows);
    }

    /**
     * Erase every Lead directly carrying one canonical identifier.
     *
     * **A `DELETE`, never an anonymising update** (ADR 0018). Anonymising is
     * an update and ADR 0002 has no update path, so a delete lets that ADR
     * survive with no carve-out — and it buys almost nothing anyway: what
     * would remain is a conversion count, which the stats table already owns.
     *
     * Email matches only `email`; phone matches only `phone`. A row carrying
     * both is removed when either value is the requested identifier, because
     * the value appears on that row. Nothing follows an inferred link from
     * that row to another one (ADR 0021).
     */
    public function eraseByIdentifier(string $identifier): int
    {
        return str_contains($identifier, '@')
            ? $this->db->delete(Connection::TABLE_LEADS, 'DELETE FROM %i WHERE email = %s', $identifier)
            : $this->db->delete(Connection::TABLE_LEADS, 'DELETE FROM %i WHERE phone = %s', $identifier);
    }

    /** Kept as the WordPress export/erasure adapter's explicit email spelling. */
    public function eraseByEmail(string $email): int
    {
        return $this->eraseByIdentifier($email);
    }

    /**
     * Retention pruning: remove every Lead captured before a boundary.
     *
     * **A range on the PRIMARY KEY, not on `created_at`.** They name the same
     * rows — a ULID's leading 48 bits are the minting time, stamped in the
     * same statement as `created_at`, which is why the whole codebase already
     * treats `ORDER BY id` as `ORDER BY created_at` — and only one of them is
     * an index this table already has. `idx_created` would have been a third
     * write per capture bought for a job that runs once a day
     * (ADR 0002, ADR 0018).
     *
     * `$boundary` is {@see \WConvert\Support\Ulid::floorAt()}, so the comparison is strict: a
     * Lead minted in the boundary millisecond itself is kept.
     */
    public function pruneBefore(string $boundary): int
    {
        return $this->db->delete(Connection::TABLE_LEADS, 'DELETE FROM %i WHERE id < %s', $boundary);
    }
}
