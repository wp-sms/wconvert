<?php

namespace WConvert\Destination;

use WConvert\Lead\Lead;

defined('ABSPATH') || exit;

/**
 * The canonical keys a [[Lead]] offers a [[Destination]] — **the thing that
 * removes the per-Optin field map**.
 *
 * An [[Optin]]'s field definitions carry canonical keys rather than
 * merchant-typed names, so canonical→vendor mapping lives once on the
 * Destination type and a second Optin reusing `name` needs no new mapping at
 * all (#4). Without this, every (Optin × Destination) pair would carry a map
 * for the merchant to fill in and get wrong.
 *
 * The keys are the template manifest's `fields` list plus the reserved
 * `consent`, and they are read here rather than re-derived: `email` and
 * `phone` are columns because they are the identity keys, and everything else
 * the form captured is in the `fields` JSON (ADR 0002).
 *
 * **`consent` is reserved and no v1 Destination writes it.** What a Lead
 * carries is the [[Consent Record]] — the sentence exactly as shown — and the
 * WSMS push never writes lifecycle state of any kind (ADR 0022). It is named
 * here so that the reservation is visible rather than forgotten, and so the
 * next implementer does not read its absence as room.
 *
 * @since 0.1.0
 */
final class CanonicalFields
{
    public const EMAIL = 'email';

    public const PHONE = 'phone';

    /**
     * The person's name, **whole and unsplit**.
     *
     * The template vocabulary offers one `name` field, so one is what a Lead
     * carries. Splitting it on a space to fill a vendor's first/last pair is a
     * guess with no way back — "van der Berg" and "Maria Elena" file wrong in
     * opposite directions — and the wrong half then becomes a stored value
     * that fill-empty-only will never correct (ADR 0022).
     */
    public const NAME = 'name';

    /** Reserved, and written by nothing. See the class docblock. */
    public const CONSENT = 'consent';

    /**
     * One Lead's canonical values, with the empties dropped.
     *
     * Dropped rather than passed as `null`, because the one caller is a push
     * that fills blanks: a key present with no value would ask a Destination
     * to decide between "not captured" and "captured as empty", and both
     * answers write nothing.
     *
     * @return array<string, string>
     */
    public static function of(Lead $lead): array
    {
        $values = [
            self::EMAIL => $lead->email,
            self::PHONE => $lead->phone,
            self::NAME => $lead->fields[self::NAME] ?? null,
        ];

        return array_filter(
            $values,
            static fn (?string $value): bool => $value !== null && trim($value) !== ''
        );
    }
}
