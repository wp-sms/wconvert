import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ readProductHealth: vi.fn() }));
vi.mock('../../resources/admin/src/optins/api', () => api);
import { ProductHealthDetails, useProductHealth } from '../../resources/admin/src/optins/ProductHealth';
const row = (id: string) => ({ id, basis: 'published' as const, checks: [{ label: 'Coffee lovers', state: 'warning' as const, message: 'Unavailable: Coffee filter. Review these products in the editor.' }] });
beforeEach(() => { vi.clearAllMocks(); });

it('names the checked version and the selection to repair', async () => {
  const recheck = vi.fn();
  render(<ProductHealthDetails health={row('A')} loading={false} failed={false} onRecheck={recheck} />);
  expect(screen.getByText('Checks the published version against today’s catalog.')).toBeInTheDocument();
  expect(screen.getByText('Coffee lovers')).toBeInTheDocument();
  expect(screen.getByText(/Unavailable: Coffee filter/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Check products again' }));
  expect(recheck).toHaveBeenCalledOnce();
});

it('never retains a successful claim when a refresh fails', async () => {
  api.readProductHealth.mockResolvedValueOnce([row('A')]).mockRejectedValueOnce(Error('offline'));
  const { result } = renderHook(() => useProductHealth('A', 0));
  await waitFor(() => expect(result.current.rows.A).toBeTruthy());
  act(() => result.current.recheck());
  await waitFor(() => expect(result.current.failed).toBe(true));
  expect(result.current.rows).toEqual({});
});

it('ignores a late response from the previous page and aborts that request', async () => {
  let finish!: (rows: unknown) => void;
  api.readProductHealth.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce([row('B')]);
  const { result, rerender } = renderHook(({ ids }) => useProductHealth(ids, 0), { initialProps: { ids: 'A' } });
  rerender({ ids: 'B' });
  await waitFor(() => expect(result.current.rows.B).toBeTruthy());
  await act(async () => finish([row('A')]));
  expect(result.current.rows.A).toBeUndefined();
  expect(api.readProductHealth.mock.calls[0][1].aborted).toBe(true);
});

it('bounds requests to twelve campaigns, and treats missing rows as a failed check', async () => {
  api.readProductHealth.mockImplementation(async (ids: string[]) => ids.map(row));
  const ids = Array.from({ length: 25 }, (_, i) => String(i));
  const { result } = renderHook(() => useProductHealth(ids.join(','), 0));
  await waitFor(() => expect(Object.keys(result.current.rows)).toHaveLength(25));
  expect(api.readProductHealth.mock.calls.map(call => call[0].length)).toEqual([12, 12, 1]);
  api.readProductHealth.mockResolvedValue([]);
  act(() => result.current.recheck());
  await waitFor(() => expect(result.current.failed).toBe(true));
});

it('allows a retry when a catalog request hangs', async () => {
  vi.useFakeTimers();
  try {
    api.readProductHealth.mockReturnValue(new Promise(() => {}));
    const { result, unmount } = renderHook(() => useProductHealth('A', 0));
    await act(async () => vi.advanceTimersByTime(20000));
    expect(result.current.loading).toBe(false); expect(result.current.failed).toBe(true);
    expect(api.readProductHealth.mock.calls[0][1].aborted).toBe(true);
    unmount();
  } finally { vi.useRealTimers(); }
});
