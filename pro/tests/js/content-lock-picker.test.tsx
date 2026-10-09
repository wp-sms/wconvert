import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import apiFetch from '@wordpress/api-fetch';
import { CampaignPicker, boundaryLabel } from '../../modules/content-lock/block/CampaignPicker';
import { useState } from 'react';

vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn() }));
beforeEach(() => { vi.mocked(apiFetch).mockReset(); });
it('refreshes published choices without changing the saved selection or offering ordinary inline campaigns', async () => {
  window.wconvertContentLockEditor = { campaigns: [{ id: 'old', name: 'Original bonus', status: 'ready' }, { id: 'form', name: 'Ordinary form', status: 'disabled' }], manageUrl: null };
  const change = vi.fn();
  render(<CampaignPicker value="old" onChange={change} />);
  expect(screen.queryByText('Ordinary form')).toBeNull();
  vi.mocked(apiFetch).mockResolvedValue({ campaigns: [{ id: 'new', name: 'New bonus', status: 'ready' }], manageUrl: null });
  await userEvent.click(screen.getByRole('button', { name: 'Refresh campaigns' }));
  expect(await screen.findByText(/no longer published as inline/i)).toBeVisible();
  expect(screen.getByText('Previously selected campaign')).toBeVisible();
  expect(screen.queryByRole('combobox', { name: 'Campaign' })).toBeNull();
  expect(change).not.toHaveBeenCalled();
  expect(screen.queryByRole('link', { name: /Campaigns/ })).toBeNull();
});

it('keeps the selection when refresh fails and distinguishes missing data from an empty list', async () => {
  window.wconvertContentLockEditor = undefined;
  const change = vi.fn();
  render(<CampaignPicker value="saved" onChange={change} />);
  expect(screen.getByText(/choices could not be loaded/)).toBeVisible();
  expect(screen.queryByText(/No published content lock campaigns/)).toBeNull();
  vi.mocked(apiFetch).mockRejectedValue(new Error('Offline'));
  await userEvent.click(screen.getByRole('button', { name: 'Refresh campaigns' }));
  expect(await screen.findByText(/Could not refresh campaigns/)).toBeVisible();
  expect(change).not.toHaveBeenCalled();
});

it('shows the full selected name and changes or clears it without changing content', async () => {
  const name = 'Newsletter signup after an article with a long Campaign name';
  window.wconvertContentLockEditor = { campaigns: [{ id: 'old', name, status: 'ready' }, { id: 'new', name: 'New bonus', status: 'ready' }], manageUrl: null };
  const change = vi.fn();
  const { rerender } = render(<CampaignPicker value="old" onChange={change} />);
  expect(screen.getByText(name)).toBeVisible();
  expect(screen.queryByRole('combobox', { name: 'Campaign' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Change campaign' }));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Campaign' }), 'new');
  expect(change).toHaveBeenLastCalledWith('new');
  rerender(<CampaignPicker value="new" onChange={change} />);
  await userEvent.click(screen.getByRole('button', { name: 'Clear campaign' }));
  expect(change).toHaveBeenLastCalledWith('');
  rerender(<CampaignPicker value="" onChange={change} />);
  expect(screen.getByRole('combobox', { name: 'Campaign' })).toBeVisible();
});

it.each([
  { status: 'unavailable' as const, selected: { id: 'saved', name: 'Temporarily unavailable bonus', status: 'unavailable' as const }, label: 'Temporarily unavailable bonus' },
  { status: 'missing' as const, selected: null, label: 'Previously selected campaign' },
])('keeps a $status saved selection in a repairable name card', async ({ selected, label }) => {
  window.wconvertContentLockEditor = {
    campaigns: [...(selected ? [selected] : []), { id: 'ready', name: 'Ready bonus', status: 'ready' }],
    manageUrl: null,
  };
  const change = vi.fn();
  const { rerender } = render(<CampaignPicker value="saved" onChange={change} />);
  expect(screen.getByText(label)).toBeVisible();
  expect(screen.queryByRole('combobox', { name: 'Campaign' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Change campaign' }));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Campaign' }), 'ready');
  expect(change).toHaveBeenLastCalledWith('ready');
  rerender(<CampaignPicker value="saved" onChange={change} />);
  await userEvent.click(screen.getByRole('button', { name: 'Clear campaign' }));
  expect(change).toHaveBeenLastCalledWith('');
});

