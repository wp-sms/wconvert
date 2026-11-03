import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  DashboardPayload,
  GoalReport,
  Numbers,
  OptinReport,
} from '../../resources/admin/src/stats/api';
import { routeFrom } from '../../resources/admin/src/nav';
import {
  families,
  reportCSV,
  csvCell,
} from '../../resources/admin/src/stats/reporting';

const api = vi.hoisted(() => ({
  readReport: vi.fn(),
  publishOptin: vi.fn(),
  unpublishOptin: vi.fn(),
  declareWinner: vi.fn(),
}));
vi.mock('../../resources/admin/src/stats/api', async (actual) => ({
  ...(await actual<typeof import('../../resources/admin/src/stats/api')>()),
  readReport: api.readReport,
}));
vi.mock('../../resources/admin/src/stats/targets-api', () => ({
  readMonthlyTargets: vi.fn(async () => ({
    month: '2026-09',
    from: '2026-09-01',
    end: '2026-09-30',
    through: '2026-09-13',
    previous_month: '2026-08',
    previous_targets: {},
    max_target: 100000000,
    metrics: [],
  })),
  saveMonthlyTargets: vi.fn(),
}));
vi.mock('../../resources/admin/src/optins/api', () => ({
  publishOptin: api.publishOptin,
  unpublishOptin: api.unpublishOptin,
  declareWinner: api.declareWinner,
}));
import { Dashboard } from '../../resources/admin/src/stats/Dashboard';
import { Change, changeOf, rateChange } from '../../resources/admin/src/stats/ReportDetails';

