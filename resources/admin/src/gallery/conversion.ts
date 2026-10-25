import { __ } from '@wordpress/i18n';
import type { TemplateIndexEntry } from '../templates/api';
import type { ConvertingAct } from '../builder/structure/catalogue';
import type { GoalEntry } from '../goals/api';
import { fitsOutcome } from '../goals/outcome';
import { captureSwitch, conversionFor, convertedFor, type CaptureChoice, type Conversion } from '../builder/structure/captureConversion';
import { shopNowLink } from '../builder/structure/captureWording';
import type { Template } from '@renderer/types';

/**
 * How a design meets this campaign (ADR 0163, ADR 0171): whether it fits the
 * Goal, what the form switch would change so it does, why it cannot be used,
 * and what taking it changes about what the campaign counts.
 */

/** Constraints and publication guidance for this edited Optin. */
export interface Fit {
  readonly outcome?: import('../goals/outcome').OutcomeContract;
  /** Whether this Optin binds [[Destination]]s, which need a [[Lead]] to send. */
  readonly bound: boolean;
  /**
   * What the other arms of this A/B test convert on, or null where this Optin
   * is not part of one.
   *
   * **The guarantee the shared Goal used to smuggle in** (ADR 0059): two arms
   * shared an act because they shared a Goal and the Goal declared one. An arm
   * holding a form beside an arm holding a click CTA would put a ~3%
   * submission rate against a ~25% click rate and call one of them the winner.
   */
  readonly sibling: ConvertingAct | null;
  /**
   * What this Optin converts on today, read off the design it holds.
   *
   * It refuses nothing. It is what lets the picker say, before the click, that
   * a switch changes what this Optin counts — including what it has already
   * counted.
   */
  readonly act: ConvertingAct;
  /**
   * The campaign's Goal, the registry and its config, where the form switch may
   * convert a design to fit (ADR 0163). Memoised by the caller: a design's
   * conversion is computed from it.
   */
  readonly capture?: { readonly goal: string; readonly goals: readonly GoalEntry[]; readonly config: Readonly<Record<string, unknown>> };
}

/**
 * What the form switch would do to this design so it fits the Goal, or null
 * where it already fits or cannot be converted. Read off the facets until the
 * design's tree is known, then asked of the switch itself, so a card never
 * promises a conversion the switch refuses. Only a design whose tree is on
 * this site: a hosted one is converted once installed.
 */
export function conversionOf(entry: TemplateIndexEntry, fit: Fit, tree?: Template): CaptureChoice | null {
  if (!fit.capture || !fit.outcome || entry.availability !== 'ready' || entry.remote !== undefined || fitsOutcome(fit.outcome, entry.facets)) return null;
  const choice = conversionFor(fit.outcome, entry.facets);
  if (choice === null || tree === undefined) return choice;
  return captureSwitch({ template: tree }, fit.capture.goal, fit.capture.goals).offered ? choice : null;
}

/** The design converted for the campaign, with its config, or null where it is taken as it is. */
export function convertedDesign(entry: TemplateIndexEntry, fit: Fit, tree: Template | undefined): Conversion | null {
  const choice = tree ? conversionOf(entry, fit, tree) : null;
  return choice && tree && fit.capture
    ? convertedFor({ ...fit.capture.config, template: tree }, fit.capture.goal, fit.capture.goals, choice, shopNowLink()) : null;
}

/** The design as it will be once converted: what it collects and what a visitor does. */
export function asConverted(entry: TemplateIndexEntry, fit: Fit, tree?: Template): TemplateIndexEntry {
  const choice = conversionOf(entry, fit, tree);
  if (choice === null) return entry;
  return { ...entry, facets: choice === 'none'
    ? { ...entry.facets, act: fit.outcome?.action === 'none' ? null : 'click', captures: [], asks_consent: false }
    : { ...entry.facets, act: 'submit', captures: [choice], asks_consent: fit.outcome?.audience_channel !== null } };
}

