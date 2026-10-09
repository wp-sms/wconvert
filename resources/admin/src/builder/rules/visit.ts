import { __, _n, sprintf } from '@wordpress/i18n';
import { audienceMatches, type Answer, type Opening } from '../../../../loader/src/display-rules';
import type { Frequency, OptinRecord, Rule } from '@loader/types';
import { isAllowed } from '../../../../loader/src/frequency';
import { inside, minutesIn } from '../../../../loader/src/modules/time-of-day';
import { adminSettings } from '../../settings';
import { readable, wallKey, wallNow } from '../../lib/wallTime';
import type { ConvertingAct } from '../structure/catalogue';
import { derive, type SectionId } from './picks';
import { sentenceParts } from './sentence';
import { targetingSummary } from './targetingSummary';
import { summarise, summaryOf, type DisplayRulesValue } from './summaries';
import type { RuleVocabulary, Schedule, Targeting } from '../api';

/**
 * Test a visit — one described visitor, read against the five questions.
 *
 * Pure, and it reads the visitor with the loader's own functions wherever the
 * loader has one, so the answer here is the answer a real page would give.
 * Nothing is stored and nothing is measured: timing is described, never
 * simulated (ADR 0129).
 */

/** The visitor, as described — every fact a rule on this campaign could ask about. */
export interface Visitor {
  /** A {@see PageChoice} value. */
  readonly page: string;
  readonly device: 'mobile' | 'tablet' | 'desktop';
  readonly signedIn: boolean;
  readonly role?: string;
  /** `search`, `social`, `direct`, a domain a referrer rule names, or `elsewhere`. */
  readonly source?: string;
  /** The page address's query string, with or without its `?`. */
  readonly query?: string;
  /** `HH:MM` on the site's clock. */
  readonly clock?: string;
  readonly adBlocking?: 'yes' | 'no' | 'unknown';
  readonly history: 'new' | 'this-visit' | 'days-ago' | 'closed' | 'converted';
  readonly daysAgo?: number;
  /** `YYYY-MM-DD HH:mm` on the site's clock; absent means now. */
  readonly date?: string;
  /** A plain yes or no, by rule id, for a rule with no natural field. */
  readonly answers?: Readonly<Record<string, boolean>>;
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value : [value])
  .filter((each): each is string => typeof each === 'string' && each !== '');

/**
 * One audience rule, answered for this visitor — the loader's reading where it
 * has one. A cart rule is the basket check's answer, by rule id.
 */
export function readRule(rule: Rule, visitor: Visitor, cart: Readonly<Record<string, Answer>> = {}): Answer {
  switch (rule.type) {
    case 'device': return strings(rule.in).includes(visitor.device);
    case 'logged_in': return rule.value === visitor.signedIn;
    // A role is a signed-in visitor's; the server never reads one off a guest.
    case 'role': return visitor.signedIn && visitor.role !== undefined && strings(rule.value).includes(visitor.role);
    case 'referrer': return visitor.source !== undefined && strings(rule.in).includes(visitor.source);
    case 'query_param': {
      const key = typeof rule.key === 'string' ? rule.key.trim() : '';
      const found = key === '' ? null : new URLSearchParams(visitor.query ?? '').get(key);
      const wanted = strings(rule.value);
      return found !== null && (wanted.length === 0 || wanted.includes(found));
    }
    case 'time_of_day': {
      const at = minutesIn(visitor.clock ?? '');
      return at !== null && inside(String(rule.between ?? ''), at);
    }
    case 'ad_blocking': return visitor.adBlocking !== undefined && visitor.adBlocking !== 'unknown'
      && rule.value === (visitor.adBlocking === 'yes' ? 'detected' : 'not_detected');
  }
  if (rule.type.startsWith('cart_')) return cart[String(rule.id)] ?? false;
  return visitor.answers?.[String(rule.id)] ?? false;
}

/** What stopped another showing, in the order the loader asks. */
export type PacingStop = 'converted' | 'dismissed' | 'impressions' | 'cooldown' | 'session';

/** Any day will do: only the distance to the last impression is ever read. */
const TODAY = 20_000;

