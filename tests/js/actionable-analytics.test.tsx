import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
  expect(screen.getAllByText('2%')).toHaveLength(3);
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