/** A converted design's chip on its card and the action that applies it. */
export function conversionWords(choice: CaptureChoice, outcome: GoalEntry['outcome'] | undefined): { readonly chip: string; readonly action: string } {
  if (choice === 'none') return { chip: __('Form removed', 'wconvert'), action: __('Use without form', 'wconvert') };
  if (!outcome?.audience_channel) return { chip: __('Enquiry form added', 'wconvert'), action: __('Use with enquiry form', 'wconvert') };
  return choice === 'phone'
    ? { chip: __('Phone form added', 'wconvert'), action: __('Use with phone form', 'wconvert') }
    : { chip: __('Email form added', 'wconvert'), action: __('Use with email form', 'wconvert') };
}

/**
 * Why this design cannot be used on this Optin, in the merchant's words.
 *
 * `null` where it can, and null on a locked card: one that is not offered is
 * never refused, and a sentence about a design the merchant cannot have would
 * be a sentence about nothing.
 *
 * **Worst first**, because a card shows one reason. A design that counts
 * nothing renders, publishes and reports zero forever (ADR 0020) — which looks
 * like a working Optin, and is the worst of the four. The two capture failures
 * come next; the arm one last, because it is the only one that is not about
 * this Optin on its own.
 */
export function refusalFor(entry: TemplateIndexEntry, fit: Fit): string | null {
  if (entry.availability !== 'ready') {
    return null;
  }

  const offered = entry.facets.act;

  if (offered === null) {
    return __('Nothing on this template counts as a conversion.', 'wconvert');
  }

  if (entry.facets.captures.length === 0) {
    if (fit.bound) {
      return __(
        'This design collects nothing, so there would be no submissions to send to this campaign’s destinations.',
        'wconvert',
      );
    }
  }

  if (fit.sibling !== null && offered !== fit.sibling) {
    return fit.sibling === 'submit'
      ? __(
          'Converts on a click, and the other arm of this test converts on a form submission.',
          'wconvert',
        )
      : __(
          'Converts on a form submission, and the other arm of this test converts on a click.',
          'wconvert',
        );
  }

  return null;
}

/**
 * What taking THIS design would change about what the Optin counts, or null.
 *
 * ============================================================================
 * A NOTE BESIDE THE APPLY ACTION, NOT ABOVE THE WHOLE LIBRARY.
 * ============================================================================
 * **Not a refusal, and it disables nothing.** Switching is allowed and is the
 * whole point of the change; what it does is reinterpret the Optin's history,
 * because `wconvert_stats` carries no act and a [[Conversion]] is read against
 * the design the Optin holds NOW (ADR 0020). A hundred form submissions on an
 * Optin switched to a click design read as a hundred click-throughs.
 *
 * That was impossible before, because the swap was refused outright. It is now
 * something a merchant does casually, so it is said before the apply click
 * (ADR 0042 rule 3). The preview-first library puts it in the design detail;
 * a direct-choice caller keeps it on the card that applies it. It shipped for a
 * day as one clause appended to the dialog's header, which was wrong three
 * ways: it showed before anything was picked, it stayed up while the merchant
 * hovered a design that changes nothing, and it could not say which direction
 * because it was not about any particular card.
 *
 * It is distinct from a refusal: a reason dims the render and says the design
 * cannot be applied. A change in what it counts still permits the switch.
 */
export function actChangeOf(entry: TemplateIndexEntry, fit: Fit, tree?: Template): string | null {
  // Converted on the way in by the form switch, it fits, so there is no change
  // to warn about: its chip says what happens (ADR 0163).
  if (conversionOf(entry, fit, tree) !== null) return null;
  if (fit.outcome && (entry.facets.act !== fit.outcome.action || (fit.outcome.capture_any_of.length > 0
    && !fit.outcome.capture_any_of.some((field) => entry.facets.captures.includes(field))))) {
    return fit.outcome.requirement;
  }
  if (fit.outcome) return null;
  if (entry.availability !== 'ready' || entry.facets.act === null || entry.facets.act === fit.act) {
    return null;
  }

  return entry.facets.act === 'click'
    ? __(
        'Counts click-throughs instead of submissions — including everything this campaign has already counted.',
        'wconvert',
      )
    : __(
        'Counts submissions instead of click-throughs — including everything this campaign has already counted.',
        'wconvert',
      );
}
