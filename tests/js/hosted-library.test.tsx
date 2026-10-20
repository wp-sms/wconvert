import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, onTestFinished, vi } from 'vitest';
import type { TemplateIndex, TemplateIndexEntry } from '../../resources/admin/src/templates/api';

/**
 * The hosted library in the picker (ADR 0156): cards for designs this site
 * does not have yet, the one-time question before any of them loads, and the
 * locked image card free shows for a Pro design — a picture and a link, never
 * a control.
 */
const catalog = vi.hoisted(() => ({
  catalogStatus: vi.fn(), refreshCatalog: vi.fn(), setCatalogConsent: vi.fn(), installDesign: vi.fn(), installSetup: vi.fn(), previewDesign: vi.fn(),
}));
vi.mock('../../resources/admin/src/templates/catalog', () => catalog);
const templates = vi.hoisted(() => ({ listTemplates: vi.fn() }));
vi.mock('../../resources/admin/src/templates/api', async (original) => ({ ...(await original<object>()), listTemplates: templates.listTemplates }));

beforeEach(() => { vi.clearAllMocks(); });

const { TemplatePicker } = await import('../../resources/admin/src/builder/TemplatePicker');
const { PinnedDesignNotice, usePinnedDesign } = await import('../../resources/admin/src/templates/PinnedDesign');
const { takeDesignLink } = await import('../../resources/admin/src/nav');

const LABELS = { facets: {}, facetValues: { 'shape.stack': 'Stacked', 'captures.email': 'Email address' }, fields: { email: 'Email address' }, params: {} } as unknown as TemplateIndex['labels'];
const FACETS = { shape: ['stack'], captures: ['email'], has_image: ['true'] };
const facets = { act: 'submit' as const, captures: ['email'], shape: 'stack', has_image: false, asks_consent: false };
const local = (id: string, name: string, extra: Partial<TemplateIndexEntry> = {}): TemplateIndexEntry =>
  ({ id, design_key: `registered:${id}`, name, display_type: 'popup', tier: 'free', availability: 'ready', facets, revision: 1, ...extra });
const hosted = (id: string, name: string, state: 'install' | 'locked' | 'update_plugin', extra: Partial<TemplateIndexEntry> = {}): TemplateIndexEntry => ({
  id: `remote:${id}`, design_key: `registered:${id}`, name, display_type: 'popup', tier: state === 'locked' ? 'pro' : 'free',
  availability: state === 'locked' ? 'locked' : 'ready', facets,
  remote: { id, revision: 1, sha256: 'b'.repeat(64), state, thumbnail: { '1x': `https://templates.example/v3/thumbs/${id}.webp`, '2x': `https://templates.example/v3/thumbs/${id}@2x.webp` }, tags: ['industry:food-drink'], family: null, popularity: null, prerequisites: [] },
  ...(state === 'locked' ? { preview_url: `https://wconvert.io/templates/${id}/` } : {}), ...extra,
});
const CATALOG = (consent: 'unanswered' | 'yes' | 'no' = 'yes'): TemplateIndex['catalog'] => ({
  enabled: true, consent, checked_at: '2026-10-20T00:00:00+00:00', update_required: false,
  taxonomy: { industry: [{ id: 'food-drink', label: 'Food & drink' }, { id: 'retail', label: 'Retail' }] },
});
const picker = (entries: TemplateIndexEntry[], props: Record<string, unknown> = {}, consent: 'unanswered' | 'yes' | 'no' = 'yes') => render(
  <TemplatePicker index={{ templates: entries, labels: LABELS, facets: FACETS, catalog: CATALOG(consent) }} trees={new Map()} displayType="popup"
    chosen={undefined} fit={{ bound: false, sibling: null, act: 'submit' }} busy={false} onChoose={vi.fn()} onNear={vi.fn()} {...props} />);

it('draws a hosted design from its server thumbnail, without a referrer, and installs it on request', async () => {
  catalog.refreshCatalog.mockResolvedValue({ checked_at: '2026-10-20T00:00:00+00:00' });
  catalog.installDesign.mockResolvedValue({ template_id: 'design-1-supper' });
  const onLibraryChanged = vi.fn().mockResolvedValue(undefined), onInspectInstalled = vi.fn();
  picker([local('reading', 'Reading slip'), hosted('supper', 'Supper menu', 'install')], { onLibraryChanged, onInspectInstalled });
  const card = screen.getByText('Supper menu').closest('li')!;
  const image = card.querySelector('img')!;
  expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(image).toHaveAttribute('src', 'https://templates.example/v3/thumbs/supper.webp');
  expect(within(card).queryByRole('button', { name: 'Preview design' })).toBeNull();
  await userEvent.click(within(card).getByRole('button', { name: 'Add to my designs' }));
  expect(catalog.installDesign).toHaveBeenCalledWith('supper', 'b'.repeat(64));
  await waitFor(() => expect(onInspectInstalled).toHaveBeenCalledWith('design-1-supper'));
  expect(onLibraryChanged).toHaveBeenCalled();
});

