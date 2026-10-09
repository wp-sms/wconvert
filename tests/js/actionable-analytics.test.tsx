import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiFetch from '@wordpress/api-fetch';
import { DeliveryAttention } from '../../resources/admin/src/stats/DeliveryAttention';
import { readDestinations, type DestinationsPayload } from '../../resources/admin/src/destinations/api';
import { Insights, type Insight } from '../../resources/admin/src/stats/Insights';
import { Interests } from '../../resources/admin/src/stats/Interests';
import { ReportNavigationProvider, ReportShortcuts, ReportTarget } from '../../resources/admin/src/stats/ReportNavigation';
import { routeFrom } from '../../resources/admin/src/nav';
import { formatWhen } from '../../resources/admin/src/lib/format';
import { JourneyReport } from '../../resources/admin/src/stats/JourneyReport';
vi.mock('../../resources/admin/src/destinations/api', () => ({ readDestinations: vi.fn() }));
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('shows at most three observations with inspectable denominators and a scoped edit link', async () => {
  const evidence: Insight = { rule_id: 'lower_rate', fingerprint: 'one', optin_id: 'campaign', goal: 'grow_email_list', name: 'Newsletter', title: 'Result rate fell', note: 'Review the comparison.', result_label: 'Email submissions', rate_label: 'Email submission rate', limitation: 'The cause is unknown.', action: 'edit', facts: { current: { appearances: 1000, results: 20, rate: .02 }, previous: { appearances: 1000, results: 40, rate: .04 } }, periods: { from: '2026-09-24', to: '2026-09-30', previous_from: '2026-09-17', previous_to: '2026-09-23' } };
  render(<Insights items={[1,2,3,4].map(n => ({ ...evidence, fingerprint: String(n) }))} query={{ days: 7 }} />);
  expect(screen.getAllByRole('article')).toHaveLength(3);
  await userEvent.click(screen.getAllByText('View evidence')[0]);
  expect(screen.getAllByRole('table', { name: 'Insight evidence' })).toHaveLength(3);
  expect(within(screen.getAllByRole('table', { name: 'Insight evidence' })[0]).getByText('2%')).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Open editor' })[0].getAttribute('href')).toContain('campaign');
  expect(screen.getByText('1 more campaign needs attention. Open a goal to see it.')).toBeInTheDocument();
  expect(screen.queryByText(/apply automatically/i)).not.toBeInTheDocument();
});
it('refuses journey numbers from a different reporting period', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ from: '2026-09-01', to: '2026-09-07', rows: [], definitions: {}, days: 7 });
  render(<JourneyReport id="campaign" period={{ from: '2026-09-24', to: '2026-09-30', days: 7 }} />);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load matching journey totals'));
  expect(vi.mocked(apiFetch).mock.calls[0][0].path).toContain('complete=1');
  expect(screen.queryByText('No journey activity in this period.')).not.toBeInTheDocument();
});

it('keeps accepted activity and its dates when a new period fails', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce({ from: '2026-09-24', to: '2026-09-30', rows: [{ scope: 'channel:email_marketing', kind: 'channel_capture', total: '17' }], definitions: {}, days: 7 });
  const view = render(<JourneyReport id="campaign" period={{ from: '2026-09-24', to: '2026-09-30', days: 7 }} />);
  await screen.findByText('17');
  vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'));
  view.rerender(<JourneyReport id="campaign" period={{ from: '2026-09-01', to: '2026-09-30', days: 30 }} />);
  await screen.findByRole('alert');
  expect(screen.getByText('17')).toBeInTheDocument();
  expect(screen.getByText(/Sep 24.*30, 2026/)).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '17' })).toHaveAttribute('data-label', 'Accepted');
});

it('groups actions by screen without combining revisions or inventing missing counts', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ from: '2026-09-24', to: '2026-09-30', days: 7, definitions: { old: { intro: { name: 'Welcome', order: 0 } }, current: { intro: { name: 'Welcome', order: 0 } } }, rows: [
    { scope: 'screen:old:intro', kind: 'screen_shown', total: '80' },
    { scope: 'screen:old:intro', kind: 'screen_advanced', total: '50' },
    { scope: 'screen:current:intro', kind: 'screen_shown', total: '100' },
  ] });
  render(<JourneyReport id="campaign" period={{ from: '2026-09-24', to: '2026-09-30', days: 7 }} />);
  const table = await screen.findByRole('table', { name: 'Screen activity' });
  const rows = within(table).getAllByRole('row');
  expect(rows).toHaveLength(3);
  expect(rows[1]).toHaveTextContent('Version 1'); expect(rows[1]).toHaveTextContent('80'); expect(rows[1]).toHaveTextContent('50');
  expect(rows[2]).toHaveTextContent('Version 2'); expect(rows[2]).toHaveTextContent('100');
  expect(within(rows[2]).getAllByRole('cell').slice(2).map(cell => cell.textContent)).toEqual(['—', '—', '—']);
});

