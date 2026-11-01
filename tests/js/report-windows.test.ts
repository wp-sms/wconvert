import { describe, expect, it } from 'vitest';
import { periodOf, periodParams, type ReportPeriod } from '../../resources/admin/src/stats/api';

/** What each window asks the server for (ADR 0177): every one runs through today but Yesterday. */
describe('report windows', () => {
  const params = (query: Parameters<typeof periodParams>[0]) => periodParams(query).toString();

  it('asks for today included on Today, the day counts and This month', () => {
    expect(params({ today: true })).toBe('days=1&complete=0');
    expect(params({ days: 7 })).toBe('days=7&complete=0');
    expect(params({ days: 30 })).toBe('days=30&complete=0');
    expect(params({ month: '2026-11' })).toBe('month=2026-11&complete=0');
  });

  it('keeps Yesterday one complete day, and custom dates as typed', () => {
    expect(params({ days: 1 })).toBe('days=1&complete=1');
    expect(params({ from: '2026-10-01', to: '2026-10-07' })).toBe('from=2026-10-01&to=2026-10-07');
  });

  it('reads an accepted window back as the link that asked for it', () => {
    const period = (over: Partial<ReportPeriod>): ReportPeriod => ({ from: '2026-10-26', to: '2026-11-01', days: 7, ...over });
    expect(periodOf(period({ complete_days: false }))).toEqual({ days: 7 });
    expect(periodOf(period({ days: 1, from: '2026-11-01', complete_days: false }))).toEqual({ today: true });
    expect(periodOf(period({ days: 1, from: '2026-10-31', to: '2026-10-31', complete_days: true }))).toEqual({ days: 1 });
    expect(periodOf(period({ month: '2026-11', days: 1, from: '2026-11-01', complete_days: false }))).toEqual({ month: '2026-11' });
  });
});
