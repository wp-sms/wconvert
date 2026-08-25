<?php

namespace WConvert\Lead;

defined('ABSPATH') || exit;

/**
 * A capture refused, while the visitor is still on the page.
 *
 * The refusal happens in the request they are still in, never in a queued job:
 * the form is the only place they can fix a typo'd phone number, and a capture
 * that fails minutes later with them gone looked successful to everyone
 * involved (ADR 0021).
 *
 * It carries a CODE rather than a sentence, because the wording is a
 * translated string and this type is the pure half — {@see
 * \WConvert\Rest\CaptureController} turns the code into the message the
 * visitor reads. `field` is what the browser needs to put the error beside the
 * input that caused it, and is null where no single input is to blame.
 *
 * @since 0.1.0
 */
final class Refusal
{
    public const CONSENT_REQUIRED = 'wconvert_consent_required';
    public const FIELD_REQUIRED = 'wconvert_field_required';
    public const NOT_CANONICAL = 'wconvert_uncanonicalisable_identifier';
    public const NO_IDENTIFIER = 'wconvert_no_identifier';
    public const NOTHING_TO_CAPTURE = 'wconvert_nothing_to_capture';

    public function __construct(
        public readonly string $code,
        public readonly ?string $field = null,
    ) {
    }
}
