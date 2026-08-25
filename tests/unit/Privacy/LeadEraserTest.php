<?php

namespace WConvert\Tests\Unit\Privacy;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Database\Connection;
use WConvert\Lead\LeadRepository;
use WConvert\Privacy\LeadEraser;
use WConvert\Tests\Unit\Optin\FakeConnection;

/**
 * The personal-data eraser, and the decision it exists to carry:
 * **it `DELETE`s, and it never anonymises** (ADR 0018).
 *
 * Anonymising is an UPDATE, and ADR 0002 has no update path — `wconvert_leads`
 * has no `status` and no `updated_at` precisely so a row cannot acquire
 * mutable state without a migration a reviewer will see. An eraser that blanked
 * the identifying columns would re-open that door for the one caller nobody
 * would think to check. A `DELETE` is not an update, so the ADR survives with
 * no carve-out.
 *
 * It also buys almost nothing: with email and phone gone, what remains on the
 * row is a `created_at`, an `optin_id` and an emptied `fields` — which is a
 * conversion count, and the stats table already owns that.
 */
#[CoversClass(LeadEraser::class)]
final class LeadEraserTest extends TestCase
{
    private FakeConnection $db;

    private LeadEraser $eraser;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestFilters'] = [];

        $this->db = new FakeConnection();
        $this->eraser = new LeadEraser(new LeadRepository($this->db));
    }

    /**
     * The seam #25 named. One statement, and it begins `DELETE`.
     */
    public function testErasureIssuesADeleteAgainstTheLeadLog(): void
    {
        $this->db->removes = 2;

        $this->eraser->erase('sarah@example.com');

        $this->assertCount(1, $this->db->deletes);
        $this->assertSame(Connection::TABLE_LEADS, $this->db->deletes[0]['table']);
        $this->assertStringStartsWith('DELETE FROM %i', $this->db->deletes[0]['sql']);
        $this->assertSame(['sarah@example.com'], $this->db->deletes[0]['params']);
    }

    /**
     * **The other half, and the one that would have gone unnoticed.** A
     * `DELETE` that also stamped the row would satisfy the test above and
     * still be the update ADR 0002 forbids.
     */
    public function testErasureWritesNothingToALeadRow(): void
    {
        $this->db->removes = 2;

        $this->eraser->erase('sarah@example.com');

        $this->assertSame([], $this->db->writes, 'ADR 0018: an anonymising eraser is an update, and a Lead has none');
    }

    /**
     * **No residue row.** The WordPress convention an eraser usually follows
     * is to report what it kept; there is nothing to keep here, so `done` is
     * true on the first pass and `items_retained` is false always.
     */
    public function testErasureLeavesNoResidueAndFinishesInOnePass(): void
    {
        $this->db->removes = 2;

        $result = $this->eraser->erase('sarah@example.com');

        $this->assertTrue($result['items_removed']);
        $this->assertFalse($result['items_retained']);
        $this->assertSame([], $result['messages']);
        $this->assertTrue($result['done']);
    }

    public function testAnAddressWithNoLeadsRemovesNothingAndStillFinishes(): void
    {
        $this->db->removes = 0;

        $result = $this->eraser->erase('nobody@example.com');

        $this->assertFalse($result['items_removed']);
        $this->assertFalse($result['items_retained']);
        $this->assertTrue($result['done']);
    }

    /**
     * **One eraser, over one table, at the default priority.**
     *
     * WSMS registers its contact eraser at priority 99 because several of its
     * erasers resolve an email to a phone number through the contact row
     * first, and WordPress runs each eraser to completion before starting the
     * next. WConvert has no such dependency, so copying the caveat would be
     * carrying WSMS's ordering hazard into a plugin that does not have it
     * (ADR 0018). The day a second eraser appears, copy it then.
     */
    public function testItRegistersExactlyOneEraserAndNeedsNoOrderingCaveat(): void
    {
        $this->eraser->hooks();

        /** @var array<string, array{eraser_friendly_name: string, callback: callable}> $erasers */
        $erasers = apply_filters('wp_privacy_personal_data_erasers', []);

        $this->assertCount(1, $erasers);
        $this->assertArrayHasKey(LeadEraser::ID, $erasers);
        $this->assertSame([$this->eraser, 'erase'], $erasers[LeadEraser::ID]['callback']);
    }
}
