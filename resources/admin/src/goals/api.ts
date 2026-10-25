import type { DisplayPlan } from '@loader/display-rules';
import apiFetch from '@wordpress/api-fetch';
import type { Template } from '@renderer/types';
import type { Availability } from './availability';
import type { OutcomeContract } from './outcome';
import type { Frequency, Targeting } from '../builder/api';
import type { TemplateFacets } from '../templates/api';

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
  cart_required?: boolean;
  audience_requirement?: string | null;
  headline_kind: string;
  headline_label: string;
  /** What its rate is called, e.g. “Quiz completion rate”. */
  rate_label: string;
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
  revision?: string;
  prepared_revision?: string;
  design_key?: string;
  availability?: 'ready' | 'locked' | 'unavailable';
  requirements?: string[];
  copy?: Record<string, unknown>;
  rules: Record<string, unknown>[];
  targeting: Record<string, unknown>;
  destination_hint: Record<string, unknown>;
  /** Why it works, in the merchant's language. */
  notes: string;
  /** The design's facets and plan, which the gallery filters and labels by. */
  facets?: TemplateFacets | null;
  tier?: string;
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

/** A setup the hosted library has for this Goal and this site does not, as `/playbooks` sends it (ADR 0171). */
export interface OnlineSetup {
  id: string;
  revision: number;
  sha256: string;
  name: string;
  goal: string;
  tier: string;
  /** What still stands between the merchant and using it; `ready` rows are sent as the local setup they became. */
  state: 'install' | 'locked' | 'update_plugin' | 'unavailable';
  /** The Playbook an earlier revision left on this site, so the gallery shows one card for both. */
  installed_playbook_id: string | null;
  business_types: { id: string; label: string }[];
  design: { id: string; name: string; tier: string };
  display_type: string;
  facets: TemplateFacets;
  thumbnail: { '1x': string; '2x': string } | null;
  tags: string[];
  preview_url: string;
}

/** Everything step 2 offers for one Goal, in one answer. */
export interface GoalGallery {
  setups: PlaybookEntry[];
  online: OnlineSetup[];
  /** `checked_at` is when the library was last asked, so a refresh can tell whether it brought anything. */
  library: { configured: boolean; consent: 'unanswered' | 'yes' | 'no'; checked_at: string | null };
}

// Filtered on Goal ONLY. Display Type is prefilled by the chosen Playbook and
// is selectable as an override afterwards — it is never the first question
// asked, and a second parameter here is how it would become one.
export const readGoalGallery = (goal: string) =>
  apiFetch<GoalGallery>({ path: `/wconvert/v1/playbooks?goal=${encodeURIComponent(goal)}` });

/** This site's setups for a Goal, recommended first. */
export const listPlaybooks = (goal: string) => readGoalGallery(goal).then(gallery => gallery.setups);

// `playbookId` absent is "start from scratch", which skips the Playbook and
// never the Goal.
export const prefill = (goal: string, playbookId?: string, revision?: string, preparedRevision?: string) =>
  apiFetch<Draft>({
    path:
      `/wconvert/v1/playbooks/prefill?goal=${encodeURIComponent(goal)}` +
      (playbookId === undefined ? '' : `&playbook_id=${encodeURIComponent(playbookId)}`) +
      (revision === undefined ? '' : `&revision=${encodeURIComponent(revision)}`) +
      (preparedRevision === undefined ? '' : `&prepared_revision=${encodeURIComponent(preparedRevision)}`),
  });

export const previewPlaybooks = (goal: string, ids: readonly string[]) => apiFetch<{ entries: PlaybookEntry[] }>({
  path: `/wconvert/v1/playbooks/previews?${new URLSearchParams({ goal, ids: ids.join(',') })}`,
});
