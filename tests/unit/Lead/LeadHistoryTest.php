<?php

namespace WConvert\Tests\Unit\Lead;

use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Lead\LeadLog;
use WConvert\Lead\LeadQuery;
use WConvert\Lead\LeadRepository;
use WConvert\Support\Ulid;
use WConvert\Tests\Unit\Support\FakeConnection;

/** Contracts at the read boundary; the fake records SQL and never pretends to execute it. */
#[CoversClass(LeadQuery::class)]
#[CoversClass(LeadLog::class)]
#[CoversClass(LeadRepository::class)]
final class LeadHistoryTest extends TestCase
{
    private const SNAPSHOT = '01J99999990000000000000000';
    private const NEWER = '01J0000000CCCCCCCCCCCCCCCC';
    private const OLDER = '01J0000000BBBBBBBBBBBBBBBB';
    private const OLDEST = '01J0000000AAAAAAAAAAAAAAAA';

    public function testIdentifierSearchIsCanonicalAndExactRatherThanASubstringScan(): void
    {
        $email = LeadQuery::fromInput(['identifier' => ' Sarah@Example.COM ', 'snapshot' => self::SNAPSHOT]);
        $this->assertSame('sarah@example.com', $email->identifier);
        $this->assertSame(['sarah@example.com', self::SNAPSHOT], $email->constraints()['params']);
        $this->assertStringContainsString('email = %s', $email->constraints()['sql']);
        $this->assertStringNotContainsString('LIKE', $email->constraints()['sql']);
        $phone = LeadQuery::fromInput(['identifier' => '0044 (7911) 123456']);
        $this->assertSame('+447911123456', $phone->identifier);
        $this->assertStringNotContainsString('email IS NULL', $phone->constraints()['sql'], 'Phone search must also find captures that carry an email.');
    }

    public function testPhoneGroupDrilldownPreservesEmailFirstGrouping(): void
    {
        $group = LeadQuery::fromInput(['group_identifier' => '+44 7911 123456']);
        $this->assertStringContainsString('email IS NULL AND phone = %s', $group->constraints()['sql']);
        $this->assertSame('+447911123456', $group->constraints()['params'][0]);
    }

    public function testBothDatesAreInclusiveSiteDaysExpressedAsPrimaryKeyBounds(): void
    {
        $query = LeadQuery::fromInput(['from' => '2026-08-01', 'to' => '2026-08-31', 'snapshot' => self::SNAPSHOT]);
        $this->assertSame([
            Ulid::floorAt((new DateTimeImmutable('2026-08-01', wp_timezone()))->getTimestamp() * 1000),
            Ulid::floorAt((new DateTimeImmutable('2026-09-01', wp_timezone()))->getTimestamp() * 1000),
            self::SNAPSHOT,
        ], $query->constraints()['params']);
        $this->assertStringContainsString('id >= %s AND id < %s', $query->constraints()['sql']);
        $this->assertStringNotContainsString('created_at', $query->constraints()['sql']);
    }

