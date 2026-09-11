import apiFetch from '@wordpress/api-fetch';
import type { Template } from '@renderer/types';
import type { Availability } from './availability';
import type { Frequency, Rule, Targeting } from '../builder/api';

/**
 * The creation flow's three reads.
 *
 * **All three are `GET`, and prefill is one of them.** Prefill persists
 * nothing until the merchant chooses to customize: what comes back is the body
 * `POST /wconvert/v1/optins` takes, and a merchant who browses the gallery and
 * closes the tab has created nothing.
 *
 * **No [[Goal]] id is spelled in this file, or anywhere in this bundle.** The
 * five live in `src/Goal/Goal.php` as an enum, their labels are translatable
 * strings `wp i18n make-pot` can only see in PHP, and their Availability is
 * resolved against the install on the server. Naming one here would be a
 * cross-language list with nothing asserting the two agree —
 * `tests/unit/Goal/GoalParityTest.php` fails the day one appears, **including
 * on a Goal id inside a comment**, which is why nothing below names a case and
 * every sentence says what a Goal DOES.
 */

/** One [[Goal]], as `GET /wconvert/v1/goals` resolves it for this install. */
export interface GoalEntry {
  id: string;
  label: string;
  description: string;
  /**
   * Whether this Goal's own number is unreachable on a design that captures
   * nothing.
   *
   * ==========================================================================
   * IT REPLACES `converting_act`, AND IT IS A MUCH SMALLER CLAIM.
   * ==========================================================================
   * A Goal used to declare the converting act, and this bundle read it to grey
   * out every design offering the other one — five of seven popup cards under
   * a Goal that counted clicks, each saying *"your goal counts
   * click-throughs"* and naming no control that changed a goal. The act is the
   * DESIGN's now (ADR 0059): the builder derives it with `convertingActOf`
   * from the tree it is already holding, so there is nothing for a registry
   * field to add.
   *
   * What is left is the one refusal a Goal can still make about a design: the
   * delivery kind is written when a push to the lead-magnet [[Destination]]
   * succeeds, and a design with no field on it gives it nothing to push. It is
   * resolved on the server rather than derived from `headline_kind` here, for
   * the reason `availability` is — a rule spelled on both sides is a rule with
   * nothing asserting the two agree.
   */
  needs_a_capture: boolean;
  /**
   * Whether this Goal's product is a captured contact.
   *
   * **The looser half of {@link needs_a_capture}, and it only ever prints a
   * sentence.** A Goal that counts submissions used to refuse every design
   * offering the other act, so a list-growing Goal over a design with no field
   * on it was impossible. ADR 0059 made it reachable, and it is silent: the
   * Optin saves, runs, counts click-throughs and collects nothing. The
   * builder's Summary says so ({@see problemsIn}).
   *
   * Never a refusal and never a filter. The Optin is not broken — the number
   * is honest, it just measures something else.
   */
  grows_a_list: boolean;
  /** The counted kind this Goal's headline number is read from. */
  headline_kind: string;
  /**
   * What that number is CALLED — *"Conversions"* or *"Deliveries"*, which is
   * the counted KIND's own word.
   *
   * It was the Goal's, and varied five ways, because a Goal declared the
   * converting act. One Goal's card can now hold an Optin that submits beside
   * one that links away (ADR 0059), so a card headed *"Submissions"* would be
   * wrong about half of it. The precise word survives per Optin, in the
   * builder, derived from the one design that Optin holds.
   *
   * The dashboard receives it per card, which is enough for a screen reporting
   * counts and useless to the builder: a DRAFT has no card, and *"what will
   * this be judged on?"* is a question about the Goal rather than about a
   * window. It travels with the Goal for the same reason its label does — the
   * words are PHP's, and a `match` over Goal ids in this bundle is what
   * `GoalParityTest` fails on.
   */
  headline_label: string;
  tier: string;
  availability: Availability;
}

/** One [[Playbook]], as the gallery receives it. */
export interface PlaybookEntry {
  id: string;
  name: string;
  goal: string;
  template_id: string;
  display_type: string;
  copy: Record<string, unknown>;
  rules: Record<string, unknown>[];
  targeting: Record<string, unknown>;
  destination_hint: Record<string, unknown>;
  /** Why it works, in the merchant's language. */
  notes: string;
  /**
   * **The design this Playbook would prefill, with its words already in it.**
   *
   * Composed by `Prefill` on the server and not here, which is the whole point:
   * binding `copy` to [[Slot Role]]s is the one thing that must not have two
   * implementations, and this is prefill's own call. The chooser draws exactly what creating the draft would store.
   *
   * Absent where the Playbook names a Template this install no longer ships —
   * which still starts a perfectly good Optin, so the card falls back to the
   * words it always had (#79).
   */
  template?: Template;
  /** Effective Prefill settings for this install, including rule degradation.
   * Kept compact: no copy, full template, bindings, or extra config snapshot.
   * Omitted only where the source could not be resolved. */
  setup?: {
    display_type: string;
    rules: Rule[];
    targeting?: Targeting;
    frequency?: Frequency;
    destination_hint?: Record<string, unknown>;
  };
}

/** What prefill hands back: an Optin nobody has saved. */
export interface Draft {
  name: string;
  goal: string;
  config: Record<string, unknown>;
}

export const listGoals = () => apiFetch<GoalEntry[]>({ path: '/wconvert/v1/goals' });

// Filtered on Goal ONLY. Display Type is prefilled by the chosen Playbook and
// is selectable as an override afterwards — it is never the first question
// asked, and a second parameter here is how it would become one.
export const listPlaybooks = (goal: string) =>
  apiFetch<PlaybookEntry[]>({ path: `/wconvert/v1/playbooks?goal=${encodeURIComponent(goal)}` });

// `playbookId` absent is "start from scratch", which skips the Playbook and
// never the Goal.
export const prefill = (goal: string, playbookId?: string) =>
  apiFetch<Draft>({
    path:
      `/wconvert/v1/playbooks/prefill?goal=${encodeURIComponent(goal)}` +
      (playbookId === undefined ? '' : `&playbook_id=${encodeURIComponent(playbookId)}`),
  });
