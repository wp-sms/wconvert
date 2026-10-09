import { describe, expect, it } from 'vitest';
import { presetWindow, rangeOf, shiftDay, siteToday } from '../../resources/admin/src/leads/calendar';

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
  it('resolves the log\'s presets with today included', () => {
    expect(presetWindow('today', '2026-10-09')).toEqual({ from: '2026-10-09', to: '2026-10-09' });
    expect(presetWindow('yesterday', '2026-10-01')).toEqual({ from: '2026-09-30', to: '2026-09-30' });
    expect(presetWindow('7', '2026-10-09')).toEqual({ from: '2026-10-03', to: '2026-10-09' });
    expect(presetWindow('90', '2026-10-09')).toEqual({ from: '2026-07-12', to: '2026-10-09' });
    expect(presetWindow('this_month', '2026-10-09')).toEqual({ from: '2026-10-01', to: '2026-10-09' });
    expect(presetWindow('last_month', '2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(presetWindow('last_month', '2026-01-02')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });
  it('reads a bookmarked pair back as the preset it spells today, else as custom dates', () => {
    expect(rangeOf({}, '2026-10-09')).toEqual({ preset: 'all' });
    expect(rangeOf({ from: '2026-10-03', to: '2026-10-09' }, '2026-10-09')).toEqual({ preset: '7' });
    expect(rangeOf({ from: '2026-10-09', to: '2026-10-09' }, '2026-10-09')).toEqual({ preset: 'today' });
    expect(rangeOf({ from: '2026-10-03', to: '2026-10-09' }, '2026-10-10')).toEqual({ preset: 'custom', from: '2026-10-03', to: '2026-10-09' });
    expect(rangeOf({ from: '2026-09-01' }, '2026-10-09')).toEqual({ preset: 'custom', from: '2026-09-01', to: '' });
    expect(rangeOf({ from: '2026-10-03', to: '2026-10-09' }, null)).toEqual({ preset: 'custom', from: '2026-10-03', to: '2026-10-09' });
  });
});
