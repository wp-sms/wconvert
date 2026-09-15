import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../resources/admin/src/App';

const api = vi.hoisted(() => ({ readDestinations: vi.fn() }));
const HEALTHY = { destinations: [], failures: [] };
const ISSUES = { destinations: [], failures: [{ destination: 'route-1' }, { destination: 'route-1' }] };
vi.mock('../../resources/admin/src/leads/LeadLog', () => ({
  LeadLog: ({ onRefresh }: { onRefresh: () => void }) => <><p>Submission table</p><button onClick={onRefresh}>Refresh submissions</button></>,
}));
vi.mock('../../resources/admin/src/destinations/Destinations', () => ({ Destinations: () => <p>Sending diagnostics</p> }));
vi.mock('../../resources/admin/src/destinations/api', () => api);

beforeEach(() => {
  vi.clearAllMocks();
  api.readDestinations.mockResolvedValue(HEALTHY);
  window.history.replaceState({}, '', '#leads');
});

it('makes submissions the default without tabs, setup shortcut or healthy-state issue action', async () => {
  render(<App />);
  await waitFor(() => expect(api.readDestinations).toHaveBeenCalledOnce());
  expect(screen.getByRole('main')).toHaveTextContent('Submission table');
  expect(screen.queryByRole('navigation', { name: 'Leads views' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Sending setup' })).toBeNull();
  expect(screen.queryByRole('link', { name: /Sending issues/ })).toBeNull();
  expect(screen.queryByText('Every form submission, as it was captured.')).toBeNull();
});

it('shows affected destination count only for known problems and returns from diagnostics', async () => {
  api.readDestinations.mockResolvedValue(ISSUES);
  render(<App />);
  const issues = await screen.findByRole('link', { name: 'Sending issues 1' });
  expect(issues.closest('.wconvert-page-actions')).not.toBeNull();
  await userEvent.click(issues);
  expect(await screen.findByText('Sending diagnostics')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sending issues');
  await userEvent.click(screen.getByRole('link', { name: 'Back to submissions' }));
  expect(await screen.findByText('Submission table')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Leads');
});

it('does not invent an issue action during loading or a failed health read', async () => {
  let reject!: (error: Error) => void;
  api.readDestinations.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  render(<App />);
  expect(screen.queryByRole('link', { name: /Sending issues/ })).toBeNull();
  await act(async () => reject(new Error('Unavailable')));
  expect(screen.queryByRole('link', { name: /Sending issues/ })).toBeNull();
  expect(screen.getByText('Submission table')).toBeInTheDocument();
});

it('removes the issue action when a refreshed read has no remaining problems', async () => {
  api.readDestinations.mockResolvedValueOnce(ISSUES).mockResolvedValue(HEALTHY);
  render(<App />);
  await screen.findByRole('link', { name: 'Sending issues 1' });
  await userEvent.click(screen.getByRole('button', { name: 'Refresh submissions' }));
  await waitFor(() => expect(api.readDestinations).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('link', { name: /Sending issues/ })).toBeNull();
});

it('keeps bookmarked diagnostics reachable with a way back even without a known count', () => {
  window.history.replaceState({}, '', '#leads?view=issues');
  render(<App />);
  expect(screen.getByText('Sending diagnostics')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to submissions' })).toHaveAttribute('href', '#leads');
  expect(screen.queryByRole('link', { name: 'Sending setup' })).toBeNull();
});
