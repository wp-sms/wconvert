import { describe, expect, it } from 'vitest';
import { audienceMatches, groupMatches, openingMatches } from '../../resources/loader/src/display-rules';

describe('display rule matching', () => {
  const time = { type: 'time_on_page', seconds: 20 };
  const scroll = { type: 'scroll_depth', percent: 50 };
  it('requires both achieved thresholds for ALL, but only one for ANY', () => {
    const read = (rule: { type: string }) => rule.type === time.type;
    expect(groupMatches({ match: 'all', rules: [time, scroll] }, read)).toBe(false);
    expect(groupMatches({ match: 'any', rules: [time, scroll] }, read)).toBe(true);
  });
  it('can pass a permitted OR branch without treating withheld consent as a failed rule', () => {
    const read = (rule: { type: string }) => rule.type === 'cart' ? 'blocked' as const : true;
    expect(groupMatches({ match: 'any', rules: [{ type: 'cart' }, time] }, read)).toBe(true);
    expect(groupMatches({ match: 'all', rules: [{ type: 'cart' }, time] }, read)).toBe('blocked');
    expect(groupMatches({ match: 'all', rules: [{ type: 'cart' }, scroll] }, () => false)).toBe(false);
  });
  it('ORs alternative audience groups and fails closed on empty groups', () => {
    expect(audienceMatches({ mode: 'groups', groups: [
      { match: 'all', rules: [scroll] }, { match: 'all', rules: [time] },
    ] }, rule => rule.type === time.type)).toBe(true);
    expect(groupMatches({ match: 'all', rules: [] }, () => true)).toBe(false);
    expect(audienceMatches({ mode: 'groups', groups: [] }, () => true)).toBe(false);
  });
  it('requires minimum dwell at the instant a fresh event is evaluated', () => {
    const opening = { mode: 'automatic' as const, match: 'all' as const, minimum_seconds: 15, rules: [{ type: 'gesture' }] };
    expect(openingMatches(opening, () => true, 5)).toBe(false);
    expect(openingMatches(opening, () => false, 15)).toBe(false);
    expect(openingMatches(opening, () => true, 16)).toBe(true);
  });
});
