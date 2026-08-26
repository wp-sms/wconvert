import apiFetch from '@wordpress/api-fetch';
import type { Template } from '@renderer/types';
import type { Availability } from '../goals/availability';

/**
 * What the builder reads, and the one shape the rule vocabulary reaches it in.
 *
 * **No rule type, preset id or control kind is spelled in this bundle** beyond
 * the control table that draws one. The vocabulary is `resources/rules/manifest.json`,
 * its words are PHP's so `wp i18n make-pot` can see them, and its
 * [[Availability]] is resolved against the install on the server — the same
 * arrangement `goals/api.ts` has, and for the same reason: a cross-language
 * list with nothing asserting the two agree is how the manifest quietly gains
 * a second copy.
 */

/** One `{type, scalar}` entry, exactly as it is stored and shipped (ADR 0005). */
export interface Rule {
  type: string;
  [param: string]: unknown;
}

/**
 * The one key a stored rule carries that is not a param of its type.
 *
 * It records which rule this one was SUBSTITUTED FOR when the Optin was
 * prefilled on an install without [[Pro]] — `time_on_page` standing in for
 * `exit_intent` — and the rule row renders it as a persistent inline note
 * (ADR 0012). Provenance rather than configuration: it is deliberately not a
 * manifest param, because a param would draw a control and invite the merchant
 * to edit the record of a substitution.
 *
 * Spelled here and in `WConvert\Rules\RuleVocabulary::DEGRADED_FROM`, which is
 * the side that decides what survives a save.
 * `tests/unit/Rules/DegradedMarkerParityTest.php` is what stops the two
 * drifting — a marker the builder wrote under another name would be dropped on
 * the way in, silently, and the note would simply never appear.
 */
export const DEGRADED_FROM = 'degraded_from';

/**
 * What a param takes on screen.
 *
 * Spelled here as well as in the manifest, which is the same duplicate
 * {@link Availability} is: there is nothing else about a control to declare,
 * so a manifest between the two would be a file with one column.
 * `tests/js/builder-controls.test.tsx` is what stops them drifting.
 */
export type Control =
  | 'text'
  | 'text_set'
  | 'seconds'
  | 'percent'
  | 'selector'
  | 'device_set'
  | 'boolean'
  | 'post_id'
  | 'term_id'
  | 'post_type'
  | 'path_glob'
  | 'amount';

export interface RuleParam {
  control: Control;
  label: string;
  /**
   * The merchant fills this in and a [[Playbook]] may not — it names something
   * only one site has (ADR 0012). The builder shows it as an ordinary control;
   * what the flag decides is who may put a value in it, which is settled at
   * Playbook registration.
   */
  authored: boolean;
  /** A closed option set where the param has one, resolved for this install. */
  options: { value: string; label: string }[];
}

/** One legible shortcut over a type's general form. */
export interface RulePreset {
  id: string;
  label: string;
  /** The params it decides, leaving the rest to the merchant. */
  fixed: Record<string, unknown>;
}

export interface RuleType {
  type: string;
  kind: string;
  label: string;
  tier: string;
  availability: Availability;
  params: Record<string, RuleParam>;
  presets: RulePreset[];
}

/** The rule vocabulary, by axis, as `GET /wconvert/v1/rules` resolves it. */
export interface RuleVocabulary {
  targeting: RuleType[];
  triggers: RuleType[];
  conditions: RuleType[];
}

export const getRules = () => apiFetch<RuleVocabulary>({ path: '/wconvert/v1/rules' });

/** One Optin, whole — the working draft the builder edits. */
export interface OptinDraft {
  id: string;
  name: string;
  goal: string;
  config: Record<string, unknown>;
  published_at: string | null;
}

export const getOptin = (id: string) => apiFetch<OptinDraft>({ path: `/wconvert/v1/optins/${id}` });

export const saveOptin = (id: string, name: string, config: Record<string, unknown>) =>
  apiFetch<OptinDraft>({ path: `/wconvert/v1/optins/${id}`, method: 'PATCH', data: { name, config } });

/**
 * The site's own colours and type, as VALUES.
 *
 * Read once, when the merchant asks for them, and copied into the Optin's
 * tokens. Never a link: a stored "inherit from the theme" flag would restyle a
 * running Optin the day the merchant switches theme, which is the surprise
 * ADR 0010 keeps a Template's snapshot away from.
 */
export const getThemeTokens = () => apiFetch<{ tokens: Record<string, string> }>({ path: '/wconvert/v1/theme' });

/** The Optin's own copy of its design, as the builder holds it. */
export type { Template };
