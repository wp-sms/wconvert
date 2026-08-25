<?php

namespace WConvert\Tests\Unit\Lead;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Lead\Lead;
use WConvert\Lead\LeadCsv;
use WConvert\Template\TemplateVocabulary;

/**
 * The CSV export.
 *
 * **A manual admin action, not a [[Destination]]** (ADR 0007, ADR 0018). It is
 * not configured, not optional, not one of several, and it cannot fail without
 * the capture failing — because there is no capture to fail. It is a merchant
 * taking their own data out.
 *
 * **And it is out of reach once downloaded, deliberately.** A file already on
 * a merchant's laptop cannot be recalled, and tracking exports so it could be
 * would mean logging who exported what — more personal data, to solve a
 * personal-data problem. The registered privacy-policy text says the merchant
 * is the controller of exported files instead.
 */
#[CoversClass(LeadCsv::class)]
final class LeadCsvTest extends TestCase
{
    private LeadCsv $csv;

    protected function setUp(): void
    {
        $this->csv = new LeadCsv(TemplateVocabulary::fromManifest(__DIR__ . '/../../..'));
    }

    /**
     * @param array<string, string> $fields
     */
    private static function lead(array $fields = [], string $optinId = 'OPTIN1'): Lead
    {
        return new Lead(
            '01J0000000ZZZZZZZZZZZZZZZZ',
            $optinId,
            'sarah@example.com',
            '+12025551234',
            $fields,
            '2026-08-01 09:30:00'
        );
    }

    /**
     * @param list<Lead> $leads
     * @param array<string, string> $names
     * @return list<array<int, string>>
     */
    private function parse(array $leads, array $names): array
    {
        $handle = fopen('php://memory', 'r+');
        self::assertNotFalse($handle);

        $this->csv->writeHeader($handle);
        $this->csv->writeRows($handle, $leads, $names);
        rewind($handle);

        $rows = [];

        while (($row = fgetcsv($handle, 0, ',', '"', '')) !== false) {
            /** @var list<string> $row */
            $rows[] = $row;
        }

        fclose($handle);

        return $rows;
    }

    /**
     * **The file carries the Optin's NAME**, which is the acceptance criterion
     * and the reason deleting an Optin is a `deleted_at` stamp: the name has
     * to outlive the delete without being denormalised onto every Lead row
     * (ADR 0002, ADR 0020).
     */
    public function testTheFileCarriesTheOptinsName(): void
    {
        $rows = $this->parse([self::lead()], ['OPTIN1' => 'Newsletter footer']);

        $optin = array_search('optin', $rows[0], true);

        $this->assertNotFalse($optin);
        $this->assertSame('Newsletter footer', $rows[1][$optin]);
    }

    /**
     * The soft delete is the whole mechanism, so the name is there whether or
     * not the Optin still is. `OptinRepository::names()` reads deleted rows
     * for exactly this.
     */
    public function testTheNameSurvivesTheOptinBeingSoftDeleted(): void
    {
        $rows = $this->parse([self::lead()], ['OPTIN1' => 'Deleted campaign']);

        $optin = (int) array_search('optin', $rows[0], true);

        $this->assertSame('Deleted campaign', $rows[1][$optin]);
    }

    /**
     * An Optin whose row is gone entirely has no name to print, and the id is
     * the honest fallback — not a blank cell, which reads as "no Optin".
     */
    public function testAnUnknownOptinFallsBackToItsId(): void
    {
        $rows = $this->parse([self::lead()], []);

        $optin = (int) array_search('optin', $rows[0], true);

        $this->assertSame('OPTIN1', $rows[1][$optin]);
    }

    /**
     * **The header comes from the template vocabulary, not from the data.**
     *
     * A header built by unioning the keys the rows happen to carry cannot be
     * written until every row has been read — which is the one thing a
     * streamed export of a table this size must not do. The field vocabulary
     * is closed (ADR 0010), so the columns are known before the first row is
     * fetched, and a merchant gets the same shape from every export.
     */
    public function testTheHeaderIsTheClosedFieldVocabularyAndNotWhateverTheRowsCarried(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(__DIR__ . '/../../..');
        $rows = $this->parse([self::lead()], []);

        foreach ($vocabulary->fields() as $field) {
            $this->assertContains($field, $rows[0], "the manifest declares {$field}, so the export has a column for it");
        }

        $this->assertContains('consent_text', $rows[0]);
    }

    public function testTheConsentRecordIsAColumnOfItsOwn(): void
    {
        $rows = $this->parse([self::lead(['consent_text' => 'Email me offers.'])], []);

        $consent = (int) array_search('consent_text', $rows[0], true);

        $this->assertSame('Email me offers.', $rows[1][$consent]);
    }

    /**
     * **An empty consent cell is "no wording to show", not "no consent".**
     *
     * The column is named for the WORDING for that reason. A column named
     * `consent` would make an empty cell read as a refusal — a state that
     * cannot exist, since a submission whose Optin declares a consent node and
     * whose payload lacks one is rejected at the endpoint (ADR 0032).
     */
    public function testAnAbsentConsentRecordIsAnEmptyCellUnderAColumnNamedForTheWording(): void
    {
        $rows = $this->parse([self::lead()], []);

        $this->assertContains('consent_text', $rows[0]);
        $this->assertNotContains('consent', $rows[0]);
        $this->assertSame('', $rows[1][(int) array_search('consent_text', $rows[0], true)]);
    }

    /**
     * A leading `=`, `+`, `-` or `@` makes a spreadsheet treat the cell as a
     * FORMULA, and every value in this file was typed by a member of the
     * public into a form on the merchant's own site. The phone column is not
     * hypothetical: E.164 numbers all start with `+`.
     */
    public function testAValueASpreadsheetWouldRunAsAFormulaIsNeutralised(): void
    {
        $rows = $this->parse([self::lead(['name' => '=cmd|/c calc'])], []);

        $name = (int) array_search('name', $rows[0], true);
        $phone = (int) array_search('phone', $rows[0], true);

        $this->assertSame("'=cmd|/c calc", $rows[1][$name]);
        $this->assertSame("'+12025551234", $rows[1][$phone]);
    }
}
