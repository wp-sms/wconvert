<?php

namespace WConvert\Lead;

defined('ABSPATH') || exit;

/**
 * Every way a capture is refused. Closed, and spelled as a backed enum for the
 * same reason {@see \WConvert\Rules\RuleKind} is: the set is fixed, and an
 * exhaustive `match` over it is what makes adding a case a compile-time
 * question rather than a runtime one.
 *
 * The backing strings are the REST error codes a refused submission comes back
 * with, so there is one spelling of each rather than a constant here and a
 * literal at the boundary.
 *
 * @since 0.1.0
 */
enum RefusalCode: string
{
    /** The Optin declares a `consent` node and the payload did not carry one (ADR 0032). */
    case ConsentRequired = 'wconvert_consent_required';

    /** A field the form declared `required` arrived empty. */
    case FieldRequired = 'wconvert_field_required';

    /** An identifier that cannot be put in canonical form (ADR 0021). */
    case NotCanonical = 'wconvert_uncanonicalisable_identifier';

    /**
     * Neither identity key. WSMS's `ContactRepository::create()` hard-requires
     * one of the two, and a Lead carrying neither can never be grouped by the
     * only identity this system has (ADR 0002, ADR 0021).
     */
    case NoIdentifier = 'wconvert_no_identifier';

    /**
     * The Optin's template declares no form at all — the shape of a
     * click-metered Optin, whose whole product is a message and a link
     * (ADR 0025).
     */
    case NothingToCapture = 'wconvert_nothing_to_capture';
}
