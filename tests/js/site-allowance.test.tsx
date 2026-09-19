import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteAllowance } from '../../resources/admin/src/optins/SiteAllowance';

const api = vi.hoisted(() => ({
  readSiteAllowance: vi.fn(),
  saveSiteAllowance: vi.fn(),
}));
vi.mock('../../resources/admin/src/optins/api', () => api);
const OFF = {
  maxImpressions: null,
  cooldownDays: null,
  stopAfterDismiss: false,
  stopAfterConversion: false,
};
const maxField = () => screen.getByLabelText(/Total campaign appearances/i);
const save = async () => {
  if (!screen.queryByRole('alertdialog')) await userEvent.click(screen.getByRole('button', { name: 'Save display limits' }));
  const confirm = screen.queryByRole('button', { name: 'Apply to all campaigns' });
  if (confirm) await userEvent.click(confirm);
};

describe('explicit site-wide allowance drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.readSiteAllowance.mockResolvedValue(OFF);
    api.saveSiteAllowance.mockImplementation(async (next) => next);
  });
  it('shows a placeholder before reading, not editable defaults', () => {
    api.readSiteAllowance.mockReturnValue(new Promise(() => undefined));
    render(<SiteAllowance />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading Display limits…');
    expect(screen.queryByLabelText(/after a visitor closes/i)).toBeNull();
  });
  it('retries a failed read without writing a setting', async () => {
    api.readSiteAllowance.mockRejectedValueOnce(new Error('Read unavailable.'));
    render(<SiteAllowance />);
    await screen.findByText('Read unavailable.');
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry loading display limits' }),
    );
    expect(await screen.findByLabelText(/Total campaign appearances/i)).toHaveValue(
      null,
    );
    expect(api.saveSiteAllowance).not.toHaveBeenCalled();
  });
  it('keeps every default off and explains the shared scope', async () => {
    render(<SiteAllowance />);
    expect(
      await screen.findByLabelText(/after a visitor closes/i),
    ).not.toBeChecked();
    expect(screen.getByLabelText(/after a visitor converts/i)).not.toBeChecked();
    expect(maxField()).toHaveValue(null);
    expect(screen.getByLabelText(/Wait between campaigns/i)).toHaveValue(null);
    expect(
      screen.getByText(/in addition to its own display rules/i),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Save display limits' }),
    ).toBeDisabled();
  });
  it('does not write on typing, blur or a switch; saves the whole answer once', async () => {
    render(<SiteAllowance />);
    await userEvent.type(
      await screen.findByLabelText(/Total campaign appearances/i),
      '10',
    );
    await userEvent.click(screen.getByLabelText(/after a visitor closes/i));
    expect(api.saveSiteAllowance).not.toHaveBeenCalled();
    await save();
    expect(api.saveSiteAllowance).toHaveBeenCalledExactlyOnceWith({
      ...OFF,
      maxImpressions: 10,
      stopAfterDismiss: true,
    });
    expect(
      screen.getByRole('button', { name: 'Save display limits' }),
    ).toBeDisabled();
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });
  it('treats a cleared number as no limit, only on Save', async () => {
    api.readSiteAllowance.mockResolvedValue({ ...OFF, maxImpressions: 4 });
    render(<SiteAllowance />);
    await waitFor(() => expect(maxField()).toHaveValue(4));
    await userEvent.clear(maxField());
    await userEvent.tab();
    expect(api.saveSiteAllowance).not.toHaveBeenCalled();
    await save();
    expect(api.saveSiteAllowance).toHaveBeenCalledWith(OFF);
  });
  it('never saves an invalid count', async () => {
    render(<SiteAllowance />);
    await userEvent.type(
      await screen.findByLabelText(/Total campaign appearances/i),
      '0',
    );
    await save();
    expect(api.saveSiteAllowance).not.toHaveBeenCalled();
  });
  it('cancel restores numbers and switches without a write', async () => {
    api.readSiteAllowance.mockResolvedValue({ ...OFF, maxImpressions: 4 });
    render(<SiteAllowance />);
    await waitFor(() => expect(maxField()).toHaveValue(4));
    await userEvent.clear(maxField());
    await userEvent.type(maxField(), '10');
    await userEvent.click(screen.getByLabelText(/after a visitor closes/i));
    await userEvent.click(
      screen.getByRole('button', { name: 'Cancel changes' }),
    );
    expect(maxField()).toHaveValue(4);
    expect(screen.getByLabelText(/after a visitor closes/i)).not.toBeChecked();
    expect(api.saveSiteAllowance).not.toHaveBeenCalled();
  });
  it('keeps the draft after a failed save and supports retry', async () => {
    api.saveSiteAllowance.mockRejectedValueOnce(new Error('Read-only site.'));
    render(<SiteAllowance />);
    await userEvent.type(
      await screen.findByLabelText(/Total campaign appearances/i),
      '10',
    );
    await save();
    await screen.findByText('Read-only site.');
    expect(maxField()).toHaveValue(10);
    expect(screen.getByText('Unsaved changes')).toBeVisible();
    await save();
    expect(
      screen.getByRole('button', { name: 'Save display limits' }),
    ).toBeDisabled();
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });
  it('locks the pending write against edits and double submission', async () => {
    let finish!: (value: unknown) => void;
    api.saveSiteAllowance.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<SiteAllowance />);
    await userEvent.type(
      await screen.findByLabelText(/Total campaign appearances/i),
      '10',
    );
    await save();
    expect(maxField()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await act(async () => finish({ ...OFF, maxImpressions: 10 }));
    expect(maxField()).toBeEnabled();
    expect(api.saveSiteAllowance).toHaveBeenCalledTimes(1);
  });
});
