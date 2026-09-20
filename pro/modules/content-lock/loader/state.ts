import { captureEndpoint } from '@loader/payload';

const day = () => Math.floor(Date.now() / 86400000);
export function unlockStore() {
  const key = `wcv_unlock1:${new URL(captureEndpoint() ?? location.origin, location.href).href}`;
  let memory: Record<string, number> = {};
  const read = () => {
    let saved: Record<string, number> = {};
    try {
      const raw = localStorage.getItem(key);
      const value: unknown = raw && raw.length <= 8192 ? JSON.parse(raw) : null;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        saved = Object.fromEntries(Object.entries(value).filter(([id, expiry]) =>
          /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id) && Number.isInteger(expiry) && expiry > day() && expiry <= day() + 30,
        ).slice(0, 64));
      }
    } catch { /* Remembering is optional; capture and reveal are not. */ }
    return { ...saved, ...memory };
  };
  return {
    key,
    has: (id: string) => (read()[id] ?? 0) > day(),
    remember(id: string) {
      memory = { ...read(), [id]: day() + 30 };
      memory = Object.fromEntries(Object.entries(memory).filter(([, expiry]) => expiry > day())
        .sort((a, b) => b[1] - a[1]).slice(0, 64));
      try { localStorage.setItem(key, JSON.stringify(memory)); } catch { /* Memory holds this document. */ }
    },
  };
}
