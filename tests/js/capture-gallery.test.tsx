import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Template } from '../../resources/renderer/src/types';
import type { TemplateIndexEntry, TemplateLabelsWithFacets } from '../../resources/admin/src/templates/api';
import { counterpartOf, type Fit } from '../../resources/admin/src/builder/Gallery';
import { TemplateDesignDetail } from '../../resources/admin/src/builder/TemplateDesignDetail';
import { counterpartChoice, counterpartSource } from '../../resources/admin/src/builder/structure/captureConversion';
import { GOALS } from './support/goals';

/** The gallery's way into the form switch (ADR 0163): designs that fit the Goal once converted. */
const design = (id: string): Template => JSON.parse(readFileSync(resolve(import.meta.dirname, `../../resources/templates/library/${id}.json`), 'utf8'));
const goal = (id: string) => GOALS.find(entry => entry.id === id)!;
const LABELS = { fields: {}, facetValues: {}, facets: {} } as unknown as TemplateLabelsWithFacets;
const OFFER: TemplateIndexEntry = { id: 'offer-receipt', name: 'Offer receipt', display_type: 'popup', tier: 'free', availability: 'ready',
  facets: { act: 'click', captures: [], shape: 'panel', has_image: false, asks_consent: false } };
const fitFor = (id: string): Fit => ({ bound: false, sibling: null, act: 'submit', outcome: goal(id).outcome, capture: { goal: id, goals: GOALS } });

describe('which designs the switch makes fit', () => {
  it('offers click designs to a list goal and forms to an offer or a message, never the reverse', () => {
    expect(counterpartOf(OFFER, fitFor('grow_email_list'))).toBe('email');
    expect(counterpartOf(OFFER, fitFor('grow_sms_list'))).toBe('phone');
    expect(counterpartOf(OFFER, fitFor('promote_offer'))).toBeNull();
    const form = { ...OFFER, facets: { ...OFFER.facets, act: 'submit' as const, captures: ['email'] } };
    expect(counterpartOf(form, fitFor('promote_offer'))).toBe('none');
    expect(counterpartOf(form, fitFor('show_message'))).toBe('none');
    expect(counterpartOf(form, fitFor('deliver_lead_magnet'))).toBeNull();
    expect(counterpartOf({ ...OFFER, remote: { id: 'x', revision: 1, sha256: '', state: 'install', thumbnail: null, tags: [], family: null, popularity: null, prerequisites: [] } }, fitFor('grow_email_list'))).toBeNull();
  });

  it('finds the setups of the goal on the other side', () => {
    expect(counterpartSource(goal('grow_email_list'), GOALS)?.id).toBe('promote_offer');
    expect(counterpartSource(goal('collect_enquiries'), GOALS)?.id).toBe('promote_offer');
    expect(counterpartSource(goal('show_message'), GOALS)?.id).toBe('grow_email_list');
    expect(counterpartSource(goal('recover_cart'), GOALS)).toBeNull();
    expect(counterpartChoice(goal('collect_enquiries').outcome, { act: 'click', captures: [] })).toBe('email');
  });
});

describe('using a design with its form added', () => {
  it('shows and applies the converted design under its own button', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const sample = design('offer-receipt');
    const onPrepare = vi.fn().mockResolvedValue(sample);
    const onChoose = vi.fn();
    render(<TemplateDesignDetail entry={OFFER} template={sample} labels={LABELS} current={false} fit={fitFor('grow_email_list')}
      busy={false} onChoose={onChoose} onBack={vi.fn()} onPrepare={onPrepare} />);
    const use = await screen.findByRole('button', { name: 'Use with email form' });
    await waitFor(() => expect(use).toHaveAttribute('aria-disabled', 'false'));
    await userEvent.click(screen.getByRole('button', { name: 'What changes' }));
    const box = within(await screen.findByRole('dialog', { name: 'Add an email form?' }));
    expect(box.queryByRole('button', { name: 'Add email form' })).toBeNull();
    await userEvent.click(box.getByRole('button', { name: 'Done' }));
    await userEvent.click(use);
    const [, applied] = onChoose.mock.calls[0] as [string, Template];
    expect(applied.tree.submissions).toHaveLength(1);
    expect(applied.tree.steps.map(step => step.kind)).toEqual(['input', 'acknowledgement']);
    vi.unstubAllGlobals();
  });
});
