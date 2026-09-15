import { describe, expect, it } from 'vitest';
import { captureTime, shiftDay, siteToday } from '../../resources/admin/src/leads/calendar';

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
  it('labels relative dates without shifting captured wall-clock time', () => {
    expect(captureTime('2026-09-15 09:30:00', '2026-09-15')).toMatch(/^Today,/);
    expect(captureTime('2026-09-14 09:30:00', '2026-09-15')).toMatch(/^Yesterday,/);
    expect(captureTime('2026-09-13 09:30:00', '2026-09-15')).not.toMatch(/Today|Yesterday/);
    expect(captureTime('bad date', '2026-09-15')).toBe('bad date');
  });
});
