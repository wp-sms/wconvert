import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiFetch from '@wordpress/api-fetch';
import { Insights, type Insight } from '../../resources/admin/src/stats/Insights';
import { JourneyReport } from '../../resources/admin/src/stats/JourneyReport';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('shows at most three observations with inspectable denominators and a scoped edit link', async () => {
  const evidence: Insight = { rule_id: 'lower_rate', fingerprint: 'one', optin_id: 'campaign', goal: 'grow_email_list', name: 'Newsletter', title: 'Result rate fell', note: 'Review the comparison.', result_label: 'Email submissions', limitation: 'The cause is unknown.', action: 'edit', facts: { current: { appearances: 1000, results: 20, rate: .02 }, previous: { appearances: 1000, results: 40, rate: .04 } }, periods: { from: '2026-09-24', to: '2026-09-30', previous_from: '2026-09-17', previous_to: '2026-09-23' } };
  render(<Insights items={[1,2,3,4].map(n => ({ ...evidence, fingerprint: String(n) }))} query={{ days: 7 }} />);
  expect(screen.getAllByRole('article')).toHaveLength(3);
  await userEvent.click(screen.getAllByText('View evidence')[0]);
  expect(screen.getAllByRole('table', { name: 'Insight evidence' })).toHaveLength(3);
  expect(within(screen.getAllByRole('table', { name: 'Insight evidence' })[0]).getByText('2%')).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Edit campaign' })[0].getAttribute('href')).toContain('campaign');
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
