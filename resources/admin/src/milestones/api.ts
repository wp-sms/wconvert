import apiFetch from '@wordpress/api-fetch';

/**
 * The milestone screen's one read.
 *
 * ============================================================================
 * IT ASKS FOR NOTHING, BECAUSE A MILESTONE IS ALL-TIME.
 * ============================================================================
 * The dashboard read takes a number of days and the far end is resolved on the
 * server. This one takes nothing at all: there is no window over a *first*, so
 * there is nothing here a caller could narrow — and a `days` parameter creeping
 * onto this route would be the first step towards a "first conversion" that
 * moved when somebody switched the analytics window from 30 days to 7.
 *
 * **It is a second request rather than four more fields on the dashboard's
 * payload**, for that same reason: one payload answering for a window and for
 * all time is one field away from being read as answering for the window.
 */

/** The [[Playbook]] suggestion a merchant overrode first. */
export interface FirstEdit {
  /** The day, as a `Y-m-d` on the site's own clock. */
  on: string;
  /** Which Playbook the Optin was started from. */
  playbook: string;
  /**
   * Which part went first — one of a closed set of five.
   *
   * **This bundle never branches on it.** The words are `part_label`, decided
   * in PHP, for the reason a [[Goal]]'s `headline_label` is: `wp i18n make-pot`
   * cannot see a string in a JavaScript file, so a `switch` here would ship
   * five untranslatable sentences.
   */
  part: string;
  /** The merchant's own words for `part`, translated in PHP. */
  part_label: string;
}

/**
 * Whether the captured data is reaching anywhere.
 *
 * **Three booleans and no numbers**, deliberately. Success and failure are
 * already recorded per [[Destination]] and already drawn on the Destinations
 * screen, with the error text and the repair actions beside them — so a count
 * copied here would be a second, staler spelling of an outage on a screen that
 * cannot act on it.
 */
export interface DestinationsReached {
  /** Whether the merchant has configured one at all. */
  configured: boolean;
  /** Whether anything has ever landed. */
  landed: boolean;
  /** Whether anything is failing right now. */
  failing: boolean;
}

/**
 * Five milestones: **activation through first conversion**.
 *
 * Every date is a `Y-m-d` on the SITE's clock, or `null` for "not yet". Two of
 * them are read out of a WordPress option and two are `MIN(stat_date)` over
 * the daily counters, and this bundle cannot tell which is which — which is
 * how it should be.
 */
export interface MilestonePayload {
  /** The day an Optin was first published. */
  first_publish: string | null;
  /** The day something was first shown to a visitor. */
  first_impression: string | null;
  /** The day somebody first converted. */
  first_conversion: string | null;
  first_edit: FirstEdit | null;
  destinations: DestinationsReached;
}

export const readMilestones = () =>
  apiFetch<MilestonePayload>({ path: '/wconvert/v1/milestones' });

/**
 * Where a site has stopped, or `null` when it has not.
 *
 * ============================================================================
 * THE SCREEN DRAWS THE STEP THAT IS STUCK, AND NEVER THE ONES THAT ARE DONE.
 * ============================================================================
 * A checklist of four ticks is the shape ADR 0042 refuses: *"does knowing this
 * change what they do next?"* — and a completed step never does. So this
 * returns at most one step, the first unmet one, and the region renders
 * nothing at all when everything is met.
 *
 * **A failing Destination outranks an unreached one**, because it is the
 * sharper fact: "nothing has arrived yet" may just be a queue that has not run,
 * while "it is being refused" is an outage with an error message waiting on
 * another screen.
 *
 * Exported separately from the component so the ordering is testable without a
 * DOM — it is the whole of the screen's logic, and none of it is layout.
 */
export type StuckAt = 'publish' | 'impression' | 'conversion' | 'delivery' | 'failing';

export function stuckAt(milestones: MilestonePayload): StuckAt | null {
  if (milestones.first_publish === null) {
    return 'publish';
  }

  if (milestones.first_impression === null) {
    return 'impression';
  }

  if (milestones.first_conversion === null) {
    return 'conversion';
  }

  if (milestones.destinations.failing) {
    return 'failing';
  }

  // Only where the merchant asked for one. A Destination is optional — the
  // lead log is the capture and always happens (ADR 0007) — so a site with
  // none configured is finished at its first conversion rather than
  // permanently one step short.
  if (milestones.destinations.configured && !milestones.destinations.landed) {
    return 'delivery';
  }

  return null;
}