/**
 * May this visitor be shown it again? Null where they may.
 *
 * The verdict is the loader's own {@see isAllowed} over the record this
 * history would have left, plus the per-visit cap `decide.ts` checks beside
 * it. A click skips the automatic pacing and keeps the conversion stop
 * (ADR 0104). The stop is named afterwards, only to say which one it was.
 */
export function paced(frequency: Frequency, history: Visitor['history'], daysAgo: number | undefined, mode: 'immediate' | 'automatic' | 'click'): PacingStop | null {
  const record: OptinRecord | undefined = history === 'new' ? undefined
    : history === 'this-visit' ? { i: 1, l: TODAY }
      : history === 'days-ago' ? { i: 1, l: TODAY - Math.max(0, daysAgo ?? 0) }
        : history === 'closed' ? { i: 1, d: 1 } : { i: 1, c: 1 };
  const converted = frequency.stopAfterConversion !== false && record?.c === 1;
  if (mode === 'click') return converted ? 'converted' : null;
  const session = history === 'this-visit' && frequency.maxPerSession !== undefined && frequency.maxPerSession <= 1;
  if (isAllowed(frequency, record, TODAY) && !session) return null;
  if (converted) return 'converted';
  if (frequency.stopAfterDismiss !== false && record?.d === 1) return 'dismissed';
  if (frequency.maxImpressions !== undefined && (record?.i ?? 0) >= frequency.maxImpressions) return 'impressions';
  return session ? 'session' : 'cooldown';
}

/**
 * Is the campaign running at this wall time? Start inclusive, end exclusive —
 * the loader's reading of the instants the server resolves these to.
 */
export function inWindow(schedule: Schedule, wallTime: string): boolean {
  const at = wallKey(wallTime);
  const from = wallKey(schedule.starts_at);
  const until = wallKey(schedule.ends_at);
  return at !== null && (from === null || at >= from) && (until === null || at < until);
}

/**
 * Leaving can't be detected on a touch screen, so a campaign that needs it
 * never opens there — where it is the only way in, or one that must happen.
 */
export function touchBlocked(opening: Opening, device: Visitor['device']): boolean {
  if (device === 'desktop' || opening.mode !== 'automatic' || opening.rules.length === 0) return false;
  const leaving = (rule: Rule) => rule.type === 'exit_intent';
  return opening.match === 'all' ? opening.rules.some(leaving) : opening.rules.every(leaving);
}

/** One page the visitor could be on, and whether Where lets it in. */
export interface PageChoice {
  readonly value: string;
  readonly label: string;
  readonly admitted: boolean;
}

type PageRule = NonNullable<Targeting['include']>[number];

/** A page rule in the tab’s words — “A blog post”, “/sale/”, “Posts: Recipes”. */
function pageLabel(rule: PageRule, vocabulary: RuleVocabulary): string {
  if (rule.type === 'singular' && rule.value === 'post') return __('A blog post', 'wconvert');
  const control = vocabulary.targeting.find(type => type.type === rule.type)?.params.value?.control;
  if (control === 'path_glob' && typeof rule.value === 'string' && rule.value.trim() !== '') return rule.value.trim();
  return targetingSummary({ include: [rule] }, vocabulary.targeting, 'review');
}

/**
 * The pages worth testing: one per *Show it on* rule, one per *But never on*
 * rule, and every other page — which is in only where the whole site is.
 */
export function pageChoices(value: DisplayRulesValue, vocabulary: RuleVocabulary): readonly PageChoice[] {
  const { include = [], exclude = [] } = value.targeting;
  const everywhere = derive('where', value, vocabulary).id === 'entire';
  return [
    ...include.map((rule, index) => ({ value: `in:${index}`, label: pageLabel(rule, vocabulary), admitted: true })),
    ...exclude.map((rule, index) => ({ value: `out:${index}`, admitted: false, label: sprintf(
      /* translators: %s: a page the campaign is kept off, e.g. “/checkout/*”. */
      __('Excluded: %s', 'wconvert'), pageLabel(rule, vocabulary)) })),
    { value: 'other', admitted: everywhere,
      label: include.length || exclude.length ? __('Any other page', 'wconvert') : __('Any page', 'wconvert') },
  ];
}