it('moves keyboard focus into the picker after Change and back after Cancel', async () => {
  window.wconvertContentLockEditor = { campaigns: [{ id: 'saved', name: 'Saved bonus', status: 'ready' }], manageUrl: null };
  render(<CampaignPicker value="saved" onChange={vi.fn()} />);
  const user = userEvent.setup();
  screen.getByRole('button', { name: 'Change campaign' }).focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('combobox', { name: 'Campaign' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('button', { name: 'Change campaign' })).toHaveFocus();
});

it('honors a canvas request to focus settings once without refocusing on unrelated renders', () => {
  window.wconvertContentLockEditor = { campaigns: [], manageUrl: null };
  const handled = vi.fn();
  const change = vi.fn();
  const { rerender } = render(<CampaignPicker value="" onChange={change} />);
  const picker = screen.getByRole('combobox', { name: 'Campaign' });
  expect(picker).not.toHaveFocus();
  rerender(<CampaignPicker value="" onChange={change} focusRequested onFocusHandled={handled} />);
  expect(picker).toHaveFocus();
  expect(handled).toHaveBeenCalledOnce();
  screen.getByRole('button', { name: 'Refresh campaigns' }).focus();
  rerender(<CampaignPicker value="" onChange={change} focusRequested={false} onFocusHandled={handled} />);
  expect(picker).not.toHaveFocus();
  expect(handled).toHaveBeenCalledOnce();
});

it('keeps focus usable after selecting or clearing a Campaign without stealing it on mount or refresh', async () => {
  window.wconvertContentLockEditor = { campaigns: [{ id: 'saved', name: 'Saved bonus', status: 'ready' }], manageUrl: null };
  function Picker() {
    const [value, setValue] = useState('');
    return <CampaignPicker value={value} onChange={setValue} />;
  }
  render(<Picker />);
  expect(screen.getByRole('combobox', { name: 'Campaign' })).not.toHaveFocus();
  const user = userEvent.setup();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Campaign' }), 'saved');
  expect(screen.getByRole('button', { name: 'Change campaign' })).toHaveFocus();
  screen.getByRole('button', { name: 'Clear campaign' }).focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('combobox', { name: 'Campaign' })).toHaveFocus();
  vi.mocked(apiFetch).mockResolvedValue(window.wconvertContentLockEditor);
  await user.click(screen.getByRole('button', { name: 'Refresh campaigns' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Campaign choices updated.');
  expect(screen.getByRole('combobox', { name: 'Campaign' })).not.toHaveFocus();
});

it('says the draft-preview trap out loud, under the picker', () => {
  window.wconvertContentLockEditor = { campaigns: [], manageUrl: null };
  render(<CampaignPicker value="" onChange={vi.fn()} />);
  expect(screen.getByText('Draft previews stay unlocked. Check the published page in a private window.')).toBeVisible();
  expect(screen.getByText('No published content lock campaigns yet.')).toBeVisible();
  expect(screen.getByText('Ask your administrator to publish a content lock campaign.')).toBeVisible();
  expect(screen.queryByText('Setup tips')).toBeNull();
});

it.each([
  { value: '', expected: 'Choose a campaign' },
  { value: 'gone', expected: 'Campaign unpublished' },
  { value: 'off', expected: 'Content lock off for this campaign' },
  { value: 'held', expected: 'Campaign unavailable' },
  { value: 'ready', expected: 'Bonus chapter' },
  { value: 'nameless', expected: 'Unnamed campaign' },
])('labels the canvas boundary by the chosen campaign’s state ($expected)', ({ value, expected }) => {
  const data = { manageUrl: null, createUrl: null, campaigns: [
    { id: 'off', name: 'Ordinary form', status: 'disabled' as const },
    { id: 'held', name: 'Shop bonus', status: 'unavailable' as const },
    { id: 'ready', name: 'Bonus chapter', status: 'ready' as const },
    { id: 'nameless', name: '', status: 'ready' as const },
  ] };
  expect(boundaryLabel(value, { data, busy: false, result: null, refresh: async () => {} }, 'Choose a campaign')).toBe(expected);
});

it('claims nothing about the chosen campaign when the list never arrived', () => {
  expect(boundaryLabel('saved', { data: null, busy: false, result: null, refresh: async () => {} }, 'Choose a campaign')).toBe('Campaign choices not loaded');
});
