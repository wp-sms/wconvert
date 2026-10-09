import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import apiFetch from '@wordpress/api-fetch';
import { ProductActivityReport } from '../../resources/admin/src/stats/ProductActivityReport';
vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
const api = vi.mocked(apiFetch);
const period = { days: 30, from: '2026-09-06', to: '2026-10-05' };
const data = { available: true, collecting: true, since: '2026-10-03', from: period.from, to: period.to, days: 30,
  recorded_from: '2026-10-03', truncated: false, retention_days: 90,
  rows: [{ id: 42, name: 'Coffee filter', shown: 12, clicked: 3, added: 2 }] };
beforeEach(() => { api.mockReset(); window.wconvertAdmin = { exportUrl: '', commerce: true }; });
afterEach(() => { cleanup(); delete window.wconvertAdmin; });
it('shows product actions and explains the shorter recorded period', async () => {
  api.mockResolvedValue(data); render(<ProductActivityReport id="campaign" period={period} />);
  expect(await screen.findByText('Coffee filter')).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Added' })).toBeTruthy();
  expect(screen.getByText(/Earlier product activity is unavailable/)).toBeTruthy();
  expect(screen.queryByText(/The rest of this period/)).toBeNull();
  expect(screen.queryByText(/#42/)).toBeNull();
});
it('suppresses an incomplete table instead of presenting a partial ranking', async () => {
  api.mockResolvedValue({ ...data, truncated: true }); render(<ProductActivityReport id="campaign" period={period} />);
  expect(await screen.findByText('Choose a shorter period')).toBeTruthy(); expect(screen.queryByText('Coffee filter')).toBeNull();
});
it('does not show the old campaign while a new report loads, or accept its late response', async () => {
  let resolveOld: (value: unknown) => void = () => {};
  api.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  api.mockResolvedValueOnce({ ...data, rows: [{ ...data.rows[0], name: 'New product' }] });
  const view = render(<ProductActivityReport id="old" period={period} />);
  view.rerender(<ProductActivityReport id="new" period={period} />);
  expect(await screen.findByText('New product')).toBeTruthy();
  await act(async () => resolveOld(data)); expect(screen.queryByText('Coffee filter')).toBeNull();
});
it('shows a failure instead of mismatched dates or false zeroes', async () => {
  api.mockResolvedValue({ ...data, to: '2026-10-04' }); render(<ProductActivityReport id="campaign" period={period} />);
  expect(await screen.findByText('Could not load product activity.')).toBeTruthy(); expect(screen.queryByText('Coffee filter')).toBeNull();
});
it('hides the section for campaigns without product instrumentation', async () => {
  api.mockResolvedValue({ ...data, available: false, rows: [], since: null });
  const view = render(<ProductActivityReport id="campaign" period={period} />);
  await waitFor(() => expect(view.container.innerHTML).toBe(''));
});
it('waits without a placeholder, and stays away on failure, where no product module is active', async () => {
  delete window.wconvertAdmin;
  let fail: (reason: unknown) => void = () => {};
  api.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  const view = render(<ProductActivityReport id="campaign" period={period} />);
  expect(view.container.innerHTML).toBe('');
  await act(async () => fail(new Error('offline')));
  expect(view.container.innerHTML).toBe('');
});
it('still shows activity a removed module left behind', async () => {
  delete window.wconvertAdmin;
  api.mockResolvedValue(data); render(<ProductActivityReport id="campaign" period={period} />);
  expect(await screen.findByText('Coffee filter')).toBeTruthy();
});
