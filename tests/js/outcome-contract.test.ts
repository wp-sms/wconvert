import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitsOutcome, outcomeDesignIssue, outcomeHandoffIssue } from '../../resources/admin/src/goals/outcome';
import { CAPTURE_OUTCOME, CLICK_OUTCOME } from './support/outcomes';
import type { Template } from '@renderer/types';
import type { Destination } from '../../resources/admin/src/destinations/api';

const design = (id: string): Template => JSON.parse(readFileSync(resolve(import.meta.dirname, `../../resources/templates/library/${id}.json`), 'utf8'));

describe('the Goal contract on the edited draft', () => {
  it('requires the named channel, including requiredness, and ignores hidden fields', () => {
    const sms = { ...CAPTURE_OUTCOME, capture_any_of: ['phone'] };
    expect(outcomeDesignIssue(sms, design('centred-card'))).toBe(sms.requirement);
    const phone = design('stacked-signup');
    expect(outcomeDesignIssue(sms, phone)).toBeNull();
    const optional = JSON.parse(JSON.stringify(phone).replaceAll('"required":true', '"required":false'));
    expect(outcomeDesignIssue(sms, optional)).toBe(sms.requirement);
    const hidden = { ...phone, tree: { steps: phone.tree.steps.map((step, index) => index === 0 ? { ...step, hidden: true } : step) } };
    expect(outcomeDesignIssue(sms, hidden)).toBe(sms.requirement);
  });

  it('suggests fitting designs but checks their actual edited contents before publication', () => {
    expect(fitsOutcome(CAPTURE_OUTCOME, { act: 'submit', captures: ['email'] })).toBe(true);
    expect(fitsOutcome(CAPTURE_OUTCOME, { act: 'click', captures: [] })).toBe(false);
    expect(outcomeDesignIssue(CLICK_OUTCOME, design('centred-card'))).toBe(CLICK_OUTCOME.requirement);
    expect(outcomeDesignIssue(CLICK_OUTCOME, design('offer-panel'))).toBe(CLICK_OUTCOME.requirement);
    const linked = JSON.parse(JSON.stringify(design('offer-panel')).replace('"action":"link"', '"action":"link","href":"https://example.org/offer"'));
    expect(outcomeDesignIssue(CLICK_OUTCOME, linked)).toBeNull();
  });

  it('requires the selected delivery destination to be available and configured', () => {
    const outcome = { ...CAPTURE_OUTCOME, destination_type: 'delivery' };
    const destination = { id: 'route', type: 'delivery', availability: 'ready', settings: {}, requirements: {
      capture_any_of: ['email'], settings: { file: { label: 'File', type: 'text' } }, fields: ['email'], mapped_fields: {},
    } } as unknown as Destination;
    expect(outcomeHandoffIssue(outcome, [], [destination])).not.toBeNull();
    expect(outcomeHandoffIssue(outcome, ['route'], [destination])).not.toBeNull();
    expect(outcomeHandoffIssue(outcome, ['route'], [{ ...destination, settings: { file: 'https://example.org/guide.pdf' } }])).toBeNull();
    expect(outcomeHandoffIssue(outcome, ['route'], null)).not.toBeNull();
  });
});
