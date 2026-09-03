import apiFetch from '@wordpress/api-fetch';
import type { Template } from '@renderer/types';
import type { Availability } from '../goals/availability';
import type { OptinState } from '../optins/api';

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
  | 'referrer_set'
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
  /**
   * The preset read inside a sentence, or **null where it offers none** — in
   * which case the summary falls back to its type's phrase with the fixed
   * values substituted back in, which reads correctly.
   *
   * Its placeholders are the params the preset does NOT fix, in declared
   * order. That is what makes a preset a shortcut rather than a second
   * spelling of its type: *"after a few seconds"* rather than *"after 5
   * seconds on the page"*, which is the general form with extra steps.
   */
  phrase: string | null;
  /** The params it decides, leaving the rest to the merchant. */
  fixed: Record<string, unknown>;
}

export interface RuleType {
  type: string;
  kind: string;
  label: string;
  /**
   * The same rule read INSIDE a sentence — "after %1$s seconds on the page"
   * where {@link label} says "Time on the page".
   *
   * A second word for one rule rather than a transformation of the first,
   * because neither can be derived from the other in any language: a name is a
   * heading over a control and a phrase is a clause in a summary, and
   * substituting one for the other produces "Fires Time on the page". Both are
   * `WConvert\Rules\RuleLabels`', where `wp i18n make-pot` can see them.
   *
   * A Targeting type's phrase falls back to its name, because the Where
   * section summarises itself by counting rather than by reading them.
   */
  phrase: string;
  tier: string;
  availability: Availability;
  /**
   * What the SITE is missing, in words — and **null unless that is why this
   * type is absent**. `locked` reads null here, because the cause is then the
   * tier and the tier is ours to sell (ADR 0026).
   *
   * The rules panel is a settings list, so it EXPLAINS the gap rather than
   * hiding it — and an explanation that cannot name the missing plugin leaves
   * a merchant who deactivated WooCommerce to guess which of their plugins did
   * it. `WConvert\Optin\Suspension` already names it on the Optin list; this
   * is what stops the two screens disagreeing.
   */
  requires_label: string | null;
  params: Record<string, RuleParam>;
  presets: RulePreset[];
}

/**
 * One [[Starting point]]: a named set of rules to begin from.
 *
 * **Not a preset.** `preset` already means a per-type shortcut on this very
 * screen ({@link RulePreset}), and two meanings of one word is what the
 * glossary exists to prevent.
 *
 * **It carries exactly the sections it fills**, so "applying replaces the axes
 * it names" is readable off the response: a bundle with no `triggers` key
 * leaves the merchant's Triggers alone, which is what stops a starting point
 * from landing an Optin that can never fire.
 */
export interface RuleBundle {
  id: string;
  label: string;
  description: string;
  availability: Availability;
  requires_label: string | null;
  triggers?: Rule[];
  conditions?: Rule[];
  targeting?: Targeting;
  frequency?: Frequency;
}

/** The rule vocabulary, by axis, as `GET /wconvert/v1/rules` resolves it. */
export interface RuleVocabulary {
  targeting: RuleType[];
  triggers: RuleType[];
  conditions: RuleType[];
  bundles: RuleBundle[];
}

/**
 * *Where* an Optin is allowed to appear, as it is stored.
 *
 * Two lists of page rules with exclude beating include, plus one visitor
 * predicate held APART from them: an include list is a union of page SETS, so
 * a visitor rule dropped into it would widen the Optin to the whole site for
 * anyone matching it. Read whole, the axis is `page-set AND logged_in`
 * (ADR 0005). Mirrors `WConvert\Targeting\Targeting`.
 */
export interface Targeting {
  include?: { type: string; value: unknown }[];
  exclude?: { type: string; value: unknown }[];
  logged_in?: boolean;
}

