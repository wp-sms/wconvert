<?php

namespace WConvert\Tests\Unit\Admin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Admin\LeadExport;
use WConvert\Lead\LeadCsv;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Optin\FakeConnection;
use WConvert\Tests\Unit\Optin\FakeOptionStore;

/**
 * The CSV download's walk over the log.
 *
 * The file's SHAPE is `LeadCsvTest`'s. What is here is the part that only
 * exists because the log can be large: the export **streams**, in keyset
 * batches over the primary key, so the memory one request holds is one batch
 * however many Leads there are (ADR 0001).
 */
#[CoversClass(LeadExport::class)]
final class LeadExportTest extends TestCase
{
    private FakeConnection $db;

    private LeadExport $export;

    protected function setUp(): void
    {
        $root = dirname(__DIR__, 3);
        $this->db = new FakeConnection();

        $this->export = new LeadExport(
            new LeadRepository($this->db),
            new OptinRepository(
                $this->db,
                new PublishedSet(new FakeOptionStore()),
                RuleVocabulary::fromManifest($root)
            ),
            new LeadCsv(TemplateVocabulary::fromManifest($root))
        );
    }

    /**
     * @return array<string, string|null>
     */
    private static function leadRow(string $id): array
    {
        return [
            'id' => $id,
            'optin_id' => 'OPTIN1',
            'email' => $id . '@example.com',
            'phone' => null,
            'fields' => '{}',
            'created_at' => '2026-08-01 09:30:00',
        ];
    }

    private function streamed(): string
    {
        $handle = fopen('php://memory', 'r+');
        self::assertNotFalse($handle);

        $this->export->stream($handle, null);
        rewind($handle);
        $csv = (string) stream_get_contents($handle);
        fclose($handle);

        return $csv;
    }

    /**
     * Two batches and then an empty one, which is how the walk knows it is
     * done — there is no count to compare against, deliberately, because a
     * count taken before the walk is stale by the time the walk reaches it.
     */
    public function testItWalksEveryBatchUntilOneComesBackEmpty(): void
    {
        $this->db->answers = [
            [['id' => 'OPTIN1', 'name' => 'Newsletter footer']],
            [self::leadRow('01J0000000AAAAAAAAAAAAAAAA'), self::leadRow('01J0000000BBBBBBBBBBBBBBBB')],
            [self::leadRow('01J0000000CCCCCCCCCCCCCCCC')],
            [],
        ];

        $csv = $this->streamed();

        $this->assertStringContainsString('01J0000000AAAAAAAAAAAAAAAA', $csv);
        $this->assertStringContainsString('01J0000000BBBBBBBBBBBBBBBB', $csv);
        $this->assertStringContainsString('01J0000000CCCCCCCCCCCCCCCC', $csv);
    }

    /**
     * Each batch asks for what comes AFTER the last id of the one before it —
     * a cursor, not an offset. An offset walk re-reads every row it has
     * already passed, and shifts by one the moment a capture lands mid-export,
     * which duplicates a row in the merchant's file.
     */
    public function testEachBatchResumesFromTheLastIdRatherThanFromAnOffset(): void
    {
        $this->db->answers = [
            [['id' => 'OPTIN1', 'name' => 'Newsletter footer']],
            [self::leadRow('01J0000000AAAAAAAAAAAAAAAA'), self::leadRow('01J0000000BBBBBBBBBBBBBBBB')],
            [],
        ];

        $this->streamed();

        $this->assertStringContainsString('id > %s', $this->db->statements[1]);
        $this->assertStringNotContainsString('OFFSET', $this->db->statements[1]);
        $this->assertStringContainsString('ORDER BY id ASC', $this->db->statements[1]);
    }

    /**
     * A log with nothing in it is still a file, with its header. An empty
     * download reads as a broken export; a header with no rows reads as an
     * empty log, which is what it is.
     */
    public function testAnEmptyLogStillProducesAHeaderRow(): void
    {
        $this->db->answers = [[], []];

        $csv = $this->streamed();

        $this->assertStringContainsString('lead_id', $csv);
        $this->assertSame(1, substr_count(trim($csv), "\n") + 1);
    }
}
