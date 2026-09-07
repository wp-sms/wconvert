import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The analytics screen, and the four decisions it exists to hold.
 *
 * **Per-goal cards, never a leaderboard**, and no site-wide conversion rate.
 * The payload's shape carries most of that — an Optin's numbers arrive inside
 * its Goal's card, so there is no flat list here to sort — and this is the
 * other end of it: the screen renders the cards in the order it was handed
 * them, whatever the numbers say.
 *
 * **The window is asked for in DAYS and never in dates.** "Today" has to mean
 * the merchant's today, and a date built in the browser is the day of whoever
 * is at the keyboard.
 *
 * **A metric nothing writes yet says why it is zero.** This is the first
 * screen a merchant meets that on, and a bare 0 beside real conversions reads
 * as a bug.
 *
 * **And an undefined rate is not a zero one.** "0%" is a claim that visitors
 * saw it and did not act.
 */
const api = vi.hoisted(() => ({ readDashboard: vi.fn() }));

vi.mock('../../resources/admin/src/stats/api', () => api);

const { Dashboard } = await import('../../resources/admin/src/stats/Dashboard');

/**
 * Two Goals, deliberately in the order the enum declares them rather than the
 * order their numbers would sort in: the offer card's three click-throughs are
 * dwarfed by the email list's hundred, and it still comes second.
 */
const TWO_GOALS = {
  from: '2026-07-27',
  to: '2026-08-25',
  days: 30,
  goals: [
    {
      goal: 'grow_email_list',
      label: 'Grow my email list',
      headline_label: 'Submissions',
      headline: 100,
      impressions: 1000,
      dismissals: 40,
      conversion_rate: 0.1,
      undelivered_conversions: null,
      by_day: { '2026-08-24': 50, '2026-08-25': 10 },
      optins: [
        {
          id: '01J0000000AAAAAAAAAAAAAAAA',
          name: 'Newsletter footer',
          headline: 100,
          impressions: 1000,
          dismissals: 40,
          conversion_rate: 0.1,
          by_day: { '2026-08-24': 90, '2026-08-25': 10 },
        },
      ],
    },
    {
      goal: 'promote_offer',
      label: 'Promote a sale or offer',
      headline_label: 'Click-throughs to the offer',
      headline: 9000,
      impressions: 20000,
      dismissals: 100,
      conversion_rate: 0.45,
      undelivered_conversions: null,
      by_day: { '2026-08-24': 4000, '2026-08-25': 5000 },
      optins: [],
    },
  ],
};

