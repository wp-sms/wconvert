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
 * Product dimensions are pruned separately by ProductStats (ADR 0122).
 * Empty-scope campaign counters and milestone history remain lifetime totals.
 *
 * **This repository has two reads, and no delete.** {@see self::inRange()} is the
 * one the dashboard issues; {@see self::firstDays()} is the one the milestone
 * screen issues, and it is deliberately not the same query. Retention is
 * keep-forever with no pruning, because at ~29k rows a year there is nothing
 * to prune and analytics needs no retention setting of its own (ADR 0019) —
 * which is also what makes the second read's answer a fact rather than an
 * artefact of when somebody last tidied up.
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
    private const INCREMENT = 'INSERT INTO %i (optin_id, stat_date, kind, scope, `count`) VALUES (%s, %s, %s, %s, 1)'
        . ' ON DUPLICATE KEY UPDATE `count` = `count` + 1';

    /**
     * The milestone read.
     *
     * `MIN` over a `DATE` column, grouped by a `VARCHAR(32)` of at most four
     * distinct values — so the result set is four rows however long the site
     * has been counting. No `WHERE`, because a milestone is all-time, and
     * therefore no bindings at all.
     */
    private const FIRST_DAYS = 'SELECT kind, MIN(stat_date) AS first_day FROM %i WHERE scope = \'\' GROUP BY kind';

    public function __construct(
        private readonly Connection $db,
    ) {
    }

    /**
     * Every counter in a window, across every [[Optin]].
     *
     * ========================================================================
     * ONE TABLE, ONE STATEMENT, AND NO `JOIN`.
     * ========================================================================
     * The [[Goal]] that gives these rows meaning lives in `wconvert_optins`
     * and is read separately, then applied in PHP by {@see Dashboard}. That is
     * a decision rather than an omission (ADR 0034): a Goal is tens of rows of
     * fact, and joining it here would denormalise it onto thousands of
     * counters to save an array lookup — while costing
     * {@see \WConvert\Database\Connection} a third widening, on an interface
     * whose own docblock says the third should be read as pressure to stop.
     *
     * **It is a scan of the primary key, and that is affordable rather than
     * overlooked.** `(optin_id, stat_date, kind)` puts the id leftmost, so a
     * date range across every Optin cannot use it as a range — but the table
     * is booked at ~29k rows a year (ADR 0019) and {@see StatRange::MAX_DAYS}
     * keeps the window to one of them. A secondary index would be paid on
     * every beacon to save one admin screen a read it takes on demand, which
     * is the same asymmetry ADR 0033 decided the other way round for the lead
     * log. `tests/unit/Database/SchemaTest.php` still budgets this table zero.
     *
     * `count` is backticked because it is also a function name.
     *
     * `ORDER BY` is deliberately absent: the caller buckets by Optin and by
     * day anyway, and asking the database to sort a scan it is going to hand
     * over whole is work nobody reads.
     *
     * @return list<array<string, string|null>>
     */
    public function inRange(StatRange $range): array
    {
        return $this->db->results(
            Connection::TABLE_STATS,
            'SELECT optin_id, stat_date, kind, `count` FROM %i WHERE scope = \'\' AND stat_date BETWEEN %s AND %s',
            $range->from,
            $range->to
        );
    }

    /**
     * The earliest day each kind was ever counted on, keyed by kind.
     *
     * ========================================================================
     * TWO MILESTONES, DERIVED, WITH NOTHING WRITTEN TO SUPPORT THEM.
     * ========================================================================
     * "The first [[Impression]]" and "the first [[Conversion]]" are milestones
     * #94 asks to be recorded once, and this table already holds the answer:
     * one row per Optin per day per kind, never pruned and never deleted. So
     * they are read rather than stored, which is the better shape twice over —
     * a derived date cannot disagree with the counters it comes from, and a
     * `MIN` **cannot move forwards**, so "recorded once" is a property of the
     * arithmetic rather than a guard somebody has to remember.
     *
     * That rests on properties of THIS table and does not generalise. An
     * erasure request deletes [[Lead]] rows and never a counter (ADR 0018), an
     * Optin is soft-deleted so its counters outlive it (ADR 0020), and there
     * is no delete path here at all — {@see \WConvert\Database\Connection}
     * offers none this class could call.
     *
     * ========================================================================
     * NO WINDOW, WHICH IS WHY IT IS NOT ON THE DASHBOARD'S PAYLOAD.
     * ========================================================================
     * A milestone is all-time by definition. {@see self::inRange()} answers
     * for a window a merchant chose, and a first conversion that moved when
     * somebody changed the analytics window would not be a milestone at all —
     * so the two reads stay separate rather than one gaining a mode.
     *
     * **A scan, and a cheaper one than the dashboard's.** There is no
     * secondary index and `optin_id` is leftmost, so this cannot use the
     * primary key — but it reads three columns' worth of nothing and returns
     * at most four rows, on a table booked at ~29k rows a year, for a screen
     * an admin opens on demand. That is the same asymmetry `inRange()` books,
     * without even a `WHERE` to be unable to use.
     *
     * A kind this build has no case for is dropped rather than passed on:
     * {@see StatKind} is a closed set and it is enforced on the way out of
     * storage as well as on the way in.
     *
     * @return array<string, string> Kind => the `Y-m-d` it was first counted on.
     */
    public function firstDays(): array
    {
        $first = [];

        foreach ($this->db->results(Connection::TABLE_STATS, self::FIRST_DAYS) as $row) {
            $kind = StatKind::tryFrom((string) ($row['kind'] ?? ''));
            $day = (string) ($row['first_day'] ?? '');

            if ($kind !== null && $day !== '') {
                $first[$kind->value] = $day;
            }
        }

        return $first;
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
    public function increment(string $optinId, StatKind $kind, string $statDate, string $scope = ''): void
    {
        $this->db->upsert(Connection::TABLE_STATS, self::INCREMENT, $optinId, $statDate, $kind->value, $scope);
    }
}
