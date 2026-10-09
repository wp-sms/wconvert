import { describe, expect, it } from 'vitest';
import { checkVisit, inWindow, paced, pageChoices, readRule, touchBlocked, type Visitor } from '../../resources/admin/src/builder/rules/visit';
import type { DisplayRulesValue } from '../../resources/admin/src/builder/rules/summaries';
import { ruleTypes } from './support/rule-types';
import { wallNow } from '../../resources/admin/src/lib/wallTime';

/**
 * Test a visit — one described visitor, read against the five questions the
 * way the loader would read them (ADR 0129).
 */

const vocabulary = ruleTypes();
const base = (patch: Partial<DisplayRulesValue> = {}): DisplayRulesValue => ({
  display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'immediate' } },
  targeting: {},
  frequency: {},
  schedule: {},
  priority: 0,
  ...patch,
});

describe('the page they are on', () => {
  it('offers only “Any page” when nothing narrows Where', () => {
    expect(pageChoices(base(), vocabulary)).toEqual([{ value: 'other', label: 'Any page', admitted: true }]);
  });

  it('offers each shown-on page, each excluded page, and any other page where the whole site is in', () => {
    const value = base({ targeting: { exclude: [{ type: 'url', value: '/checkout/*' }] } });
    expect(pageChoices(value, vocabulary)).toEqual([
      { value: 'out:0', label: 'Excluded: /checkout/*', admitted: false },
      { value: 'other', label: 'Any other page', admitted: true },
    ]);
  });

  it('names the blog pick as a blog post and keeps every other page out of a selected list', () => {
    const blog = base({ targeting: { mode: 'selected', include: [{ type: 'singular', value: 'post' }] } });
    expect(pageChoices(blog, vocabulary)).toEqual([
      { value: 'in:0', label: 'A blog post', admitted: true },
      { value: 'other', label: 'Any other page', admitted: false },
    ]);
    const selected = base({ targeting: { mode: 'selected', include: [{ type: 'url', value: '/sale/' }, { type: 'term', value: 7 }] } });
    expect(pageChoices(selected, vocabulary).map(choice => [choice.label, choice.admitted])).toEqual([
      ['/sale/', true], ['term: #7', true], ['Any other page', false],
    ]);
  });
});

const visitor = (patch: Partial<Visitor> = {}): Visitor => ({ page: 'other', device: 'desktop', signedIn: false, history: 'new', ...patch });

describe('each audience rule, read from the visitor', () => {
  it('reads device, signed-in and role as the visitor was described', () => {
    expect(readRule({ type: 'device', in: ['mobile', 'tablet'] }, visitor({ device: 'tablet' }))).toBe(true);
    expect(readRule({ type: 'device', in: ['mobile'] }, visitor())).toBe(false);
    expect(readRule({ type: 'logged_in', value: true }, visitor({ signedIn: true }))).toBe(true);
    expect(readRule({ type: 'logged_in', value: false }, visitor({ signedIn: true }))).toBe(false);
    expect(readRule({ type: 'role', value: ['editor'] }, visitor({ signedIn: true, role: 'editor' }))).toBe(true);
    expect(readRule({ type: 'role', value: ['editor'] }, visitor({ signedIn: false, role: 'editor' }))).toBe(false);
  });

  it('reads where they came from, including a site named in the rule', () => {
    expect(readRule({ type: 'referrer', in: ['search'] }, visitor({ source: 'search' }))).toBe(true);
    expect(readRule({ type: 'referrer', in: ['social'] }, visitor({ source: 'direct' }))).toBe(false);
    expect(readRule({ type: 'referrer', in: ['example.com'] }, visitor({ source: 'example.com' }))).toBe(true);
    expect(readRule({ type: 'referrer', in: ['search', 'direct', 'social'] }, visitor({ source: 'elsewhere' }))).toBe(false);
  });

  it('reads the page address the way the loader reads a query parameter', () => {
    expect(readRule({ type: 'query_param', key: 'utm_source', value: [] }, visitor({ query: '?utm_source=anything' }))).toBe(true);
    expect(readRule({ type: 'query_param', key: 'utm_source', value: ['newsletter'] }, visitor({ query: 'utm_source=newsletter' }))).toBe(true);
    expect(readRule({ type: 'query_param', key: 'utm_source', value: ['newsletter'] }, visitor({ query: '?utm_source=ads' }))).toBe(false);
    expect(readRule({ type: 'query_param', key: 'utm_source', value: [] }, visitor())).toBe(false);
  });

  it('reads the site clock against a daily window, overnight included', () => {
    expect(readRule({ type: 'time_of_day', between: '09:00-17:00' }, visitor({ clock: '09:00' }))).toBe(true);
    expect(readRule({ type: 'time_of_day', between: '09:00-17:00' }, visitor({ clock: '17:00' }))).toBe(false);
    expect(readRule({ type: 'time_of_day', between: '22:00-02:00' }, visitor({ clock: '01:30' }))).toBe(true);
  });

  it('reads an ad blocker only where it could be told', () => {
    expect(readRule({ type: 'ad_blocking', value: 'detected' }, visitor({ adBlocking: 'yes' }))).toBe(true);
    expect(readRule({ type: 'ad_blocking', value: 'not_detected' }, visitor({ adBlocking: 'no' }))).toBe(true);
    expect(readRule({ type: 'ad_blocking', value: 'not_detected' }, visitor({ adBlocking: 'unknown' }))).toBe(false);
    expect(readRule({ type: 'ad_blocking', value: 'detected' }, visitor({ adBlocking: 'unknown' }))).toBe(false);
  });

  it('reads a cart rule from the basket check, and any other rule from a plain yes or no', () => {
    expect(readRule({ id: 'c', type: 'cart_has_items' }, visitor(), { c: true })).toBe(true);
    expect(readRule({ id: 'c', type: 'cart_has_items' }, visitor(), { c: 'blocked' })).toBe('blocked');
    expect(readRule({ id: 'c', type: 'cart_has_items' }, visitor())).toBe(false);
    expect(readRule({ id: 'n', type: 'future_rule' }, visitor({ answers: { n: true } }))).toBe(true);
    expect(readRule({ id: 'n', type: 'future_rule' }, visitor())).toBe(false);
  });
});

