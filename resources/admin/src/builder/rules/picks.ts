import { __, _n, sprintf } from '@wordpress/i18n';
import type { Audience, DisplayPlan, Opening, RuleGroup } from '@loader/display-rules';
import { isFreeInstall, renderingFor, type Availability } from '../../goals/availability';
import { emptyGroup, everyType, freshRule, incompletePlan } from './plan';
import { NUMBER_BOUNDS } from './validation';
import type { DisplayRulesValue } from './summaries';
import type { Frequency, Rule, RuleVocabulary } from '../api';

/**
 * The [[Quick pick]]s — the common answer to each Display rules question, one
 * click away (ADR 0129).
 *
 * ============================================================================
 * A PICK IS A SHAPE, NEVER A REMEMBERED CHOICE.
 * ============================================================================
 * Nothing records which pick a merchant chose. The screen reads the stored
 * value and asks each pick whether it has that pick's shape, so a Campaign a
 * Playbook prefilled, an undo, and a draft from another tab all show the pick
 * they actually hold. A chip reads its real number — "Scrolled [50]% down" —
 * because the shape is `scroll_depth` and the number is the merchant's.
 *
 * The one exception is {@link pickFor}'s sticky rule: while a section is open,
 * an `open` pick the merchant just chose stays chosen even if what they typed
 * comes to match a quick pick. Re-opening the section derives it again.
 *
 * ============================================================================
 * CLIENT-ONLY, AND THE SERVER NO LONGER SHIPS A LIBRARY.
 * ============================================================================
 * This replaced `RuleBundles.php`. A pick writes the same `display_rules`,
 * `targeting`, `frequency` and `schedule` the editors underneath write — every
 * rule through {@see freshRule}, every group through {@see emptyGroup} — so
 * `DisplayPlan.php` validates a pick's output like any other.
 */

export type SectionId = 'where' | 'who' | 'when' | 'how-often' | 'dates';

export const SECTIONS: readonly SectionId[] = ['where', 'who', 'when', 'how-often', 'dates'];

/** The number or selector a chip carries inline, once it is chosen. */
export interface PickParam {
  /** The stored key. Two picks sharing it carry the merchant's number across a switch. */
  readonly key: string;
  readonly kind: 'number' | 'selector';
  readonly min?: number;
  readonly max?: number;
  readonly default: number | string;
  /** Only whole numbers are valid. */
  readonly whole?: boolean;
  /** Out of range is never written: nothing downstream would flag it. */
  readonly strict?: boolean;
  /** The inline control's accessible name. */
  readonly label: () => string;
  /** The value this pick's shape currently holds. */
  readonly read: (value: DisplayRulesValue) => number | string | undefined;
}

export interface Pick {
  readonly id: string;
  /** The chip's words, with `%s` where the inline control sits — in the plural form `n` takes. */
  readonly template: (n?: number) => string;
  /** The chip's words with the stored value filled in — the section's answer. */
  readonly label: (value: DisplayRulesValue) => string;
  /** Its phrase in the summary sentence: lowercase, with its own preposition. Absent where the sentence reads the rules instead. */
  readonly fragment?: (value: DisplayRulesValue) => string;
  readonly matches: (value: DisplayRulesValue) => boolean;
  readonly apply: (value: DisplayRulesValue, n?: number | string) => Partial<DisplayRulesValue>;
  /** The rule types it writes, so its availability can be read. */
  readonly types: readonly string[];
  readonly param?: PickParam;
  /** Shows any value — Custom…, Selected pages, Between two dates. */
  readonly open?: boolean;
}

// ============================================================================
// SHAPES.
// ============================================================================

const planOf = (value: DisplayRulesValue): DisplayPlan => value.display_rules ?? incompletePlan();
const withAudience = (value: DisplayRulesValue, audience: Audience): Partial<DisplayRulesValue> => ({ display_rules: { ...planOf(value), audience } });
const withOpening = (value: DisplayRulesValue, opening: Opening): Partial<DisplayRulesValue> => ({ display_rules: { ...planOf(value), opening } });

