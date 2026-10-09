import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
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
  readDashboard: vi.fn(),
  publishOptin: vi.fn(),
  unpublishOptin: vi.fn(),
  declareWinner: vi.fn(),
}));
vi.mock('../../resources/admin/src/stats/api', () => ({
  readDashboard: api.readDashboard,
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
    goals: [goal()],
    impact: [
      {
        id: 'leads',
        label: 'Leads captured',
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
        label: 'Times shown',
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
  api.readDashboard.mockResolvedValue(payload());
});

describe('impact overview', () => {
  it('does not link an empty first-day month to today’s capture history or export', async () => {
    api.readDashboard.mockResolvedValue({
      ...payload(),
      month: '2026-09',
      from: '2026-09-01',
      to: '2026-09-01',
      days: 0,
      previous: undefined,
    });
    render(<Dashboard query={{ month: '2026-09', optinId: 'email' }} />);
    await screen.findByText('No complete days yet this month');
    expect(
      screen.queryByRole('link', { name: 'View captured leads' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'View captured leads' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Export report CSV' }),
    ).toBeDisabled();
  });
  it('keeps a monthly target drilldown on that month through campaign and editor links', async () => {
    const monthly = {
      ...payload(),
      month: '2026-09',
      from: '2026-09-01',
      days: 13,
    };
    api.readDashboard.mockResolvedValue(monthly);
    const view = render(
      <Dashboard query={{ month: '2026-09', impact: 'leads' }} />,
    );
    const campaign = await screen.findByRole('link', {
      name: 'Newsletter footer',
    });
    expect(api.readDashboard).toHaveBeenCalledWith(null, true, '2026-09');
    expect(routeFrom(campaign.getAttribute('href')!).report).toMatchObject({
      month: '2026-09',
      optinId: 'email',
    });
    expect(screen.getByRole('combobox', { name: 'Report period' })).toHaveValue(
      'month:2026-09',
    );
    const onChange = vi.fn();
    view.rerender(
      <Dashboard
        query={{ month: '2026-09', optinId: 'email' }}
        onQueryChange={onChange}
      />,
    );
    const edit = routeFrom(
      (await screen.findByRole('link', { name: 'Edit campaign' })).getAttribute(
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
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Report period' }),
      '7',
    );
    expect(onChange).toHaveBeenCalledWith({
      month: undefined,
      days: 7,
      optinId: 'email',
    });
  });

  it('shows compatible impact counts without a global rate or timezone', async () => {
    render(<Dashboard />);
    await screen.findByRole('heading', {
      name: 'What WConvert brought to your site',
    });
    expect(
      screen.getByRole('link', { name: /Leads captured/ }),
    ).toHaveTextContent('12');
    expect(screen.queryByText('Conversion rate')).toBeNull();
    expect(
      screen.queryByText(/Asia\/Muscat|in your site’s timezone/),
    ).toBeNull();
    expect(api.readDashboard).toHaveBeenCalledWith(null, true);
  });
  it('shows no cart results on a site that cannot run cart campaigns (ADR 0127)', async () => {
    render(<Dashboard />);
    await screen.findByRole('heading', { name: 'What WConvert brought to your site' });
    expect(screen.queryByRole('link', { name: /Cart return clicks/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Offer link clicks/ })).toBeInTheDocument();
  });
  it('keeps cart results where the cart module runs', async () => {
    window.wconvertAdmin = { exportUrl: '', commerce: true };
    try {
      render(<Dashboard />);
      expect(await screen.findByRole('link', { name: /Cart return clicks/ })).toBeInTheDocument();
    } finally { delete window.wconvertAdmin; }
  });
  it('toggles the previous period without fetching or discarding the current result', async () => {
    render(<Dashboard />);
    const toggle = await screen.findByRole('switch', {
      name: 'Compare with previous period',
    });
    expect(
      screen.getByRole('link', { name: /Leads captured/ }),
    ).toHaveTextContent('100%');
    await userEvent.click(toggle);
    expect(screen.getByText('Comparison off')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Leads captured/ }),
    ).not.toHaveTextContent('100%');
    expect(api.readDashboard).toHaveBeenCalledTimes(1);
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
          .getByRole('link', { name: /Leads captured/ })
          .getAttribute('href')!,
      ).report.impact,
    ).toBe('leads');
  });
  it('shows an actionable first visit with no invented results', async () => {
    api.readDashboard.mockResolvedValue({ ...payload(), goals: [] });
    render(<Dashboard />);
    expect(
      await screen.findByText('Your first results start with a live campaign'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Go to Campaigns' }),
    ).toHaveAttribute('href', '#optins');
  });
  it('reports an initial read failure and allows retry', async () => {
    api.readDashboard.mockRejectedValueOnce(new Error('Not allowed'));
    render(<Dashboard />);
    expect(await screen.findByText('Not allowed')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry loading report' }),
    );
    expect(
      await screen.findByRole('heading', {
        name: 'What WConvert brought to your site',
      }),
    ).toBeInTheDocument();
  });
  it('retains accepted dates and capture links when a new period fails', async () => {
    const { rerender } = render(
      <Dashboard query={{ days: 30, optinId: 'email' }} />,
    );
    await screen.findByRole('heading', { name: 'Newsletter footer' });
    api.readDashboard.mockRejectedValueOnce(new Error('Offline'));
    rerender(<Dashboard query={{ days: 7, optinId: 'email' }} />);
    await screen.findByText(/Could not load the requested period.*Offline/);
    expect(
      routeFrom(
        screen
          .getByRole('link', { name: 'View captured leads' })
          .getAttribute('href')!,
      ).leads,
    ).toMatchObject({ from: '2026-08-15', to: '2026-09-13' });
    const edit = routeFrom(
      screen.getByRole('link', { name: 'Edit campaign' }).getAttribute('href')!,
    );
    expect(routeFrom(edit.returnTo).report.days).toBe(30);
  });
  it('ignores a stale response finishing after the latest period', async () => {
    const { rerender } = render(<Dashboard query={{ days: 30 }} />);
    await screen.findByRole('heading', {
      name: 'What WConvert brought to your site',
    });
    let finish!: (data: DashboardPayload) => void;
    api.readDashboard.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    rerender(<Dashboard query={{ days: 7 }} />);
    api.readDashboard.mockResolvedValueOnce({
      ...payload(),
      days: 90,
      impact: payload().impact.map((i) => ({ ...i, count: 99 })),
    });
    rerender(<Dashboard query={{ days: 90 }} />);
    await screen.findByRole('link', { name: /Leads captured.*99/ });
    await act(async () => finish({ ...payload(), days: 7 }));
    expect(
      screen.getByRole('link', { name: /Leads captured/ }),
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
    api.readDashboard.mockResolvedValue({ ...payload(), goals: [card] });
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
    api.readDashboard.mockResolvedValue({
      ...payload(),
      goals: [goal([row('email', 'historical')])],
    });
    render(<Dashboard query={{ optinId: 'email' }} />);
    await screen.findByRole('heading', { name: 'Newsletter footer' });
    expect(
      screen.getByText(/This deleted campaign is kept here/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit campaign' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Resume campaign' }),
    ).toBeNull();
    expect(
      screen.getByRole('link', { name: 'View captured leads' }),
    ).toBeInTheDocument();
  });
  it('does not send click-only campaigns to the lead log', async () => {
    api.readDashboard.mockResolvedValue({
      ...payload(),
      goals: [{ ...goal(), action: 'click', rate_label: 'Link click rate' }],
    });
    render(<Dashboard query={{ optinId: 'email' }} />);
    await screen.findByRole('heading', { name: 'Newsletter footer' });
    expect(
      screen.queryByRole('link', { name: 'View captured leads' }),
    ).toBeNull();
    expect(screen.getByText('Link click rate')).toBeInTheDocument();
  });
  it('searches and filters campaign contributions', async () => {
    api.readDashboard.mockResolvedValue({
      ...payload(),
      goals: [goal([row(), { ...row('second', 'paused'), name: 'Old form' }])],
    });
    render(<Dashboard query={{ goal: 'grow_email_list' }} />);
    await screen.findByRole('heading', { name: 'Grow my email list' });
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Find a campaign' }),
      'Old',
    );
    expect(
      screen.queryByRole('link', { name: 'Newsletter footer' }),
    ).toBeNull();
    expect(screen.getByRole('link', { name: 'Old form' })).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Campaign status' }),
      'published',
    );
    expect(
      screen.getByText('No campaigns match. Try another name or status.'),
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
    api.readDashboard.mockResolvedValue({
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
    api.readDashboard.mockResolvedValue({
      ...payload(),
      goals: [{ ...goal(), ...numbers(0, 0) }],
    });
    render(<Dashboard query={{ goal: 'grow_email_list', compare: false }} />);
    await screen.findByRole('heading', { name: 'Grow my email list' });
    expect(screen.getByText('—', { selector: 'dd' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Rate' }));
    await userEvent.click(screen.getByText('View exact daily numbers'));
    const table = screen.getByRole('table', { name: 'Daily performance' });
    expect(within(table).getByText('—')).toBeInTheDocument();
  });
  it('confirms resume and reports a rejected publication without optimistic success', async () => {
    api.readDashboard.mockResolvedValue({
      ...payload(),
      goals: [goal([row('email', 'paused')])],
    });
    api.publishOptin.mockRejectedValueOnce(
      new Error('Complete the destination first'),
    );
    render(<Dashboard query={{ optinId: 'email' }} />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Resume campaign' }),
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'latest saved draft',
    );
    expect(api.publishOptin).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Publish and resume' }),
    );
    expect(
      await screen.findByText('Complete the destination first'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Resume campaign' }),
    ).toBeInTheDocument();
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
      await screen.findByRole('button', { name: 'Pause campaign' }),
    );
    expect(api.unpublishOptin).not.toHaveBeenCalled();
    api.unpublishOptin.mockResolvedValueOnce({});
    api.readDashboard.mockResolvedValueOnce({
      ...payload(),
      goals: [goal([row('email', 'paused')])],
    });
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Pause campaign',
      }),
    );
    expect(
      await screen.findByRole('button', { name: 'Resume campaign' }),
    ).toBeInTheDocument();
    expect(api.unpublishOptin).toHaveBeenCalledWith('email');
  });
  it('opens family totals in the comparison rather than a single arm report', async () => {
    api.readDashboard.mockResolvedValue({
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
    api.readDashboard.mockResolvedValue({
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
    api.readDashboard.mockResolvedValue({
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
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'not a statistically proven winner',
    );
    expect(api.declareWinner).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Use selected variant' }),
    );
    expect(
      await screen.findByText('The comparison has already ended'),
    ).toBeInTheDocument();
    expect(api.declareWinner).toHaveBeenCalledWith('email', 'arm');
  });
});

it('explains publication after the selected dates without implying a display problem', async () => {
  api.readDashboard.mockResolvedValue({ ...payload(), goals: [goal([{ ...row(), ...numbers(0, 0), published_at: '2026-09-14 09:00:00' }])] });
  render(<Dashboard query={{ optinId: 'email' }} />);
  expect(await screen.findByText('Published after these report dates. New activity appears after each day ends.')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Needs attention' })).not.toBeInTheDocument();
});
