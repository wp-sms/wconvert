import { expect, it, vi } from 'vitest';
import { newAuthoringId } from '../../resources/admin/src/authoringId';
it('creates distinct authoring IDs on HTTP without randomUUID', () => {
  const getRandomValues = crypto.getRandomValues.bind(crypto);
  vi.stubGlobal('crypto', { getRandomValues });
  try {
    const ids = Array.from({ length: 20 }, newAuthoringId);
    expect(new Set(ids).size).toBe(20);
    expect(ids.every(id => /^[a-f0-9]{32}$/.test(id))).toBe(true);
  } finally { vi.unstubAllGlobals(); }
});