/** The audience's one rule, when it is one group holding one rule. */
function onlyAudienceRule(value: DisplayRulesValue): Rule | undefined {
  const audience = value.display_rules?.audience;
  if (audience?.mode !== 'groups' || audience.groups.length !== 1 || audience.groups[0].rules.length !== 1) return undefined;
  return audience.groups[0].rules[0] as Rule;
}

const sameSet = (left: unknown, right: readonly string[]): boolean =>
  Array.isArray(left) && new Set(left).size === right.length && right.every(each => left.includes(each)) && left.every(each => right.includes(each as string));

const oneGroup = (rule: Rule): Audience => ({ mode: 'groups', groups: [{ ...emptyGroup(), rules: [freshRule(rule)] } satisfies RuleGroup] });

/** An automatic opening with no minimum time, holding exactly these rule types in any order. */
function automaticWith(value: DisplayRulesValue, types: readonly string[], match?: 'any'): readonly Rule[] | undefined {
  const opening = value.display_rules?.opening;
  if (opening?.mode !== 'automatic' || (opening.minimum_seconds ?? 0) !== 0 || opening.rules.length !== types.length) return undefined;
  if (match !== undefined && types.length > 1 && opening.match !== match) return undefined;
  const held = opening.rules.map(rule => rule.type);
  return types.every(type => held.includes(type)) && new Set(held).size === held.length ? opening.rules as readonly Rule[] : undefined;
}

const automatic = (rules: readonly Rule[]): Opening => ({ mode: 'automatic', match: 'any', minimum_seconds: 0, rules: rules.map(freshRule) });

const numberOr = (n: number | string | undefined, fallback: number): number => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
/** A template's two halves around its `%s`, with `%%` read as a literal percent sign. */
export const halves = (template: string): readonly [string, string] => {
  const [before, after = ''] = template.split('%s');
  return [before.replaceAll('%%', '%'), after.replaceAll('%%', '%')];
};
const fill = (template: string, value: number | string | undefined): string => halves(template).join(String(value ?? ''));

// ============================================================================
// WHERE DOES IT SHOW?
// ============================================================================

const pageCount = (count: number): string => sprintf(
  /* translators: %d: a number of pages. */
  _n('%d page', '%d pages', count, 'wconvert'), count);
const except = (value: DisplayRulesValue, phrase: string): string => {
  const excluded = value.targeting.exclude?.length ?? 0;
  /* translators: 1: where it shows, e.g. “on every page”. 2: a count of pages, e.g. “2 pages”. */
  return excluded === 0 ? phrase : sprintf(__('%1$s except %2$s', 'wconvert'), phrase, pageCount(excluded));
};
const isBlog = (value: DisplayRulesValue): boolean => {
  const include = value.targeting.include ?? [];
  return include.length === 1 && include[0].type === 'singular' && include[0].value === 'post';
};

function wherePicks(): readonly Pick[] {
  return [
    { id: 'entire', types: [], template: () => __('Entire site', 'wconvert'), label: () => __('Entire site', 'wconvert'),
      fragment: value => except(value, __('on every page', 'wconvert')),
      matches: value => !(value.targeting.include?.length) && value.targeting.mode !== 'selected',
      apply: value => ({ targeting: { ...value.targeting, mode: 'entire', include: [] } }) },
    { id: 'blog', types: ['singular'], template: () => __('Blog posts only', 'wconvert'), label: () => __('Blog posts only', 'wconvert'),
      fragment: value => except(value, __('on blog posts', 'wconvert')),
      matches: isBlog,
      apply: value => ({ targeting: { ...value.targeting, mode: 'selected', include: [{ type: 'singular', value: 'post' }] } }) },
    { id: 'selected', open: true, types: [], template: () => __('Selected pages', 'wconvert'), label: () => __('Selected pages', 'wconvert'),
      fragment: value => {
        const included = value.targeting.include?.length ?? 0;
        /* translators: %d: a number of pages. */
        return except(value, included === 0 ? __('on pages you have not chosen yet', 'wconvert') : sprintf(_n('on %d selected page', 'on %d selected pages', included, 'wconvert'), included));
      },
      matches: () => true,
      apply: value => ({ targeting: { ...value.targeting, mode: 'selected' } }) },
  ];
}

