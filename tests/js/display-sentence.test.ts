import { afterEach, describe, expect, it, vi } from 'vitest';
import { sentenceParts } from '../../resources/admin/src/builder/rules/sentence';
import { summarise, summaryOf, type DisplayRulesValue } from '../../resources/admin/src/builder/rules/summaries';
import { ruleTypes } from './support/rule-types';

afterEach(() => vi.unstubAllGlobals());

/**
 * The summary sentence above the Display rules grid, and the five answers the
 * menu, Readiness and Campaign details read (ADR 0129).
 */

const vocabulary = ruleTypes();
const value = (patch: Partial<DisplayRulesValue> = {}): DisplayRulesValue => ({
  display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'automatic', match: 'any', minimum_seconds: 0, rules: [{ type: 'time_on_page', seconds: 15 }] } },
  targeting: {},
  frequency: { maxPerSession: 1 },
  schedule: {},
  priority: 0,
  ...patch,
});

describe('the five answers', () => {
  it('answers each question in screen order, in the matched pick’s own words', () => {
    const summaries = summarise(value(), vocabulary);
    expect(summaries.map(summary => [summary.id, summary.eyebrow, summary.text])).toEqual([
      ['where', 'Where does it show?', 'Entire site'],
      ['who', 'Who sees it?', 'Everyone'],
      ['when', 'When does it open?', 'After 15 seconds'],
      ['how-often', 'How often?', 'Once per visit'],
      ['dates', 'Dates', 'Runs until you unpublish it'],
    ]);
  });

  it('reads Custom pacing in plain words', () => {
    expect(summaryOf(summarise(value({ frequency: { maxPerSession: 2, cooldownDays: 3 } }), vocabulary), 'how-often').text).toBe('Up to 2 times per visit, 3 days apart');
    expect(sentenceParts(value({ frequency: { maxPerSession: 2 } }), vocabulary).often.text).toBe('up to 2 times per visit');
  });

  it('names a page it can name without a lookup, and counts the rest', () => {
    const answer = (targeting: DisplayRulesValue['targeting']) => summaryOf(summarise(value({ targeting }), vocabulary), 'where').text;
    expect(answer({ exclude: [{ type: 'url', value: '/checkout/*' }] })).toBe('Entire site, except /checkout/*');
    expect(answer({ exclude: [{ type: 'post', value: 7 }] })).toBe('Entire site, except 1 page');
    expect(answer({ mode: 'selected', include: [{ type: 'url', value: '/sale/' }, { type: 'url', value: '/shop/*' }] })).toBe('/sale/ or /shop/*');
    expect(answer({ mode: 'selected', include: [1, 2, 3].map(id => ({ type: 'post', value: id })) })).toBe('3 selected pages');
  });

  it('reads the problem rather than a pick when a section needs attention', () => {
    const blank = value({ targeting: { mode: 'selected' }, display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'click', rules: [{ type: 'click_element', selector: '' }] } } });
    const summaries = summarise(blank, vocabulary);
    expect(summaryOf(summaries, 'where')).toMatchObject({ text: 'Choose at least one page', attention: true });
    expect(summaryOf(summaries, 'when').attention).toBe(true);
    expect(summaryOf(summaries, 'when').text).not.toBe('When they click a button');
  });

  it('flags an out-of-range number on a quick pick', () => {
    const tooLong = value({ display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'automatic', match: 'any', minimum_seconds: 0, rules: [{ type: 'time_on_page', seconds: 99999 }] } } });
    expect(summaryOf(summarise(tooLong, vocabulary), 'when').attention).toBe(true);
  });
});

describe('the sentence', () => {
  it('gives each question a phrase, framed by its own connecting words', () => {
    const parts = sentenceParts(value(), vocabulary);
    expect([parts.where, parts.who, parts.when, parts.often].map(part => part.frame.replace('%s', `[${part.text}]`)))
      .toEqual(['on [every page]', 'to [everyone]', '[after 15 seconds]', '[once per visit]']);
    expect(parts.dates).toBeUndefined();
  });

  it('counts pages, and names the exclusions', () => {
    expect(sentenceParts(value({ targeting: { exclude: [{ type: 'url', value: '/a' }, { type: 'url', value: '/b' }] } }), vocabulary).where.text).toBe('every page except /a and /b');
    expect(sentenceParts(value({ targeting: { exclude: [1, 2, 3].map(id => ({ type: 'url', value: `/${id}` })) } }), vocabulary).where.text).toBe('every page except 3 pages');
    expect(sentenceParts(value({ targeting: { mode: 'selected', include: [{ type: 'singular', value: 'post' }] } }), vocabulary).where.text).toBe('blog posts');
    expect(sentenceParts(value({ targeting: { mode: 'selected', include: [1, 2, 3].map(id => ({ type: 'post', value: id })) } }), vocabulary).where.text).toBe('3 selected pages');
  });

  it('reads a Custom audience as its rules, groups joined by “or if”', () => {
    const custom = value({ display_rules: { audience: { mode: 'groups', groups: [
      { id: 'a', match: 'all', rules: [{ type: 'device', in: ['mobile'] }, { type: 'logged_in', value: true }] },
      { id: 'b', match: 'all', rules: [{ type: 'cart_has_items' }] },
    ] }, opening: { mode: 'immediate' } } });
    const parts = sentenceParts(custom, vocabulary);
    expect(parts.who.text).toBe('visitors if mobile_only and signed in to this site, or if cart_has_items');
    expect(parts.when.text).toBe('as soon as the page loads');
  });

  it('reads a Custom opening as its rules joined by the match', () => {
    const both = value({ display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'automatic', match: 'all', minimum_seconds: 0, rules: [{ type: 'time_on_page', seconds: 6 }, { type: 'scroll_depth', percent: 30 }] } } });
    expect(sentenceParts(both, vocabulary).when.text).toBe('time_on_page 6 and scroll_depth 30');
  });

  it('adds the dates as a second sentence, and says so when they have passed', () => {
    vi.stubGlobal('wconvertAdmin', { timezone: 'UTC', exportUrl: '' });
    const running = sentenceParts(value({ schedule: { starts_at: '2099-11-27 09:00', ends_at: '2099-11-30 23:59' } }), vocabulary).dates;
    expect(running?.frame).toBe('It runs %s.');
    expect(running?.text).toMatch(/^from .*2099.* to .*2099/);
    const done = sentenceParts(value({ schedule: { ends_at: '2020-08-03 12:00' } }), vocabulary).dates;
    expect(done).toMatchObject({ frame: 'It stopped running on %s.', attention: true });
  });

  it('turns a section’s phrase amber with its menu item', () => {
    expect(sentenceParts(value({ targeting: { mode: 'selected', exclude: [{ type: 'url', value: '/a' }] } }), vocabulary).where).toMatchObject({ attention: true, text: 'pages you haven’t chosen yet' });
  });
});
