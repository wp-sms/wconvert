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
  /** The same contradictions `DisplayPlan::issues()` refuses at publish (ADR 0139). */
  it('takes a negated device away from what is left, and refuses the same rule both ways', () => {
    const conditions = [...ruleTypes().conditions, ...ruleTypes().targeting];
    const phone = { type: 'device', in: ['mobile'] };
    const notPhone = { type: 'device', in: ['mobile'], negate: true };
    const notComputers = { type: 'device', in: ['tablet', 'desktop'], negate: true };

    expect(groupProblems({ match: 'all', rules: [phone, notPhone] }, conditions)).not.toEqual([]);
    expect(groupProblems({ match: 'all', rules: [phone, notComputers] }, conditions)).toEqual([]);
    expect(groupProblems({ match: 'all', rules: [notPhone, notComputers] }, conditions)).not.toEqual([]);
    expect(groupProblems({ match: 'any', rules: [phone, notPhone] }, conditions)).toEqual([]);
    expect(groupProblems({ match: 'all', rules: [{ type: 'cart_has_items' }, { type: 'cart_has_items', negate: true }] }, conditions)).not.toEqual([]);
    expect(groupProblems({ match: 'all', rules: [{ type: 'role', value: ['editor'] }, { type: 'role', value: ['author'], negate: true }] }, conditions)).toEqual([]);
  });
});