// ============================================================================
// WHO SEES IT?
// ============================================================================

function audiencePick(id: string, label: () => string, fragment: () => string, rule: Rule, held: (rule: Rule) => boolean): Pick {
  return { id, types: [rule.type], template: label, label, fragment,
    matches: value => { const only = onlyAudienceRule(value); return only !== undefined && only.type === rule.type && held(only); },
    apply: value => withAudience(value, oneGroup(rule)) };
}

function whoPicks(): readonly Pick[] {
  return [
    { id: 'everyone', types: [], template: () => __('Everyone', 'wconvert'), label: () => __('Everyone', 'wconvert'), fragment: () => __('to everyone', 'wconvert'),
      matches: value => value.display_rules?.audience.mode === 'everyone',
      apply: value => withAudience(value, { mode: 'everyone' }) },
    audiencePick('phones', () => __('Phones only', 'wconvert'), () => __('to visitors on phones', 'wconvert'), { type: 'device', in: ['mobile'] }, rule => sameSet(rule.in, ['mobile'])),
    audiencePick('computers', () => __('Computers only', 'wconvert'), () => __('to visitors on computers', 'wconvert'), { type: 'device', in: ['desktop'] }, rule => sameSet(rule.in, ['desktop'])),
    audiencePick('signed-in', () => __('Signed-in visitors', 'wconvert'), () => __('to signed-in visitors', 'wconvert'), { type: 'logged_in', value: true }, rule => rule.value === true),
    audiencePick('signed-out', () => __('Signed-out visitors', 'wconvert'), () => __('to signed-out visitors', 'wconvert'), { type: 'logged_in', value: false }, rule => rule.value === false),
    audiencePick('cart', () => __('Shoppers with items in their cart', 'wconvert'), () => __('to shoppers with items in their cart', 'wconvert'), { type: 'cart_has_items' }, () => true),
    { id: 'custom', open: true, types: [], template: () => __('Custom…', 'wconvert'), label: () => __('Custom', 'wconvert'),
      matches: () => true,
      apply: value => value.display_rules?.audience.mode === 'groups' ? {} : withAudience(value, { mode: 'groups', groups: [emptyGroup()] }) },
  ];
}

// ============================================================================
// WHEN DOES IT OPEN?
// ============================================================================

const seconds = (label: () => string, fallback: number): Omit<PickParam, 'read'> => ({ key: 'seconds', kind: 'number', ...NUMBER_BOUNDS.seconds, default: fallback, label });

