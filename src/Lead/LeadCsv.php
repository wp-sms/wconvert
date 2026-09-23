<?php

namespace WConvert\Lead;

use WConvert\Template\TemplateVocabulary;

defined('ABSPATH') || exit;

/**
 * The [[Lead]] log as a CSV file.
 *
 * **A manual admin action, not a [[Destination]]** (ADR 0007). It is not
 * configured, not optional, not one of several, and it cannot fail without a
 * capture failing, because no capture is involved. It is a merchant taking
 * their own data out.
 *
 * **It is out of reach once downloaded, and stays that way.** A file already
 * on a merchant's laptop cannot be recalled, and tracking exports so that it
 * could be would mean logging who exported what — more personal data, to solve
 * a personal-data problem (ADR 0018). {@see \WConvert\Privacy\PolicyText} says
 * the merchant is the controller of exported files instead.
 *
 * Written to a stream rather than returned as a string: the export walks the
 * whole table, and building the file in memory first is the read ADR 0001
 * measured exhausting PHP's memory limit.
 *
 * @since 0.1.0
 */
final class LeadCsv
{
    /** What every row starts with, before the captured values. */
    private const LEADING_COLUMNS = ['lead_id', 'submitted_at', 'optin', 'optin_id', 'email', 'phone'];

    /**
     * The [[Consent Record]]'s column, named for the WORDING it holds.
     *
     * A column named `consent` would make an empty cell read as a refusal, and
     * a refusal is a state that cannot exist: a submission whose Optin
     * declares a consent node and whose payload lacks one is rejected at the
     * endpoint (ADR 0032). Empty here means there was no wording to snapshot,
     * which is what `CaptureForm` writes when the `consent_text` Slot Role is
     * unfilled (ADR 0031).
     */
    private const CONSENT_COLUMN = 'consent_text';

    /** What a spreadsheet reads as the start of a formula rather than of a value. */
    private const FORMULA_PREFIXES = ['=', '+', '-', '@', "\t", "\r"];

    /** @var list<string>|null The columns, worked out once — the export writes one per Lead. */
    private ?array $columns = null;

    public function __construct(
        private readonly TemplateVocabulary $vocabulary,
    ) {
    }

    /**
     * The columns, **from the closed field vocabulary rather than from the
     * data**.
     *
     * A header unioned from the keys the rows happen to carry cannot be
     * written until every row has been read, which is exactly what a streamed
     * export must not do. A Template may only declare fields the manifest
     * names (ADR 0010), so the columns are known before the first row is
     * fetched — and a merchant gets the same shape from every export, whatever
     * this batch of Leads happened to contain.
     *
     * @return list<string>
     */
    public function columns(): array
    {
        // The identity keys are already leading columns of their own: they are
        // real columns on the table rather than entries in `fields`.
        $captured = array_values(array_diff($this->vocabulary->fields(), ['email', 'phone']));
        if (in_array('interest', $captured, true)) {
            $captured[] = 'interest_label';
        }

        return $this->columns ??= array_merge(self::LEADING_COLUMNS, $captured, [self::CONSENT_COLUMN, 'email_consent_text', 'email_accepted_at', 'sms_consent_text', 'sms_accepted_at']);
    }

    /**
     * @param resource $handle
     */
    public function writeHeader($handle): void
    {
        fputcsv($handle, $this->columns(), ',', '"', '');
    }

    /**
     * @param resource $handle
     * @param list<Lead> $leads
     * @param array<string, string> $optinNames Every Optin's name by id, soft-deleted ones included.
     */
    public function writeRows($handle, array $leads, array $optinNames): void
    {
        foreach ($leads as $lead) {
            fputcsv($handle, $this->rowFor($lead, $optinNames), ',', '"', '');
        }
    }

    /**
     * @param array<string, string> $optinNames
     * @return list<string>
     */
    private function rowFor(Lead $lead, array $optinNames): array
    {
        $leading = [
            'lead_id' => $lead->id,
            'submitted_at' => $lead->createdAt,
            // The NAME, which survives the Optin being soft-deleted — that is
            // what the soft delete is for (ADR 0002, ADR 0020). The id is the
            // fallback where the row is gone entirely, because a blank cell
            // would read as "no Optin".
            'optin' => $optinNames[$lead->optinId] ?? $lead->optinId,
            'optin_id' => $lead->optinId,
            'email' => $lead->email ?? '',
            'phone' => $lead->phone ?? '',
        ];

        $row = [];

        // In column order, so the row lines up with the header by construction
        // rather than by two lists agreeing.
        foreach ($this->columns() as $column) {
            $row[] = self::neutralise($leading[$column] ?? $lead->fields[$column] ?? '');
        }

        return $row;
    }

    /**
     * A value a spreadsheet would run rather than show.
     *
     * Every cell in this file was typed by a member of the public into a form
     * on the merchant's own site, and a leading `=`, `+`, `-` or `@` makes
     * Excel and Sheets evaluate it. The phone column is not a hypothetical:
     * E.164 numbers all begin with `+`.
     *
     * Prefixed with an apostrophe, which is the spelling both spreadsheets
     * read as "this is text" — rather than stripped, because the value is a
     * [[Lead]]'s own data and an export that quietly edits it is not an export.
     */
    private static function neutralise(string $value): string
    {
        return $value !== '' && in_array($value[0], self::FORMULA_PREFIXES, true) ? "'" . $value : $value;
    }
}
