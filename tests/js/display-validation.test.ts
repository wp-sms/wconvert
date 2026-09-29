import { describe, expect, it } from 'vitest';
import selectors from '../fixtures/display/selectors.json';
import { portableSelector, groupProblems } from '@/builder/rules/validation';
import { ruleTypes } from './support/rule-types';

describe('display validation', () => {
  it.each(selectors)('validates selector %s on both authoring paths', (selector, valid) => {
    expect(portableSelector(String(selector))).toBe(valid);
  });
  it('requires a device overlap for ALL but permits alternatives', () => {
    const rules = [{ type: 'device', in: ['mobile'] }, { type: 'device', in: ['desktop'] }];
    expect(groupProblems({ match: 'all', rules }, ruleTypes().conditions)).not.toEqual([]);
    expect(groupProblems({ match: 'any', rules }, ruleTypes().conditions)).toEqual([]);
  });
  it('keeps ad-block statuses closed and rejects a contradictory ALL group', () => {
    const conditions = ruleTypes().conditions;
    const rules = [{ type: 'ad_blocking', value: 'detected' }, { type: 'ad_blocking', value: 'not_detected' }];
    expect(groupProblems({ match: 'all', rules }, conditions)).not.toEqual([]);
    expect(groupProblems({ match: 'any', rules }, conditions)).toEqual([]);
    expect(groupProblems({ match: 'all', rules: [{ type: 'ad_blocking', value: 'maybe' }] }, conditions)).not.toEqual([]);
  });
});