function whenPicks(): readonly Pick[] {
  const readOf = (type: string, key: string) => (value: DisplayRulesValue) => automaticWith(value, [type])?.[0]?.[key] as number | undefined;
  const after = { ...seconds(() => __('Seconds before it opens', 'wconvert'), 15), read: readOf('time_on_page', 'seconds') };
  const scroll: PickParam = { key: 'percent', kind: 'number', ...NUMBER_BOUNDS.percent, default: 50, label: () => __('Percent of the page', 'wconvert'), read: readOf('scroll_depth', 'percent') };
  const pause = { ...seconds(() => __('Seconds without activity', 'wconvert'), 30), read: readOf('inactivity', 'seconds') };
  const clickRule = (value: DisplayRulesValue): Rule | undefined => {
    const opening = value.display_rules?.opening;
    return opening?.mode === 'click' && opening.rules.length === 1 && opening.rules[0].type === 'click_element' ? opening.rules[0] as Rule : undefined;
  };
  const click: PickParam = { key: 'selector', kind: 'selector', default: '', label: () => __('CSS selector of the button or link', 'wconvert'), read: value => clickRule(value)?.selector as string | undefined };
  const count = (param: PickParam, value: DisplayRulesValue): number => Number(param.read(value) ?? param.default);
  const numbered = (id: string, type: string, param: PickParam, template: (n: number) => string, fragment: (n: number) => string): Pick => ({
    id, types: [type], param, template: n => template(n ?? Number(param.default)),
    label: value => fill(template(count(param, value)), param.read(value)), fragment: value => fill(fragment(count(param, value)), param.read(value)),
    matches: value => automaticWith(value, [type]) !== undefined,
    // Editing the number keeps the rule, and its id; arriving from another pick writes a fresh one.
    apply: (value, n) => {
      const held = automaticWith(value, [type])?.[0];
      const next = numberOr(n, param.default as number);
      return withOpening(value, held ? { mode: 'automatic', match: 'any', minimum_seconds: 0, rules: [{ ...held, [param.key]: next }] } : automatic([{ type, [param.key]: next }]));
    },
  });
  const gesture = (id: string, types: readonly string[], label: () => string, fragment: () => string): Pick => ({
    id, types, template: label, label, fragment,
    matches: value => automaticWith(value, types, 'any') !== undefined,
    apply: value => withOpening(value, automatic(types.map(type => ({ type })))),
  });

  return [
    { id: 'immediate', types: ['page_load'], template: () => __('Right away', 'wconvert'), label: () => __('Right away', 'wconvert'), fragment: () => __('right away', 'wconvert'),
      matches: value => value.display_rules?.opening.mode === 'immediate',
      apply: value => withOpening(value, { mode: 'immediate' }) },
    numbered('after', 'time_on_page', after,
      /* translators: %s: a number of seconds, shown as a field. */
      n => _n('After %s second', 'After %s seconds', n, 'wconvert'),
      /* translators: %s: a number of seconds. */
      n => _n('after %s second', 'after %s seconds', n, 'wconvert')),
    numbered('scrolled', 'scroll_depth', scroll,
      /* translators: %s: a percentage of the page, shown as a field. Write %% for a literal percent sign. */
      () => __('Scrolled %s%% down', 'wconvert'),
      /* translators: %s: a percentage of the page. Write %% for a literal percent sign. */
      () => __('once they scroll %s%% down', 'wconvert')),
    numbered('pause', 'inactivity', pause,
      /* translators: %s: a number of seconds, shown as a field; “s” abbreviates seconds. */
      () => __('When they pause for %s s', 'wconvert'),
      /* translators: %s: a number of seconds. */
      n => _n('when they pause for %s second', 'when they pause for %s seconds', n, 'wconvert')),
    gesture('leave', ['exit_intent'], () => __('When they try to leave', 'wconvert'), () => __('when they try to leave', 'wconvert')),
    gesture('leave-or-scroll-up', ['exit_intent', 'scroll_up'], () => __('Leaving or scrolling back up', 'wconvert'), () => __('when they leave or scroll back up', 'wconvert')),
    { id: 'click', types: ['click_element'], param: click,
      /* translators: %s: a CSS selector, shown as a field. */
      template: () => __('When they click %s', 'wconvert'),
      label: value => clickRule(value)?.selector
        /* translators: %s: a CSS selector, e.g. “.offer-button”. */
        ? fill(__('When they click %s', 'wconvert'), click.read(value)) : __('When they click a button', 'wconvert'),
      fragment: value => clickRule(value)?.selector
        /* translators: %s: a CSS selector, e.g. “.offer-button”. */
        ? fill(__('when they click %s', 'wconvert'), click.read(value)) : __('when they click a button', 'wconvert'),
      matches: value => clickRule(value) !== undefined,
      apply: (value, n) => {
        const held = clickRule(value);
        const selector = typeof n === 'string' ? n : '';
        return withOpening(value, { mode: 'click', rules: [held ? { ...held, selector } : freshRule({ type: 'click_element', selector })] });
      } },
    { id: 'custom', open: true, types: [], template: () => __('Custom…', 'wconvert'), label: () => __('Custom', 'wconvert'),
      matches: () => true, apply: () => ({}) },
  ];
}

