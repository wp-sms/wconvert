import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import type { Template } from '../../resources/renderer/src/types';
import type { TemplateIndex, TemplateIndexEntry } from '../../resources/admin/src/templates/api';
import type { Fit } from '../../resources/admin/src/gallery/conversion';
import { GOALS } from './support/goals';

/**
 * Change template (ADR 0171): the creation gallery's cards, one per design,
 * for the campaign's goal or every template, with the form switch's chip on a
 * design it would convert (ADR 0163) and the review before anything changes.
 */
const catalog = vi.hoisted(() => ({
  catalogStatus: vi.fn(), refreshCatalog: vi.fn(), setCatalogConsent: vi.fn(), installDesign: vi.fn(), installSetup: vi.fn(), previewDesign: vi.fn(),
}));
vi.mock('../../resources/admin/src/templates/catalog', () => catalog);
const picker = vi.hoisted(() => ({ pickerData: vi.fn(), savePreferences: vi.fn(), saveOccasions: vi.fn() }));
vi.mock('../../resources/admin/src/discovery/api', () => picker);

const { TemplatePickerDialog } = await import('../../resources/admin/src/builder/TemplatePickerDialog');

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  picker.pickerData.mockResolvedValue({ schema: 1, today: '2026-10-25', timezone: 'UTC', collections: [], preferences: { schema: 1, revision: 0, saved: [], hidden: [] }, occasions: { schema: 1, revision: 0, items: [] } });
  picker.savePreferences.mockImplementation(value => Promise.resolve({ ...value, revision: value.revision + 1 }));
  catalog.refreshCatalog.mockResolvedValue({ checked_at: '2026-10-20T00:00:00+00:00' });
});

const design = (id: string): Template => JSON.parse(readFileSync(resolve(import.meta.dirname, `../../resources/templates/library/${id}.json`), 'utf8'));
const goal = (id: string) => GOALS.find(entry => entry.id === id)!;

const LABELS = { fields: {}, facets: {}, facetValues: { 'shape.stack': 'Column', 'shape.panel': 'Panel' }, params: {} } as unknown as TemplateIndex['labels'];
const facets = (extra: Partial<TemplateIndexEntry['facets']> = {}): TemplateIndexEntry['facets'] => ({ act: 'submit', captures: ['email'], shape: 'stack', has_image: false, asks_consent: false, ...extra });
const local = (id: string, name: string, extra: Partial<TemplateIndexEntry> = {}): TemplateIndexEntry =>
  ({ id, design_key: `registered:${id}`, name, display_type: 'popup', tier: 'free', availability: 'ready', facets: facets(), revision: 1, ...extra });
const hosted = (id: string, name: string, state: 'install' | 'locked', extra: Partial<TemplateIndexEntry> = {}): TemplateIndexEntry => ({
  id: `remote:${id}`, design_key: `registered:${id}`, name, display_type: 'popup', tier: state === 'locked' ? 'pro' : 'free',
  availability: state === 'locked' ? 'locked' : 'ready', facets: facets(),
  remote: { id, revision: 1, sha256: 'b'.repeat(64), state, thumbnail: { '1x': `https://templates.example/thumbs/${id}.webp`, '2x': `https://templates.example/thumbs/${id}@2x.webp` }, tags: ['industry:food-drink'], family: null, popularity: null, prerequisites: [] },
  ...(state === 'locked' ? { preview_url: `https://wconvert.io/templates/${id}/` } : {}), ...extra,
});
const CATALOG = (consent: 'unanswered' | 'yes' | 'no' = 'yes'): TemplateIndex['catalog'] => ({
  enabled: true, consent, checked_at: '2026-10-20T00:00:00+00:00', update_required: false,
  taxonomy: { industry: [{ id: 'food-drink', label: 'Food & drink' }, { id: 'retail', label: 'Retail' }] },
});

const CENTRED = local('centred-card', 'Centred card');
const OFFER = local('offer-receipt', 'Offer receipt', { facets: facets({ act: 'click', captures: [], shape: 'panel' }) });
const TREES = new Map<string, Template>([['centred-card', design('centred-card')], ['offer-receipt', design('offer-receipt')]]);
const EMAIL_LIST: Fit = { bound: false, sibling: null, act: 'submit', outcome: goal('grow_email_list').outcome, capture: { goal: 'grow_email_list', goals: GOALS, config: {} } };

interface Props {
  readonly entries: TemplateIndexEntry[];
  readonly chosen?: string;
  readonly fit?: Fit;
  readonly consent?: 'unanswered' | 'yes' | 'no';
  readonly onChoose?: (id: string) => void;
  readonly onNear?: (id: string) => void;
  /** What the index holds once the library changed it. */
  readonly after?: TemplateIndexEntry[];
}