/** What happened before this visit, in the visitor field's words. */
export function historyLabel(history: Visitor['history'], daysAgo: number | undefined, act: ConvertingAct = 'submit'): string {
  switch (history) {
    case 'new': return __('First time here', 'wconvert');
    case 'this-visit': return __('Saw it earlier this visit', 'wconvert');
    /* translators: %d: a number of days. */
    case 'days-ago': return sprintf(_n('Saw it %d day ago', 'Saw it %d days ago', daysAgo ?? 1, 'wconvert'), daysAgo ?? 1);
    case 'closed': return __('Closed it before', 'wconvert');
    case 'converted': return act === 'click' ? __('Clicked the main button before', 'wconvert')
      : act === 'add_to_cart' ? __('Added it to their cart before', 'wconvert') : __('Signed up before', 'wconvert');
  }
}

/** One of the five questions, as this visitor answered it. */
export interface Check {
  readonly section: SectionId;
  /** `info` describes rather than checks — When, which is never simulated. */
  readonly status: 'pass' | 'fail' | 'info';
  readonly text: string;
}

export interface VisitResult {
  readonly opens: boolean;
  /** The basket is still being checked, so Who has no answer yet. */
  readonly checking?: boolean;
  readonly headline: string;
  /** Why it doesn't open, in one plain sentence. */
  readonly reason?: string;
  readonly checks: readonly Check[];
}

/** The server's answer for the sample basket, where this campaign reads one. */
export interface BasketCheck {
  readonly status: 'unused' | 'checking' | 'pass' | 'fail';
  readonly reason?: string;
  /** Each cart rule's answer, by rule id. */
  readonly answers?: Readonly<Record<string, Answer>>;
}

/** Who a quick pick is for, said as the reason a visitor is not. */
function audienceReason(pick: string): string | null {
  switch (pick) {
    case 'phones': return __('This campaign is for phones only.', 'wconvert');
    case 'computers': return __('This campaign is for computers only.', 'wconvert');
    case 'signed-in': return __('This campaign is for signed-in visitors only.', 'wconvert');
    case 'signed-out': return __('This campaign is for signed-out visitors only.', 'wconvert');
    case 'cart': return __('This campaign is for shoppers with items in their cart.', 'wconvert');
    default: return null;
  }
}

function pacingReason(stop: PacingStop, often: string, act: ConvertingAct): string {
  switch (stop) {
    /* translators: %s: how often it shows, e.g. “Once per visit”. */
    case 'session': return sprintf(__('They already saw it this visit (%s).', 'wconvert'), often);
    /* translators: %s: how often it shows, e.g. “Once every 7 days”. */
    case 'cooldown': return sprintf(__('They saw it too recently (%s).', 'wconvert'), often);
    /* translators: %s: how often it shows, e.g. “Only once ever”. */
    case 'impressions': return sprintf(__('They have already seen it (%s).', 'wconvert'), often);
    case 'dismissed': return __('It stops showing after they close it.', 'wconvert');
    case 'converted': return act === 'click' ? __('It stops showing after they click the main button.', 'wconvert')
      : act === 'add_to_cart' ? __('It stops showing after they add it to their cart.', 'wconvert') : __('It stops showing after they sign up.', 'wconvert');
  }
}

/**
 * Would this visitor see it, and when?
 *
 * The five questions in screen order; the first that fails decides it and
 * gives the one reason. When only describes: timing is not simulated, so a
 * campaign that passes "opens" with the sentence's own When phrase — except
 * where leaving is the only way in on a touch screen, which can never happen.
 */
