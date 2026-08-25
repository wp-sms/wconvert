<?php

namespace WConvert\Tests\Unit\Lead;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Lead\LeadGroup;
use WConvert\Lead\LeadLog;
use WConvert\Lead\LeadRepository;
use WConvert\Tests\Unit\Support\FakeConnection;

/**
 * The lead log, read — and the two boundaries ADR 0021 calls load-bearing.
 *
 * **Grouping is presentation, never the count.** The headline number is
 * submissions whether the toggle is on or off, and this file is where that
 * stops being a convention: the log is built in one place, from one call, so
 * there is no wiring in which a group count could reach the headline.
 *
 * **"Unique leads" is not a number this system can honestly produce.** Two
 * Leads are one person only where they share an identifier, and identifiers
 * are optional — so a group count is a count of *identifiers seen*, which is
 * not the same thing and must never be reported as though it were.
 */
#[CoversClass(LeadLog::class)]
#[CoversClass(LeadGroup::class)]
final class LeadLogTest extends TestCase
{
    /** Sarah's two submissions, as the aggregate over `email` returns them. */
    private const SARAH = [
        'identifier' => 'sarah@example.com',
        'submissions' => '2',
        'latest_id' => '01J0000000ZZZZZZZZZZZZZZZZ',
    ];

    private FakeConnection $db;

    private LeadLog $log;

    protected function setUp(): void
    {
        $this->db = new FakeConnection();
        $this->log = new LeadLog(new LeadRepository($this->db));
    }

    /**
     * The seam #25 named: two rows sharing a canonical identifier collapse to
     * one group reading "2 submissions".
     *
     * The collapse itself is the database's — a fake that re-implemented
     * `GROUP BY` would only prove this file agrees with itself — so what is
     * asserted here is that the count comes back from the aggregate untouched.
     * The query that produces it is asserted below, and executed against a
     * real WordPress by `bin/verify-lead-log.php`.
     */
    public function testTwoLeadsSharingAnIdentifierAreOneGroupOfTwoSubmissions(): void
    {
        $this->db->answers = [[['id' => '1', 'total' => '2']], [self::SARAH]];

        $read = $this->log->read(null, true, 50);

        $this->assertCount(1, $read['groups']);
        $this->assertSame('sarah@example.com', $read['groups'][0]['identifier']);
        $this->assertSame(2, $read['groups'][0]['submissions']);
    }

    /**
     * **The other half of the seam, and the boundary that matters more.**
     *
     * Collapsing two rows into one is a view. The moment the number beside it
     * changes with the toggle, grouping has become a second metric the product
     * reports — and the only honest name for that metric would be "people",
     * which is exactly the number ADR 0021 says this system cannot produce.
     */
    public function testTheHeadlineCountIsSubmissionsWhicheverWayTheToggleIsSet(): void
    {
        $this->db->answers = [[['id' => '1', 'total' => '7']], []];
        $ungrouped = $this->log->read(null, false, 50);

        $this->db->answers = [[['id' => '1', 'total' => '7']], [self::SARAH]];
        $grouped = $this->log->read(null, true, 50);

        $this->assertSame(7, $ungrouped['submissions']);
        $this->assertSame(7, $grouped['submissions'], 'ADR 0021: grouping is presentation, never the count');
    }

    /**
     * One total, and it is spelled `submissions`.
     *
     * A screen cannot report a count of people if the payload it renders from
     * carries no second number to mistake for one. That is a property of the
     * SHAPE rather than of the React that reads it, so it is asserted here.
     */
    public function testTheLogCarriesExactlyOneTotalAndNoCountOfPeople(): void
    {
        $this->db->answers = [[['id' => '1', 'total' => '7']], [self::SARAH]];

        $read = $this->log->read(null, true, 50);

        $this->assertSame(['submissions', 'grouped', 'leads', 'groups'], array_keys($read));
        $this->assertIsInt($read['submissions']);

        foreach (array_keys($read) as $key) {
            $this->assertStringNotContainsString('people', $key);
            $this->assertStringNotContainsString('unique', $key);
        }
    }

    /**
     * The grouping pivots on the identity keys the rows already carry, and on
     * nothing else — **no person key, no person table, no column**
     * (ADR 0021). A person key does not add a lifecycle; it adds the row a
     * lifecycle attaches to.
     */
    public function testTheGroupingPivotsOnTheIndexedIdentityKeysAndOnNothingElse(): void
    {
        $this->db->answers = [[['id' => '1', 'total' => '2']], [self::SARAH]];

        $this->log->read(null, true, 50);

        $grouping = $this->db->statements[1];

        $this->assertStringContainsString('GROUP BY email', $grouping);
        $this->assertStringContainsString('GROUP BY phone', $grouping);
        $this->assertStringNotContainsString('person', $grouping);
        $this->assertStringNotContainsString('JOIN', $grouping);
    }

    /**
     * The headline is its own `COUNT(*)`, with no `GROUP BY` in it.
     *
     * Deriving it from the grouped result — summing the group counts — would
     * give the same number today and a different one the moment the group
     * query grows a `LIMIT`, which it has.
     */
    public function testTheHeadlineIsItsOwnUngroupedCount(): void
    {
        $this->db->answers = [[['id' => '1', 'total' => '7']], [self::SARAH]];

        $this->log->read(null, true, 50);

        $counting = $this->db->statements[0];

        $this->assertStringContainsString('COUNT(*)', $counting);
        $this->assertStringNotContainsString('GROUP BY', $counting);
        $this->assertStringNotContainsString('LIMIT', $counting);
    }

    /**
     * A group knows when it was last heard from, and it reads that off the
     * ULID rather than out of a `MAX(created_at)`.
     *
     * The reason is the index. InnoDB appends the primary key to every
     * secondary index, so `idx_email` already covers `(email, id)` and
     * `MAX(id)` is answered from the index alone — while `MAX(created_at)`
     * would force a row lookup per row and lose the covering read ADR 0021
     * promised when it made these two columns indexed.
     */
    public function testAGroupReadsItsLatestSubmissionOffTheUlid(): void
    {
        $this->db->answers = [[['id' => '1', 'total' => '2']], [self::SARAH]];

        $read = $this->log->read(null, true, 50);

        $this->assertSame('2024-06-10 02:35:18', $read['groups'][0]['latest_at']);
    }
}
