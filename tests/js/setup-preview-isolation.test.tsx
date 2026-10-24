import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { PlaybookEntry } from '../../resources/admin/src/goals/api';

const previewPlaybooks = vi.hoisted(() => vi.fn());
vi.mock('../../resources/admin/src/goals/api', () => ({ previewPlaybooks }));
import { useSetupPreviews } from '../../resources/admin/src/discovery/useSetupPreviews';

it('keeps a late Closing time preview out of the subsequently selected coupon', async () => {
  const entries = [
    { id: 'bf-closing-time', revision: 'closing-r', template_id: 'bf-closing-time' },
    { id: 'campaign-extra-ten-coupon', revision: 'coupon-r', template_id: 'campaign-extra-ten-coupon' },
  ] as PlaybookEntry[];
  const waiting = new Map<string, (value: { entries: PlaybookEntry[] }) => void>();
  previewPlaybooks.mockImplementation((_goal: string, ids: string[]) => new Promise(resolve => waiting.set(ids[0], resolve)));
  const { result } = renderHook(() => useSetupPreviews('promote_offer', entries));
  act(() => result.current.onNear(entries[0].id));
  await waitFor(() => expect(waiting.has(entries[0].id)).toBe(true));
  act(() => result.current.onNear(entries[1].id));
  await waitFor(() => expect(waiting.has(entries[1].id)).toBe(true));
  const coupon = { ...entries[1], prepared_revision: 'coupon-prepared', template: { tokens: {}, tree: { v: 2, submissions: [], steps: [] } } } as PlaybookEntry;
  await act(async () => waiting.get(entries[1].id)!({ entries: [coupon] }));
  expect(result.current.previews.get(entries[1].id)).toBe(coupon);
  const closing = { ...entries[0], prepared_revision: 'closing-prepared' } as PlaybookEntry;
  await act(async () => waiting.get(entries[0].id)!({ entries: [closing] }));
  expect(result.current.previews.get(entries[1].id)).toBe(coupon);
  expect(result.current.previews.get(entries[0].id)).toBe(closing);
});
