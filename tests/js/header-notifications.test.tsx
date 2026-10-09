import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The bell's unread dot is read on LOAD (ADR 0131). It used to be fetched only
 * when the popover opened, so every page said "nothing to see" until the
 * merchant had already looked — which is the one thing a dot exists to avoid.
 */
const api = vi.hoisted(() => ({ listOptins: vi.fn(), readDestinations: vi.fn() }));
vi.mock('../../resources/admin/src/optins/api', async (original) => ({
  ...(await original<typeof import('../../resources/admin/src/optins/api')>()),
  listOptins: api.listOptins,
}));
vi.mock('../../resources/admin/src/destinations/api', () => ({ readDestinations: api.readDestinations }));
const protection = vi.hoisted(() => vi.fn());
vi.mock('@wordpress/api-fetch', () => ({ default: protection }));
const { HeaderTools } = await import('../../resources/admin/src/shell/HeaderTools');

const SUSPENDED = {
  id: '01JQ00000000000000000000AA', name: '', goal: 'grow_email_list', parent_id: null,
  published_at: '2026-09-01 10:00:00', has_unpublished_changes: false, deleted_at: null,
  suspended: 'WooCommerce is inactive.', arms: [],
};

beforeEach(() => {
  protection.mockResolvedValue(null);
  vi.clearAllMocks();
  api.readDestinations.mockResolvedValue({ destinations: [], failures: [] });
});

it('shows how many things need attention before the bell is ever opened', async () => {
  api.listOptins.mockResolvedValue([SUSPENDED]);
  render(<HeaderTools />);
  expect(await screen.findByRole('button', { name: 'Notifications, 1 issue' })).toBeInTheDocument();
  expect(document.querySelector('.wconvert-notification-count')).toHaveTextContent('1');
});

it('names an unnamed campaign without its ID, with its status', async () => {
  api.listOptins.mockResolvedValue([SUSPENDED]);
  render(<HeaderTools />);
  await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 issue' }));
  const popover = await screen.findByRole('dialog');
  expect(within(popover).getByText('Unnamed campaign')).toBeInTheDocument();
  expect(within(popover).getByText('Suspended')).toBeInTheDocument();
  expect(within(popover).queryByText(SUSPENDED.id)).toBeNull();
});

it('keeps a quiet bell, and no dot, where nothing needs attention', async () => {
  api.listOptins.mockResolvedValue([]);
  render(<HeaderTools />);
  await vi.waitFor(() => expect(api.listOptins).toHaveBeenCalled());
  expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  expect(document.querySelector('.wconvert-notification-dot')).toBeNull();
});

it('offers one way to try again when the read fails', async () => {
  api.listOptins.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue([]);
  render(<HeaderTools />);
  await vi.waitFor(() => expect(api.listOptins).toHaveBeenCalledTimes(1));
  api.listOptins.mockRejectedValueOnce(new Error('Offline'));
  await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
  const popover = await screen.findByRole('dialog');
  expect(await within(popover).findByRole('alert')).toHaveTextContent('Notifications couldn’t load: Offline');
  await userEvent.click(within(popover).getByRole('button', { name: 'Try again' }));
  expect(await within(popover).findByText('Everything is running. Checked just now.')).toBeInTheDocument();
});

it('counts forms paused by spam protection as something broken', async () => {
  api.listOptins.mockResolvedValue([]);
  protection.mockResolvedValue({ rules_configured: true, rules_available: false });
  render(<HeaderTools />);
  await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 issue' }));
  expect(await screen.findByText('Forms are paused')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Review spam protection' })).toHaveAttribute('href', '#settings?group=protection');
});
