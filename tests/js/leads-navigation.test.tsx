import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../resources/admin/src/App';

vi.mock('../../resources/admin/src/leads/LeadLog', () => ({ LeadLog: () => <p>Submission table</p> }));
vi.mock('../../resources/admin/src/destinations/Destinations', () => ({ Destinations: () => <p>Sending diagnostics</p> }));
vi.mock('../../resources/admin/src/destinations/api', () => ({
  readDestinations: vi.fn().mockResolvedValue({ destinations: [], failures: [] }),
}));

beforeEach(() => {
  window.history.replaceState({}, '', '#leads?days=30');
});

it('puts compact view navigation in the heading instead of above the table body', async () => {
  render(<App />);
  const nav = screen.getByRole('navigation', { name: 'Leads views' });
  expect(nav.closest('.wconvert-panel-heading')).not.toBeNull();
  expect(within(screen.getByRole('main')).queryByRole('navigation', { name: 'Leads views' })).toBeNull();
  expect(screen.getByRole('main')).toHaveTextContent('Submission table');
  expect(within(nav).getByRole('link', { name: 'Submissions' })).toHaveAttribute('aria-current', 'page');
  expect(within(nav).getByRole('link', { name: 'Sending setup' })).toHaveAttribute('href', '#settings?group=connections');
  await userEvent.click(within(nav).getByRole('link', { name: 'Sending issues' }));
  expect(await screen.findByText('Sending diagnostics')).toBeInTheDocument();
  expect(within(nav).getByRole('link', { name: 'Sending issues' })).toHaveAttribute('aria-current', 'page');
  expect(within(nav).getByRole('link', { name: 'Submissions' })).not.toHaveAttribute('aria-current');
  await userEvent.click(within(nav).getByRole('link', { name: 'Submissions' }));
  expect(await screen.findByText('Submission table')).toBeInTheDocument();
});