describe('how often, for what happened before this visit', () => {
  it('lets a first-time visitor in under any pacing', () => {
    expect(paced({ maxPerSession: 1 }, 'new', undefined, 'automatic')).toBeNull();
    expect(paced({ maxImpressions: 1 }, 'new', undefined, 'automatic')).toBeNull();
  });

  it('stops a second showing in one visit under Once per visit, and allows it on every page', () => {
    expect(paced({ maxPerSession: 1 }, 'this-visit', undefined, 'automatic')).toBe('session');
    expect(paced({}, 'this-visit', undefined, 'automatic')).toBeNull();
  });

  it('counts the days since they saw it under Once every 7 days', () => {
    expect(paced({ cooldownDays: 7 }, 'days-ago', 3, 'automatic')).toBe('cooldown');
    expect(paced({ cooldownDays: 7 }, 'days-ago', 7, 'automatic')).toBeNull();
    expect(paced({ cooldownDays: 7 }, 'this-visit', undefined, 'automatic')).toBe('cooldown');
  });

  it('never shows it twice under Only once ever', () => {
    expect(paced({ maxImpressions: 1 }, 'days-ago', 400, 'automatic')).toBe('impressions');
  });

  it('stops after a close unless that stop is turned off', () => {
    expect(paced({}, 'closed', undefined, 'automatic')).toBe('dismissed');
    expect(paced({ stopAfterDismiss: false }, 'closed', undefined, 'automatic')).toBeNull();
    expect(paced({}, 'converted', undefined, 'automatic')).toBe('converted');
    expect(paced({ stopAfterConversion: false }, 'converted', undefined, 'automatic')).toBeNull();
  });

  it('lets a click open it whatever the pacing, but not after they signed up', () => {
    expect(paced({ maxPerSession: 1 }, 'this-visit', undefined, 'click')).toBeNull();
    expect(paced({ maxImpressions: 1 }, 'closed', undefined, 'click')).toBeNull();
    expect(paced({}, 'converted', undefined, 'click')).toBe('converted');
  });
});

describe('the dates it runs', () => {
  const sale = { starts_at: '2026-11-27 09:00', ends_at: '2026-11-30 23:59' };

  it('runs inside the window, from its first minute and up to its last', () => {
    expect(inWindow(sale, '2026-11-27 09:00')).toBe(true);
    expect(inWindow(sale, '2026-11-28T12:00')).toBe(true);
    expect(inWindow(sale, '2026-11-30 23:59')).toBe(false);
  });

  it('does not run before it starts or after it ends, and always runs with no dates', () => {
    expect(inWindow(sale, '2026-11-27 08:59')).toBe(false);
    expect(inWindow(sale, '2026-12-01 00:00')).toBe(false);
    expect(inWindow({ ends_at: '2026-11-30 23:59' }, '2020-01-01 00:00')).toBe(true);
    expect(inWindow({}, '2026-11-27 09:00')).toBe(true);
  });

  it('reads now as a wall time on the site’s clock', () => {
    const instant = Date.UTC(2026, 10, 27, 23, 30);
    expect(wallNow('+05:30', instant)).toBe('2026-11-28 05:00');
    expect(wallNow('Europe/London', instant)).toBe('2026-11-27 23:30');
  });
});

describe('leaving, on a touch screen', () => {
  const leave = { mode: 'automatic' as const, match: 'any' as const, rules: [{ id: 'x', type: 'exit_intent' }] };

  it('cannot open on a phone or tablet when leaving is the only way in', () => {
    expect(touchBlocked(leave, 'mobile')).toBe(true);
    expect(touchBlocked(leave, 'tablet')).toBe(true);
    expect(touchBlocked(leave, 'desktop')).toBe(false);
  });

  it('can when scrolling back up is another way in, and cannot when leaving is required as well', () => {
    expect(touchBlocked({ ...leave, rules: [...leave.rules, { id: 'u', type: 'scroll_up' }] }, 'mobile')).toBe(false);
    expect(touchBlocked({ ...leave, match: 'all', rules: [...leave.rules, { id: 't', type: 'time_on_page', seconds: 5 }] }, 'mobile')).toBe(true);
    expect(touchBlocked({ mode: 'immediate' }, 'mobile')).toBe(false);
  });
});