const numbers = (n = 12, shown = 100): Numbers => ({
  headline: n,
  conversions: n,
  impressions: shown,
  dismissals: 0,
  deliveries: null,
  conversion_rate: shown ? n / shown : null,
  by_day: { '2026-09-13': n },
  conversion_by_day: { '2026-09-13': n },
  impression_by_day: { '2026-09-13': shown },
});
const row = (
  id = 'email',
  status: OptinReport['status'] = 'published',
): OptinReport => ({
  ...numbers(),
  id,
  name: 'Newsletter footer',
  parent_id: null,
  published_at: null,
  status,
});
const goal = (optins = [row()]): GoalReport => ({
  ...numbers(),
  goal: 'grow_email_list',
  label: 'Grow my email list',
  action: 'submit',
  result_label: 'Email submissions',
  rate_label: 'Email submission rate',
  headline_label: 'Email submissions',
  undelivered_conversions: null,
  optins,
  measurement: 'Counts submitted forms, not confirmed subscribers.',
});
function payload(): DashboardPayload {
  const data: DashboardPayload = {
    from: '2026-08-15',
    to: '2026-09-13',
    days: 30,
    complete_days: true,
    today: '2026-09-14',
    goals: [goal()],
    impact: [
      {
        id: 'leads',
        label: 'Submissions',
        note: 'Form submissions across all capture goals',
        count: 12,
        goals: ['grow_email_list'],
      },
      {
        id: 'offers',
        label: 'Offer link clicks',
        note: 'Clicks to offers',
        count: 0,
        goals: [],
      },
      {
        id: 'carts',
        label: 'Cart return clicks',
        note: 'Clicks back to carts',
        count: 0,
        goals: [],
      },
      {
        id: 'impressions',
        label: 'Shown',
        note: 'Appearances, including repeats',
        count: 100,
        goals: ['grow_email_list'],
      },
    ],
  };
  return {
    ...data,
    previous: {
      ...data,
      from: '2026-07-16',
      to: '2026-08-14',
      goals: [{ ...goal(), ...numbers(6, 100) }],
      impact: data.impact.map((i) => ({ ...i, count: i.count / 2 })),
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  window.wconvertAdmin = {
    exportUrl: '',
    variants: { availability: 'ready', tier: 'pro' },
  };
  api.readReport.mockResolvedValue(payload());
});

describe('impact overview', () => {
  it('reads This month’s first day as today so far, with its submissions and export (ADR 0177)', async () => {
    api.readReport.mockResolvedValue({
      ...payload(),
      month: '2026-09',
      from: '2026-09-01',
      to: '2026-09-01',
      days: 1,
      complete_days: false,
      today: '2026-09-01',
      previous: undefined,
    });
    render(<Dashboard query={{ month: '2026-09', optinId: 'email' }} />);
    expect(await screen.findByRole('link', { name: 'View submissions' })).toBeInTheDocument();
    expect(screen.queryByText(/No complete days/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).not.toHaveAttribute('aria-disabled');
  });
  it('keeps a monthly target drilldown on that month through campaign and editor links', async () => {
    const monthly = {
      ...payload(),
      month: '2026-09',
      from: '2026-09-01',
      days: 13,
    };
    api.readReport.mockResolvedValue(monthly);
    const view = render(
      <Dashboard query={{ month: '2026-09', impact: 'leads' }} />,
    );
    const campaign = await screen.findByRole('link', {
      name: 'Newsletter footer',
    });
    expect(api.readReport).toHaveBeenCalledWith({ month: '2026-09' });
    expect(routeFrom(campaign.getAttribute('href')!).report).toMatchObject({
      month: '2026-09',
      optinId: 'email',
    });
    expect(
      screen.getByRole('button', { name: /^Report period: This month, Sep 1\s–\s13, 2026$/ }),
    ).toBeInTheDocument();
    const onChange = vi.fn();
    view.rerender(
      <Dashboard
        query={{ month: '2026-09', optinId: 'email' }}
        onQueryChange={onChange}
      />,
    );
    const edit = routeFrom(
      (await screen.findByRole('link', { name: 'Open editor' })).getAttribute(
        'href',
      )!,
    );
    expect(routeFrom(edit.returnTo).report.month).toBe('2026-09');
    expect(
      routeFrom(
        screen
          .getByRole('link', { name: 'Overall impact' })
          .getAttribute('href')!,
      ).report.month,
    ).toBe('2026-09');
    await userEvent.click(screen.getByRole('button', { name: /^Report period/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Last 7 days' }));
    expect(onChange).toHaveBeenCalledWith({
      month: undefined,
      days: 7,
      optinId: 'email',
    });
  });

  it('shows compatible impact counts without a global rate or timezone', async () => {
    render(<Dashboard />);
    await screen.findByRole('region', { name: 'Overall impact' });
    expect(
      screen.getByRole('link', { name: /^Submissions/ }),
    ).toHaveTextContent('12');
    expect(screen.queryByText('Your impact at a glance')).toBeNull();
    expect(screen.queryByText('Conversion rate')).toBeNull();
    expect(
      screen.queryByText(/Asia\/Muscat|in your site’s timezone/),
    ).toBeNull();
    // The window on screen is the window asked for, never a server default it would guess.
    expect(api.readReport).toHaveBeenCalledWith({ days: 30 });
    expect(
      screen.getByRole('button', { name: /^Report period: Last 30 days, Aug 15\s–\sSep 13, 2026$/ }),
    ).toBeInTheDocument();
  });
  it('shows no zero card for an impact nobody runs, on any site (ADR 0116)', async () => {
    window.wconvertAdmin = { exportUrl: '', commerce: true };
    try {
      render(<Dashboard />);
      await screen.findByRole('region', { name: 'Overall impact' });
      expect(screen.queryByRole('link', { name: /Cart return clicks/ })).toBeNull();
      expect(screen.queryByRole('link', { name: /Offer link clicks/ })).toBeNull();
      expect(screen.getByRole('link', { name: /^Shown/ })).toBeInTheDocument();
    } finally { delete window.wconvertAdmin; }
  });
  it('keeps an impact card that has a goal, a count or an earlier count', async () => {
    const data = payload();
    data.impact[1] = { ...data.impact[1], count: 0, goals: ['promote_offer'] };
    data.previous!.impact[2] = { ...data.previous!.impact[2], count: 3 };
    api.readReport.mockResolvedValue(data);
    render(<Dashboard />);
    expect(await screen.findByRole('link', { name: /Offer link clicks/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cart return clicks/ })).toBeInTheDocument();
  });
  it('toggles the previous period without fetching or discarding the current result', async () => {
    render(<Dashboard />);
    await screen.findByRole('region', { name: 'Overall impact' });
    expect(
      screen.getByRole('link', { name: /^Submissions/ }),
    ).toHaveTextContent('100%');
    await userEvent.click(screen.getByRole('button', { name: /^Report period/ }));
    const compare = screen.getByRole('checkbox', { name: /^Compare with the previous period/ });
    expect(compare).toBeChecked();
    expect(compare).toHaveAccessibleDescription(/^Jul 16\s–\sAug 14, 2026$/);
    await userEvent.click(compare);
    expect(compare).not.toBeChecked();
    expect(
      screen.getByRole('link', { name: /^Submissions/ }),
    ).not.toHaveTextContent('100%');
    expect(api.readReport).toHaveBeenCalledTimes(1);
  });
  it('offers bookmarkable Goal and impact drill-downs', async () => {
    render(<Dashboard />);
    const link = await screen.findByRole('link', {
      name: /Grow my email list/,
    });
    expect(routeFrom(link.getAttribute('href')!).report).toMatchObject({
      days: 30,
      goal: 'grow_email_list',
    });
    expect(
      routeFrom(
        screen
          .getByRole('link', { name: /^Submissions/ })
          .getAttribute('href')!,
      ).report.impact,
    ).toBe('leads');
  });
  it('shows an actionable first visit with no invented results', async () => {
    api.readReport.mockResolvedValue({ ...payload(), goals: [] });
    render(<Dashboard />);
    expect(
      await screen.findByText('Your first results start with a live campaign'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Create campaign' }),
    ).toHaveAttribute('href', '#optins?new=1');
    // Nothing to export, compare, target or sell before the first campaign.
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
    expect(screen.queryByText('Monthly targets')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^Report period/ }));
    expect(screen.queryByRole('checkbox', { name: /^Compare with the previous period/ })).toBeNull();
  });
  it('reports an initial read failure and allows retry', async () => {
    api.readReport.mockRejectedValueOnce(new Error('Not allowed'));
    render(<Dashboard />);
    expect(await screen.findByText('Not allowed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('region', { name: 'Overall impact' }),
    ).toBeInTheDocument();
  });
  it('retains accepted dates and capture links when a new period fails', async () => {
    const { rerender } = render(
      <Dashboard query={{ days: 30, optinId: 'email' }} />,
    );
    await screen.findByRole('heading', { name: 'Newsletter footer' });
    api.readReport.mockRejectedValueOnce(new Error('Offline'));
    rerender(<Dashboard query={{ days: 7, optinId: 'email' }} />);
    const failure = await screen.findByText(/Could not load that period.*Offline/);
    expect(
      within(failure.closest('[data-slot="alert"]') as HTMLElement).getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
    expect(
      routeFrom(
        screen
          .getByRole('link', { name: 'View submissions' })
          .getAttribute('href')!,
      ).leads,
    ).toMatchObject({ from: '2026-08-15', to: '2026-09-13' });
    const edit = routeFrom(
      screen.getByRole('link', { name: 'Open editor' }).getAttribute('href')!,
    );
    expect(routeFrom(edit.returnTo).report.days).toBe(30);
  });
  it('ignores a stale response finishing after the latest period', async () => {
    const { rerender } = render(<Dashboard query={{ days: 30 }} />);
    await screen.findByRole('region', { name: 'Overall impact' });
    let finish!: (data: DashboardPayload) => void;
    api.readReport.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    rerender(<Dashboard query={{ days: 7 }} />);
    api.readReport.mockResolvedValueOnce({
      ...payload(),
      days: 90,
      impact: payload().impact.map((i) => ({ ...i, count: 99 })),
    });
    rerender(<Dashboard query={{ days: 90 }} />);
    await screen.findByRole('link', { name: /^Submissions.*99/ });
    await act(async () => finish({ ...payload(), days: 7 }));
    expect(
      screen.getByRole('link', { name: /^Submissions/ }),
    ).toHaveTextContent('99');
  });
});

describe('Goal and campaign reports', () => {
  it('keeps every earlier variant in the family after successive child winners', async () => {
    const historical = [
      { ...row('winner'), name: 'Current design' },
      {
        ...row('earlier', 'historical'),
        name: 'Previous winner',
        parent_id: 'winner',
      },
      {
        ...row('oldest', 'historical'),
        name: 'Earliest design',
        parent_id: 'earlier',
      },
    ];
    const card = { ...goal(historical), ...numbers(36, 300) };
    api.readReport.mockResolvedValue({ ...payload(), goals: [card] });
    render(<Dashboard query={{ experiment: 'winner' }} />);
    expect(
      await screen.findByRole('heading', { name: 'Earliest design' }),
    ).toBeInTheDocument();
    const family = families(card);
    expect(family).toHaveLength(1);
    expect(family[0].numbers.conversions).toBe(36);
    expect(
      reportCSV(payload(), [{ ...card, optins: family[0].arms }]),
    ).toContain('Earliest design');
  });
  it('keeps deleted rows inspectable and does not offer edit or resume', async () => {
    api.readReport.mockResolvedValue({
      ...payload(),
      goals: [goal([row('email', 'historical')])],
    });
    render(<Dashboard query={{ optinId: 'email' }} />);
    await screen.findByRole('heading', { name: 'Newsletter footer' });
    expect(screen.getByText(/This campaign was deleted/)).toBeInTheDocument();
    expect(screen.getByText('Deleted')).toBeInTheDocument();
    expect(screen.queryByText('Historical')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open editor' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Publish saved draft' }),
    ).toBeNull();
    expect(
      screen.getByRole('link', { name: 'View submissions' }),
    ).toBeInTheDocument();
  });
  it('does not send click-only campaigns to the lead log', async () => {
    api.readReport.mockResolvedValue({
      ...payload(),
      goals: [{ ...goal(), action: 'click', rate_label: 'Link click rate' }],
    });
    render(<Dashboard query={{ optinId: 'email' }} />);
    await screen.findByRole('heading', { name: 'Newsletter footer' });
    expect(
      screen.queryByRole('link', { name: 'View submissions' }),
    ).toBeNull();
    expect(screen.getByText('Link click rate')).toBeInTheDocument();
  });
  it('searches and filters campaign contributions', async () => {
    api.readReport.mockResolvedValue({
      ...payload(),
      goals: [goal([row(), { ...row('second', 'paused'), name: 'Old form' }])],
    });
    render(<Dashboard query={{ goal: 'grow_email_list' }} />);
    await screen.findByRole('heading', { name: 'Grow my email list' });
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search campaigns' }),
      'Old',
    );
    expect(
      screen.queryByRole('link', { name: 'Newsletter footer' }),
    ).toBeNull();
    expect(screen.getByRole('link', { name: 'Old form' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Published' }));
    expect(screen.getByText('No campaigns found')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(
      screen.getByRole('link', { name: 'Newsletter footer' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Campaign contributions' })).getByText('Draft'),
    ).toBeInTheDocument();
  });
  it('counts each variant once and keeps retired-arm results', () => {
    const g = goal([
      row(),
      { ...row('arm', 'historical'), parent_id: 'email' },
    ]);
    const family = families(g);
    expect(family).toHaveLength(1);
    expect(family[0].numbers.conversions).toBe(24);
    expect(family[0].arms).toHaveLength(2);
  });
  it('shows requests and accepted sends separately', async () => {
    api.readReport.mockResolvedValue({
      ...payload(),
      goals: [{ ...goal(), deliveries: 10, result_label: 'Resource requests' }],
    });
    render(<Dashboard query={{ goal: 'grow_email_list' }} />);
    await screen.findByRole('heading', { name: 'Email handoffs' });
    expect(
      screen.getByText('10', { selector: '.wa-handoff strong' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a difference is not a queue or failure count/),
    ).toBeInTheDocument();
  });
  it('shows an undefined rate as a dash and includes exact zero days', async () => {
    api.readReport.mockResolvedValue({
      ...payload(),
      goals: [{ ...goal(), ...numbers(0, 0) }],
    });
    render(<Dashboard query={{ goal: 'grow_email_list', compare: false }} />);
    await screen.findByRole('heading', { name: 'Grow my email list' });
    expect(screen.getByText('—', { selector: 'dd' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Rate' }));
    await userEvent.click(screen.getByText('View exact daily numbers'));
    const table = screen.getByRole('table', { name: 'Daily performance' });
    expect(within(table).getByText('—')).toBeInTheDocument();
  });
  it('confirms resume and reports a rejected publication without optimistic success', async () => {
    api.readReport.mockResolvedValue({
      ...payload(),
      goals: [goal([row('email', 'paused')])],
    });
    api.publishOptin.mockRejectedValueOnce(
      new Error('Complete the destination first'),
    );
    render(<Dashboard query={{ optinId: 'email' }} />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Publish saved draft' }),
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'latest saved draft',
    );
    expect(api.publishOptin).not.toHaveBeenCalled();
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Publish saved draft',
      }),
    );
    expect(
      await screen.findByText('Complete the destination first'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Publish saved draft' }),
    ).toBeInTheDocument();
    // The failure's door runs the decision already confirmed, as the list's does.
    api.publishOptin.mockResolvedValueOnce({});
    const failure = screen.getByText('Complete the destination first').closest<HTMLElement>('[data-slot="alert"]')!;
    await userEvent.click(within(failure).getByRole('button', { name: 'Try again' }));
    expect(api.publishOptin).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(screen.queryByText('Complete the destination first')).toBeNull());
  });
  it('exports scoped raw arm rows, dates and safe merchant text', () => {
    const data = payload();
    data.goals[0].optins[0].name = '=HYPERLINK("bad")';
    const csv = reportCSV(data, data.goals, 'email');
    expect(csv).toContain('2026-08-15');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv.split('\r\n')).toHaveLength(2);
    expect(csvCell('safe, "name"')).toBe('"safe, ""name"""');
  });
  it('pauses only after confirmation, then refreshes the reported status', async () => {
    render(<Dashboard query={{ optinId: 'email' }} />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Unpublish campaign' }),
    );
    expect(api.unpublishOptin).not.toHaveBeenCalled();
    api.unpublishOptin.mockResolvedValueOnce({});
    api.readReport.mockResolvedValueOnce({
      ...payload(),
      goals: [goal([row('email', 'paused')])],
    });
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Unpublish campaign',
      }),
    );
    expect(
      await screen.findByRole('button', { name: 'Publish saved draft' }),
    ).toBeInTheDocument();
    expect(api.unpublishOptin).toHaveBeenCalledWith('email');
  });
  it('opens family totals in the comparison rather than a single arm report', async () => {
    api.readReport.mockResolvedValue({
      ...payload(),
      goals: [
        goal([
          row(),
          {
            ...row('arm', 'historical'),
            parent_id: 'email',
            name: 'Retired variant',
          },
        ]),
      ],
    });
    render(<Dashboard query={{ goal: 'grow_email_list' }} />);
    const link = await screen.findByRole('link', { name: 'Newsletter footer' });
    expect(routeFrom(link.getAttribute('href')!).report.experiment).toBe(
      'email',
    );
  });
  it('keeps retired variants readable without offering another winner decision', async () => {
    api.readReport.mockResolvedValue({
      ...payload(),
      goals: [
        goal([
          row(),
          {
            ...row('arm', 'historical'),
            parent_id: 'email',
            name: 'Retired variant',
          },
        ]),
      ],
    });
    render(<Dashboard query={{ experiment: 'email' }} />);
    expect(
      await screen.findByRole('heading', { name: 'Retired variant' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'View report' })).toHaveLength(
      2,
    );
    expect(
      screen.queryByRole('button', { name: 'Use this variant' }),
    ).toBeNull();
    expect(api.declareWinner).not.toHaveBeenCalled();
  });
  it('requires an explicit manual variant choice and surfaces server refusals', async () => {
    api.readReport.mockResolvedValue({
      ...payload(),
      goals: [
        goal([
          row(),
          { ...row('arm'), parent_id: 'email', name: 'Second variant' },
        ]),
      ],
    });
    api.declareWinner.mockRejectedValueOnce(
      new Error('The comparison has already ended'),
    );
    render(<Dashboard query={{ experiment: 'email' }} />);
    const choices = await screen.findAllByRole('button', {
      name: 'Use this variant',
    });
    await userEvent.click(choices[1]);
    // The campaign list's words for the same decision (ADR 0137).
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Use this variant?');
    expect(api.declareWinner).not.toHaveBeenCalled();
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Use this variant' }),
    );
    expect(
      await screen.findByText('The comparison has already ended'),
    ).toBeInTheDocument();
    expect(api.declareWinner).toHaveBeenCalledWith('email', 'arm');
    // Drawn on the variant whose choice failed, with its door.
    api.declareWinner.mockResolvedValueOnce({});
    const failure = screen.getByText('The comparison has already ended').closest<HTMLElement>('[data-slot="alert"]')!;
    await userEvent.click(within(failure).getByRole('button', { name: 'Try again' }));
    expect(api.declareWinner).toHaveBeenCalledTimes(2);
    expect(api.declareWinner).toHaveBeenLastCalledWith('email', 'arm');
  });
});

it('explains publication after the selected dates without implying a display problem', async () => {
  api.readReport.mockResolvedValue({ ...payload(), goals: [goal([{ ...row(), ...numbers(0, 0), published_at: '2026-09-14 09:00:00' }])] });
  render(<Dashboard query={{ optinId: 'email' }} />);
  expect(await screen.findByText('Published after these report dates. New activity appears after each day ends.')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Needs attention' })).not.toBeInTheDocument();
});

describe('a change against the previous period (ADR 0185)', () => {
  it('reads as a direction, and only a real move has one', () => {
    expect(changeOf(120, 100)).toEqual({ text: '20%', direction: 'up' });
    expect(changeOf(50, 100)).toEqual({ text: '50%', direction: 'down' });
    expect(changeOf(100, 100)).toEqual({ text: '0%', direction: 'flat' });
    // Rounds to 0%, so an arrow would claim a move the figure denies.
    expect(changeOf(100001, 100000)).toEqual({ text: '0%', direction: 'flat' });
    expect(changeOf(5, 0)).toEqual({ text: 'New this period', direction: 'new' });
    expect(changeOf(0, 0)).toBeNull();
  });

  it('reads a rate in percentage points, and says nothing when either rate is missing', () => {
    expect(rateChange(0.046, 0.04)).toEqual({ text: '0.6 pts', direction: 'up' });
    expect(rateChange(0.04, 0.046)).toEqual({ text: '0.6 pts', direction: 'down' });
    expect(rateChange(0.04, 0.04)).toEqual({ text: '0 pts', direction: 'flat' });
    expect(rateChange(0.04004, 0.04)).toEqual({ text: '0 pts', direction: 'flat' });
    expect(rateChange(null, 0.04)).toBeNull();
    expect(rateChange(0.04, null)).toBeNull();
  });

  it('shows a fall in red and a rise in green, each with an arrow and words for a screen reader', async () => {
    const data = payload();
    data.previous!.impact = data.impact.map((i) => ({ ...i, count: i.id === 'leads' ? 24 : 50 }));
    api.readReport.mockResolvedValue(data);
    render(<Dashboard />);
    const fall = (await screen.findByRole('link', { name: /^Submissions/ })).querySelector('.wa-change')!;
    expect(fall).toHaveTextContent('Down50% vs previous period');
    expect(fall.querySelector('.wa-change-down svg.lucide-arrow-down')).not.toBeNull();
    expect(within(fall as HTMLElement).getByText('Down')).toHaveClass('sr-only');
    const rise = screen.getByRole('link', { name: /^Shown/ }).querySelector('.wa-change')!;
    expect(rise).toHaveTextContent(/^Up.*% vs previous period$/);
    expect(rise.querySelector('.wa-change-up svg.lucide-arrow-up')).not.toBeNull();
    // The words after the figure stay muted: only the figure takes the colour.
    expect(rise).not.toHaveClass('wa-change-up');
  });

  it('keeps no change and a first period neutral, with no arrow', async () => {
    render(<>
      <Change current={10} previous={10} />
      <Change current={10} previous={0} />
    </>);
    const lines = [...document.querySelectorAll('.wa-change')].map((line) => line.textContent);
    expect(lines).toEqual(['0% vs previous period', 'New this period']);
    expect(document.querySelector('svg')).toBeNull();
    expect(document.querySelector('.wa-change-up, .wa-change-down')).toBeNull();
  });

  it('writes the goal card the same way', async () => {
    const data = payload();
    data.previous!.goals = [{ ...data.goals[0], conversions: data.goals[0].conversions * 2 }];
    api.readReport.mockResolvedValue(data);
    render(<Dashboard />);
    const card = (await screen.findAllByRole('link')).find((link) => link.classList.contains('wa-goal-card'))!;
    expect(card.querySelector('.wa-change-down svg.lucide-arrow-down')).not.toBeNull();
    expect(card).toHaveTextContent('Down50%');
  });

  it('puts a change on the Rate tile of a report', async () => {
    const data = payload();
    data.previous!.goals = [{ ...data.goals[0], conversion_rate: (data.goals[0].conversion_rate ?? 0) + 0.006 }];
    api.readReport.mockResolvedValue(data);
    render(<Dashboard query={{ goal: data.goals[0].goal }} />);
    const tile = (await screen.findByText(data.goals[0].rate_label)).closest('div')!;
    expect(tile).toHaveTextContent('Down0.6 pts vs previous period');
    expect(tile).not.toHaveTextContent('÷');
    expect(tile.querySelector('.wa-change-down')).not.toBeNull();
  });

  it('puts no change on the Rate tile when the earlier rate is missing', async () => {
    const data = payload();
    data.previous!.goals = [{ ...data.goals[0], conversion_rate: null }];
    api.readReport.mockResolvedValue(data);
    render(<Dashboard query={{ goal: data.goals[0].goal }} />);
    const tile = (await screen.findByText(data.goals[0].rate_label)).closest('div')!;
    expect(tile.querySelector('.wa-change')).toBeNull();
  });
});

describe('a headline card (ADR 0185)', () => {
  it('keeps its description in a tip beside the link rather than on the card', async () => {
    api.readReport.mockResolvedValue(payload());
    render(<Dashboard />);
    const link = await screen.findByRole('link', { name: /^Submissions/ });
    const note = payload().impact.find((item) => item.id === 'leads')!.note;
    expect(screen.queryByText(note)).toBeNull();
    const tip = screen.getByRole('button', { name: 'About Submissions' });
    // Beside the link, because a button inside a link is not something a keyboard can reach.
    expect(link).not.toContainElement(tip);
    await userEvent.click(tip);
    expect(await screen.findByText(note)).toBeVisible();
    expect(link).toHaveAttribute('href');
  });
});

describe('a report’s section title (ADR 0187)', () => {
  it('names the number and keeps its description in a tip beside the title', async () => {
    api.readReport.mockResolvedValue(payload());
    render(<Dashboard query={{ impact: 'leads' }} />);
    const title = await screen.findByRole('heading', { level: 2, name: 'Submissions' });
    const note = payload().impact.find((item) => item.id === 'leads')!.note;
    expect(screen.queryByText(note)).toBeNull();
    const tip = screen.getByRole('button', { name: 'About Submissions' });
    expect(title.parentElement).toContainElement(tip);
    await userEvent.click(tip);
    expect(await screen.findByText(note)).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(tip).toHaveFocus();
  });

  it('keeps “not a proven winner” one press from the A/B report’s title', async () => {
    api.readReport.mockResolvedValue({
      ...payload(),
      goals: [goal([
        { ...row('email'), name: 'Variant A', ...numbers(24, 999) },
        { ...row('arm'), parent_id: 'email', name: 'Variant B', ...numbers(31, 999) },
      ])],
    });
    render(<Dashboard query={{ experiment: 'email' }} />);
    const title = await screen.findByRole('heading', { level: 2, name: 'Variant A' });
    expect(screen.queryByText(/They do not prove a winner/)).toBeNull();
    const tip = within(title.parentElement!).getByRole('button', { name: 'About Variant A' });
    await userEvent.click(tip);
    expect(await screen.findByText(/They do not prove a winner/)).toBeVisible();
  });
});

describe('Jump to on each report (ADR 0185)', () => {
  const sections = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Jump to' }));
    return screen.getAllByRole('menuitem').map((item) => item.textContent);
  };

  it('lists the overview in page order', async () => {
    api.readReport.mockResolvedValue(payload());
    render(<Dashboard />);
    expect(await sections()).toEqual(['Results by goal', 'Monthly targets']);
  });

  it('lists a goal report in page order', async () => {
    const data = payload();
    api.readReport.mockResolvedValue(data);
    render(<Dashboard query={{ goal: data.goals[0].goal }} />);
    expect(await sections()).toEqual(['Performance', 'Campaigns']);
  });

  it('sits in the page header, not in a row of its own', async () => {
    api.readReport.mockResolvedValue(payload());
    render(<Dashboard />);
    const trigger = await screen.findByRole('button', { name: 'Jump to' });
    expect(trigger.closest('.wa-header-actions')).not.toBeNull();
    expect(trigger.parentElement!.firstElementChild).toBe(trigger);
  });
});

describe('the report period (ADR 0132)', () => {
  it('reads Today live, labelled so far, and refuses the comparison with its reason', async () => {
    const live = { ...payload(), from: '2026-09-14', to: '2026-09-14', days: 1, complete_days: false, previous: undefined, insights: [] };
    api.readReport.mockResolvedValue(live);
    const onChange = vi.fn();
    render(<Dashboard query={{ today: true }} onQueryChange={onChange} />);
    const trigger = await screen.findByRole('button', { name: /^Report period: Today, Sep 14, 2026 so far$/ });
    expect(api.readReport).toHaveBeenCalledWith({ today: true });
    await userEvent.click(trigger);
    const compare = screen.getByRole('checkbox', { name: /^Compare with the previous period/ });
    expect(compare).toHaveAttribute('aria-disabled', 'true');
    expect(compare).not.toBeChecked();
    expect(compare).toHaveAccessibleDescription('Today is still in progress.');
    await userEvent.click(compare);
    expect(compare).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /^Submissions/ }).querySelector('.wa-change')).toBeNull();
  });

  it('turns each choice into the window a link names, and custom dates into from and to', async () => {
    const onChange = vi.fn();
    render(<Dashboard query={{ goal: 'grow_email_list' }} onQueryChange={onChange} />);
    await screen.findByRole('heading', { name: 'Grow my email list' });
    const open = () => userEvent.click(screen.getByRole('button', { name: /^Report period/ }));
    await open();
    await userEvent.click(screen.getByRole('radio', { name: 'Today' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ today: true, days: undefined, goal: 'grow_email_list' }));
    await open();
    await userEvent.click(screen.getByRole('radio', { name: 'Yesterday' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ days: 1 }));
    // Months come from the server's today, never the browser's clock.
    await open();
    await userEvent.click(screen.getByRole('radio', { name: 'Last month' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ month: '2026-08' }));
    await open();
    await userEvent.click(screen.getByRole('radio', { name: 'Custom dates' }));
    await userEvent.type(screen.getByLabelText('From'), '2026-09-01');
    await userEvent.type(screen.getByLabelText('To'), '2026-09-10');
    await userEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-09-01', to: '2026-09-10', days: undefined, month: undefined }));
  });

  it('reads custom dates and keeps them on drill-down links', async () => {
    api.readReport.mockResolvedValue({ ...payload(), from: '2026-09-01', to: '2026-09-10', days: 10, custom: true });
    render(<Dashboard query={{ from: '2026-09-01', to: '2026-09-10' }} />);
    const link = await screen.findByRole('link', { name: /Grow my email list/ });
    expect(api.readReport).toHaveBeenCalledWith({ from: '2026-09-01', to: '2026-09-10' });
    expect(routeFrom(link.getAttribute('href')!).report).toMatchObject({ from: '2026-09-01', to: '2026-09-10', goal: 'grow_email_list' });
    expect(screen.getByRole('button', { name: /^Report period: Custom dates, Sep 1\s–\s10, 2026$/ })).toBeInTheDocument();
  });

  it('names the chosen period without dates while it loads, and the shown one after it fails', async () => {
    const view = render(<Dashboard query={{ days: 30 }} />);
    await screen.findByRole('region', { name: 'Overall impact' });
    let fail!: (cause: Error) => void;
    api.readReport.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
    view.rerender(<Dashboard query={{ days: 7 }} />);
    expect(screen.getByRole('button', { name: 'Report period: Last 7 days' })).toBeInTheDocument();
    await act(async () => fail(new Error('Offline')));
    expect(await screen.findByRole('button', { name: /^Report period: Last 30 days, Aug 15\s–\sSep 13, 2026$/ })).toBeInTheDocument();
  });
});

describe('what the overview says', () => {
  it('says once that there is nothing earlier, instead of a line under every card', async () => {
    const data = payload();
    data.previous!.impact = data.impact.map((i) => ({ ...i, count: 0 }));
    api.readReport.mockResolvedValue(data);
    render(<Dashboard />);
    await screen.findByRole('region', { name: 'Overall impact' });
    expect(screen.getByText(/^Nothing to compare in Jul 16\s–\sAug 14, 2026\.$/)).toBeInTheDocument();
    expect(document.querySelectorAll('.wa-impact .wa-change')).toHaveLength(0);
    expect(screen.queryByText('No earlier results')).toBeNull();
  });

  it('shows nothing for nothing → nothing and "New this period" from nothing', async () => {
    const { Change } = await import('../../resources/admin/src/stats/ReportDetails');
    const { container } = render(<Change current={0} previous={0} />);
    expect(container).toBeEmptyDOMElement();
    render(<Change current={4} previous={0} />);
    expect(screen.getByText('New this period')).toBeInTheDocument();
  });

  it('gives each goal card its own rate, change and campaign count — never a site-wide rate', async () => {
    const data = payload();
    data.goals[0] = { ...data.goals[0], ...numbers(105, 4653) };
    data.previous!.goals[0] = { ...data.previous!.goals[0], conversions: 94 };
    api.readReport.mockResolvedValue(data);
    render(<Dashboard />);
    const card = await screen.findByRole('link', { name: /Grow my email list/ });
    expect(card).toHaveTextContent('105 Email submissions');
    expect(card).toHaveTextContent('2.3% of 4,653 shown · Up11.7% · 1 campaign');
    expect(screen.queryByText(/conversion rate/i)).toBeNull();
  });

  it('says an empty window showed nothing, and no longer points at tomorrow (ADR 0177)', async () => {
    const data = payload();
    data.impact = data.impact.map((i) => (i.id === 'impressions' ? { ...i, count: 0 } : i));
    api.readReport.mockResolvedValue(data);
    render(<Dashboard />);
    expect(await screen.findByText('Nothing was shown in this period.')).toBeInTheDocument();
    expect(screen.queryByText(/appears tomorrow/)).not.toBeInTheDocument();
  });

  it('compares a window through today without a line about it, and explains today in the help (ADR 0185)', async () => {
    api.readReport.mockResolvedValue({ ...payload(), from: '2026-08-16', to: '2026-09-14', complete_days: false });
    render(<Dashboard />);
    await userEvent.click(await screen.findByText('How these numbers work'));
    expect(screen.queryByText('Includes today so far')).not.toBeInTheDocument();
    expect(screen.getByText('Today', { selector: 'dt' }).nextElementSibling).toHaveTextContent('still running');
    expect(document.querySelectorAll('.wa-impact .wa-change').length).toBeGreaterThan(0);
  });

  it('lifts linked sales into the headlines, qualified, and jumps to Campaign sales', async () => {
    const { reportExtensions } = await import('../../resources/admin/src/stats/extensions');
    const { ReportTarget } = await import('../../resources/admin/src/stats/ReportNavigation');
    const { useEffect } = await import('react');
    document.documentElement.lang = 'en-US';
    reportExtensions.commerce = function FakeSales({ onSummary }) {
      useEffect(() => onSummary?.({ orders: 18, amount: 1240, currency: 'EUR' }), [onSummary]);
      return <ReportTarget name="sales" label="Sales"><h2>Campaign sales</h2></ReportTarget>;
    };
    try {
      render(<Dashboard />);
      const card = await screen.findByRole('button', { name: /^Linked sales/ });
      expect(card).toHaveTextContent('€1,240.00');
      expect(card).toHaveTextContent('18 orders');
      await userEvent.click(screen.getByRole('button', { name: 'About Linked sales' }));
      expect(await screen.findByText(/Linked, not caused\./)).toBeVisible();
      await userEvent.keyboard('{Escape}');
      const target = document.getElementById(card.getAttribute('aria-controls')!)!;
      target.scrollIntoView = vi.fn();
      await userEvent.click(card);
      expect(target).toHaveFocus();
    } finally {
      delete reportExtensions.commerce;
    }
  });
});

describe('A/B comparison', () => {
  const arms = (shown: number) =>
    goal([
      { ...row('email'), name: 'Variant A', ...numbers(24, shown) },
      { ...row('arm'), parent_id: 'email', name: 'Variant B', ...numbers(31, shown) },
    ]);

  it('reads the leader against the next, best first, and calls it too early on little traffic', async () => {
    api.readReport.mockResolvedValue({ ...payload(), goals: [arms(1000 - 1)] });
    render(<Dashboard query={{ experiment: 'email' }} />);
    const headings = await screen.findAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(['Variant B', 'Variant A']);
    expect(screen.getByText(/^Variant B converts 3\.1% vs Variant A 2\.4% \(\+0\.7 pts\) — too early to call: fewer than 1,000 shown per variant$/)).toBeInTheDocument();
  });

  it('says there is enough to compare, and still not proof', async () => {
    api.readReport.mockResolvedValue({ ...payload(), goals: [arms(1000)] });
    render(<Dashboard query={{ experiment: 'email' }} />);
    expect(await screen.findByText(/enough traffic to compare; this is still not proof\.$/)).toBeInTheDocument();
  });
});

it('unpublishes with a visibility icon, not a pause', async () => {
  render(<Dashboard query={{ optinId: 'email' }} />);
  const button = await screen.findByRole('button', { name: 'Unpublish campaign' });
  expect(button.querySelector('.lucide-eye-off')).not.toBeNull();
  expect(button.querySelector('.lucide-pause')).toBeNull();
});

it('offers only the status chips that would filter to something, as Campaigns does', async () => {
  api.readReport.mockResolvedValue({
    ...payload(),
    goals: [goal([row(), { ...row('second', 'paused'), name: 'Old form' }])],
  });
  render(<Dashboard query={{ goal: 'grow_email_list' }} />);
  const chips = await screen.findByRole('group', { name: 'Filter campaigns by status' });
  expect(within(chips).getAllByRole('radio').map((radio) => radio.closest('label')?.querySelector('span')?.textContent))
    .toEqual(['All', 'Published', 'Drafts']);
  expect(within(chips).queryByRole('radio', { name: 'Deleted' })).toBeNull();
  await userEvent.click(within(chips).getByRole('radio', { name: 'Drafts' }));
  expect(screen.queryByRole('link', { name: 'Newsletter footer' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Old form' })).toBeInTheDocument();
});

it('states the report table’s count and dates in its foot', async () => {
  render(<Dashboard query={{ goal: 'grow_email_list' }} />);
  const table = await screen.findByRole('table', { name: 'Campaign contributions' });
  const foot = table.parentElement!.querySelector('.wconvert-list-foot')!;
  expect(foot).toHaveTextContent(/^1 campaign · /);
  expect(foot).toHaveTextContent('2026');
});

it('dims the report under its line while a new period is read', async () => {
  const { rerender } = render(<Dashboard query={{ days: 30 }} />);
  await screen.findByRole('region', { name: 'Overall impact' });
  expect(document.querySelector('.wa-report-sheet')).not.toHaveClass('opacity-60');
  api.readReport.mockReturnValueOnce(new Promise(() => undefined));
  rerender(<Dashboard query={{ days: 7 }} />);
  expect(await screen.findByText('Updating report…')).toBeInTheDocument();
  const sheet = document.querySelector('.wa-report-sheet')!;
  expect(sheet).toHaveClass('opacity-60');
  expect(sheet).toHaveAttribute('aria-busy', 'true');
  expect(within(sheet as HTMLElement).getByRole('region', { name: 'Overall impact' })).toBeInTheDocument();
});

it('keeps the overview’s reports at one heading level under the page', async () => {
  render(<Dashboard query={{}} />);
  expect(await screen.findByRole('heading', { name: 'Results by goal', level: 2 })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { level: 3, name: 'Results by goal' })).toBeNull();
});

it('draws no empty actions card for a deleted campaign with nothing to act on', async () => {
  api.readReport.mockResolvedValue({ ...payload(), goals: [{ ...goal([row('email', 'historical')]), action: 'click' }] });
  render(<Dashboard query={{ optinId: 'email' }} />);
  await screen.findByText('This campaign was deleted. Its results stay here, and it can no longer be edited.');
  expect(screen.queryByRole('region', { name: 'Campaign actions' })).toBeNull();
});
