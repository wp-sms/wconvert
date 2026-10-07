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
    const summaries = summarise(value(), vocabulary, true);
    expect(summaries.map(summary => [summary.id, summary.eyebrow, summary.text])).toEqual([
      ['where', 'Where does it show?', 'Entire site'],
      ['who', 'Who sees it?', 'Everyone'],
      ['when', 'When does it open?', 'After 15 seconds'],
      ['how-often', 'How often?', 'Once per visit'],
      ['dates', 'Dates', 'Until you pause it'],
    ]);
  });

  it('reads the rules when the pick is Custom', () => {
    const custom = value({ frequency: { maxPerSession: 2 } });
    expect(summaryOf(summarise(custom, vocabulary, true), 'how-often').text).toMatch(/^Shows at most 2 times per visit/);
  });

  it('reads the problem rather than a pick when a section needs attention', () => {
    const blank = value({ targeting: { mode: 'selected' }, display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'click', rules: [{ type: 'click_element', selector: '' }] } } });
    const summaries = summarise(blank, vocabulary, true);
    expect(summaryOf(summaries, 'where')).toMatchObject({ text: 'Choose at least one page', attention: true });
    expect(summaryOf(summaries, 'when').attention).toBe(true);
    expect(summaryOf(summaries, 'when').text).not.toBe('When they click a button');
  });

  it('flags an out-of-range number on a quick pick', () => {
    const tooLong = value({ display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'automatic', match: 'any', minimum_seconds: 0, rules: [{ type: 'time_on_page', seconds: 99999 }] } } });
    expect(summaryOf(summarise(tooLong, vocabulary, true), 'when').attention).toBe(true);
  });
});

describe('the sentence', () => {
  it('gives each question a lowercase phrase with its own preposition', () => {
    const parts = sentenceParts(value(), vocabulary, true);
    expect([parts.where.text, parts.who.text, parts.when.text, parts.often.text]).toEqual(['on every page', 'to everyone', 'after 15 seconds', 'once per visit']);
    expect(parts.dates).toBeUndefined();
  });

  it('counts pages, and names the exclusions', () => {
    expect(sentenceParts(value({ targeting: { exclude: [{ type: 'url', value: '/a' }, { type: 'url', value: '/b' }] } }), vocabulary, true).where.text).toBe('on every page except 2 pages');
    expect(sentenceParts(value({ targeting: { mode: 'selected', include: [{ type: 'singular', value: 'post' }] } }), vocabulary, true).where.text).toBe('on blog posts');
    expect(sentenceParts(value({ targeting: { mode: 'selected', include: [1, 2, 3].map(id => ({ type: 'post', value: id })) } }), vocabulary, true).where.text).toBe('on 3 selected pages');
  });

  it('reads a Custom audience as its rules, groups joined by “or if”', () => {
    const custom = value({ display_rules: { audience: { mode: 'groups', groups: [
      { id: 'a', match: 'all', rules: [{ type: 'device', in: ['mobile'] }, { type: 'logged_in', value: true }] },
      { id: 'b', match: 'all', rules: [{ type: 'cart_has_items' }] },
    ] }, opening: { mode: 'immediate' } } });
    const parts = sentenceParts(custom, vocabulary, true);
    expect(parts.who.text).toBe('to visitors if mobile_only and signed in to this site, or if cart_has_items');
    expect(parts.when.text).toBe('right away');
  });

  it('reads a Custom opening as its rules joined by the match', () => {
    const both = value({ display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'automatic', match: 'all', minimum_seconds: 0, rules: [{ type: 'time_on_page', seconds: 6 }, { type: 'scroll_depth', percent: 30 }] } } });
    expect(sentenceParts(both, vocabulary, true).when.text).toBe('time_on_page 6 and scroll_depth 30');
  });

  it('adds the dates as a second sentence, and says so when they have passed', () => {
    vi.stubGlobal('wconvertAdmin', { timezone: 'UTC', exportUrl: '' });
    const running = sentenceParts(value({ schedule: { starts_at: '2099-11-27 09:00', ends_at: '2099-11-30 23:59' } }), vocabulary, true).dates;
    expect(running?.frame).toBe('It runs %s.');
    expect(running?.text).toMatch(/^from .*2099.* to .*2099/);
    const done = sentenceParts(value({ schedule: { ends_at: '2020-08-03 12:00' } }), vocabulary, true).dates;
    expect(done).toMatchObject({ frame: 'It stopped running on %s.', attention: true });
  });

  it('turns a section’s phrase amber with its menu item', () => {
    expect(sentenceParts(value({ targeting: { mode: 'selected' } }), vocabulary, true).where).toMatchObject({ attention: true, text: 'on pages you have not chosen yet' });
  });
});
