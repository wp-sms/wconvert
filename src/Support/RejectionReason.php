<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * Why a registry refused a member **at registration**.
 *
 * ============================================================================
 * VALIDATION HAPPENS AT REGISTRATION, NEVER AT RUNTIME.
 * ============================================================================
 * That is the pattern ADR 0010 and ADR 0012 already established and ADR 0020
 * names again: a [[Template]] offering two candidate converting acts is
 * "caught as a registration-time validation error … not a runtime ambiguity".
 * Runtime is the wrong moment twice over — a merchant already has a published
 * [[Optin]] by then, and the only refusal available to a renderer is a blank
 * popup.
 *
 * **A reason, not a message.** A string would be a sentence a test asserts by
 * matching, which passes on the day the sentence changes and the rule does
 * not. The wording belongs to whichever surface reports it; this is what the
 * surface is reporting ABOUT.
 *
 * A closed enum for the same reason {@see \WConvert\Stats\StatKind} is one:
 * these are the ways registration can fail, and an open list of them is a
 * fourth cross-cutting vocabulary this project has now refused five times
 * (ADR 0019).
 *
 * @since 0.1.0
 */
enum RejectionReason: string
{
    /**
     * A [[Template]] offering both a form's submit and a click-through CTA.
     * An Optin with two candidate Conversions has no honest number to report
     * (ADR 0020, CONTEXT.md Conversion).
     */
    case TwoConvertingActs = 'two_converting_acts';

    /**
     * A Template offering neither. The same rule read the other way: an Optin
     * that cannot be converted reports zero forever, which is the
     * countability failure the [[Goal]] test exists to prevent.
     */
    case NoConvertingAct = 'no_converting_act';

    /**
     * A Template whose step count disagrees with its converting act — a
     * submit-metered design without its terminal success step, or a
     * click-metered one carrying a success state the visitor has already
     * navigated away from (ADR 0025).
     */
    case WrongStepCount = 'wrong_step_count';

    /**
     * A [[Playbook]] filling a [[Slot Role]] its default Template does not
     * declare. The words would be dropped on prefill and nobody would be told
     * (CONTEXT.md, Slot Role).
     */
    case UnfilledSlotRole = 'unfilled_slot_role';

    /**
     * A Playbook naming something that only exists on a particular site — a
     * post or term id in its targeting, a [[Destination]] id, or the
     * privacy-policy link the renderer resolves for itself (ADR 0032).
     */
    case SiteLocalReference = 'site_local_reference';

    /**
     * A Playbook whose default Template is metered by the other act from the
     * [[Goal]] it serves. Its Optins would report nothing at all — the Goal
     * counts one act and the design offers the other.
     */
    case MetricMismatch = 'metric_mismatch';

    /** A Playbook naming a Goal or a Template this install does not have. */
    case UnknownReference = 'unknown_reference';

    /** An entry with no id, or one that is not an array at all. */
    case Malformed = 'malformed';
}