/**
 * The allowance — how often this device may be shown the Optin at all.
 *
 * ============================================================================
 * ONE SHAPE IN THREE LANGUAGES, AND A TEST HOLDS THEM TOGETHER.
 * ============================================================================
 * `resources/loader/src/types.ts` declares it for the engine that reads it,
 * `src/Optin/Frequency.php` normalises it on the way in, and this is the
 * surface that writes it. Same four names in the same casing, because the
 * payload is inlined into every matching page verbatim — a translation layer
 * between any two of them would be a second vocabulary.
 *
 * `tests/js/builder-frequency.test.ts` asserts the three agree.
 *
 * **The two switches default TRUE and `true` is never stored.** `frequency.ts`
 * tests `!== false`, so an absent key and a stored `true` are the same answer
 * and only one of them costs bytes on every page view.
 */
export interface Frequency {
  maxImpressions?: number;
  cooldownDays?: number;
  stopAfterDismiss?: boolean;
  stopAfterConversion?: boolean;
}

/**
 * *When* it runs — the merchant's own local date and time, never an instant.
 *
 * ============================================================================
 * ONE NAME, TWO REPRESENTATIONS, AND ONE CONVERTER BETWEEN THEM.
 * ============================================================================
 * `starts_at` and `ends_at` are the same two keys the payload carries, and
 * they hold something different there: **this is the wall time the merchant
 * typed** (`2026-11-27 09:00`, no zone on it) and the payload's are absolute
 * instants in milliseconds, resolved once by `PublishedProjection` against
 * `wp_timezone()`.
 *
 * The asymmetry is the feature rather than an oversight. A wall time is the
 * only thing a merchant can reason about, and storing the resolved instant
 * would freeze it against whatever timezone the site was on the day they
 * pressed Publish — so correcting the site timezone afterwards would leave
 * every schedule an hour out with nothing on any screen to say why. Storing
 * the wall time means the answer is recomputed on every rebuild.
 *
 * The other direction is just as load-bearing: sending the browser a wall time
 * would make one schedule mean a different moment in every visitor's browser,
 * because the visitor's clock is not the site's clock.
 *
 * `src/Optin/Schedule.php` is the one converter, and it is also what refuses
 * an end at or before its start — `tests/js/builder-schedule.test.ts` holds
 * the three spellings together.
 */
export interface Schedule {
  starts_at?: string;
  ends_at?: string;
}

/**
 * The two field names, as a value rather than only as a type — the same
 * arrangement {@link FREQUENCY_FIELDS} has, and for its reason: an interface
 * is erased at build, so nothing could assert it against the loader's
 * declaration or PHP's.
 */
export const SCHEDULE_FIELDS = ['starts_at', 'ends_at'] as const;

/**
 * The four field names, as a value rather than only as a type.
 *
 * A TypeScript interface is erased at build, so nothing could assert it
 * against the loader's declaration or PHP's. This is what the parity test
 * reads.
 */
export const FREQUENCY_FIELDS = [
  'maxImpressions',
  'cooldownDays',
  'stopAfterDismiss',
  'stopAfterConversion',
] as const;

export const getRules = () => apiFetch<RuleVocabulary>({ path: '/wconvert/v1/rules' });

/**
 * One Optin, whole — the working draft the builder edits.
 *
 * **It extends {@link OptinState}, which is what lets the editor say whether
 * this Optin is on the site.** `published_at` cannot answer that on its own: a
 * [[Suspended]] Optin *is* published and is on no page at all, so a readiness
 * panel reading the column would print *"Live"* over an Optin the site is
 * holding back. `OptinController::show()` resolves the sentence off the same
 * published set the list reads, so the two screens cannot disagree about one
 * campaign.
 */
export interface OptinDraft extends OptinState {
  id: string;
  name: string;
  goal: string;
  config: Record<string, unknown>;
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
/** One family the SITE declares, as the font picker offers it. */
export interface SiteFont {
  /** The theme's own name for it — a proper noun, and deliberately untranslated. */
  readonly label: string;
  /** What is STORED: a stack the site already serves. */
  readonly stack: string;
}

export const getThemeTokens = () =>
  apiFetch<{ tokens: Record<string, string>; fonts?: readonly SiteFont[] }>({
    path: '/wconvert/v1/theme',
  });

/** The Optin's own copy of its design, as the builder holds it. */
export type { Template };