/** The dialog as the editor holds it: the index is the editor's, and reloads when the library changes it. */
function Editor({ entries, chosen, fit = EMAIL_LIST, consent = 'yes', onChoose = vi.fn(), onNear = vi.fn(), after }: Props) {
  const [templates, setTemplates] = useState(entries);
  return <TemplatePickerDialog open onOpenChange={vi.fn()} index={{ templates, labels: LABELS, facets: {}, catalog: CATALOG(consent) }} trees={TREES}
    displayType="popup" chosen={chosen} fit={fit} goalLabel="Grow your email list" busy={false} onChoose={onChoose} onNear={onNear}
    onLibraryChanged={async () => { if (after) setTemplates(after); }} />;
}

const names = () => [...document.querySelectorAll('.wconvert-template-card h3')].map(name => name.textContent);
const cardFor = (name: string) => screen.getByRole('heading', { name, level: 3 }).closest('li') as HTMLElement;

describe('the gallery it opens on', () => {
  it('is titled for what it does and says what stays', async () => {
    render(<Editor entries={[CENTRED]} />);
    const dialog = await screen.findByRole('dialog', { name: 'Change template' });
    expect(dialog).toHaveAccessibleDescription('Your words, rules and placement stay. Only the design changes.');
  });

  it('shows what fits the goal, with every template one choice away and the form switch’s chip on those it converts', async () => {
    render(<Editor entries={[CENTRED, OFFER]} />);
    expect(names()).toEqual(['Centred card']);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'all');
    expect(names()).toEqual(['Centred card', 'Offer receipt']);
    const offer = within(cardFor('Offer receipt'));
    expect(offer.getByText('Email form added')).toBeInTheDocument();
    expect(offer.getByRole('button', { name: 'Use with email form' })).toBeEnabled();
    expect(within(cardFor('Centred card')).queryByText(/form added/)).toBeNull();
    expect(screen.getByRole('option', { name: 'For “Grow your email list”' })).toBeInTheDocument();
  });

  it('counts every template, the goal filter included', async () => {
    render(<Editor entries={[CENTRED, OFFER]} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2');
  });

  it('puts the template in use first, marked, with nothing to press', async () => {
    const second = local('stacked-signup', 'Stacked signup');
    render(<Editor entries={[second, CENTRED]} chosen="centred-card" />);
    expect(names()).toEqual(['Centred card', 'Stacked signup']);
    const current = within(cardFor('Centred card'));
    expect(current.getByText('Current template')).toBeInTheDocument();
    expect(current.queryByRole('button', { name: /Use/ })).toBeNull();
  });

  it('offers a format only the paid plan has as “· Pro”, beside the locked card that shows it', async () => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'free', proHints: true };
    onTestFinished(() => { delete window.wconvertAdmin; });
    render(<Editor entries={[CENTRED, hosted('bar', 'Countdown bar', 'locked', { display_type: 'floating_bar' })]} />);
    expect(screen.getByRole('option', { name: 'Floating bar · Pro' })).toBeInTheDocument();
    const locked = within(cardFor('Countdown bar'));
    expect(locked.getByRole('link', { name: /See this design/ })).toHaveAttribute('href', 'https://wconvert.io/templates/bar/');
    expect(locked.queryByRole('button', { name: /Use/ })).toBeNull();
  });

  it('shows a free site no locked card where Pro hints are off', () => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'free', proHints: false };
    onTestFinished(() => { delete window.wconvertAdmin; });
    render(<Editor entries={[CENTRED, hosted('bar', 'Countdown bar', 'locked')]} />);
    expect(names()).toEqual(['Centred card']);
  });
});