it('shows a free install a Pro design only as a picture, the plan and a link, and sorts what it can use first', () => {
  picker([hosted('bar', 'Countdown bar', 'locked'), local('reading', 'Reading slip')]);
  const card = screen.getByText('Countdown bar').closest('li')!;
  expect(within(card).getByText('Pro')).toBeInTheDocument();
  expect(within(card).getByRole('link', { name: /See this design/ })).toHaveAttribute('href', 'https://wconvert.io/templates/bar/');
  expect(within(card).queryByRole('button')).toBeNull();
  expect(card.textContent).not.toMatch(/upgrade/i);
  expect(screen.getByRole('combobox', { name: 'Sort designs' })).toHaveValue('available');
  const names = screen.getAllByRole('listitem').map((item) => item.textContent ?? '');
  expect(names.findIndex((text) => text.includes('Reading slip'))).toBeLessThan(names.findIndex((text) => text.includes('Countdown bar')));
});

it('asks once before any online design loads, and remembers "Not now" without fetching', async () => {
  catalog.setCatalogConsent.mockResolvedValue({ consent: 'no' });
  const onLibraryChanged = vi.fn().mockResolvedValue(undefined);
  picker([local('reading', 'Reading slip')], { onLibraryChanged }, 'unanswered');
  expect(screen.getByRole('heading', { name: 'See more designs from the WConvert library?' })).toBeInTheDocument();
  expect(screen.getByText(/run on Cloudflare/)).toBeInTheDocument();
  expect(catalog.refreshCatalog).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
  expect(catalog.setCatalogConsent).toHaveBeenCalledWith(false);
  expect(catalog.refreshCatalog).not.toHaveBeenCalled();
  await waitFor(() => expect(onLibraryChanged).toHaveBeenCalled());
});

it('checks for new designs when it opens, at most what the server allows, and reloads only on change', async () => {
  catalog.refreshCatalog.mockResolvedValue({ checked_at: '2026-10-21T00:00:00+00:00' });
  const onLibraryChanged = vi.fn().mockResolvedValue(undefined);
  picker([local('reading', 'Reading slip')], { onLibraryChanged });
  await waitFor(() => expect(catalog.refreshCatalog).toHaveBeenCalledWith(true));
  await waitFor(() => expect(onLibraryChanged).toHaveBeenCalledTimes(1));
});

it('searches and filters by the library’s industries, with counts', async () => {
  catalog.refreshCatalog.mockResolvedValue({ checked_at: '2026-10-20T00:00:00+00:00' });
  picker([local('reading', 'Reading slip', { tags: ['industry:retail'] }), hosted('supper', 'Supper menu', 'install')]);
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search designs' }), 'food');
  expect(screen.queryByText('Reading slip')).toBeNull();
  expect(screen.getByText('Supper menu')).toBeInTheDocument();
  await userEvent.clear(screen.getByRole('searchbox', { name: 'Search designs' }));
  await userEvent.click(screen.getByText('More filters'));
  const industry = screen.getByRole('group', { name: 'Industry' });
  await userEvent.click(within(industry).getByRole('button', { name: /Retail/ }));
  expect(screen.getByText('Reading slip')).toBeInTheDocument();
  expect(screen.queryByText('Supper menu')).toBeNull();
});

it('offers the newer revision of a local design through the usual review', async () => {
  catalog.refreshCatalog.mockResolvedValue({ checked_at: '2026-10-20T00:00:00+00:00' });
  catalog.installDesign.mockResolvedValue({ template_id: 'design-2-reading' });
  const onInspectInstalled = vi.fn();
  picker([local('reading', 'Reading slip', { newer_revision: { revision: 2, sha256: 'c'.repeat(64) } })], { onLibraryChanged: vi.fn().mockResolvedValue(undefined), onInspectInstalled });
  expect(screen.getByText('A newer version of this design is in the library.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Get the newer version' }));
  expect(catalog.installDesign).toHaveBeenCalledWith('reading', 'c'.repeat(64));
  await waitFor(() => expect(onInspectInstalled).toHaveBeenCalledWith('design-2-reading'));
});