// ============================================================================
// HOW OFTEN?
// ============================================================================

/**
 * A pacing pick changes only the pacing keys. `stopAfterDismiss` and
 * `stopAfterConversion` keep their values whatever is chosen.
 */
function paced(value: DisplayRulesValue, set: Partial<Frequency>, dropOnce: boolean): Partial<DisplayRulesValue> {
  const next: Frequency = { ...value.frequency };
  delete next.maxPerSession;
  delete next.cooldownDays;
  if (dropOnce && next.maxImpressions === 1) delete next.maxImpressions;
  return { frequency: { ...next, ...set } };
}

function howOftenPicks(): readonly Pick[] {
  const pacing = (value: DisplayRulesValue) => value.frequency;
  const onceEver = (value: DisplayRulesValue) => pacing(value).maxImpressions === 1 && pacing(value).maxPerSession === undefined && pacing(value).cooldownDays === undefined;
  const days: PickParam = { key: 'cooldownDays', kind: 'number', min: 1, max: 3650, whole: true, default: 7, strict: true, label: () => __('Days between showings', 'wconvert'), read: value => pacing(value).cooldownDays };
  const dayCount = (value: DisplayRulesValue) => pacing(value).cooldownDays ?? 7;

  return [
    { id: 'session', types: [], template: () => __('Once per visit', 'wconvert'), label: () => __('Once per visit', 'wconvert'), fragment: () => __('once per visit', 'wconvert'),
      matches: value => pacing(value).maxPerSession === 1 && pacing(value).cooldownDays === undefined,
      apply: value => paced(value, { maxPerSession: 1 }, onceEver(value)) },
    { id: 'days', types: [], param: days,
      /* translators: %s: a number of days, shown as a field. */
      template: n => _n('Once every %s day', 'Once every %s days', n ?? 7, 'wconvert'),
      /* translators: %s: a number of days. */
      label: value => fill(_n('Once every %s day', 'Once every %s days', dayCount(value), 'wconvert'), days.read(value)),
      /* translators: %s: a number of days. */
      fragment: value => fill(_n('at most once every %s day', 'at most once every %s days', dayCount(value), 'wconvert'), days.read(value)),
      matches: value => pacing(value).cooldownDays !== undefined && pacing(value).maxPerSession === undefined,
      apply: (value, n) => paced(value, { cooldownDays: numberOr(n, 7) }, onceEver(value)) },
    { id: 'once', types: [], template: () => __('Only once ever', 'wconvert'), label: () => __('Only once ever', 'wconvert'), fragment: () => __('only once ever', 'wconvert'),
      matches: onceEver,
      apply: value => paced(value, { maxImpressions: 1 }, false) },
    { id: 'every', types: [], template: () => __('Every page they see', 'wconvert'), label: () => __('Every page they see', 'wconvert'), fragment: () => __('on every page they see', 'wconvert'),
      matches: value => pacing(value).maxPerSession === undefined && pacing(value).cooldownDays === undefined && pacing(value).maxImpressions !== 1,
      // Its own shape forbids a total of one, so it drops that too.
      apply: value => paced(value, {}, true) },
    { id: 'custom', open: true, types: [], template: () => __('Custom…', 'wconvert'), label: () => __('Custom', 'wconvert'),
      matches: () => true, apply: () => ({}) },
  ];
}

// ============================================================================
// DATES.
// ============================================================================

