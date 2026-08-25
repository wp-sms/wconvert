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
}
