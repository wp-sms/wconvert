import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState, type ComponentProps } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Template } from '../../resources/renderer/src/types';
import type { TemplateIndexEntry, TemplateLabelsWithFacets } from '../../resources/admin/src/templates/api';
import { conversionOf, type Fit } from '../../resources/admin/src/gallery/conversion';
import { TemplateDesignDetail } from '../../resources/admin/src/builder/TemplateDesignDetail';
import { conversionFor, otherSideOf } from '../../resources/admin/src/builder/structure/captureConversion';
import { GOALS } from './support/goals';

/** The gallery's way into the form switch (ADR 0163): designs that fit the Goal once converted. */
const design = (id: string): Template => JSON.parse(readFileSync(resolve(import.meta.dirname, `../../resources/templates/library/${id}.json`), 'utf8'));
const goal = (id: string) => GOALS.find(entry => entry.id === id)!;
const LABELS = { fields: {}, facetValues: {}, facets: {} } as unknown as TemplateLabelsWithFacets;
const OFFER: TemplateIndexEntry = { id: 'offer-receipt', name: 'Offer receipt', display_type: 'popup', tier: 'free', availability: 'ready',
  facets: { act: 'click', captures: [], shape: 'panel', has_image: false, asks_consent: false } };
const fitFor = (id: string): Fit => ({ bound: false, sibling: null, act: 'submit', outcome: goal(id).outcome, capture: { goal: id, goals: GOALS, config: {} } });

describe('which designs the switch makes fit', () => {
  it('offers click designs to a list goal and forms to an offer or a message, never the reverse', () => {
    expect(conversionOf(OFFER, fitFor('grow_email_list'))).toBe('email');
    expect(conversionOf(OFFER, fitFor('grow_sms_list'))).toBe('phone');
    expect(conversionOf(OFFER, fitFor('promote_offer'))).toBeNull();
    const form = { ...OFFER, facets: { ...OFFER.facets, act: 'submit' as const, captures: ['email'] } };
    expect(conversionOf(form, fitFor('promote_offer'))).toBe('none');
    expect(conversionOf(form, fitFor('show_message'))).toBe('none');
    expect(conversionOf(form, fitFor('deliver_lead_magnet'))).toBeNull();
    expect(conversionOf({ ...OFFER, remote: { id: 'x', revision: 1, sha256: '', state: 'install', thumbnail: null, tags: [], family: null, popularity: null, prerequisites: [] } }, fitFor('grow_email_list'))).toBeNull();
  });

  it('finds the setups of the goal on the other side', () => {
    expect(otherSideOf(goal('grow_email_list'), GOALS)?.id).toBe('promote_offer');
    expect(otherSideOf(goal('collect_enquiries'), GOALS)?.id).toBe('promote_offer');
    expect(otherSideOf(goal('show_message'), GOALS)?.id).toBe('grow_email_list');
    expect(otherSideOf(goal('recover_cart'), GOALS)).toBeNull();
    expect(conversionFor(goal('collect_enquiries').outcome, { act: 'click', captures: [] })).toBe('email');
  });
});

/** The review as the picker holds it: what changes opens in its place. */
function Review(props: ComponentProps<typeof TemplateDesignDetail>) {
  const [explaining, setExplaining] = useState(false);
  return <TemplateDesignDetail {...props} explaining={explaining} onExplain={setExplaining} />;
}

describe('using a design with its form added', () => {
  it('shows and applies the converted design under its own button', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const sample = design('offer-receipt');
    const onPrepare = vi.fn().mockResolvedValue(sample);
    const onChoose = vi.fn();
    render(<Review entry={OFFER} template={sample} labels={LABELS} current={false} fit={fitFor('grow_email_list')}
      busy={false} onChoose={onChoose} onBack={vi.fn()} onPrepare={onPrepare} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use with email form' })).toHaveAttribute('aria-disabled', 'false'));
    await userEvent.click(screen.getByRole('button', { name: 'What changes' }));
    expect(screen.getByRole('heading', { name: 'What changes' })).toHaveFocus();
    expect(screen.getByText(/^Visitors sign up first/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use with email form' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add email form' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'What changes' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Use with email form' }));
    const [, applied] = onChoose.mock.calls[0] as [string, Template];
    expect(applied.tree.submissions).toHaveLength(1);
    expect(applied.tree.steps.map(step => step.kind)).toEqual(['input', 'acknowledgement']);
    vi.unstubAllGlobals();
  });
});

describe('what changes for a design taken without its form', () => {
  it('explains the design that applies, with nothing to type that could not reach it', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('wconvertAdmin', { offerLink: { href: 'https://shop.test/shop/', place: 'shop' } });
    const entry = { ...OFFER, id: 'centred-card', name: 'Centred card', facets: { ...OFFER.facets, act: 'submit' as const, captures: ['email'] } };
    const onChoose = vi.fn();
    const sample = design('centred-card');
    render(<Review entry={entry} template={sample} labels={LABELS} current={false} fit={fitFor('promote_offer')}
      busy={false} onChoose={onChoose} onBack={vi.fn()} onPrepare={vi.fn().mockResolvedValue(sample)} />);
    await userEvent.click(await screen.findByRole('button', { name: 'What changes' }));
    // The button the applied design gets is said, and is not a choice here.
    expect(screen.getByText(/“Shop now”/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByRole('button', { name: 'Use without form' }));
    const [, applied] = onChoose.mock.calls[0] as [string, Template];
    expect(applied.tree.submissions).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});

describe('an enquiries goal through the gallery (A6)', () => {
  it('adds an enquiry form and keeps the enquiries goal', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const sample = design('offer-receipt');
    const onChoose = vi.fn();
    render(<TemplateDesignDetail entry={OFFER} template={sample} labels={LABELS} current={false} fit={fitFor('collect_enquiries')} goalLabel="Collect enquiries"
      busy={false} onChoose={onChoose} onBack={vi.fn()} onPrepare={vi.fn().mockResolvedValue(sample)} />);
    const use = await screen.findByRole('button', { name: 'Use with enquiry form' });
    expect(screen.getByText(/The goal stays “Collect enquiries”\./)).toBeInTheDocument();
    await waitFor(() => expect(use).toHaveAttribute('aria-disabled', 'false'));
    await userEvent.click(use);
    const [, applied] = onChoose.mock.calls[0] as [string, Template];
    expect(applied.tree.submissions).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it('never promises a conversion the switch refuses once the design is known', () => {
    const quiz = { tree: { v: 2, steps: [{ id: 'r', name: 'Result', kind: 'result', content: { type: 'stack', children: [] } }], submissions: [] }, tokens: {} } as unknown as Template;
    expect(conversionOf(OFFER, fitFor('grow_email_list'))).toBe('email');
    expect(conversionOf(OFFER, fitFor('grow_email_list'), quiz)).toBeNull();
  });
});
