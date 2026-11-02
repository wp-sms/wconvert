import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Settings → Email reports (ADR 0176). */
const api = vi.hoisted(() => ({ readWeeklySummary: vi.fn(), saveWeeklySummary: vi.fn(), sendTestSummary: vi.fn() }));
vi.mock('../../resources/admin/src/settings-page/emailReportsApi', () => api);

const { EmailReports } = await import('../../resources/admin/src/settings-page/EmailReports');

const SAVED = { enabled: true, recipients: 'owner@example.com', default_recipient: 'owner@example.com', waiting_for_publish: false, next_send: 'Monday, November 2, 2026, 9:00 am' };

beforeEach(() => {
  vi.clearAllMocks();
  api.readWeeklySummary.mockResolvedValue(SAVED);
});

it('is on, to the admin email, and says when the next one goes', async () => {
  render(<EmailReports />);

  expect(await screen.findByRole('checkbox', { name: /Send me a weekly summary/ })).toBeChecked();
  expect(screen.getByLabelText('Send to')).toHaveValue('owner@example.com');
  expect(screen.getByText('Next summary: Monday, November 2, 2026, 9:00 am, in your site’s time zone.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save email reports' })).toBeDisabled();
});

it('says it waits for the first publish', async () => {
  api.readWeeklySummary.mockResolvedValue({ ...SAVED, waiting_for_publish: true });
  render(<EmailReports />);

  expect(await screen.findByText('The first one goes out the Monday after your first campaign is published.')).toBeInTheDocument();
});

it('sends a test to the addresses typed, before saving', async () => {
  api.sendTestSummary.mockResolvedValue({ sent: true, to: ['me@example.com'] });
  render(<EmailReports />);
  const field = await screen.findByLabelText('Send to');
  await userEvent.clear(field);
  await userEvent.type(field, 'me@example.com');

  await userEvent.click(screen.getByRole('button', { name: 'Send a test email' }));

  expect(api.sendTestSummary).toHaveBeenCalledWith('me@example.com');
  expect(await screen.findByText(/Test sent to me@example.com\./)).toBeInTheDocument();
  expect(api.saveWeeklySummary).not.toHaveBeenCalled();
});

it('hides the address and the test when switched off, and saves that', async () => {
  api.saveWeeklySummary.mockResolvedValue({ ...SAVED, enabled: false });
  render(<EmailReports />);
  await userEvent.click(await screen.findByRole('checkbox', { name: /Send me a weekly summary/ }));

  expect(screen.queryByLabelText('Send to')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Send a test email' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Save email reports' }));

  expect(api.saveWeeklySummary).toHaveBeenCalledWith(false, 'owner@example.com');
});

it('shows the server’s reason when an address is refused', async () => {
  api.saveWeeklySummary.mockRejectedValue({ code: 'wconvert_invalid_recipients', message: 'Check these addresses: nope' });
  render(<EmailReports />);
  const field = await screen.findByLabelText('Send to');
  await userEvent.type(field, ', nope');
  await userEvent.click(screen.getByRole('button', { name: 'Save email reports' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Check these addresses: nope');
});

it('offers Cancel changes only while there is something to cancel, and puts it all back', async () => {
  render(<EmailReports />);
  const field = await screen.findByLabelText('Send to');
  expect(screen.queryByRole('button', { name: 'Cancel changes' })).toBeNull();

  await userEvent.type(field, ', me@example.com');
  await userEvent.click(screen.getByRole('checkbox', { name: /Send me a weekly summary/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel changes' }));

  expect(screen.getByRole('checkbox', { name: /Send me a weekly summary/ })).toBeChecked();
  expect(screen.getByLabelText('Send to')).toHaveValue('owner@example.com');
  expect(screen.queryByRole('button', { name: 'Cancel changes' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Save email reports' })).toBeDisabled();
  expect(api.saveWeeklySummary).not.toHaveBeenCalled();
});

it('says a refused save beside Save', async () => {
  api.saveWeeklySummary.mockRejectedValue({ code: 'nope', message: 'The site refused it.' });
  render(<EmailReports />);
  await userEvent.type(await screen.findByLabelText('Send to'), ', nope');
  const save = screen.getByRole('button', { name: 'Save email reports' });
  await userEvent.click(save);

  expect((await screen.findByRole('alert')).parentElement).toBe(save.parentElement);
});