export function checkVisit(value: DisplayRulesValue, vocabulary: RuleVocabulary, visitor: Visitor,
  basket: BasketCheck = { status: 'unused' }, act: ConvertingAct = 'submit'): VisitResult {
  const plan = value.display_rules;
  const summaries = summarise(value, vocabulary);
  const reasons: string[] = [];
  const fail = (reason: string) => { reasons.push(reason); return 'fail' as const; };

  const pages = pageChoices(value, vocabulary);
  const page = pages.find(choice => choice.value === visitor.page) ?? pages[pages.length - 1];
  const excluded = /^out:(\d+)$/.exec(page.value);
  const where = page.admitted ? 'pass' : fail(excluded
    /* translators: %s: the page it is kept off, e.g. “/checkout/*”. */
    ? sprintf(__('%s is excluded.', 'wconvert'), pageLabel(value.targeting.exclude![Number(excluded[1])], vocabulary))
    : (value.targeting.include ?? []).length ? __('It only shows on the pages you chose.', 'wconvert') : __('Choose at least one page for it to show on.', 'wconvert'));

  const { logged_in: signedIn, roles } = value.targeting;
  const audience = !plan ? false : audienceMatches(plan.audience, rule => readRule(rule, visitor, basket.answers));
  const account = (signedIn === undefined || signedIn === visitor.signedIn)
    && (roles === undefined || (visitor.signedIn && visitor.role !== undefined && roles.includes(visitor.role)));
  const who = !plan ? fail(__('Set up your display rules before testing a visit.', 'wconvert'))
    // Who is unanswered until the basket is; nothing after it decides first.
    : basket.status === 'checking' ? 'info'
    : basket.status === 'fail' ? fail(basket.reason ?? '')
      : audience === 'blocked' ? fail(__('This visitor hasn’t given the consent these rules need.', 'wconvert'))
        : audience !== true || !account ? fail(audienceReason(derive('who', value, vocabulary).id) ?? sprintf(
          /* translators: %s: who sees it, e.g. “Phones only”. */
          __('This visitor isn’t in the audience: %s.', 'wconvert'), summaryOf(summaries, 'who').text))
          : 'pass';

  const opening = plan?.opening;
  const unset = opening !== undefined && opening.mode !== 'immediate' && opening.rules.length === 0;
  const touch = opening !== undefined && touchBlocked(opening, visitor.device);
  if (plan && unset) reasons.push(__('Choose when it opens.', 'wconvert'));
  if (touch) reasons.push(__('Leaving can’t be detected on touch screens. Add “Leaving or scrolling back up”.', 'wconvert'));

  const stop = paced(value.frequency, visitor.history, visitor.daysAgo, opening?.mode ?? 'automatic');
  const often = stop === null ? 'pass' : fail(pacingReason(stop, summaryOf(summaries, 'how-often').text, act));

  const scheduled = !!value.schedule.starts_at || !!value.schedule.ends_at;
  const date = visitor.date ?? wallNow(adminSettings()?.timezone);
  const dates = !scheduled || inWindow(value.schedule, date) ? 'pass' : fail(__('It isn’t running on that date.', 'wconvert'));

  const checks: Check[] = [
    { section: 'where', status: where, text: page.label },
    { section: 'who', status: who, text: summaryOf(summaries, 'who').text },
    { section: 'when', status: 'info', text: summaryOf(summaries, 'when').text },
    { section: 'how-often', status: often, text: historyLabel(visitor.history, visitor.daysAgo, act) },
    { section: 'dates', status: dates, text: !scheduled ? __('Runs until you pause it', 'wconvert')
      : visitor.date === undefined ? __('Today', 'wconvert') : readable(visitor.date) ?? visitor.date },
  ];
  if (who === 'info' && where === 'pass') return { opens: false, checking: true, headline: __('Checking…', 'wconvert'), checks };
  if (reasons.length > 0) {
    // Touch is When's question: it decides only where Where and Who passed.
    const touchFirst = touch && where === 'pass' && who === 'pass';
    return { opens: false, checks, reason: reasons[0],
      headline: touchFirst ? __('Doesn’t open on phones and tablets', 'wconvert') : __('Doesn’t open', 'wconvert') };
  }
  return { opens: true, checks,
    /* translators: %s: when it opens, e.g. “after 15 seconds”. */
    headline: sprintf(__('Opens %s', 'wconvert'), sentenceParts(value, vocabulary).when.text) };
}