function Pinned({ design }: { design: string }) {
  const { pinned, reload } = usePinnedDesign(design);
  return pinned ? <PinnedDesignNotice pinned={pinned} onReload={reload} onInstalled={reload} onClear={vi.fn()} /> : null;
}

it('resolves a "Use this template" link: local, hosted, unanswered and gone', async () => {
  templates.listTemplates.mockResolvedValueOnce({ templates: [local('reading', 'Reading slip')], labels: LABELS, facets: FACETS, catalog: CATALOG() });
  const first = render(<Pinned design="reading" />);
  expect(await screen.findByText('Starting from “Reading slip”')).toBeInTheDocument();
  first.unmount();

  templates.listTemplates.mockResolvedValueOnce({ templates: [hosted('supper', 'Supper menu', 'install')], labels: LABELS, facets: FACETS, catalog: CATALOG() });
  const second = render(<Pinned design="supper" />);
  expect(await screen.findByRole('button', { name: 'Add to my designs' })).toBeInTheDocument();
  expect(catalog.installDesign).not.toHaveBeenCalled();
  second.unmount();

  templates.listTemplates.mockResolvedValueOnce({ templates: [], labels: LABELS, facets: FACETS, catalog: CATALOG('unanswered') });
  const third = render(<Pinned design="supper" />);
  expect(await screen.findByRole('heading', { name: 'See more designs from the WConvert library?' })).toBeInTheDocument();
  third.unmount();

  // Unknown to the cache: one refresh (if stale) before saying it is gone.
  catalog.refreshCatalog.mockResolvedValue({});
  templates.listTemplates.mockResolvedValue({ templates: [local('supper-card', 'Supper card')], labels: LABELS, facets: FACETS, catalog: CATALOG() });
  render(<Pinned design="supper-menu" />);
  expect(await screen.findByText('That design is no longer available')).toBeInTheDocument();
  expect(catalog.refreshCatalog).toHaveBeenCalledWith(true);
  expect(screen.getByRole('link', { name: 'Supper card' })).toHaveAttribute('href', '#optins?new=1&design=supper-card');
});

it('follows a renamed design, names a declined library, and states a locked one with no link out', async () => {
  templates.listTemplates.mockResolvedValueOnce({ templates: [hosted('supper', 'Supper menu', 'install', { aliases: ['dinner-menu'] })], labels: LABELS, facets: FACETS, catalog: CATALOG() });
  const renamed = render(<Pinned design="dinner-menu" />);
  expect(await screen.findByText('Starting from “Supper menu”')).toBeInTheDocument();
  renamed.unmount();

  templates.listTemplates.mockResolvedValueOnce({ templates: [], labels: LABELS, facets: FACETS, catalog: CATALOG('no') });
  const declined = render(<Pinned design="supper" />);
  expect(await screen.findByText('The online design library is off')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', '#settings?group=data');
  expect(catalog.refreshCatalog).not.toHaveBeenCalled();
  declined.unmount();

  templates.listTemplates.mockResolvedValueOnce({ templates: [hosted('supper-pro', 'Supper pro', 'locked'), local('supper-card', 'Supper card')], labels: LABELS, facets: FACETS, catalog: CATALOG() });
  render(<Pinned design="supper-pro" />);
  expect(await screen.findByText('This design needs WConvert Pro.')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /See this design/ })).toBeNull();
  expect(screen.getByRole('link', { name: 'Supper card' })).toBeInTheDocument();
});

it('takes the design from the query string once and removes it from the address', () => {
  const replace = vi.spyOn(window.history, 'replaceState');
  onTestFinished(() => replace.mockRestore());
  expect(takeDesignLink({ search: '?page=wconvert&design=reading-slip', pathname: '/wp-admin/admin.php', hash: '' })).toBe('reading-slip');
  expect(replace).toHaveBeenLastCalledWith(null, '', '/wp-admin/admin.php?page=wconvert');
  expect(takeDesignLink({ search: '?page=wconvert&design=<script>', pathname: '/wp-admin/admin.php', hash: '' })).toBeUndefined();
  expect(takeDesignLink({ search: '?page=wconvert', pathname: '/wp-admin/admin.php', hash: '' })).toBeUndefined();
});
