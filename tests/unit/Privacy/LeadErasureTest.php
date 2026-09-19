<?php

namespace WConvert\Tests\Unit\Privacy;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Database\Connection;
use WConvert\Destination\DeliveryFailures;
use WConvert\Lead\LeadRepository;
use WConvert\Privacy\LeadErasure;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

#[CoversClass(LeadErasure::class)]
final class LeadErasureTest extends TestCase
{
    private const MATCHING = '01J0000000AAAAAAAAAAAAAAAA';
    private const OTHER = '01J0000000BBBBBBBBBBBBBBBB';

    /** @return array<string, string|null> */
    private static function row(string $id, ?string $email, ?string $phone): array
    {
        return [
            'id' => $id,
            'optin_id' => '01HZZZZZZZZZZZZZZZZZZZZZZZ',
            'email' => $email,
            'phone' => $phone,
            'fields' => '{}',
            'created_at' => '2026-09-19 10:00:00',
        ];
    }

    public function testPhoneErasureDeletesEveryRowDirectlyCarryingTheCanonicalPhone(): void
    {
        $db = new FakeConnection();
        $db->removes = 3;
        $options = new FakeOptionStore();
        $failures = new DeliveryFailures($options);
        $failures->record('destination-a', self::MATCHING, 'Rejected +96899123456', '2026-09-19 10:10:00');
        $failures->record('destination-b', self::OTHER, 'Different person', '2026-09-19 10:11:00');
        // Failure entries are newest first, so their referenced Leads are read in this order.
        $db->answers = [
            [self::row(self::OTHER, 'same@example.com', '+96899000000')],
            [self::row(self::MATCHING, 'same@example.com', '+96899123456')],
        ];

        $result = (new LeadErasure(new LeadRepository($db), $failures))->erase('  +968 9912 3456  ');

        $this->assertSame(['identifier' => '+96899123456', 'removed' => 3], $result);
        $this->assertSame(Connection::TABLE_LEADS, $db->deletes[0]['table']);
        $this->assertSame('DELETE FROM %i WHERE phone = %s', $db->deletes[0]['sql']);
        $this->assertSame(['+96899123456'], $db->deletes[0]['params']);
        $this->assertSame([self::OTHER], array_column($failures->all(), 'lead'), 'Only diagnostics for directly matched Leads are removed.');
    }

    public function testItNeverFollowsASecondIdentifierToAnotherLead(): void
    {
        $db = new FakeConnection();
        $db->removes = 1;
        $options = new FakeOptionStore();
        $failures = new DeliveryFailures($options);
        $failures->record('destination-a', self::OTHER, 'Different phone', '2026-09-19 10:11:00');
        // Same email as a hypothetical matching row, but the requested phone is absent.
        $db->answers = [[self::row(self::OTHER, 'same@example.com', '+96899000000')]];

        (new LeadErasure(new LeadRepository($db), $failures))->erase('+96899123456');

        $this->assertSame(['+96899123456'], $db->deletes[0]['params']);
        $this->assertSame([self::OTHER], array_column($failures->all(), 'lead'));
    }

    public function testAnInvalidIdentifierDeletesAndCleansNothing(): void
    {
        $db = new FakeConnection();
        $options = new FakeOptionStore();
        $result = (new LeadErasure(
            new LeadRepository($db),
            new DeliveryFailures($options)
        ))->erase('not an identifier');

        $this->assertNull($result);
        $this->assertSame([], $db->statements);
        $this->assertSame(0, $options->reads);
        $this->assertSame(0, $options->writes);
    }
}