    public function testDateBoundariesBeforeTheUlidEpochDoNotWrapIntoTheFuture(): void
    {
        $query = LeadQuery::fromInput(['from' => '1900-01-01', 'to' => '1901-01-01']);
        $this->assertSame(Ulid::floorAt(0), $query->constraints()['params'][0]);
        $this->assertSame(Ulid::floorAt(0), $query->constraints()['params'][1]);
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function invalidInputs(): iterable
    {
        yield 'incomplete identifier' => [['identifier' => 'Sarah']];
        yield 'local phone lacks country code' => [['identifier' => '07911123456']];
        yield 'nonexistent day' => [['from' => '2026-02-29']];
        yield 'date not padded' => [['to' => '2026-9-1']];
        yield 'reversed period' => [['from' => '2026-09-10', 'to' => '2026-09-01']];
        yield 'malformed lead id' => [['lead_id' => '123']];
        yield 'array filter never silently widens export' => [['identifier' => ['sarah@example.com']]];
        yield 'invalid cursor' => [['cursor' => 'garbage']];
        yield 'cursor disagrees with snapshot' => [['cursor' => base64_encode(self::SNAPSHOT . ':' . self::OLDER), 'snapshot' => self::NEWER]];
    }

    /** @param array<string, mixed> $input */
    #[DataProvider('invalidInputs')]
    public function testInvalidFiltersAreRejectedInsteadOfReturningAnUnfilteredLog(array $input): void
    {
        $this->expectException(InvalidArgumentException::class);
        LeadQuery::fromInput($input);
    }

    public function testCursorCarriesTheOriginalSnapshotAndLastVisibleId(): void
    {
        $first = LeadQuery::fromInput(['snapshot' => self::SNAPSHOT]);
        $next = LeadQuery::fromInput(['cursor' => $first->nextCursor(self::OLDER)]);
        $this->assertSame(self::SNAPSHOT, $next->snapshot);
        $this->assertSame(self::OLDER, $next->before);
    }

    public function testHistoryFetchesOneLookaheadRowWithoutReturningItOrChangingTheTotal(): void
    {
        $db = new FakeConnection();
        $db->answers = [[['total' => '7']], [self::row(self::NEWER), self::row(self::OLDER), self::row(self::OLDEST)]];
        $query = LeadQuery::fromInput(['snapshot' => self::SNAPSHOT]);
        $read = (new LeadLog(new LeadRepository($db)))->read(null, false, 2, $query);
        $this->assertSame(7, $read['submissions']);
        $this->assertCount(2, $read['leads']);
        $this->assertSame(self::OLDER, $read['leads'][1]['id']);
        $this->assertSame($query->nextCursor(self::OLDER), $read['next_cursor']);
        $this->assertSame([self::SNAPSHOT, 3], $db->reads[1]['params']);
        $this->assertSame([], $db->writes);
    }

    public function testAnExactFullPageDoesNotPromiseAnotherPage(): void
    {
        $db = new FakeConnection();
        $db->answers = [[['total' => '2']], [self::row(self::NEWER), self::row(self::OLDER)]];
        $read = (new LeadLog(new LeadRepository($db)))->read(null, false, 2);
        $this->assertNull($read['next_cursor']);
    }

    public function testPageCursorNarrowsRowsButNeverTheHeadlineOrExportScope(): void
    {
        $db = new FakeConnection();
        $db->answers = [[['total' => '7']], [], []];
        $repo = new LeadRepository($db);
        $query = new LeadQuery(identifier: 'sarah@example.com', snapshot: self::SNAPSHOT, before: self::OLDER);
        (new LeadLog($repo))->read(null, false, 50, $query);
        $repo->since(null, '', 500, $query);
        $this->assertSame(['sarah@example.com', self::SNAPSHOT], $db->reads[0]['params']);
        $this->assertSame(['sarah@example.com', self::SNAPSHOT, self::OLDER, 51], $db->reads[1]['params']);
        $this->assertSame(['sarah@example.com', self::SNAPSHOT, '', 500], $db->reads[2]['params']);
    }

    public function testGroupedPagingFiltersCompletedGroupsAndNeverSplitsTheirEvents(): void
    {
        $db = new FakeConnection();
        $db->answers = [[['total' => '7']], []];
        $query = new LeadQuery(optinId: self::NEWER, snapshot: self::SNAPSHOT, before: self::OLDER);
        (new LeadLog(new LeadRepository($db)))->read(self::NEWER, true, 50, $query);
        $sql = $db->reads[1]['sql'];
        $this->assertSame(2, substr_count($sql, 'HAVING MAX(id) < %s'));
        $this->assertSame(2, substr_count($sql, 'AND id < %s'), 'Only the snapshot is in WHERE; a cursor there would split a group.');
        $this->assertStringContainsString('email IS NULL AND phone IS NOT NULL GROUP BY phone', $sql);
        $this->assertStringContainsString('UNION ALL', $sql);
        $this->assertSame([self::NEWER, self::SNAPSHOT, self::OLDER, self::NEWER, self::SNAPSHOT, self::OLDER, 51], $db->reads[1]['params']);
    }

    public function testRowCapAlsoAppliesOutsideRest(): void
    {
        $db = new FakeConnection();
        $db->answers = [[], []];
        (new LeadLog(new LeadRepository($db)))->read(null, false, 100000);
        $this->assertSame(LeadLog::MAX_ROWS + 1, $db->reads[1]['params'][1]);
    }

    /** @return array<string, string|null> */
    private static function row(string $id): array
    {
        return ['id' => $id, 'optin_id' => self::NEWER, 'email' => 'sarah@example.com', 'phone' => null,
            'fields' => '{}', 'created_at' => '2026-08-01 09:30:00'];
    }
}
