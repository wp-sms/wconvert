import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, onTestFinished, vi } from 'vitest';
import type { TemplateIndex, TemplateIndexEntry } from '../../resources/admin/src/templates/api';

/**
 * A "Use this template" link from the website (ADR 0156): a design this site
 * has, one the library has, one behind the unanswered question, and one that
 * is gone. The gallery's own hosted cards are in editor-gallery.test.tsx.
 */
const catalog = vi.hoisted(() => ({
  catalogStatus: vi.fn(), refreshCatalog: vi.fn(), setCatalogConsent: vi.fn(), installDesign: vi.fn(), installSetup: vi.fn(), previewDesign: vi.fn(),
}));
vi.mock('../../resources/admin/src/templates/catalog', () => catalog);
const templates = vi.hoisted(() => ({ listTemplates: vi.fn() }));
vi.mock('../../resources/admin/src/templates/api', async (original) => ({ ...(await original<object>()), listTemplates: templates.listTemplates }));

beforeEach(() => { vi.clearAllMocks(); });

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