function datePicks(): readonly Pick[] {
  return [
    { id: 'until-paused', types: [], template: () => __('Until you pause it', 'wconvert'), label: () => __('Until you pause it', 'wconvert'),
      matches: value => !value.schedule.starts_at && !value.schedule.ends_at,
      apply: () => ({ schedule: {} }) },
    { id: 'between', open: true, types: [], template: () => __('Between two dates', 'wconvert'), label: () => __('Between two dates', 'wconvert'),
      matches: () => true, apply: () => ({}) },
  ];
}

// ============================================================================
// READING THEM.
// ============================================================================

/** The picks for one section, in screen order. Built at call time, because `__()` needs the dictionary loaded. */
export function picksIn(section: SectionId): readonly Pick[] {
  switch (section) {
    case 'where': return wherePicks();
    case 'who': return whoPicks();
    case 'when': return whenPicks();
    case 'how-often': return howOftenPicks();
    case 'dates': return datePicks();
  }
}

export interface PickAvailability {
  readonly availability: Availability;
  /** The tier that locks it, for the badge. */
  readonly tier?: string;
  /** The plugin it needs, where that is why it cannot run. */
  readonly requires_label: string | null;
}

const RANK: Record<Availability, number> = { ready: 0, locked: 1, unavailable: 2 };

/**
 * The least available of a pick's rule types. `unavailable` outranks `locked`.
 *
 * Except on a free install, where a paid type is `locked` whatever else is
 * missing: free draws nothing it cannot run (ADR 0116), so a cart pick is not
 * offered as "Needs WooCommerce" to a site that could not run it with it.
 */
export function availabilityOf(pick: Pick, vocabulary: RuleVocabulary): PickAvailability {
  const all = everyType(vocabulary);
  const free = isFreeInstall();
  let least: PickAvailability = { availability: 'ready', requires_label: null };
  for (const name of pick.types) {
    const type = all.find(each => each.type === name);
    const here: PickAvailability = type === undefined
      ? { availability: 'unavailable', requires_label: null }
      : free && type.tier !== 'free' && type.availability !== 'ready'
        ? { availability: 'locked', tier: type.tier, requires_label: null }
        : { availability: type.availability, tier: type.tier, requires_label: type.availability === 'unavailable' ? type.requires_label : null };
    if (free && here.availability === 'locked') return here;
    if (RANK[here.availability] > RANK[least.availability]) least = here;
  }
  return least;
}

/**
 * The pick a stored value has the shape of.
 *
 * Never one this site cannot offer — hidden on Free, locked after a downgrade,
 * or waiting on a plugin. That reads as the section's open pick instead, so the
 * stored rule stays on screen with its own row explaining why it will not run.
 */
export function derive(section: SectionId, value: DisplayRulesValue, vocabulary: RuleVocabulary): Pick {
  const picks = picksIn(section);
  const open = picks.find(pick => pick.open)!;
  const found = picks.find(pick => !pick.open && pick.matches(value)) ?? open;
  return renderingFor(availabilityOf(found, vocabulary).availability, 'settings_list') === 'offer' ? found : open;
}

/**
 * The pick to show as chosen.
 *
 * `chosen` is the pick the merchant last clicked while this section has been
 * open. It stays if it is open or still matches; otherwise the value decides.
 */
export function pickFor(section: SectionId, value: DisplayRulesValue, vocabulary: RuleVocabulary, chosen?: string | null): Pick {
  const kept = chosen ? picksIn(section).find(pick => pick.id === chosen) : undefined;
  return kept !== undefined && (kept.open || kept.matches(value)) ? kept : derive(section, value, vocabulary);
}

/**
 * Switching from one pick to another. The merchant's number carries over when
 * both picks store it under the same key; otherwise the new pick's default.
 */
export function switchPick(from: Pick | undefined, to: Pick, value: DisplayRulesValue): Partial<DisplayRulesValue> {
  const carried = from?.param !== undefined && to.param !== undefined && from.param.key === to.param.key && from.param.kind === to.param.kind
    ? from.param.read(value) : undefined;
  return to.apply(value, carried ?? to.param?.default);
}
