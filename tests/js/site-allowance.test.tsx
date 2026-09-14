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

const dismissSwitch = () => screen.getByLabelText(/close any Campaign/i);
const maxField = () => screen.getByLabelText(/at most this many/i);

describe('the site-wide allowance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.readSiteAllowance.mockResolvedValue(OFF);
    api.saveSiteAllowance.mockImplementation((next: unknown) => Promise.resolve(next));
  });

  /** Every control empty, which is the state every install ships in. */
  /**
   * **A loading state, not four real controls greyed out.** This card showed
   * its switches and both number fields `disabled` until the read landed —
   * which says *you may not change this* about a value nobody had read yet,
   * and then quietly becomes usable. ADR 0039 asks every region that fetches
   * for the state, and this was one of two that did not draw one.
   */
  it('draws a placeholder while it reads, rather than dead controls', async () => {
    api.readSiteAllowance.mockReturnValue(new Promise(() => undefined));

    render(<SiteAllowance />);
    await userEvent.click(screen.getByRole('button', { name: /How often anything shows/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByLabelText(/close any Campaign/i)).toBeNull();
  });

  it('renders a failed read as the region’s whole content', async () => {
    api.readSiteAllowance.mockRejectedValue(new Error('The allowance could not be read.'));

    render(<SiteAllowance />);
    await userEvent.click(screen.getByRole('button', { name: /How often anything shows/ }));

    expect(await screen.findByText('The allowance could not be read.')).toBeInTheDocument();
    expect(screen.getByText('Reload the page to try again.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/close any Campaign/i)).toBeNull();
  });

  it('shows a site that has configured nothing as configuring nothing', async () => {
    render(<SiteAllowance />);
    await userEvent.click(screen.getByRole('button', { name: /How often anything shows/ }));

    expect(await screen.findByRole('checkbox', { name: /close any Campaign/i })).not.toBeChecked();
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
    await userEvent.click(screen.getByRole('button', { name: /How often anything shows/ }));

    expect(await screen.findByText(/in addition to its own display rules/i)).toBeInTheDocument();
  });

  it('turns a switch on by ticking it, and sends the other three unchanged', async () => {
    render(<SiteAllowance />);
    await userEvent.click(screen.getByRole('button', { name: /How often anything shows/ }));

    await userEvent.click(await screen.findByRole('checkbox', { name: /close any Campaign/i }));

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
    await userEvent.click(screen.getByRole('button', { name: /How often anything shows/ }));

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
    await userEvent.click(screen.getByRole('button', { name: /How often anything shows/ }));

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
    await userEvent.click(screen.getByRole('button', { name: /How often anything shows/ }));

    await waitFor(() => expect(maxField()).toHaveValue(4));

    await userEvent.clear(maxField());
    await userEvent.type(maxField(), '0');
    await userEvent.tab();

    expect(api.saveSiteAllowance).not.toHaveBeenCalled();
  });

  it('keeps the card usable and says what went wrong when a save fails', async () => {
    api.saveSiteAllowance.mockRejectedValue(new Error('The site is read-only'));

    render(<SiteAllowance />);
    await userEvent.click(screen.getByRole('button', { name: /How often anything shows/ }));

    await userEvent.click(await screen.findByRole('checkbox', { name: /close any Campaign/i }));

    expect(await screen.findByText(/read-only/i)).toBeInTheDocument();
    expect(dismissSwitch()).toBeEnabled();
  });
});

/**
 * Two settings committed in a row do not undo each other.
 *
 * Clicking a switch blurs the number beside it, so both writes happen — the
 * number first, then the switch. What must not happen is the second response
 * retyping the field: the save that carries the switch answers with the
 * allowance as the SERVER now holds it, and re-seeding the draft from every
 * response is how a merchant's own number gets replaced by a stale one.
 */
describe('a number and a switch, one after the other', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.readSiteAllowance.mockResolvedValue(OFF);
  });

  it('keeps both, and leaves the typed number on screen', async () => {
    // A server that is a little behind, which is the case the fix is about:
    // the switch's response knows nothing of the number just committed.
    api.saveSiteAllowance.mockImplementation((next: { stopAfterDismiss: boolean }) =>
      Promise.resolve(next.stopAfterDismiss ? { ...OFF, stopAfterDismiss: true } : next),
    );

    render(<SiteAllowance />);
    await userEvent.click(screen.getByRole('button', { name: /How often anything shows/ }));

    await userEvent.type(await screen.findByLabelText(/at most this many/i), '10');
    await userEvent.click(screen.getByRole('checkbox', { name: /close any Campaign/i }));

    await waitFor(() => expect(api.saveSiteAllowance).toHaveBeenCalledTimes(2));

    expect(api.saveSiteAllowance).toHaveBeenNthCalledWith(1, { ...OFF, maxImpressions: 10 });
    expect(maxField()).toHaveValue(10);
  });
});
