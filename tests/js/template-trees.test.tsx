import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTemplateTrees } from '../../resources/admin/src/builder/TemplatePicker';

const design = (id: string) => ({ id, tree: { steps: [] }, tokens: {} });

describe('loading design previews', () => {
  it('loads every nearby design without exceeding the server batch limit', async () => {
    const fetchTrees = vi.fn(async (ids: readonly string[]) => ({ templates: ids.map(design) }));
    const { result } = renderHook(() => useTemplateTrees(fetchTrees));
    await act(async () => {
      for (let i = 0; i < 55; i++) result.current.want(`design-${i}`);
      result.current.want('design-0');
    });
    await waitFor(() => expect(result.current.trees.size).toBe(55));
    expect(fetchTrees.mock.calls.map(([ids]) => ids.length)).toEqual([24, 24, 7]);
    expect(result.current.failed.size).toBe(0);
    await act(async () => result.current.want('design-0'));
    expect(fetchTrees).toHaveBeenCalledTimes(3);
  });

  it('makes an omitted tree retryable without discarding the previews that arrived', async () => {
    const fetchTrees = vi.fn()
      .mockResolvedValueOnce({ templates: [design('first')] })
      .mockResolvedValueOnce({ templates: [design('second')] });
    const { result } = renderHook(() => useTemplateTrees(fetchTrees));
    await act(async () => { result.current.want('first'); result.current.want('second'); });
    await waitFor(() => expect(result.current.failed.has('second')).toBe(true));
    expect(result.current.trees.has('first')).toBe(true);
    await act(async () => result.current.retry('second'));
    await waitFor(() => expect(result.current.trees.has('second')).toBe(true));
    expect(result.current.trees.has('first')).toBe(true);
    expect(result.current.failed.size).toBe(0);
    expect(fetchTrees.mock.calls[1][0]).toEqual(['second']);
  });

  it('shows a failed request and retries only when explicitly requested', async () => {
    const fetchTrees = vi.fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce({ templates: [design('first')] });
    const { result } = renderHook(() => useTemplateTrees(fetchTrees));
    await act(async () => result.current.want('first'));
    await waitFor(() => expect(result.current.failed.has('first')).toBe(true));
    await act(async () => result.current.want('first'));
    expect(fetchTrees).toHaveBeenCalledOnce();
    await act(async () => result.current.retry('first'));
    await waitFor(() => expect(result.current.trees.has('first')).toBe(true));
    expect(result.current.failed.size).toBe(0);
  });
});
