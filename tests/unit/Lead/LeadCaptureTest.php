<?php

namespace WConvert\Tests\Unit\Lead;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Database\Connection;
use WConvert\Lead\Submission;
use WConvert\Lead\Lead;
use WConvert\Lead\LeadCapture;
use WConvert\Lead\LeadRepository;
use WConvert\Tests\Unit\Support\FakeConnection;

/**
 * Write ordering: the local row is the capture itself.
 *
 * The local [[Lead]] log is **not a [[Destination]]** (ADR 0007). Test it
 * against every property the word carries — configured, optional, one of
 * several, able to fail without the capture failing — and it satisfies none.
 * It is written **first and always**, before anything else on the capture path
 * runs, and if it fails the capture failed.
 *
 * The inverse is the other half, and it is the half that is easy to lose: a
 * Destination CAN fail without the capture failing. A dispatch that throws
 * must not take the row with it, because the row is the thing that was already
 * true.
 */
#[CoversClass(LeadCapture::class)]
#[CoversClass(LeadRepository::class)]
#[CoversClass(Lead::class)]
#[CoversClass(Submission::class)]
final class LeadCaptureTest extends TestCase
{
    private const OPTIN = '01JQ0000000000000000000001';

    protected function tearDown(): void
    {
        remove_all_actions(LeadCapture::CAPTURED);
    }

    private static function submission(): Submission
    {
        return new Submission('sarah@example.com', null, ['name' => 'Sarah']);
    }

    /**
     * @param FakeConnection $db
     * @return list<array<string, mixed>>
     */
    private static function leadRows(FakeConnection $db): array
    {
        return array_values(array_map(
            static fn (array $write): array => $write['data'],
            array_filter($db->writes, static fn (array $write): bool => $write['table'] === Connection::TABLE_LEADS)
        ));
    }

    public function testTheLocalRowIsWrittenBeforeAnythingDownstreamIsInvoked(): void
    {
        $db = new FakeConnection();
        $seen = [];

        add_action(LeadCapture::CAPTURED, static function (Lead $lead) use ($db, &$seen): void {
            // What the dispatch can see at the moment it runs. If the row is
            // not here yet, "written first" is a comment rather than a fact.
            $seen = self::leadRows($db);
        });

        $lead = (new LeadCapture(new LeadRepository($db)))->record(self::OPTIN, self::submission());

        $this->assertCount(1, $seen);
        $this->assertSame($lead->id, $seen[0]['id']);
    }

    /**
     * A Destination is outbound and FALLIBLE: it can fail without the capture
     * failing (ADR 0007). The row is already the capture, so a dispatch that
     * throws leaves a complete Lead behind it and the visitor is told the
     * truth — that they were captured.
     */
    public function testADownstreamFailureLeavesTheRowIntactAndTheCaptureSuccessful(): void
    {
        $db = new FakeConnection();

        add_action(LeadCapture::CAPTURED, static function (): void {
            throw new \RuntimeException('the queue rejected sarah@example.com for Sarah');
        });

        $log = (string) tempnam(sys_get_temp_dir(), 'wconvert-');
        $previous = (string) ini_set('error_log', $log);

        try {
            $lead = (new LeadCapture(new LeadRepository($db)))->record(self::OPTIN, self::submission());
        } finally {
            ini_set('error_log', $previous);
        }

        $rows = self::leadRows($db);

        $this->assertCount(1, $rows);
        $this->assertSame($lead->id, $rows[0]['id']);

        // Caught, but never swallowed. A dispatch that vanished silently is
        // the failure mode ADR 0008 exists to end, and until Destination
        // health arrives with #30 the site's error log is the only place
        // WConvert has to put it.
        $this->assertStringContainsString($lead->id, (string) file_get_contents($log));
        $written = (string) file_get_contents($log);
        $this->assertStringContainsString('the queue rejected [email] for [personal data]', $written);
        $this->assertStringNotContainsString('sarah@example.com', $written);

        unlink($log);
    }

    /**
     * **Leads are never deduplicated.** One person submitting two forms did
     * two things and produces two rows; that they are one person is a question
     * answered when the log is READ, by grouping over the identifier the rows
     * already carry, and never a stored fact (ADR 0021).
     */
    public function testTwoSubmissionsFromOnePersonProduceTwoRows(): void
    {
        $db = new FakeConnection();
        $capture = new LeadCapture(new LeadRepository($db));

        $first = $capture->record(self::OPTIN, self::submission());
        $second = $capture->record(self::OPTIN, self::submission());

        $rows = self::leadRows($db);

        $this->assertCount(2, $rows);
        $this->assertNotSame($first->id, $second->id);
        $this->assertSame($rows[0]['email'], $rows[1]['email']);
    }

    /**
     * A row with no mutable state cannot acquire a lifecycle without a
     * migration a reviewer will see (ADR 0002). The write is the other side of
     * that: a column absent from the schema but present in an insert is a
     * silent failure, and one present in both is the drift the schema exists
     * to stop.
     */
    public function testTheWrittenRowCarriesNoLifecycleColumns(): void
    {
        $db = new FakeConnection();

        (new LeadCapture(new LeadRepository($db)))->record(self::OPTIN, self::submission());

        $written = self::leadRows($db)[0];

        $this->assertArrayNotHasKey('status', $written);
        $this->assertArrayNotHasKey('updated_at', $written);
        $this->assertSame(
            ['id', 'optin_id', 'email', 'phone', 'fields', 'created_at'],
            array_keys($written)
        );
    }

    /**
     * A Lead that captured nothing but its identifier still writes a JSON
     * OBJECT. PHP decodes `[]` and `{}` to the same empty array and would
     * never notice, but the column is an object of captured values and #25's
     * export reads it as one.
     */
    public function testAnEmptyFieldsColumnIsAnObjectAndNotAnArray(): void
    {
        $db = new FakeConnection();

        (new LeadCapture(new LeadRepository($db)))->record(
            self::OPTIN,
            new Submission('sarah@example.com', null, [])
        );

        $this->assertSame('{}', self::leadRows($db)[0]['fields']);
    }

    /**
     * The [[Consent Record]] rides in the existing `fields` JSON — no new
     * column, and no second timestamp, because `created_at` already is one to
     * the same second (ADR 0032).
     */
    public function testEverythingThatIsNotAnIdentityKeyTravelsInTheFieldsJson(): void
    {
        $db = new FakeConnection();
        $submission = new Submission('sarah@example.com', '+12025551234', [
            'name' => 'Sarah',
            'consent_text' => 'I agree to receive emails.',
        ]);

        (new LeadCapture(new LeadRepository($db)))->record(self::OPTIN, $submission);

        $written = self::leadRows($db)[0];

        $this->assertSame('sarah@example.com', $written['email']);
        $this->assertSame('+12025551234', $written['phone']);
        $this->assertSame(
            ['name' => 'Sarah', 'consent_text' => 'I agree to receive emails.'],
            json_decode((string) $written['fields'], true)
        );
    }
}
