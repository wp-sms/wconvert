import { captureEndpoint } from './payload';
/** Tab-local functional pacing, with document-memory fallback when storage is denied. */
export const SESSION_KEY = 'wcv_display_session_v1';
export function sessionCounts() {
  const endpoint = captureEndpoint();
  const key = endpoint ? `${SESSION_KEY}:${new URL(endpoint, location.href).pathname}` : SESSION_KEY;
  let counts: Record<string, number> = {};
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key) ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      counts = Object.fromEntries(Object.entries(parsed).filter(([id, n]) => id.length <= 64 && Number.isSafeInteger(n) && Number(n) > 0).slice(-128));
    }
  } catch { /* No cookie or persistent fallback. */ }
  return {
    read: () => counts,
    increment(id: string) {
      const next = (counts[id] ?? 0) + 1;
      delete counts[id];
      counts[id] = next;
      counts = Object.fromEntries(Object.entries(counts).slice(-128));
      try { sessionStorage.setItem(key, JSON.stringify(counts)); } catch { /* This document only. */ }
    },
  };
}