describe('the verdict', () => {
  const after15 = { mode: 'automatic' as const, match: 'any' as const, minimum_seconds: 0, rules: [{ id: 't', type: 'time_on_page', seconds: 15 }] };
  const phonesOnly = { mode: 'groups' as const, groups: [{ id: 'g', match: 'all' as const, rules: [{ id: 'd', type: 'device', in: ['mobile'] }] }] };
  const check = (value: DisplayRulesValue, who: Partial<Visitor> = {}) => checkVisit(value, vocabulary, visitor(who));

  it('says when it opens, in the sentence’s own words, and lists all five questions', () => {
    const result = check(base({ display_rules: { audience: { mode: 'everyone' }, opening: after15 }, frequency: { maxPerSession: 1 } }));
    expect(result).toMatchObject({ opens: true, headline: 'Opens after 15 seconds' });
    expect(result.reason).toBeUndefined();
    expect(result.checks).toEqual([
      { section: 'where', status: 'pass', text: 'Any page' },
      { section: 'who', status: 'pass', text: 'Everyone' },
      { section: 'when', status: 'info', text: 'After 15 seconds' },
      { section: 'how-often', status: 'pass', text: 'First time here' },
      { section: 'dates', status: 'pass', text: 'Runs until you pause it' },
    ]);
  });

  it('names the excluded page, and the first question that fails decides it', () => {
    const value = base({ display_rules: { audience: phonesOnly, opening: after15 }, targeting: { exclude: [{ type: 'url', value: '/checkout/*' }] } });
    const result = check(value, { page: 'out:0' });
    expect(result).toMatchObject({ opens: false, headline: 'Doesn’t open', reason: '/checkout/* is excluded.' });
    expect(result.checks.map(row => row.status)).toEqual(['fail', 'fail', 'info', 'pass', 'pass']);
  });

  it('says who the campaign is for when the device is wrong', () => {
    const value = base({ display_rules: { audience: phonesOnly, opening: after15 } });
    expect(check(value)).toMatchObject({ opens: false, reason: 'This campaign is for phones only.' });
    expect(check(value, { device: 'mobile' }).opens).toBe(true);
  });

  it('names the pacing that stops a second showing', () => {
    const value = base({ frequency: { maxPerSession: 1 } });
    expect(check(value, { history: 'this-visit' })).toMatchObject({ opens: false, reason: 'They already saw it this visit (Once per visit).' });
    expect(check(value, { history: 'closed' }).reason).toBe('It stops showing after they close it.');
    expect(check(value, { history: 'this-visit' }).checks[3]).toEqual({ section: 'how-often', status: 'fail', text: 'Saw it earlier this visit' });
  });

  it('warns that leaving can’t be seen on a touch screen', () => {
    const leave = base({ display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'automatic', match: 'any', rules: [{ id: 'x', type: 'exit_intent' }] } } });
    expect(check(leave, { device: 'tablet' })).toMatchObject({ opens: false, headline: 'Doesn’t open on phones and tablets',
      reason: 'Leaving can’t be detected on touch screens. Add “Leaving or scrolling back up”.' });
    expect(check(leave).headline).toBe('Opens when they try to leave');
  });

  it('does not open on a date outside the window', () => {
    const value = base({ schedule: { starts_at: '2026-11-27 09:00', ends_at: '2026-11-30 23:59' } });
    expect(check(value, { date: '2026-12-02 10:00' })).toMatchObject({ opens: false, reason: 'It isn’t running on that date.' });
    expect(check(value, { date: '2026-11-28 10:00' }).opens).toBe(true);
  });

  it('waits for the basket, then takes its answer', () => {
    const cart = base({ display_rules: { audience: { mode: 'groups', groups: [{ id: 'g', match: 'all', rules: [{ id: 'c', type: 'cart_has_items' }] }] }, opening: { mode: 'immediate' } } });
    expect(checkVisit(cart, vocabulary, visitor(), { status: 'checking' })).toMatchObject({ opens: false, checking: true, headline: 'Checking…' });
    expect(checkVisit(cart, vocabulary, visitor(), { status: 'fail', reason: 'No basket.' })).toMatchObject({ opens: false, reason: 'No basket.' });
    expect(checkVisit(cart, vocabulary, visitor(), { status: 'pass', answers: { c: true } }).opens).toBe(true);
  });

  it('asks for display rules before it can answer', () => {
    expect(check(base({ display_rules: undefined }))).toMatchObject({ opens: false, reason: 'Set up your display rules before testing a visit.' });
  });
});
