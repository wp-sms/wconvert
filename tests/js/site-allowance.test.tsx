import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The allowance the whole site shares, on the screen that authors it.
 *
 * ============================================================================
 * THE DEFAULTS ARE THE FEATURE, SO THEY ARE WHAT IS ASSERTED.
 * ============================================================================
 * `builder/rules/HowOften.tsx` draws the same four fields for ONE Optin with
 * both switches ticked, and copying that here would silence a site nobody
 * asked to silence: *one dismissal stops everything for a week* is a claim
 * about what the visitor meant that they did not make (ADR 0047). So the
 * shipped state of this card is four empty controls, and the write it produces
 * is the one the merchant made rather than the one the shape defaulted to.
 */
const api = vi.hoisted(() => ({
  readSiteAllowance: vi.fn(),
  saveSiteAllowance: vi.fn(),
  listOptins: vi.fn(),
  statusOf: vi.fn(),
  canUnpublish: vi.fn(),
  publishOptin: vi.fn(),
  unpublishOptin: vi.fn(),
  deleteOptin: vi.fn(),
  createOptin: vi.fn(),
}));

vi.mock('../../resources/admin/src/optins/api', () => api);

const { SiteAllowance } = await import('../../resources/admin/src/optins/SiteAllowance');

const OFF = {
  maxImpressions: null,
  cooldownDays: null,
  stopAfterDismiss: false,
  stopAfterConversion: false,
};

const dismissSwitch = () => screen.getByLabelText(/close any Optin/i);
const maxField = () => screen.getByLabelText(/at most this many/i);

describe('the site-wide allowance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.readSiteAllowance.mockResolvedValue(OFF);
    api.saveSiteAllowance.mockImplementation((next: unknown) => Promise.resolve(next));
  });

  /** Every control empty, which is the state every install ships in. */
  it('shows a site that has configured nothing as configuring nothing', async () => {
    render(<SiteAllowance />);

    expect(await screen.findByRole('checkbox', { name: /close any Optin/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /sign up to anything/i })).not.toBeChecked();
    expect(maxField()).toHaveValue(null);
    expect(screen.getByLabelText(/Days to wait/i)).toHaveValue(null);
  });

  /**
   * It is a VETO, and this is the one thing a merchant cannot discover from
   * any other screen: what they set here overrides every Optin's own
   * allowance, and an Optin cannot opt out.
   */
  it('says on the card that it applies on top of every Optin', async () => {
    render(<SiteAllowance />);

    expect(await screen.findByText(/on top of each one’s own settings/i)).toBeInTheDocument();
  });

  it('turns a switch on by ticking it, and sends the other three unchanged', async () => {
    render(<SiteAllowance />);

    await userEvent.click(await screen.findByRole('checkbox', { name: /close any Optin/i }));

    await waitFor(() =>
      expect(api.saveSiteAllowance).toHaveBeenCalledWith({ ...OFF, stopAfterDismiss: true }),
    );
  });

  /**
   * On blur, never on every keystroke. Typing `10` passes through `1`, and a
   * saved 1 is a site-wide cap of one impression taking effect on the next page
   * view of every visitor.
   */
  it('commits a typed number when the field is left, not while it is typed', async () => {
    render(<SiteAllowance />);

    await userEvent.type(await screen.findByLabelText(/at most this many/i), '10');

    expect(api.saveSiteAllowance).not.toHaveBeenCalled();

    await userEvent.tab();

    await waitFor(() =>
      expect(api.saveSiteAllowance).toHaveBeenCalledWith({ ...OFF, maxImpressions: 10 }),
    );
    expect(api.saveSiteAllowance).toHaveBeenCalledTimes(1);
  });

  /** An emptied box is *no limit*, not a cap of zero. */
  it('reads an emptied number as no limit', async () => {
    api.readSiteAllowance.mockResolvedValue({ ...OFF, maxImpressions: 4 });

    render(<SiteAllowance />);

    await waitFor(() => expect(maxField()).toHaveValue(4));

    await userEvent.clear(maxField());
    await userEvent.tab();

    await waitFor(() =>
      expect(api.saveSiteAllowance).toHaveBeenCalledWith({ ...OFF, maxImpressions: null }),
    );
  });

  /** A draft that is not a usable number saves nothing and corrects nothing. */
  it('leaves a nonsense number unsaved and leaves the stored one alone', async () => {
    api.readSiteAllowance.mockResolvedValue({ ...OFF, maxImpressions: 4 });

    render(<SiteAllowance />);

    await waitFor(() => expect(maxField()).toHaveValue(4));

    await userEvent.clear(maxField());
    await userEvent.type(maxField(), '0');
    await userEvent.tab();

    expect(api.saveSiteAllowance).not.toHaveBeenCalled();
  });

  it('keeps the card usable and says what went wrong when a save fails', async () => {
    api.saveSiteAllowance.mockRejectedValue(new Error('The site is read-only'));

    render(<SiteAllowance />);

    await userEvent.click(await screen.findByRole('checkbox', { name: /close any Optin/i }));

    expect(await screen.findByText(/read-only/i)).toBeInTheDocument();
    expect(dismissSwitch()).toBeEnabled();
  });
});
