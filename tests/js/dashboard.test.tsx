import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { routeFrom, type ReportQuery } from '../../resources/admin/src/nav';

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
 * **A period's delivery gap is not a live queue count.** Conversions and
 * deliveries are daily events, not linked cohorts on this report.
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

    expect(await screen.findByRole('heading', { name: 'Grow my email list' })).toBeInTheDocument();

    // On the card, and again as the column heading of its Optin table — the
    // word travels with the payload rather than being spelled per surface.
    expect(screen.getAllByText('Submissions').length).toBeGreaterThanOrEqual(2);
    // Labels are supplied by the report rather than inferred in the client.
    expect(screen.getAllByText('Click-throughs to the offer').length).toBeGreaterThan(0);
  });

  /**
   * The cards come back in the enum's order and stay in it. Sorting them by
   * their headline would rank "click-throughs to the offer" against
   * "conversions on Optins that capture an email", which are different acts.
   */
  it('never reorders the cards by their numbers', async () => {
    render(<Dashboard />);

    await screen.findByRole('heading', { name: 'Grow my email list' });

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

    await screen.findByRole('heading', { name: 'Grow my email list' });

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

    await screen.findByRole('heading', { name: 'Grow my email list' });

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

    await screen.findByRole('heading', { name: 'Grow my email list' });

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

    await screen.findByRole('heading', { name: 'Grow my email list' });

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
  it('describes the aggregate delivery gap as events in this period, not a live queue count', async () => {
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

    expect(await screen.findByText('10 more submissions than emails accepted for sending were recorded in this period.')).toBeInTheDocument();
    expect(screen.getByText('These totals count events on the day they happen. Check Destinations for forwarding delays or errors.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review forwarding' })).toHaveAttribute('href', '#destinations');
    expect(screen.queryByText(/no delivery yet/i)).toBeNull();
    expect(screen.queryByText(/10 (queued|failed|pending)/i)).toBeNull();
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
    expect(screen.getByText('No existing Campaigns under this Goal')).toBeInTheDocument();
    expect(screen.getByText('These totals include results from deleted Campaigns.')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Campaign' })).not.toBeInTheDocument();
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

    await screen.findByRole('heading', { name: 'Grow my email list' });

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

    await screen.findByRole('heading', { name: 'Grow my email list' });
    await userEvent.click(screen.getByText('View 1 Campaign'));

    const table = screen.getByRole('table', { name: 'Campaigns for Grow my email list' });

    expect(within(table).getByText('Newsletter footer')).toBeInTheDocument();
    // One table, because only one of the two Goals has anything running.
    expect(screen.getAllByRole('table', { name: /^Campaigns for/ })).toHaveLength(1);
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

    await screen.findByRole('heading', { name: 'Grow my email list' });

    api.readDashboard.mockRejectedValue(new Error('The server did not answer.'));

    await userEvent.selectOptions(screen.getByRole('combobox'), '7');

    expect(await screen.findByText('Could not load the requested period. Showing the previous report and its dates. The server did not answer.')).toBeInTheDocument();

    // Still on screen: the numbers the merchant was reading a moment ago.
    expect(screen.getByRole('heading', { name: 'Grow my email list' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Promote a sale or offer' })).toBeInTheDocument();
    expect(screen.getByText('Requested period')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Report period' })).toHaveValue('7');
    expect(screen.getByText('Showing 2026-07-27 to 2026-08-25, in your site’s timezone.')).toBeInTheDocument();
  });

  /**
   * **Comparison within an Optin over time**, which the merchant would
   * otherwise only get by moving the whole screen's window and remembering the
   * last number.
   */
  it('gives each Optin row its own series over time', async () => {
    render(<Dashboard />);

    await screen.findByRole('heading', { name: 'Grow my email list' });
    await userEvent.click(screen.getByText('View 1 Campaign'));

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

    await screen.findByRole('heading', { name: 'Grow my email list' });

    expect(screen.queryByText(/no delivery yet/i)).not.toBeInTheDocument();
  });
  it('filters a goal locally without changing or combining its metric', async () => {
    render(<Dashboard />);
    await screen.findByRole('heading', { name: 'Grow my email list' });
    await userEvent.click(screen.getByRole('button', { name: 'Promote a sale or offer' }));
    expect(screen.queryByRole('heading', { name: 'Grow my email list' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Promote a sale or offer' })).toBeInTheDocument();
    expect(screen.getAllByText('Click-throughs to the offer').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'All goals' }));
    expect(screen.getByRole('heading', { name: 'Grow my email list' })).toBeInTheDocument();
    expect(api.readDashboard).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest period when an earlier request finishes last', async () => {
    render(<Dashboard />);
    await screen.findByRole('heading', { name: 'Grow my email list' });
    let finishOld!: (value: unknown) => void;
    api.readDashboard.mockImplementation((days: number) => days === 7
      ? new Promise((resolve) => { finishOld = resolve; })
      : Promise.resolve({ ...TWO_GOALS, days: 1, goals: [{ ...TWO_GOALS.goals[0], headline: 13 }] }));
    await userEvent.selectOptions(screen.getByRole('combobox'), '7');
    await userEvent.selectOptions(screen.getByRole('combobox'), '1');
    expect(await screen.findByText('13', { selector: 'dd' })).toBeInTheDocument();
    await act(async () => finishOld({ ...TWO_GOALS, days: 7, goals: [{ ...TWO_GOALS.goals[0], headline: 99 }] }));
    expect(screen.getByText('13', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.queryByText('99', { selector: 'dd' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('1');
  });

});

describe('report drill-down and returning to the displayed period', () => {
  const optinId = TWO_GOALS.goals[0].optins[0].id;
  const goal = TWO_GOALS.goals[0].goal;
  const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href') ?? '';

  beforeEach(() => {
    vi.clearAllMocks();
    api.readDashboard.mockResolvedValue(TWO_GOALS);
  });

  it('shows the selected Optin’s numbers and daily series without substituting its Goal totals', async () => {
    api.readDashboard.mockResolvedValue({
      ...TWO_GOALS,
      goals: [{
        ...TWO_GOALS.goals[0],
        optins: [{
          ...TWO_GOALS.goals[0].optins[0],
          headline: 7,
          impressions: 42,
          dismissals: 2,
          conversion_rate: 0.1667,
          by_day: { '2026-08-24': 3, '2026-08-25': 4 },
        }],
      }, TWO_GOALS.goals[1]],
    });
    render(<Dashboard query={{ days: 30, optinId }} />);
    const heading = await screen.findByRole('heading', { name: 'Newsletter footer' });
    const region = within(heading.closest('section')!);

    expect(region.getByText('7', { selector: 'dd' })).toBeInTheDocument();
    expect(region.getByText('42', { selector: 'dd' })).toBeInTheDocument();
    expect(region.getByText('2', { selector: 'dd' })).toBeInTheDocument();
    expect(region.getByText('16.7%', { selector: 'dd' })).toBeInTheDocument();
    expect(region.queryByText('100', { selector: 'dd' })).toBeNull();
    expect(region.queryByText('1,000', { selector: 'dd' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Promote a sale or offer' })).toBeNull();
    expect(screen.queryByRole('table', { name: /^Campaigns for/ })).toBeNull();

    await userEvent.click(region.getByText('View daily numbers'));
    const daily = region.getByRole('table', { name: 'Submissions per day' });
    expect(within(daily).getByRole('row', { name: '2026-08-24 3' })).toBeInTheDocument();
    expect(within(daily).getByRole('row', { name: '2026-08-25 4' })).toBeInTheDocument();
    expect(routeFrom(hrefOf('Edit this Campaign')).editId).toBe(optinId);
  });

  it.each([false, true])('keeps report, editor and capture links on the accepted period after refresh fails (focused: %s)', async (focused) => {
    const query: ReportQuery = { days: 30, goal, ...(focused ? { optinId } : {}) };
    const onQueryChange = vi.fn();
    const { rerender } = render(<Dashboard query={query} onQueryChange={onQueryChange} />);
    await screen.findByRole('heading', { name: focused ? 'Newsletter footer' : 'Grow my email list' });
    api.readDashboard.mockRejectedValueOnce(new Error('The new period could not be loaded.'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Report period' }), '7');
    expect(onQueryChange).toHaveBeenLastCalledWith({ ...query, days: 7 });
    rerender(<Dashboard query={{ ...query, days: 7 }} onQueryChange={onQueryChange} />);
    await screen.findByText(/Could not load the requested period.*The new period could not be loaded\./);
    expect(screen.getByText('Requested period')).toBeInTheDocument();
    expect(screen.getByText('Showing 2026-07-27 to 2026-08-25, in your site’s timezone.')).toBeInTheDocument();

    if (!focused) await userEvent.click(screen.getByText('View 1 Campaign'));
    const editor = routeFrom(hrefOf(focused ? 'Edit this Campaign' : 'Edit Newsletter footer'));
    expect(editor.editId).toBe(optinId);
    expect(routeFrom(editor.returnTo).report).toEqual({ days: 30, goal, optinId: focused ? optinId : undefined });
    expect(routeFrom(hrefOf(focused ? 'View captured leads' : 'View captures for Newsletter footer')).leads).toMatchObject({
      optinId,
      from: '2026-07-27',
      to: '2026-08-25',
    });
    expect(routeFrom(hrefOf(focused ? 'All Campaign results' : 'Newsletter footer')).report).toEqual({
      days: 30,
      goal,
      optinId: focused ? undefined : optinId,
    });

    api.readDashboard.mockResolvedValue({ ...TWO_GOALS, days: 7, from: '2026-08-19' });
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading report' }));
    await screen.findByText('Showing 2026-08-19 to 2026-08-25, in your site’s timezone.');
    expect(screen.queryByText('Requested period')).toBeNull();
    const refreshed = routeFrom(hrefOf(focused ? 'Edit this Campaign' : 'Edit Newsletter footer'));
    expect(routeFrom(refreshed.returnTo).report.days).toBe(7);
    expect(routeFrom(hrefOf(focused ? 'View captured leads' : 'View captures for Newsletter footer')).leads.from).toBe('2026-08-19');
  });

  it('reports controlled period and Goal changes while waiting for the parent to accept them', async () => {
    const onQueryChange = vi.fn();
    const { rerender } = render(<Dashboard query={{ days: 30 }} onQueryChange={onQueryChange} />);
    await screen.findByRole('heading', { name: 'Grow my email list' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Report period' }), '7');
    expect(onQueryChange).toHaveBeenLastCalledWith({ days: 7 });
    expect(api.readDashboard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('combobox', { name: 'Report period' })).toHaveValue('30');

    api.readDashboard.mockResolvedValue({ ...TWO_GOALS, days: 7, from: '2026-08-19' });
    rerender(<Dashboard query={{ days: 7 }} onQueryChange={onQueryChange} />);
    await screen.findByText('Showing 2026-08-19 to 2026-08-25, in your site’s timezone.');
    await userEvent.click(screen.getByRole('button', { name: 'Promote a sale or offer' }));
    expect(onQueryChange).toHaveBeenLastCalledWith({ days: 7, goal: 'promote_offer' });
    expect(screen.getByRole('heading', { name: 'Grow my email list' })).toBeInTheDocument();

    rerender(<Dashboard query={{ days: 7, goal: 'promote_offer' }} onQueryChange={onQueryChange} />);
    expect(screen.queryByRole('heading', { name: 'Grow my email list' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Promote a sale or offer' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'All goals' }));
    expect(onQueryChange).toHaveBeenLastCalledWith({ days: 7, goal: undefined });
    expect(api.readDashboard).toHaveBeenCalledTimes(2);
  });

  it('clears Optin focus through a real bookmarkable link that retains the accepted Goal and period', async () => {
    const onQueryChange = vi.fn();
    const { rerender } = render(<Dashboard query={{ days: 30, goal, optinId }} onQueryChange={onQueryChange} />);
    await screen.findByRole('heading', { name: 'Newsletter footer' });
    const target = routeFrom(hrefOf('All Campaign results'));
    expect(target.section).toBe('analytics');
    expect(target.report).toEqual({ days: 30, goal, optinId: undefined });
    // App accepts the link's hash and passes its parsed query back into the page.
    await act(async () => { rerender(<Dashboard query={target.report} onQueryChange={onQueryChange} />); });
    expect(screen.getByRole('heading', { name: 'Grow my email list' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Newsletter footer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Grow my email list' })).toHaveAttribute('aria-pressed', 'true');
    expect(api.readDashboard).toHaveBeenCalledTimes(1);
  });

  it('honours a custom 366-day bookmark and preserves it when editing the reported Optin', async () => {
    api.readDashboard.mockResolvedValue({ ...TWO_GOALS, days: 366, from: '2025-08-25' });
    const query = routeFrom(`#analytics?days=366&optin=${optinId}`).report;
    render(<Dashboard query={query} />);
    await screen.findByRole('heading', { name: 'Newsletter footer' });

    expect(api.readDashboard).toHaveBeenCalledWith(366);
    expect(screen.getByRole('combobox', { name: 'Report period' })).toHaveValue('366');
    expect(screen.getByRole('option', { name: 'The last 366 days' })).toBeInTheDocument();
    const editor = routeFrom(hrefOf('Edit this Campaign'));
    expect(routeFrom(editor.returnTo).report).toEqual({ days: 366, goal: undefined, optinId });
    expect(routeFrom(hrefOf('View captured leads')).leads.from).toBe('2025-08-25');
  });

  it.each(['DELETED_OPTIN', 'UNKNOWN_OPTIN'])('explains unavailable individual results for %s without relabelling Goal totals', async (missingId) => {
    if (missingId === 'DELETED_OPTIN') {
      api.readDashboard.mockResolvedValue({
        ...TWO_GOALS,
        goals: TWO_GOALS.goals.map((card) => ({ ...card, optins: [] })),
      });
    }
    render(<Dashboard query={{ days: 30, optinId: missingId }} />);
    const unavailable = await screen.findByRole('region', { name: 'Campaign report' });
    expect(within(unavailable).getByText('This Campaign is not available in the report')).toBeVisible();
    expect(screen.getByText('A deleted Campaign keeps its historical counts in its Goal’s totals, but no longer has an individual report.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Grow my email list' })).toBeNull();
    expect(screen.queryByText('100', { selector: 'dd' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit this Campaign' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'View captured leads' })).toBeNull();
    expect(routeFrom(hrefOf('View all results')).report).toEqual({ days: 30, goal: undefined, optinId: undefined });
  });

  it('does not assign a whole Goal’s delivery gap to one focused Optin', async () => {
    api.readDashboard.mockResolvedValue({
      ...TWO_GOALS,
      goals: [{ ...TWO_GOALS.goals[0], headline_label: 'Deliveries', undelivered_conversions: 10 }],
    });
    render(<Dashboard query={{ days: 30, optinId }} />);
    await screen.findByRole('heading', { name: 'Newsletter footer' });
    expect(screen.getByText('Deliveries', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.queryByText(/more submissions than emails accepted for sending/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Review forwarding' })).toBeNull();
  });

  it('explains rate, delivery, deleted-Optin and retention limits where the report is read', async () => {
    render(<Dashboard />);
    await screen.findByRole('heading', { name: 'Grow my email list' });
    await userEvent.click(screen.getByText('How these numbers work'));
    expect(screen.getByText(/Conversion rate is visitor actions divided by impressions.*A dash means there were no impressions\./)).toBeVisible();
    expect(screen.getByText(/headline counts emails accepted for sending.*These send events do not prove inbox arrival\./)).toBeVisible();
    expect(screen.getByText(/Goal totals include deleted Campaigns.*Changing a campaign’s Goal moves its historical counts/)).toBeVisible();
    expect(screen.getByText('Reports use daily counters. Deleting captured leads through retention does not remove those historical counts.')).toBeVisible();
  });
});
