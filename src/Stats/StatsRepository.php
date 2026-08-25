<?php

namespace WConvert\Stats;

use WConvert\Database\Connection;

defined('ABSPATH') || exit;

/**
 * Storage for the daily counters.
 *
 * **There is one write, and it is one statement.** Not a read and a write, and
 * not an insert with an update behind a `try`: `INSERT ... ON DUPLICATE KEY
 * UPDATE count = count + 1` is atomic at the database, so two beacons arriving
 * in the same instant produce two, and no increment is ever lost (ADR 0019).
 *
 * That is the entire justification for the table's shape, so it is proven
 * where it can be — against MySQL, on two concurrent connections, in
 * `bin/verify-stats.php`. A fake models the table and ignores the SQL text, so
 * nothing in `tests/unit/` can see a lost update; what the unit suite proves is
 * the statement issued, which is the half that can drift silently.
 *
 * **There is no read here yet, and no delete ever.** The dashboard's query
 * arrives with the ticket that draws it; retention is keep-forever with no
 * pruning, because at ~29k rows a year there is nothing to prune and analytics
 * needs no retention setting of its own (ADR 0019).
 *
 * @since 0.1.0
 */
final class StatsRepository
{
    /**
     * The one statement.
     *
     * `count` is backticked because it is also a function name, and a column
     * that shares a spelling with `COUNT()` is the kind of thing that parses
     * everywhere until it does not.
     *
     * One `%i`, then three values, in the order they appear —
     * {@see \WConvert\Database\WpdbConnection::bindings()} binds by APPEARANCE
     * rather than by kind, and a statement that named its table twice would
     * need the table interleaved at each one.
     */
    private const INCREMENT = 'INSERT INTO %i (optin_id, stat_date, kind, `count`) VALUES (%s, %s, %s, 1)'
        . ' ON DUPLICATE KEY UPDATE `count` = `count` + 1';

    public function __construct(
        private readonly Connection $db,
    ) {
    }

    /**
     * Count one act.
     *
     * `$statDate` is passed IN rather than read here, and that is the design:
     * "the site's day" is a WordPress question, answered once at the request
     * boundary by {@see StatDay::today()}, so this class has no clock, no
     * timezone and nothing to stub. A batch of events flushed together is
     * therefore also stamped together, which is what a visitor's page view
     * actually was.
     */
    public function increment(string $optinId, StatKind $kind, string $statDate): void
    {
        $this->db->upsert(Connection::TABLE_STATS, self::INCREMENT, $optinId, $statDate, $kind->value);
    }
}
