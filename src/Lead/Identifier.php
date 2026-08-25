<?php

namespace WConvert\Lead;

defined('ABSPATH') || exit;

/**
 * Canonical form for the two identity keys, and the refusal that comes with
 * it.
 *
 * A [[Lead]] holds its email and phone in **canonical form** — email
 * lowercased, phone in E.164 — because identity is decided by comparing
 * identifiers and is computed at read rather than stored (ADR 0021).
 * `GROUP BY email` is a lie the moment one row reads `Sarah@Example.com` and
 * the next reads `sarah@example.com`, so canonicalisation belongs to that
 * decision rather than beside it.
 *
 * **An identifier that cannot be put in canonical form is refused**, and this
 * class is where that is decided. Both methods return null rather than a
 * best-effort value, because the caller is handling a request the visitor is
 * still in and null is the only answer they can act on while they are there to
 * fix it. Refusing later — inside a queued push, where WSMS's `assertE164()`
 * throws — is a capture that looked successful to everyone involved.
 *
 * The rule is TOTAL. It rests on every identifier arriving from a visitor who
 * is still on the page, which holds because a Lead has exactly one origin: no
 * admin entry screen, no CSV import, no ingestion API (ADR 0031). There is no
 * second branch to write.
 *
 * @since 0.1.0
 */
final class Identifier
{
    /**
     * The pattern WSMS's `PhoneValidator` asserts on
     * (`src/Support/PhoneValidator.php`), reproduced rather than depended on:
     * WConvert runs Standalone, so it cannot reach into a plugin that may not
     * be installed — and E.164 is a standard, not WSMS's opinion.
     */
    private const E164 = '/^\+[1-9]\d{1,14}$/';

    /** What a visitor types between the digits, and none of it is the number. */
    private const FORMATTING = '/[\s\-()\.]+/';

    /**
     * An email in canonical form, or null where there is none to be had.
     *
     * Lowercased WHOLE, local part included. RFC 5321 makes the local part
     * case-sensitive in theory; in practice no mail host WConvert will meet
     * treats it that way, and WSMS's `ContactRepository::create()` lowercases
     * the whole address on the way in — so a row canonicalised any other way
     * cannot find the Contact it created itself on the next submission.
     *
     * Storing both raw and canonical was rejected in ADR 0021: nothing needs
     * to know how the visitor capitalised their address.
     */
    public static function email(string $raw): ?string
    {
        $trimmed = trim($raw);

        // `filter_var` rather than WordPress's `is_email()` because this runs
        // on the capture path and in the unit suite alike, and it is the
        // stricter of the two on the case that matters: it requires a dot in
        // the domain, so `sarah@example` is refused rather than stored as an
        // address nothing can deliver to.
        return filter_var($trimmed, FILTER_VALIDATE_EMAIL) === false ? null : strtolower($trimmed);
    }

    /**
     * A phone in E.164, or null where there is none to be had.
     *
     * Formatting is stripped and the `00` international dialling prefix is
     * read as the `+` it means — that is canonicalisation, since a visitor
     * whose keypad has no `+` types the same number a different way.
     *
     * **A bare national number is refused, not rescued.** `07911 123456` needs
     * a country to resolve against and WConvert has none: it mints no visitor
     * identifier and does no IP geolocation (ADR 0006, ADR 0017). Prepending
     * `+` to whatever digits arrived produces a number that satisfies E.164
     * and cannot be dialled — a wrong answer that validates, which is the one
     * outcome worse than refusing. The visitor is on the page and can add
     * their country code.
     */
    public static function phone(string $raw): ?string
    {
        $digits = (string) preg_replace(self::FORMATTING, '', trim($raw));

        if (str_starts_with($digits, '00')) {
            $digits = '+' . substr($digits, 2);
        }

        return preg_match(self::E164, $digits) === 1 ? $digits : null;
    }
}