describe('the analytics screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.readDashboard.mockResolvedValue(TWO_GOALS);
  });

  it('names each headline the way the Goal that declares it does', async () => {
    render(<Dashboard />);

    expect(await screen.findByText('Grow my email list')).toBeInTheDocument();

    // On the card, and again as the column heading of its Optin table — the
    // word travels with the payload rather than being spelled per surface.
    expect(screen.getAllByText('Submissions')).toHaveLength(2);
    // Two of the five Goals convert on a click, and a card headed
    // "Submissions" over one of them reports zero forever.
    expect(screen.getByText('Click-throughs to the offer')).toBeInTheDocument();
  });

  /**
   * The cards come back in the enum's order and stay in it. Sorting them by
   * their headline would rank "click-throughs to the offer" against
   * "conversions on Optins that capture an email", which are different acts.
   */
  it('never reorders the cards by their numbers', async () => {
    render(<Dashboard />);

    await screen.findByText('Grow my email list');

    const headings = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);

    expect(headings).toEqual(['Grow my email list', 'Promote a sale or offer']);
  });

  /**
   * **There is no total anywhere on this screen.** The two cards' rates are
   * 10% and 45%; a site-wide figure would be some average of two things that
   * do not average.
   */
  it('reports no site-wide conversion rate', async () => {
    render(<Dashboard />);

    await screen.findByText('Grow my email list');

    // One per card, plus the column heading of the one Optin table on screen.
    // Never a fourth standing on its own above them.
    expect(screen.getAllByText('Conversion rate')).toHaveLength(3);
    expect(screen.queryByText(/overall/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/site-wide/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/total conversion/i)).not.toBeInTheDocument();
  });

  /** And no "left without converting", which is arithmetic on numbers already shown. */
  it('reports nothing about leaving without converting', async () => {
    render(<Dashboard />);

    await screen.findByText('Grow my email list');

    expect(screen.queryByText(/left without/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/abandoned/i)).not.toBeInTheDocument();
  });

  /**
   * ========================================================================
   * THE WINDOW IS DAYS, AND THE BROWSER NEVER NAMES A DAY.
   * ========================================================================
   * A merchant in Tokyo checking their numbers from a hotel in Los Angeles
   * must be shown their site's day, so the far end is resolved on the server
   * and only a count of days goes out.
   */
  it('asks for a window in days and never sends a date', async () => {
    render(<Dashboard />);

    await screen.findByText('Grow my email list');

    // The FIRST read names no window at all, so `StatRange::DEFAULT_DAYS` is
    // spelled once, on the server. The selector then follows the payload.
    expect(api.readDashboard).toHaveBeenCalledWith(null);
    expect(screen.getByRole('combobox')).toHaveValue('30');

    await userEvent.selectOptions(screen.getByRole('combobox'), '1');

    await waitFor(() => expect(api.readDashboard).toHaveBeenLastCalledWith(1));

    // Never anything a calendar produced.
    for (const call of api.readDashboard.mock.calls) {
      expect(call[0] === null || typeof call[0] === 'number').toBe(true);
    }
  });

  /**
   * The default window is the SERVER's. This bundle spells no number for it,
   * so there is nothing here to drift from `StatRange::DEFAULT_DAYS` — the
   * rule `DashboardController` states about the same constant.
   */
  it('never spells the default window itself', async () => {
    api.readDashboard.mockResolvedValue({ ...TWO_GOALS, days: 7, from: '2026-08-19' });

    render(<Dashboard />);

    await screen.findByText('Grow my email list');

    expect(screen.getByRole('combobox')).toHaveValue('7');
  });

  /** The window it actually read comes back, and it says whose calendar it is. */
  it('says which days it is showing, in the site’s timezone', async () => {
    render(<Dashboard />);

    expect(await screen.findByText(/2026-07-27 to 2026-08-25, in your site’s timezone\./)).toBeInTheDocument();
  });

  /**
   * **The delivery gap, on the card the server put it on.**
   *
   * This bundle spells no Goal id — `GoalParityTest` fails on any of the five
   * appearing under `resources/admin/src` — so the card cannot ask which Goal
   * it is drawing. A number here means the server decided there was one to
   * report.
   */
  it('reports conversions with no delivery where the server sends a number', async () => {
    api.readDashboard.mockResolvedValue({
      ...TWO_GOALS,
      goals: [
        {
          ...TWO_GOALS.goals[0],
          goal: 'deliver_lead_magnet',
          label: 'Deliver a lead magnet',
          headline_label: 'Deliveries',
          headline: 90,
          undelivered_conversions: 10,
          optins: [],
        },
      ],
    });

    render(<Dashboard />);

    expect(await screen.findByText(/Conversions with no delivery yet/)).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  /**
   * A soft-deleted Optin's counts stay in the card and its row is gone — the
   * server decides both, and this is the screen not making the empty list look
   * like an empty card.
   */
  it('keeps a Goal’s total when nothing is running under it any more', async () => {
    api.readDashboard.mockResolvedValue({
      ...TWO_GOALS,
      goals: [{ ...TWO_GOALS.goals[0], optins: [] }],
    });

    render(<Dashboard />);

    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(screen.getByText('Nothing is running under this Goal')).toBeInTheDocument();
    expect(screen.getByText('Its numbers are what earlier ones counted.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /**
   * **Undefined is not zero.** Nothing was shown, so there is no denominator,
   * and "0%" is a claim that visitors saw it and did not act.
   */
  it('shows no rate rather than a zero one where nothing was ever shown', async () => {
    api.readDashboard.mockResolvedValue({
      ...TWO_GOALS,
      goals: [
        {
          ...TWO_GOALS.goals[0],
          headline: 0,
          impressions: 0,
          dismissals: 0,
          conversion_rate: null,
          by_day: { '2026-08-25': 0 },
          optins: [
            {
              id: '01J0000000AAAAAAAAAAAAAAAA',
              name: 'Newsletter footer',
              headline: 0,
              impressions: 0,
              dismissals: 0,
              conversion_rate: null,
              by_day: { '2026-08-25': 0 },
            },
          ],
        },
      ],
    });

    render(<Dashboard />);

    await screen.findByText('Grow my email list');

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  /**
   * An Optin's row sits inside its Goal's card, which is what makes a
   * cross-Goal ranking unexpressible on this screen rather than merely absent
   * from it.
   */
  it('puts an Optin’s numbers inside the card for its Goal', async () => {
    render(<Dashboard />);

    await screen.findByText('Grow my email list');

    const table = screen.getByRole('table');

    expect(within(table).getByText('Newsletter footer')).toBeInTheDocument();
    // One table, because only one of the two Goals has anything running.
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  it('reports a failed read rather than an empty screen', async () => {
    api.readDashboard.mockRejectedValue(new Error('Sorry, you are not allowed to do that.'));

    render(<Dashboard />);

    expect(await screen.findByText('Sorry, you are not allowed to do that.')).toBeInTheDocument();
  });

  /**
   * **A window change that fails must not take the cards with it.**
   *
   * This screen set `failed(cause)` unconditionally, so a merchant moving from
   * 30 days to 7 over a flaky connection watched every Goal card they were
   * reading disappear and be replaced by one error — the numbers they already
   * had, thrown away because the request for different numbers did not arrive.
   *
   * Every other multi-fetch screen in this admin guards exactly this and says
   * so in place ({@see OptinList}, {@see LeadLog}, {@see Destinations}): only a
   * FIRST failure has nothing to keep. This is the fourth.
   */
  it('keeps the cards when a window change fails, and says what went wrong', async () => {
    render(<Dashboard />);

    await screen.findByText('Grow my email list');

    api.readDashboard.mockRejectedValue(new Error('The server did not answer.'));

    await userEvent.selectOptions(screen.getByRole('combobox'), '7');

    expect(await screen.findByText('The server did not answer.')).toBeInTheDocument();

    // Still on screen: the numbers the merchant was reading a moment ago.
    expect(screen.getByText('Grow my email list')).toBeInTheDocument();
    expect(screen.getByText('Promote a sale or offer')).toBeInTheDocument();
  });

  /**
   * **Comparison within an Optin over time**, which the merchant would
   * otherwise only get by moving the whole screen's window and remembering the
   * last number.
   */
  it('gives each Optin row its own series over time', async () => {
    render(<Dashboard />);

    await screen.findByText('Grow my email list');

    const row = screen.getByRole('row', { name: /Newsletter footer/ });

    // The card's own series, and the row's — two sparklines, each describing
    // itself to a screen reader rather than being a picture with no text.
    expect(within(row).getByText(/Submissions per day/)).toBeInTheDocument();
  });

  /**
   * **And null means the row is absent, not zero.**
   *
   * Which is the whole reason the server nulls it rather than omitting it: the
   * field is always on the payload, so this bundle branches on a value rather
   * than on a Goal it is forbidden to name. A `0` here would be a claim that
   * every conversion was delivered on a Goal that delivers nothing.
   */
  it('says nothing about deliveries on a Goal the server sent null for', async () => {
    render(<Dashboard />);

    await screen.findByText('Grow my email list');

    expect(screen.queryByText(/no delivery yet/i)).not.toBeInTheDocument();
  });
});
