import { captureEndpoint } from '@loader/payload';
import type { PayloadEntry } from '@loader/types';

interface Record { active?: [string, string]; stopped: string[] | true }
export const familyOf = (entry: PayloadEntry): string =>
  (entry as PayloadEntry & { campaign?: string }).campaign ?? entry.id;

/** Tab-scoped choices, never identity, form values, or cached campaign content. */
export function recoveryStore() {
  const scope = new URL(captureEndpoint() ?? location.origin, location.href).href;
  const key = `wcv_teaser1:${scope}`;
  const id = (value: unknown): value is string => typeof value === 'string' && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
  let record: Record = { stopped: [] };
  let persistent = true;
  function refresh() {
    if (!persistent) return;
    try {
      const raw = sessionStorage.getItem(key);
      let next: Record = { stopped: [] };
      if (raw && raw.length <= 8192) {
        const value = JSON.parse(raw) as Record;
        if (value && (value.stopped === true || (Array.isArray(value.stopped) && value.stopped.length <= 64 && value.stopped.every(id))) &&
          (value.active === undefined || (Array.isArray(value.active) && value.active.length === 2 && value.active.every(id)))) next = value;
      }
      record = next;
    } catch { persistent = false; }
  }
  refresh();
  function write() {
    try { sessionStorage.setItem(key, JSON.stringify(record)); } catch { persistent = false; }
  }
  return {
    refresh,
    get persistent() { return persistent; },
    get active() { return record.active; },
    stopped: (entry: PayloadEntry) => record.stopped === true || record.stopped.includes(familyOf(entry)),
    remember(entry: PayloadEntry) { record.active = [entry.id, familyOf(entry)]; write(); },
    clear() { if (record.active) { delete record.active; write(); } },
    stop(entry: PayloadEntry) {
      const family = familyOf(entry);
      if (record.stopped !== true && !record.stopped.includes(family)) record.stopped.push(family);
      if (record.stopped !== true && record.stopped.length > 64) record.stopped = true;
      delete record.active; write();
    },
  };
}
