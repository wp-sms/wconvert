import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Retention } from '../../resources/admin/src/leads/api';

const api = vi.hoisted(() => ({ readRetention: vi.fn(), saveRetention: vi.fn() }));
vi.mock('../../resources/admin/src/leads/api', () => api);

const { LeadRetention } = await import('../../resources/admin/src/leads/LeadRetention');

const forever = { days: null, max_days: 3650 };
const disclosure = () => screen.getByRole('button', { name: /How long leads are kept/ });
const automatic = () => screen.getByRole('radio', { name: 'Delete them automatically after' });
const keep = () => screen.getByRole('radio', { name: 'Keep them until I delete them' });
const days = () => screen.getByRole('spinbutton', { name: 'Retention period in days' });
const save = () => screen.getByRole('button', { name: 'Save retention' });

async function open() {
  render(<LeadRetention />);
  await userEvent.click(disclosure());
  await screen.findByRole('radio', { name: 'Keep them until I delete them' });
}

async function propose(period: string) {
  await userEvent.click(automatic());
  await userEvent.clear(days());
  await userEvent.type(days(), period);
  await userEvent.click(save());
  return screen.getByRole('alertdialog');
}

describe('explicit lead retention', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.readRetention.mockResolvedValue(forever);
    api.saveRetention.mockImplementation((period: number | null) => Promise.resolve({ ...forever, days: period }));
  });

  it('shows a loading placeholder rather than an editable policy before the read succeeds', async () => {
    let resolve: (period: Retention) => void = () => undefined;
    api.readRetention.mockReturnValue(new Promise<Retention>((done) => { resolve = done; }));
    render(<LeadRetention />);
    await userEvent.click(disclosure());
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByRole('radio')).toBeNull();
    await act(async () => { resolve(forever); });
    expect(keep()).toBeChecked();
    expect(save()).toBeDisabled();
  });

  it('retries a failed settings read in its own disclosure', async () => {
    api.readRetention.mockRejectedValueOnce(new Error('Retention could not be read.'));
    render(<LeadRetention />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Retention could not be read.');
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading retention' }));
    await screen.findByRole('radio', { name: 'Keep them until I delete them' });
    expect(api.readRetention).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps selecting, typing, Enter and blur local without a suggested-period write', async () => {
    await open();
    await userEvent.click(automatic());
    expect(days()).toHaveValue(null);
    expect(disclosure()).toHaveTextContent('Kept until you delete them');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await userEvent.type(days(), '30{Enter}');
    await userEvent.tab();
    expect(api.saveRetention).not.toHaveBeenCalled();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await userEvent.click(disclosure());
    expect(disclosure()).toHaveTextContent('Kept until you delete them');
  });

  it('names and saves the exact chosen period only after destructive confirmation', async () => {
    await open();
    const dialog = await propose('30');
    expect(dialog).toHaveAccessibleName('Automatically delete leads older than 30 days?');
    expect(dialog).toHaveTextContent('Existing and future leads');
    expect(dialog).toHaveTextContent('This applies to every Optin.');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(api.saveRetention).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete after 30 days' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(api.saveRetention).toHaveBeenCalledExactlyOnceWith(30);
    expect(disclosure()).toHaveTextContent('Automatically deleted after 30 days');
    expect(screen.getByRole('status')).toHaveTextContent('Retention saved.');
    expect(save()).toBeDisabled();
    expect(automatic()).toHaveFocus();
  });

  it('keeps a confirmation cancellation editable and restores focus without saving', async () => {
    await open();
    const dialog = await propose('45');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(save()).toHaveFocus();
    expect(days()).toHaveValue(45);
    expect(automatic()).toBeChecked();
    expect(disclosure()).toHaveTextContent('Kept until you delete them');
    expect(api.saveRetention).not.toHaveBeenCalled();
  });

  it('Cancel changes restores a saved forever policy and returns focus to it', async () => {
    await open();
    await userEvent.click(automatic());
    await userEvent.type(days(), '60');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel changes' }));
    expect(keep()).toBeChecked();
    expect(keep()).toHaveFocus();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(save()).toBeDisabled();
    expect(api.saveRetention).not.toHaveBeenCalled();
  });

  it('Cancel changes restores the saved number after edits or a draft switch to forever', async () => {
    api.readRetention.mockResolvedValue({ ...forever, days: 120 });
    await open();
    await userEvent.clear(days());
    await userEvent.type(days(), '30');
    await userEvent.click(keep());
    expect(disclosure()).toHaveTextContent('Automatically deleted after 120 days');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel changes' }));
    expect(automatic()).toBeChecked();
    expect(automatic()).toHaveFocus();
    expect(days()).toHaveValue(120);
    expect(api.saveRetention).not.toHaveBeenCalled();
  });

  it.each(['', '0', '-1', '1.5', '3651'])('rejects invalid days "%s" without rounding or clamping', async (value) => {
    await open();
    await userEvent.click(automatic());
    fireEvent.change(days(), { target: { value } });
    await userEvent.click(save());
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number from 1 to 3650 days.');
    expect(days()).toHaveAttribute('aria-invalid', 'true');
    expect(days()).toHaveFocus();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(api.saveRetention).not.toHaveBeenCalled();
  });

  it('confirms a changed automatic period as well as its initial activation', async () => {
    api.readRetention.mockResolvedValue({ ...forever, days: 120 });
    await open();
    const dialog = await propose('7');
    expect(dialog).toHaveAccessibleName('Automatically delete leads older than 7 days?');
    expect(api.saveRetention).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete after 7 days' }));
    await waitFor(() => expect(disclosure()).toHaveTextContent('Automatically deleted after 7 days'));
    expect(api.saveRetention).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('preserves the draft and saved disclosure on write failure, and retries the same confirmed period', async () => {
    api.readRetention.mockResolvedValue({ ...forever, days: 120 });
    api.saveRetention.mockRejectedValueOnce(new Error('The retention change could not be saved.'));
    await open();
    const dialog = await propose('30');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete after 30 days' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The retention change could not be saved.');
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Automatically delete leads older than 30 days?');
    // The summary behind the dialog must still describe the saved policy.
    expect(screen.getByText('Automatically deleted after 120 days')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(days()).toHaveValue(30);
    expect(save()).toHaveFocus();
    await userEvent.click(save());
    await userEvent.click(screen.getByRole('button', { name: 'Delete after 30 days' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(api.saveRetention.mock.calls).toEqual([[30], [30]]);
    expect(disclosure()).toHaveTextContent('Automatically deleted after 30 days');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('prevents duplicate writes and closing the confirmation while the write is pending', async () => {
    let resolve: (period: Retention) => void = () => undefined;
    api.saveRetention.mockReturnValue(new Promise<Retention>((done) => { resolve = done; }));
    await open();
    const dialog = await propose('30');
    await userEvent.dblClick(within(dialog).getByRole('button', { name: 'Delete after 30 days' }));
    expect(api.saveRetention).toHaveBeenCalledExactlyOnceWith(30);
    expect(within(dialog).getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Kept until you delete them')).toBeInTheDocument();
    await act(async () => { resolve({ ...forever, days: 30 }); });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(disclosure()).toHaveTextContent('Automatically deleted after 30 days');
  });

  it('turns deletion off only with an explicit save, without a destructive confirmation', async () => {
    api.readRetention.mockResolvedValue({ ...forever, days: 120 });
    await open();
    await userEvent.click(keep());
    expect(api.saveRetention).not.toHaveBeenCalled();
    expect(disclosure()).toHaveTextContent('Automatically deleted after 120 days');
    await userEvent.click(save());
    await waitFor(() => expect(disclosure()).toHaveTextContent('Kept until you delete them'));
    expect(api.saveRetention).toHaveBeenCalledExactlyOnceWith(null);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(keep()).toBeChecked();
    expect(keep()).toHaveFocus();
  });

  it('keeps the previous automatic policy disclosed if saving forever fails', async () => {
    api.readRetention.mockResolvedValue({ ...forever, days: 120 });
    api.saveRetention.mockRejectedValueOnce(new Error('Save failed.'));
    await open();
    await userEvent.click(keep());
    await userEvent.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed.');
    expect(keep()).toBeChecked();
    expect(disclosure()).toHaveTextContent('Automatically deleted after 120 days');
    expect(save()).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel changes' }));
    expect(days()).toHaveValue(120);
    expect(automatic()).toHaveFocus();
  });
});
