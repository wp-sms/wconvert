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
     * A [[Playbook]] whose rules name no [[Trigger]], so the Optin it
     * prefills could never fire.
     *
     * **Every Optin has at least one, and "shows immediately" is the explicit
     * `page_load` Trigger rather than an empty list** (CONTEXT.md, Trigger).
     * A dropped or absent Trigger is a silent, total loss of function with
     * nothing in any log, which is the failure ADR 0012 names as the
     * category's defining support ticket — and refusing here is the only
     * moment an author is present to be told. Supplying `page_load` for them
     * was the alternative and is worse: it invents display behaviour nobody
     * asked for, which is the same reason ADR 0012 refuses to invent a
     * substitute for a [[Condition]].
     */
    case NoTrigger = 'no_trigger';

    /**
     * A [[Playbook]] declaring a [[Display Type]] its default [[Template]]
     * does not serve.
     *
     * One Template serves exactly one Display Type (CONTEXT.md, Template), so
     * the design already decides it and an entry that disagrees is describing
     * something that cannot exist. Deriving it and moving on would leave the
     * gallery filing a popup under "floating bar" with nobody told.
     */
    case DisplayTypeMismatch = 'display_type_mismatch';

    /** A Playbook naming a Goal or a Template this install does not have. */
    case UnknownReference = 'unknown_reference';

    /**
     * Two entries claiming one id.
     *
     * The second would silently replace the first, and a merchant looking at
     * a gallery that lost a card has nothing to read. Third parties add
     * Playbooks, so a collision is a matter of time rather than a typo — the
     * same case `tests/js/support/manifest-parity.ts` catches for loader
     * modules.
     */
    case DuplicateId = 'duplicate_id';

    /**
     * A [[Playbook]] naming a rule param the manifest does not declare.
     *
     * The keys a rule's scalar arrives under are declared per type
     * ({@see \WConvert\Rules\RuleVocabulary}), and a key no loader module
     * reads is not an extension — it is a rule that can never hold. Three of
     * the four bundled entries shipped `['type' => 'time_on_page', 'value' =>
     * 8]` against a module reading `rule.seconds`, which is a Trigger that
     * never fires on every Optin those Playbooks prefilled, with nothing in
     * any log. Registration is the only moment an author is present to be
     * told.
     */
    case UnknownRuleParam = 'unknown_rule_param';

    /** An entry with no id, or one that is not an array at all. */
    case Malformed = 'malformed';
}
