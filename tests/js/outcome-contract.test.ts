import { treeFixture } from './support/journey';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitsOutcome, outcomeDesignIssue, outcomeHandoffIssue } from '../../resources/admin/src/goals/outcome';
import { CAPTURE_OUTCOME, CLICK_OUTCOME } from './support/outcomes';
import type { Template } from '@renderer/types';
import type { Destination } from '../../resources/admin/src/destinations/api';
import { captureModeOf, routedMode } from '../../resources/admin/src/builder/captureMode';

const design = (id: string): Template => JSON.parse(readFileSync(resolve(import.meta.dirname, `../../resources/templates/library/${id}.json`), 'utf8'));

describe('the Goal contract on the edited draft', () => {
  it('requires the named channel, including requiredness, and ignores hidden fields', () => {
    const sms = { ...CAPTURE_OUTCOME, capture_any_of: ['phone'] };
    expect(outcomeDesignIssue(sms, design('centred-card'))).toBe(sms.requirement);
    const phone = design('stacked-signup');
    expect(outcomeDesignIssue(sms, phone)).toBeNull();
    const optional = JSON.parse(JSON.stringify(phone).replaceAll('"required":true', '"required":false'));
    expect(outcomeDesignIssue(sms, optional)).toBe(sms.requirement);
    const hidden = { ...phone, tree: treeFixture({ steps: phone.tree.steps.map((step, index) => index === 0 ? { ...step, content: { ...step.content, hidden: true } } : step) }) };
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
    const outcome = { ...CAPTURE_OUTCOME, destination_type: 'delivery', audience_channel: null };
    const destination = { id: 'route', type: 'delivery', availability: 'ready', settings: {}, requirements: {
      capture_any_of: ['email'], settings: { file: { label: 'File', type: 'text' } }, fields: ['email'], mapped_fields: {},
    } } as unknown as Destination;
    expect(outcomeHandoffIssue(outcome, [], [destination], 'connected')).not.toBeNull();
    expect(outcomeHandoffIssue(outcome, ['route'], [destination], 'connected')).not.toBeNull();
    expect(outcomeHandoffIssue(outcome, ['route'], [{ ...destination, settings: { file: 'https://example.org/guide.pdf' } }], 'connected')).toBeNull();
    expect(outcomeHandoffIssue(outcome, ['route'], null, 'connected')).not.toBeNull();
  });

  /** Kept in WConvert only, a lead magnet still publishes; the review warns instead (ADR 0133). */
  it('lets a lead magnet kept in WConvert publish', () => {
    const outcome = { ...CAPTURE_OUTCOME, destination_type: 'delivery', audience_channel: null };
    expect(outcomeHandoffIssue(outcome, [], [], 'local')).toBeNull();
    expect(outcomeHandoffIssue(outcome, [], null, 'local')).toBeNull();
  });

  it('requires a capable audience service once connecting is chosen, and nothing while leads stay local', () => {
    const route = { id: 'email', type: 'mailpoet', availability: 'ready', settings: {}, requirements: {
      capture_any_of: ['email'], settings: {}, fields: ['email'], mapped_fields: {}, audience_channels: ['email'],
    } } as unknown as Destination;
    expect(outcomeHandoffIssue(CAPTURE_OUTCOME, [], [route], 'connected')).not.toBeNull();
    expect(outcomeHandoffIssue(CAPTURE_OUTCOME, [], [route], 'local')).toBeNull();
    expect(outcomeHandoffIssue(CAPTURE_OUTCOME, ['email'], [route], 'connected')).toBeNull();
    expect(outcomeHandoffIssue({ ...CAPTURE_OUTCOME, audience_channel: 'phone' }, ['email'], [route], 'connected')).not.toBeNull();
  });
});

describe('where leads go', () => {
  /** The same rule `OptinBinding::captureMode()` applies (ADR 0133). */
  it('keeps leads in WConvert until a service is connected', () => {
    expect(captureModeOf(undefined)).toBe('local');
    expect(captureModeOf({})).toBe('local');
    expect(captureModeOf({ destinations: [] })).toBe('local');
    expect(captureModeOf({ destinations: ['01JQ0000000000000000000001'] })).toBe('connected');
    expect(captureModeOf({ submission_settings: { s2: { destination_ids: ['01JQ0000000000000000000001'] } } })).toBe('connected');
    expect(captureModeOf({ capture_mode: 'local', destinations: ['01JQ0000000000000000000001'] })).toBe('local');
    expect(captureModeOf({ capture_mode: 'connected' })).toBe('connected');
  });

  /** Removing the main form's last service must not cut the optional form's routes. */
  it('writes the mode every form’s routes imply, whatever was stored', () => {
    const optional = { submission_settings: { s2: { destination_ids: ['01JQ0000000000000000000001'] } } };
    expect(routedMode({ capture_mode: 'connected', destinations: [], ...optional })).toBe('connected');
    expect(routedMode({ capture_mode: 'connected', destinations: [] })).toBe('local');
    expect(routedMode({ capture_mode: 'local', destinations: ['01JQ0000000000000000000001'] })).toBe('connected');
  });
});
