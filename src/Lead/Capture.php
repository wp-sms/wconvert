<?php

namespace WConvert\Lead;

defined('ABSPATH') || exit;

/**
 * One submission, validated and canonicalised — everything about a [[Lead]]
 * except the two facts only the write knows: its id and the instant it landed.
 *
 * `email` and `phone` are separate from `fields` because they are separate
 * COLUMNS: they are the identity keys grouping pivots on, and everything else
 * the Optin captured goes in one JSON blob (ADR 0002). The [[Consent Record]]
 * rides in `fields` beside the rest — no new column, and no second timestamp,
 * because the Lead's `created_at` already is one to the same second
 * (ADR 0032).
 *
 * @since 0.1.0
 */
final class Capture
{
    /**
     * @param array<string, string> $fields Everything that is not an identity key, plus the Consent Record.
     */
    public function __construct(
        public readonly ?string $email,
        public readonly ?string $phone,
        public readonly array $fields,
    ) {
    }
}
