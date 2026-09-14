import { beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MonthlyTargetReport } from '../../resources/admin/src/stats/targets-api';
const api = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock('../../resources/admin/src/stats/targets-api', () => ({
  readMonthlyTargets: api.read,
  saveMonthlyTargets: api.save,
}));
import {
  MonthlyTargets,
  useMonthlyTargets,
} from '../../resources/admin/src/stats/MonthlyTargets';
const payload = (): MonthlyTargetReport => ({
  month: '2026-09',
  from: '2026-09-01',
  end: '2026-09-30',
  through: '2026-09-13',
  previous_month: '2026-08',
  previous_targets: { leads: 80 },
  max_target: 100000000,
  metrics: [
    {
      id: 'leads',
      label: 'Leads captured',
      unit: 'submissions',
      note: 'Submissions, not people.',
      actual: 34,
      target: 100,
      available: true,
    },
    {
      id: 'carts',
      label: 'Cart return clicks',
      unit: 'clicks',
      note: 'Not orders.',
      actual: 0,
      target: null,
      available: false,
    },
  ],
});
function Screen() {
  const report = useMonthlyTargets(true);
  return <MonthlyTargets report={report} />;
}
beforeEach(() => {
  vi.resetAllMocks();
  api.read.mockResolvedValue(payload());
});
it('shows saved progress, edits explicitly, and links to the same calendar month', async () => {
  const saved = payload();
  saved.metrics[0].target = 50;
  api.save.mockResolvedValue(saved);
  render(<Screen />);
  expect(
    await screen.findByRole('progressbar', { name: 'Leads captured' }),
  ).toHaveAttribute('aria-valuenow', '34');
  expect(
    screen.getByRole('link', { name: /View.*Leads captured/i }),
  ).toHaveAttribute('href', '#analytics?month=2026-09&impact=leads');
  expect(screen.queryByText('Cart return clicks')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Edit targets' }));
  const dialog = screen.getByRole('dialog');
  await userEvent.clear(
    within(dialog).getByRole('spinbutton', { name: /Leads captured/ }),
  );
  await userEvent.type(
    within(dialog).getByRole('spinbutton', { name: /Leads captured/ }),
    '50',
  );
  expect(api.save).not.toHaveBeenCalled();
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Save targets' }),
  );
  expect(api.save).toHaveBeenCalledWith('2026-09', { leads: 50 });
  expect(await screen.findByText('68% of target')).toBeInTheDocument();
});

it('cancels edits and treats reuse as a draft, not an automatic save', async () => {
  render(<Screen />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Edit targets' }),
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Reuse last month’s targets' }),
  );
  expect(screen.getByRole('spinbutton')).toHaveValue(80);
  expect(api.save).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('34% of target')).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Edit targets' })).toHaveFocus(),
  );
});

it('keeps a failed save draft for retry and does not change displayed progress', async () => {
  api.save.mockRejectedValueOnce(new Error('Offline'));
  render(<Screen />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Edit targets' }),
  );
  await userEvent.clear(screen.getByRole('spinbutton'));
  await userEvent.type(screen.getByRole('spinbutton'), '50');
  await userEvent.click(screen.getByRole('button', { name: 'Save targets' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Your draft is kept. Offline',
  );
  expect(screen.getByRole('spinbutton')).toHaveValue(50);
  expect(screen.getByText('34% of target')).toBeInTheDocument();
  const saved = payload();
  saved.metrics[0].target = 50;
  api.save.mockResolvedValue(saved);
  await userEvent.click(screen.getByRole('button', { name: 'Save targets' }));
  expect(await screen.findByText('68% of target')).toBeInTheDocument();
  expect(api.save).toHaveBeenCalledTimes(2);
});

it('removes a blank target without resetting its actual count', async () => {
  const saved = payload();
  saved.metrics[0].target = null;
  api.save.mockResolvedValue(saved);
  render(<Screen />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Edit targets' }),
  );
  await userEvent.clear(screen.getByRole('spinbutton'));
  await userEvent.click(screen.getByRole('button', { name: 'Save targets' }));
  expect(api.save).toHaveBeenCalledWith('2026-09', {});
  expect(
    await screen.findByRole('button', { name: 'Set a monthly target' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

it('shows every saved metric, caps the bar above target, and handles the first day honestly', async () => {
  const reached = payload();
  reached.through = null;
  reached.metrics[0].actual = 0;
  reached.metrics[1] = { ...reached.metrics[1], actual: 0, target: 20 };
  api.read.mockResolvedValue(reached);
  const rendered = render(<Screen />);
  expect(
    await screen.findByText(/No complete days yet this month/),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  rendered.unmount();
  reached.through = '2026-09-13';
  reached.metrics[0].actual = 120;
  render(<Screen />);
  expect(await screen.findByText('120% of target')).toBeInTheDocument();
  expect(
    screen.getByRole('progressbar', { name: 'Leads captured' }),
  ).toHaveAttribute('aria-valuenow', '100');
  expect(screen.getByText('20 above target')).toBeInTheDocument();
});

it('discloses failed reads, retries, and keeps accepted values after a refresh fails', async () => {
  api.read.mockRejectedValueOnce(new Error('Offline'));
  render(<Screen />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load monthly targets',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Retry targets' }));
  expect(await screen.findByText('34% of target')).toBeInTheDocument();
  api.read.mockRejectedValueOnce(new Error('Offline again'));
  fireEvent.focus(window);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Showing the last loaded month and values',
  );
  expect(screen.getByText('34% of target')).toBeInTheDocument();
});

it('does not let an older in-flight refresh overwrite an accepted save', async () => {
  render(<Screen />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Edit targets' }),
  );
  let resolveRead!: (data: ReturnType<typeof payload>) => void;
  api.read.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveRead = resolve;
    }),
  );
  fireEvent.focus(window);
  await waitFor(() => expect(api.read).toHaveBeenCalledTimes(2));
  const saved = payload();
  saved.metrics[0].target = 50;
  api.save.mockResolvedValue(saved);
  await userEvent.clear(screen.getByRole('spinbutton'));
  await userEvent.type(screen.getByRole('spinbutton'), '50');
  await userEvent.click(screen.getByRole('button', { name: 'Save targets' }));
  expect(await screen.findByText('68% of target')).toBeInTheDocument();
  await act(async () => resolveRead(payload()));
  expect(screen.getByText('68% of target')).toBeInTheDocument();
});

it('keeps the draft month frozen when the site month rolls over', async () => {
  render(<Screen />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Edit targets' }),
  );
  const october = {
    ...payload(),
    month: '2026-10',
    from: '2026-10-01',
    end: '2026-10-31',
    through: null,
  };
  api.read.mockResolvedValue(october);
  fireEvent.focus(window);
  await waitFor(() => expect(api.read).toHaveBeenCalledTimes(2));
  api.save.mockRejectedValue(
    new Error('The month changed. Close this dialog.'),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save targets' }));
  expect(api.save).toHaveBeenCalledWith('2026-09', { leads: 100 });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The month changed',
  );
  expect(screen.getByRole('spinbutton')).toHaveValue(100);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await userEvent.click(screen.getByRole('button', { name: 'Edit targets' }));
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'Set October 2026 targets',
  );
});
