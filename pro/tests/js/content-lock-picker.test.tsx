import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import apiFetch from '@wordpress/api-fetch';
import { CampaignPicker } from '../../modules/content-lock/block/CampaignPicker';

vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
beforeEach(() => { vi.mocked(apiFetch).mockReset(); });
it('refreshes published choices without changing the saved selection or offering ordinary inline campaigns', async () => {
  window.wconvertContentLockEditor = { campaigns: [{ id: 'old', name: 'Original bonus', status: 'ready' }, { id: 'form', name: 'Ordinary form', status: 'disabled' }], manageUrl: null };
  const change = vi.fn();
  render(<CampaignPicker value="old" onChange={change} />);
  expect(screen.queryByText('Ordinary form')).toBeNull();
  vi.mocked(apiFetch).mockResolvedValue({ campaigns: [{ id: 'new', name: 'New bonus', status: 'ready' }], manageUrl: null });
  await userEvent.click(screen.getByRole('button', { name: 'Refresh Campaigns' }));
  expect(await screen.findByText(/no longer published as inline/i)).toBeVisible();
  expect(screen.getByText('Previously selected Campaign')).toBeVisible();
  expect(screen.queryByRole('combobox', { name: 'Campaign' })).toBeNull();
  expect(change).not.toHaveBeenCalled();
  expect(screen.queryByRole('link', { name: /Campaigns/ })).toBeNull();
});

it('keeps the selection when refresh fails and distinguishes missing data from an empty list', async () => {
  window.wconvertContentLockEditor = undefined;
  const change = vi.fn();
  render(<CampaignPicker value="saved" onChange={change} />);
  expect(screen.getByText(/choices could not be loaded/)).toBeVisible();
  expect(screen.queryByText(/No published Content lock Campaigns/)).toBeNull();
  vi.mocked(apiFetch).mockRejectedValue(new Error('Offline'));
  await userEvent.click(screen.getByRole('button', { name: 'Refresh Campaigns' }));
  expect(await screen.findByText(/Could not refresh Campaigns/)).toBeVisible();
  expect(change).not.toHaveBeenCalled();
});

it('shows the full selected name and changes or clears it without changing content', async () => {
  const name = 'Newsletter signup after an article with a long Campaign name';
  window.wconvertContentLockEditor = { campaigns: [{ id: 'old', name, status: 'ready' }, { id: 'new', name: 'New bonus', status: 'ready' }], manageUrl: null };
  const change = vi.fn();
  const { rerender } = render(<CampaignPicker value="old" onChange={change} />);
  expect(screen.getByText(name)).toBeVisible();
  expect(screen.queryByRole('combobox', { name: 'Campaign' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Change Campaign' }));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Campaign' }), 'new');
  expect(change).toHaveBeenLastCalledWith('new');
  rerender(<CampaignPicker value="new" onChange={change} />);
  await userEvent.click(screen.getByRole('button', { name: 'Clear Campaign' }));
  expect(change).toHaveBeenLastCalledWith('');
  rerender(<CampaignPicker value="" onChange={change} />);
  expect(screen.getByRole('combobox', { name: 'Campaign' })).toBeVisible();
});

it.each([
  { status: 'unavailable' as const, selected: { id: 'saved', name: 'Temporarily unavailable bonus', status: 'unavailable' as const }, label: 'Temporarily unavailable bonus' },
  { status: 'missing' as const, selected: null, label: 'Previously selected Campaign' },
])('keeps a $status saved selection in a repairable name card', async ({ selected, label }) => {
  window.wconvertContentLockEditor = {
    campaigns: [...(selected ? [selected] : []), { id: 'ready', name: 'Ready bonus', status: 'ready' }],
    manageUrl: null,
  };
  const change = vi.fn();
  const { rerender } = render(<CampaignPicker value="saved" onChange={change} />);
  expect(screen.getByText(label)).toBeVisible();
  expect(screen.queryByRole('combobox', { name: 'Campaign' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Change Campaign' }));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Campaign' }), 'ready');
  expect(change).toHaveBeenLastCalledWith('ready');
  rerender(<CampaignPicker value="saved" onChange={change} />);
  await userEvent.click(screen.getByRole('button', { name: 'Clear Campaign' }));
  expect(change).toHaveBeenLastCalledWith('');
});
