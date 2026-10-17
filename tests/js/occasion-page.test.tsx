import { beforeEach, expect, it, onTestFinished, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OptinSummary } from '../../resources/admin/src/optins/api';

/**
 * An occasion's page offers each campaign the Campaigns list's row ⋯ menu, with
 * the same confirms, and reads its list again after an action.
 */
const occasionsApi = vi.hoisted(() => ({ readOccasions: vi.fn(), copyOccasion: vi.fn(), exportOccasion: vi.fn(), importOccasion: vi.fn(), download: vi.fn() }));
vi.mock('../../resources/admin/src/occasions/api', () => occasionsApi);
const optins = vi.hoisted(() => ({
  listOptins: vi.fn(), readCampaignPreviews: vi.fn(), unpublishOptin: vi.fn(), publishOptin: vi.fn(), deleteOptin: vi.fn(), duplicateCampaign: vi.fn(),
}));
vi.mock('../../resources/admin/src/optins/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/optins/api')>()),
  ...optins,
}));
const stats = vi.hoisted(() => ({ readReport: vi.fn(), readDashboard: vi.fn() }));
vi.mock('../../resources/admin/src/stats/api', () => stats);
vi.mock('../../resources/admin/src/optins/CampaignDesign', () => ({ default: () => null }));

const { OccasionPage } = await import('../../resources/admin/src/occasions/OccasionPage');

const BLACK_FRIDAY = { id: 'black-friday-2026', name: 'Black Friday 2026', start: '2026-11-20', end: '2026-12-01' };
const row = (id: string, name: string, extra: Partial<OptinSummary> = {}): OptinSummary => ({
  id, name, goal: 'promote_offer', parent_id: null, published_at: null, has_unpublished_changes: false, deleted_at: null,
  suspended: null, arms: [], occasion: BLACK_FRIDAY.id, display_type: 'floating_bar', starts_at: '2026-11-20 00:00', ends_at: '2026-12-02 00:00', ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  window.wconvertAdmin = { exportUrl: '', homeUrl: 'https://shop.test/', previewParam: 'wconvert-preview' };
  onTestFinished(() => { delete window.wconvertAdmin; });
  occasionsApi.readOccasions.mockResolvedValue({ schema: 1, revision: 1, items: [BLACK_FRIDAY] });
  optins.listOptins.mockResolvedValue([row('01JBAR000000000000000000AA', 'Black Friday bar', { published_at: '2026-11-01 00:00:00' })]);
  optins.readCampaignPreviews.mockResolvedValue([]);
  optins.unpublishOptin.mockResolvedValue({});
  stats.readReport.mockResolvedValue({ from: '2026-11-20', to: '2026-11-28', days: 9, goals: [], impact: [] });
});

const page = () => render(<OccasionPage id={BLACK_FRIDAY.id} notice={null} onNotice={vi.fn()} onDismissNotice={vi.fn()} navigate={vi.fn()} onEdit={vi.fn()} />);

it('gives each campaign the list’s row menu, without Details or A/B tests', async () => {
  page();
  await userEvent.click(await screen.findByRole('button', { name: 'More actions for Black Friday bar' }));

  const menu = screen.getByRole('menu', { name: 'More actions for Black Friday bar' });
  for (const item of ['Preview on site', 'View report', 'Duplicate as draft', 'Unpublish campaign', 'Delete campaign']) {
    expect(within(menu).getByRole('menuitem', { name: new RegExp(item) })).toBeInTheDocument();
  }
  expect(within(menu).queryByRole('menuitem', { name: /Details/ })).not.toBeInTheDocument();
  expect(within(menu).queryByRole('menuitem', { name: /A\/B test/ })).not.toBeInTheDocument();
});

it('asks before unpublishing, then unpublishes and reads the list again', async () => {
  page();
  await userEvent.click(await screen.findByRole('button', { name: 'More actions for Black Friday bar' }));
  await userEvent.click(screen.getByRole('menuitem', { name: /Unpublish campaign/ }));

  expect(optins.unpublishOptin).not.toHaveBeenCalled();
  const dialog = await screen.findByRole('alertdialog');
  const reads = optins.listOptins.mock.calls.length;
  await userEvent.click(within(dialog).getByRole('button', { name: /Unpublish/ }));

  expect(optins.unpublishOptin).toHaveBeenCalledExactlyOnceWith('01JBAR000000000000000000AA');
  await screen.findByRole('button', { name: 'More actions for Black Friday bar' });
  expect(optins.listOptins.mock.calls.length).toBeGreaterThan(reads);
});