it('shows the newest sending issue across independent diagnostic sources', async () => {
  vi.mocked(readDestinations).mockResolvedValue({ destinations: [{ id: 'mail', label: 'Newsletter', availability: 'ready', health: { consecutive_failures: 2, skipped_captures: 1, last_error_at: '2026-10-01 10:00:00', last_skipped_at: '2026-10-03 10:00:00' } }], failures: [{ destination: 'mail', at: '2026-10-04 10:00:00' }] } as DestinationsPayload);
  render(<DeliveryAttention />);
  await userEvent.click(await screen.findByText('Affected destinations'));
  expect(screen.getByRole('cell', { name: formatWhen('2026-10-04 10:00', 'detail') })).toBeInTheDocument();
  expect(screen.queryByText(/2026-10-0/)).not.toBeInTheDocument();
});

it('takes a display warning straight to display rules', () => {
  const item: Insight = { rule_id: 'no_appearances', fingerprint: 'none', optin_id: 'campaign', goal: 'grow_email_list', name: 'Newsletter', title: 'Not shown in this period', note: 'Review display rules.', result_label: 'Email submissions', rate_label: 'Email submission rate', limitation: 'Cause unknown.', action: 'display', facts: { current: { appearances: 0, results: 0, rate: null }, previous: null }, periods: { from: '2026-09-01', to: '2026-09-30', previous_from: null, previous_to: null } };
  render(<Insights items={[item]} query={{ days: 30, optinId: 'campaign' }} />);
  const route = routeFrom(screen.getByRole('link', { name: 'Review display rules' }).getAttribute('href')!);
  expect(route.editorTab).toBe('rules');
  expect(route.returnTo).toContain('optin=campaign');
});

it('explains multiple answers beside the counts without opening help', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ from: '2026-09-24', to: '2026-09-30', answered: 0, retained: 48, choices: [], questions: [{ question: 'What matters?', multiple: true, answered: 48, choices: [{ label: 'Gentle ingredients', count: 28 }, { label: 'A simple routine', count: 24 }] }] });
  render(<Interests id="campaign" period={{ from: '2026-09-24', to: '2026-09-30', days: 7 } as import('../../resources/admin/src/stats/api').DashboardPayload} />);
  expect(await screen.findByText('28 of 48')).toBeVisible();
  expect(screen.getByText('Multiple answers allowed; percentages can exceed 100%.')).toBeVisible();
});

it('jumps to a mounted report with keyboard focus and removes unavailable shortcuts', async () => {
  const scroll = vi.fn();
  const content = (sales: boolean) => <ReportNavigationProvider><ReportShortcuts />
    {sales && <ReportTarget name="sales" label="Sales"><h2>Campaign sales</h2></ReportTarget>}
    <ReportTarget name="activity" label="Screen activity"><h2>Activity</h2></ReportTarget>
    <ReportTarget name="answers" label="Answers"><h2>Saved answers</h2></ReportTarget>
  </ReportNavigationProvider>;
  const view = render(content(true));
  const button = screen.getByRole('button', { name: 'Sales' });
  const target = document.getElementById(button.getAttribute('aria-controls')!)!;
  target.scrollIntoView = scroll;
  await userEvent.click(button);
  expect(target).toHaveFocus();
  expect(scroll).toHaveBeenCalledWith({ block: 'start' });
  view.rerender(content(false));
  expect(screen.queryByRole('button', { name: 'Sales' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Answers' })).toBeInTheDocument();
});

it('asks every campaign report for the window the overview accepted (ADR 0132)', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ from: '2026-09-01', to: '2026-09-10', rows: [], definitions: {}, days: 10 });
  const view = render(<JourneyReport id="campaign" period={{ from: '2026-09-01', to: '2026-09-10', days: 10, custom: true }} />);
  await waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalled());
  expect(vi.mocked(apiFetch).mock.calls[0][0].path).toBe('/wconvert/v1/optins/campaign/journey-stats?from=2026-09-01&to=2026-09-10');
  view.unmount();
  vi.mocked(apiFetch).mockClear();
  render(<JourneyReport id="campaign" period={{ from: '2026-09-14', to: '2026-09-14', days: 1, complete_days: false }} />);
  await waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalled());
  expect(vi.mocked(apiFetch).mock.calls[0][0].path).toBe('/wconvert/v1/optins/campaign/journey-stats?days=1&complete=0');
});

it('says the one sentence about today where a month has no complete day yet', () => {
  render(<JourneyReport id="campaign" period={{ from: '2026-10-01', to: '2026-10-01', days: 0, month: '2026-10' }} />);
  expect(screen.getByText('Today’s activity appears tomorrow. Choose Today to see it so far.')).toBeInTheDocument();
});
