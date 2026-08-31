import apiFetch from '@wordpress/api-fetch';
import type { Template } from '@renderer/types';
import type { Availability } from './availability';

/**
 * The creation flow's three reads.
 *
 * **All three are `GET`, and prefill is one of them.** Prefill persists
 * nothing until the merchant saves: what comes back is the body
 * `POST /wconvert/v1/optins` takes, and a merchant who browses the gallery and
 * closes the tab has created nothing.
 *
 * **No [[Goal]] id is spelled in this file, or anywhere in this bundle.** The
 * five live in `src/Goal/Goal.php` as an enum, their labels are translatable
 * strings `wp i18n make-pot` can only see in PHP, and their Availability is
 * resolved against the install on the server. Naming one here would be a
 * cross-language list with nothing asserting the two agree —
 * `tests/unit/Goal/GoalParityTest.php` fails the day one appears.
 */

/** One [[Goal]], as `GET /wconvert/v1/goals` resolves it for this install. */
export interface GoalEntry {
  id: string;
  label: string;
  description: string;
  /** `submit` or `click`. Three of the five are submissions and two are clicks. */
  converting_act: string;
  /** The counted kind this Goal's headline number is read from. */
  headline_kind: string;
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
   * implementations, and this is prefill's own call. So step 2 draws exactly
   * what step 3 draws and exactly what creating it would store.
   *
   * Absent where the Playbook names a Template this install no longer ships —
   * which still starts a perfectly good Optin, so the card falls back to the
   * words it always had (#79).
   */
  template?: Template;
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
