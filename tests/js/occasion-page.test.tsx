import { beforeEach, expect, it, onTestFinished, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
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

it('names the occasion in its edit dialog', async () => {
  page();
  await userEvent.click(await screen.findByRole('button', { name: `Actions for ${BLACK_FRIDAY.name}` }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Edit occasion' }));
  expect(await screen.findByRole('dialog', { name: BLACK_FRIDAY.name })).toBeInTheDocument();
});

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

it('keeps its rows while a row action reads the list again, and says so when that read fails', async () => {
  page();
  await userEvent.click(await screen.findByRole('button', { name: 'More actions for Black Friday bar' }));
  await userEvent.click(screen.getByRole('menuitem', { name: /Unpublish campaign/ }));
  const dialog = await screen.findByRole('alertdialog');
  let refuse!: (cause: unknown) => void;
  optins.listOptins.mockImplementationOnce(() => new Promise((_resolve, reject) => { refuse = reject; }));
  await userEvent.click(within(dialog).getByRole('button', { name: /Unpublish/ }));
  await vi.waitFor(() => expect(refuse).toBeDefined());

  // In flight: no skeleton where the table was.
  expect(screen.getByRole('table', { name: /Campaigns in/ })).toBeInTheDocument();
  await act(async () => refuse({ code: 'x', message: 'The server is away.' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('still shows what was read before. The server is away.');
  expect(screen.getByRole('table', { name: /Campaigns in/ })).toBeInTheDocument();
  await userEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }));
  await vi.waitFor(() => expect(screen.queryByText(/still shows what was read before/)).toBeNull());
});

it('a first read that fails has nothing to keep, and offers Try again', async () => {
  optins.listOptins.mockRejectedValueOnce({ code: 'x', message: 'The server is away.' });
  page();
  expect(await screen.findByText('The server is away.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('table', { name: /Campaigns in/ })).toBeInTheDocument();
});

it('a first results failure fills the region, and a later one keeps the numbers under a band', async () => {
  // An occasion already over, so its own days are a window with results to read.
  occasionsApi.readOccasions.mockResolvedValue({ schema: 1, revision: 1, items: [{ ...BLACK_FRIDAY, start: '2024-11-20', end: '2024-12-01' }] });
  stats.readReport.mockReset();
  stats.readReport.mockRejectedValueOnce({ code: 'x', message: 'No report today.' }).mockResolvedValue({ from: '2024-11-20', to: '2024-12-01', days: 12, goals: [], impact: [] });
  page();
  expect(await screen.findByText('No report today.')).toBeInTheDocument();
  const results = () => within(screen.getByRole('region', { name: 'Results' }));
  await userEvent.click(results().getByRole('button', { name: 'Try again' }));
  await vi.waitFor(() => expect(screen.queryByText('No report today.')).toBeNull());
  expect(results().queryByRole('alert')).toBeNull();

  // Now a period change fails over the numbers on screen: they stay, under a band.
  stats.readReport.mockRejectedValueOnce({ code: 'x', message: 'No report today.' });
  await userEvent.click(results().getByRole('button', { name: /Results period/ }));
  await userEvent.click(await screen.findByRole('radio', { name: 'Last 7 days' }));
  expect(await results().findByRole('alert')).toHaveTextContent('Results could not refresh. The previous period and results remain below.');
  expect(screen.queryByText('No report today.')).toBeNull();
  // The picker's dates stay those of the numbers on screen.
  expect(results().getByRole('button', { name: /Results period: .*Nov 20/ })).toBeInTheDocument();
});

it('draws a preview that could not be read, with a way to read it again', async () => {
  optins.readCampaignPreviews.mockRejectedValueOnce({ code: 'x', message: 'No previews.' });
  page();
  expect(await screen.findByText('Design previews could not load.')).toBeInTheDocument();
  await userEvent.click(within(screen.getByRole('region', { name: 'Campaigns' })).getByRole('button', { name: 'Try again' }));
  await vi.waitFor(() => expect(screen.queryByText('Design previews could not load.')).toBeNull());
  expect(optins.readCampaignPreviews).toHaveBeenCalledTimes(2);
});

it('names a row’s next action as Campaigns does, under the same column', async () => {
  optins.listOptins.mockResolvedValue([
    row('01JBAR000000000000000000AA', 'Changed', { published_at: '2026-11-01 00:00:00', has_unpublished_changes: true }),
    row('01JBAR000000000000000000AB', 'Stopped', { published_at: '2026-11-01 00:00:00', suspended: 'Needs a product.' }),
    row('01JBAR000000000000000000AC', 'Draft'),
    row('01JBAR000000000000000000AD', 'Live', { published_at: '2026-11-01 00:00:00' }),
  ]);
  page();
  await screen.findByRole('button', { name: 'Review changes' });
  expect(screen.getByRole('columnheader', { name: 'Next action' })).toBeInTheDocument();
  for (const label of ['Review changes', 'Review issue', 'Continue editing', 'Edit']) {
    expect(screen.getByRole('button', { name: label })).toHaveClass('text-action');
  }
});

it('states the list’s count and the dates of its numbers in the foot', async () => {
  // An occasion already over, so there is a window to read whatever day this runs.
  occasionsApi.readOccasions.mockResolvedValue({ schema: 1, revision: 1, items: [{ ...BLACK_FRIDAY, start: '2020-01-01', end: '2020-02-01' }] });
  page();
  await screen.findByText('1 campaign');
  await waitFor(() => expect(screen.getByText('1 campaign').closest('.wconvert-list-foot')).toHaveTextContent(/1 campaign · .*2026/));
});
