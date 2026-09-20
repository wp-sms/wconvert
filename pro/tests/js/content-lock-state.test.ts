import { afterEach, expect, it, vi } from 'vitest';
import { unlockStore } from '../../modules/content-lock/loader/state';
const id = '01JQ0000000000000000000001';
afterEach(() => { localStorage.clear(); document.body.innerHTML = ''; vi.useRealTimers(); });
it('expires after 30 whole days and does not extend on a read', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));
  const store = unlockStore(); store.remember(id); const saved = localStorage.getItem(store.key);
  vi.setSystemTime(new Date('2026-10-19T12:00:00Z')); expect(unlockStore().has(id)).toBe(true);
  expect(localStorage.getItem(store.key)).toBe(saved);
  vi.setSystemTime(new Date('2026-10-20T00:00:00Z')); expect(store.has(id)).toBe(false);
});
it('bounds storage and isolates sites by the capture endpoint', () => {
  const store = unlockStore();
  for (let n = 0; n < 70; n++) store.remember(String(n).padStart(26, '0'));
  const saved = localStorage.getItem(store.key)!;
  expect(Object.keys(JSON.parse(saved))).toHaveLength(64); expect(saved.length).toBeLessThan(8192);
  store.remember(id);
  document.body.innerHTML = '<script id="wconvert-payload" data-capture="/other-site/wp-json/wconvert/v1/capture"></script>';
  expect(unlockStore().has(id)).toBe(false);
});
it.each(['broken', '[]', '{"email":"reader@example.com"}', 'x'.repeat(8193)])('ignores malformed or oversized receipts', raw => {
  const store = unlockStore(); localStorage.setItem(store.key, raw); expect(store.has(id)).toBe(false);
});
it('observes valid cross-tab receipts without trusting frequency conversion state', () => {
  localStorage.setItem('wcv1', JSON.stringify({ [id]: { c: true } }));
  const otherTab = unlockStore(); expect(otherTab.has(id)).toBe(false);
  unlockStore().remember(id); expect(otherTab.has(id)).toBe(true);
});