describe('More filters', () => {
  it('narrows by the library’s industries and says the filter again as a chip that removes it', async () => {
    render(<Editor entries={[local('reading', 'Reading slip', { tags: ['industry:retail'] }), hosted('supper', 'Supper menu', 'install')]} />);
    await userEvent.click(screen.getByRole('button', { name: 'More filters' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Industry' }), 'retail');
    expect(names()).toEqual(['Reading slip']);
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Retail' }));
    expect(names()).toEqual(['Reading slip', 'Supper menu']);
  });

  it('finds a template by a word in its name', async () => {
    render(<Editor entries={[local('reading', 'Reading slip'), hosted('supper', 'Supper menu', 'install')]} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'supper');
    expect(names()).toEqual(['Supper menu']);
  });
});

describe('using a template', () => {
  it('reviews it first, keeps the search on Back, and applies only from the review', async () => {
    const onChoose = vi.fn();
    render(<Editor entries={[CENTRED, local('stacked-signup', 'Stacked signup')]} onChoose={onChoose} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'centred');
    await userEvent.click(within(cardFor('Centred card')).getByRole('button', { name: 'Use template' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Centred card');
    expect(onChoose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Back to templates' }));
    expect(screen.getByRole('searchbox', { name: 'Search templates' })).toHaveValue('centred');
    await userEvent.click(within(cardFor('Centred card')).getByRole('button', { name: 'Use template' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use this template' })).toHaveAttribute('aria-disabled', 'false'));
    await userEvent.click(screen.getByRole('button', { name: 'Use this template' }));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith('centred-card', undefined);
  });

  it('adds an online template to the site, then reviews it like any other', async () => {
    catalog.installDesign.mockResolvedValue({ template_id: 'design-1-supper' });
    const onNear = vi.fn();
    render(<Editor entries={[CENTRED, hosted('supper', 'Supper menu', 'install')]} onNear={onNear}
      after={[CENTRED, local('design-1-supper', 'Supper menu')]} />);
    const card = cardFor('Supper menu');
    expect(card.querySelector('img')).toHaveAttribute('referrerpolicy', 'no-referrer');
    await userEvent.click(within(card).getByRole('button', { name: 'Use template' }));
    expect(catalog.installDesign).toHaveBeenCalledWith('supper', 'b'.repeat(64));
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAccessibleName('Supper menu'));
    expect(onNear).toHaveBeenCalledWith('design-1-supper');
  });

  it('says on the card when the library could not add it, with the one retry', async () => {
    catalog.installDesign.mockRejectedValueOnce(new Error('The library is unreachable.'));
    render(<Editor entries={[CENTRED, hosted('supper', 'Supper menu', 'install')]} />);
    await userEvent.click(within(cardFor('Supper menu')).getByRole('button', { name: 'Use template' }));
    const alert = await within(cardFor('Supper menu')).findByRole('alert');
    expect(alert).toHaveTextContent('Couldn’t add this template. The library is unreachable.');
    catalog.installDesign.mockResolvedValue({ template_id: 'design-1-supper' });
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(catalog.installDesign).toHaveBeenCalledTimes(2);
  });

  it('offers the newer revision of a template on this site through the same review', async () => {
    catalog.installDesign.mockResolvedValue({ template_id: 'design-2-reading' });
    render(<Editor entries={[local('reading', 'Reading slip', { newer_revision: { revision: 2, sha256: 'c'.repeat(64) } })]}
      after={[local('design-2-reading', 'Reading slip')]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Get the newer version' }));
    expect(catalog.installDesign).toHaveBeenCalledWith('reading', 'c'.repeat(64));
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAccessibleName('Reading slip'));
  });

  it('refuses in the review a template that would count nothing, saying why', async () => {
    render(<Editor entries={[local('silent', 'Silent', { facets: facets({ act: null, captures: [] }) })]} fit={{ bound: false, sibling: null, act: 'submit' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Use template' }));
    expect(await screen.findByText('Nothing on this template counts as a conversion.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use this template' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('the online library', () => {
  it('asks once, at the end of the grid, before any online template loads', async () => {
    catalog.setCatalogConsent.mockResolvedValue({ consent: 'no' });
    render(<Editor entries={[CENTRED]} consent="unanswered" />);
    expect(screen.getByRole('heading', { name: 'See more templates from the WConvert library?' })).toBeInTheDocument();
    expect(catalog.refreshCatalog).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(catalog.setCatalogConsent).toHaveBeenCalledWith(false);
    expect(catalog.refreshCatalog).not.toHaveBeenCalled();
  });

  it('checks for new templates when it opens, once, and reloads only when the library changed', async () => {
    const onLibraryChanged = vi.fn().mockResolvedValue(undefined);
    const dialog = (catalogCheckedAt: string) => <TemplatePickerDialog open onOpenChange={vi.fn()} onLibraryChanged={onLibraryChanged}
      index={{ templates: [CENTRED], labels: LABELS, facets: {}, catalog: { ...CATALOG()!, checked_at: catalogCheckedAt } }} trees={TREES}
      displayType="popup" chosen={undefined} fit={EMAIL_LIST} busy={false} onChoose={vi.fn()} onNear={vi.fn()} />;
    const same = render(dialog('2026-10-20T00:00:00+00:00'));
    await waitFor(() => expect(catalog.refreshCatalog).toHaveBeenCalledExactlyOnceWith(true));
    expect(onLibraryChanged).not.toHaveBeenCalled();
    same.unmount();
    render(dialog('2026-10-19T00:00:00+00:00'));
    await waitFor(() => expect(onLibraryChanged).toHaveBeenCalledTimes(1));
  });
});
