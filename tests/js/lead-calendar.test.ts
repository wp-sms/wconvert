import { describe, expect, it } from 'vitest';
import { shiftDay, siteToday } from '../../resources/admin/src/leads/calendar';

describe('capture calendar labels', () => {
  it('uses the site day for fixed offsets and IANA zones across midnight', () => {
    const now = Date.parse('2026-09-14T22:30:00Z');
    expect(siteToday(now, '+04:00')).toBe('2026-09-15');
    expect(siteToday(now, 'Asia/Muscat')).toBe('2026-09-15');
    expect(siteToday(now, '-03:30')).toBe('2026-09-14');
    expect(siteToday(now, 'Invalid/Zone')).toBeNull();
    expect(siteToday(now, '+25:00')).toBeNull();
  });
  it('keeps calendar presets inclusive across year and DST boundaries', () => {
    expect(shiftDay('2026-01-03', -6)).toBe('2025-12-28');
    expect(shiftDay('2026-03-10', -6)).toBe('2026-03-04');
  });
});
