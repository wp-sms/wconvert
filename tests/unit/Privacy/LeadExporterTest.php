<?php

namespace WConvert\Tests\Unit\Privacy;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Privacy\LeadExporter;
use WConvert\Rules\RuleVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * The personal-data exporter.
 *
 * **Its absence is a live wp.org review flag** for a plugin that stores email
 * addresses, and it is cheap to write (ADR 0018) — but the reason it is
 * interesting is what it carries.
 *
 * **The export includes the [[Consent Record]]**: the consent text exactly as
 * it was shown when the visitor submitted. Consent evidence that does not
 * travel with the data it justifies is useless to the merchant at the moment
 * they need it most, which is precisely this moment.
 */
#[CoversClass(LeadExporter::class)]
final class LeadExporterTest extends TestCase
{
    private FakeConnection $db;

    private LeadExporter $exporter;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestFilters'] = [];

        $this->db = new FakeConnection();
        $this->exporter = new LeadExporter(
            new LeadRepository($this->db),
            new OptinRepository(
                $this->db,
                new PublishedSet(new FakeOptionStore()),
                RuleVocabulary::fromManifest(__DIR__ . '/../../..')
            )
        );
    }

    /**
     * @param array<string, string> $fields
     * @return array<string, string|null>
     */
    private static function leadRow(string $id, array $fields, ?string $email = 'sarah@example.com'): array
    {
        return [
            'id' => $id,
            'optin_id' => '01HZZZZZZZZZZZZZZZZZZZZZZZ',
            'email' => $email,
            'phone' => '+12025551234',
            'fields' => (string) json_encode((object) $fields),
            'created_at' => '2026-08-01 09:30:00',
        ];
    }

    /**
     * @param array<string, string> $fields
     * @return list<array{name: string, value: string}>
     */
    private function exportedItem(array $fields): array
    {
        // The Lead page, then the Optin names the export labels it with.
        $this->db->answers = [
            [self::leadRow('01J0000000ZZZZZZZZZZZZZZZZ', $fields)],
            [['id' => '01HZZZZZZZZZZZZZZZZZZZZZZZ', 'name' => 'Newsletter footer']],
        ];

        /** @var array{data: list<array{data: list<array{name: string, value: string}>}>, done: bool} $export */
        $export = $this->exporter->export('sarah@example.com');

        return $export['data'][0]['data'];
    }

    /**
     * @param list<array{name: string, value: string}> $item
     */
    private static function valueOf(array $item, string $name): ?string
    {
        foreach ($item as $pair) {
            if ($pair['name'] === $name) {
                return $pair['value'];
            }
        }

        return null;
    }

    public function testItExportsTheLeadsIdentifiersAndCapturedFields(): void
    {
        $item = $this->exportedItem(['first_name' => 'Sarah']);

        $this->assertSame('sarah@example.com', self::valueOf($item, 'Email'));
        $this->assertSame('+12025551234', self::valueOf($item, 'Phone'));
        $this->assertSame('Sarah', self::valueOf($item, 'first_name'));
        $this->assertSame('2026-08-01 09:30:00', self::valueOf($item, 'Submitted'));
    }

    /**
     * The Optin's NAME, not its id. A merchant answering a personal-data
     * request has to be able to say which form this came from.
     */
    public function testItNamesTheOptinTheLeadWasCapturedBy(): void
    {
        $item = $this->exportedItem([]);

        $this->assertSame('Newsletter footer', self::valueOf($item, 'Optin'));
    }

    /**
     * **The Consent Record travels with the data it justifies** (ADR 0018).
     * The wording exactly as it was shown, snapshotted at capture — not the
     * merchant's current copy, which they will have edited by now.
     */
    public function testItExportsTheConsentRecordAsShown(): void
    {
        $item = $this->exportedItem(['consent_text' => 'Email me offers. See the Privacy Policy.']);

        $this->assertSame('Email me offers. See the Privacy Policy.', self::valueOf($item, 'Consent'));
    }

    /**
     * **The carry-over from #24, and the one that would have been got wrong.**
     *
     * `consent_text` is ABSENT where the consent node carried no wording —
     * `CaptureForm::consented()` declines to write an empty sentence, because
     * a `consent_text` of `''` in an export handed to a regulator asserts an
     * artefact that does not exist. Absent therefore means "there is no
     * wording to show", and it means that whether the Optin declared no
     * consent node at all or declared one nobody had filled in yet.
     *
     * It does **not** mean consent was refused. A submission whose Optin
     * declares a consent node and whose payload lacks one is rejected at the
     * endpoint (ADR 0032) — so no stored Lead is un-consented, and an export
     * that printed "not given" would be reporting a state that cannot exist.
     */
    public function testAnAbsentConsentRecordIsNotExportedAsConsentRefused(): void
    {
        $item = $this->exportedItem(['first_name' => 'Sarah']);

        $this->assertNull(self::valueOf($item, 'Consent'), 'absent wording is nothing to show, not a refusal');

        foreach ($item as $pair) {
            $this->assertStringNotContainsStringIgnoringCase('not given', $pair['value']);
            $this->assertStringNotContainsStringIgnoringCase('no consent', $pair['value']);
            $this->assertStringNotContainsStringIgnoringCase('refused', $pair['value']);
        }
    }

    /**
     * An empty page is a finished export, not an error.
     */
    public function testAnAddressWithNoLeadsExportsNothingAndIsDone(): void
    {
        $this->db->answers = [[], []];

        $export = $this->exporter->export('nobody@example.com');

        $this->assertSame([], $export['data']);
        $this->assertTrue($export['done']);
    }

    /**
     * Canonicalised before it is matched, for the reason
     * `LeadEraserTest` gives at length: stored addresses are lowercased at
     * capture, and matching a raw one against them rides on a collation rather
     * than on a rule.
     */
    public function testTheAddressIsCanonicalisedBeforeItIsMatched(): void
    {
        $this->db->answers = [[], []];

        $this->exporter->export('  Sarah@Example.COM ');

        $this->assertStringContainsString('WHERE email = %s', $this->db->reads[0]['sql']);
        $this->assertSame('sarah@example.com', $this->db->reads[0]['params'][0]);
    }

    public function testAnAddressThatIsNotOneReadsNothingAndIsDone(): void
    {
        $export = $this->exporter->export('not-an-address');

        $this->assertSame([], $this->db->statements);
        $this->assertSame([], $export['data']);
        $this->assertTrue($export['done']);
    }

    public function testItRegistersExactlyOneExporter(): void
    {
        $this->exporter->hooks();

        /** @var array<string, array{exporter_friendly_name: string, callback: callable}> $exporters */
        $exporters = apply_filters('wp_privacy_personal_data_exporters', []);

        $this->assertCount(1, $exporters);
        $this->assertArrayHasKey(LeadExporter::ID, $exporters);
        $this->assertSame([$this->exporter, 'export'], $exporters[LeadExporter::ID]['callback']);
    }
}
