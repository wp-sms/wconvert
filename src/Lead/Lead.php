<?php

namespace WConvert\Lead;

defined('ABSPATH') || exit;

/**
 * A [[Lead]]: one capture EVENT — one person submitted one form, at one time,
 * on one page, into one [[Optin]].
 *
 * **It has no lifecycle.** It is never confirmed, unsubscribed, bounced or
 * re-engaged; it is a row in a log, not a record under management. That is
 * enforced by the schema rather than by this comment — `wconvert_leads` has no
 * `status` column and no `updated_at`, so acquiring one takes a migration a
 * reviewer will see (ADR 0002).
 *
 * There is nothing to mutate here for the same reason. The type is readonly
 * not as a style but because a Lead genuinely never changes after the instant
 * it is written.
 *
 * @since 0.1.0
 */
final class Lead
{
    /**
     * @param array<string, string> $fields Everything that is not an identity key, plus the Consent Record.
     */
    public function __construct(
        public readonly string $id,
        public readonly string $optinId,
        public readonly ?string $email,
        public readonly ?string $phone,
        public readonly array $fields,
        public readonly string $createdAt,
    ) {
    }

    /**
     * One row of `wconvert_leads`, read back.
     *
     * `fields` is a JSON **object** on the way in — `LeadRepository::record()`
     * casts it so an empty one is `{}` rather than `[]` — and it is read back
     * as one here. Non-string values are dropped rather than coerced: what the
     * capture path writes is a map of strings, so anything else is a row this
     * plugin did not write, and inventing a spelling for it would put it in a
     * CSV export and a personal-data export as though it had.
     *
     * @param array<string, string|null> $row
     */
    public static function fromRow(array $row): self
    {
        $decoded = json_decode((string) ($row['fields'] ?? '{}'), true);

        return new self(
            (string) ($row['id'] ?? ''),
            (string) ($row['optin_id'] ?? ''),
            self::nullableString($row['email'] ?? null),
            self::nullableString($row['phone'] ?? null),
            array_filter(is_array($decoded) ? $decoded : [], 'is_string'),
            (string) ($row['created_at'] ?? '')
        );
    }

    /**
     * @return array{id: string, optin_id: string, email: string|null, phone: string|null, fields: array<string, string>, created_at: string}
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'optin_id' => $this->optinId,
            'email' => $this->email,
            'phone' => $this->phone,
            'fields' => $this->fields,
            'created_at' => $this->createdAt,
        ];
    }

    private static function nullableString(?string $value): ?string
    {
        return $value === null || $value === '' ? null : $value;
    }
}
