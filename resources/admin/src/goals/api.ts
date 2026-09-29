import type { DisplayPlan } from '@loader/display-rules';
import apiFetch from '@wordpress/api-fetch';
import type { Template } from '@renderer/types';
import type { Availability } from './availability';
import type { OutcomeContract } from './outcome';
import type { Frequency, Targeting } from '../builder/api';

/**
 * The creation flow's three reads.
 *
 * **All three are `GET`, and prefill is one of them.** Prefill persists
 * nothing until the merchant chooses to customize: what comes back is the body
 * `POST /wconvert/v1/optins` takes, and a merchant who browses the gallery and
 * closes the tab has created nothing.
 *
 * **No [[Goal]] id is spelled in this file, or anywhere in this bundle.** The
 * six live in `src/Goal/Goal.php` as an enum, their labels are translatable
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
  outcome: OutcomeContract;
  audience_requirement?: string | null;
  headline_kind: string;
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
  /** Optional editorial recommendation; never a Goal or design restriction. */
  recommendation?: string;
  /** Editorial examples; choosing a business never changes Goal eligibility. */
  business_types?: { id: string; label: string }[];
  collection?: { id: string; name: string; version: string };
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
    display_rules: DisplayPlan;
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
