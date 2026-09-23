<?php

namespace WConvert\Lead;

defined('ABSPATH') || exit;

/** One journey's combined capture record. Accepted submission values stay fixed. */
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
        /** @var array<string, mixed> Internal accepted snapshots; never a public DTO. */
        public readonly array $capture = [],
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
            array_filter(is_array($decoded['answers'] ?? null) ? $decoded['answers'] : [], 'is_string'),
            (string) ($row['created_at'] ?? ''),
            is_array($decoded['capture'] ?? null) ? $decoded['capture'] : []
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

    /** Frozen payload for one job; erasure is checked by the repository before this read. */
    public function submission(string $id): ?self
    {
        $snapshot = $this->capture['submissions'][$id] ?? null;
        if (!is_array($snapshot) || !is_array($snapshot['values'] ?? null)) { return null; }
        $values = $snapshot['values'];
        $email = $values['email'] ?? null;
        $phone = $values['phone'] ?? null;
        unset($values['email'], $values['phone']);
        return new self($this->id, $this->optinId, $email, $phone, $values, $this->createdAt);
    }

    private static function nullableString(?string $value): ?string
    {
        return $value === null || $value === '' ? null : $value;
    }
}
