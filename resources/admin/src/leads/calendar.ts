import { adminSettings } from '../settings';
import type { DatePreset, DateRange } from '../shell/DateRangePicker';

/**
 * Calendar arithmetic for the log's date presets, on the site's day, never the
 * administrator's timezone. Showing a date is `lib/format`'s job.
 */
export function siteToday(now = Date.now(), timezone = adminSettings()?.timezone): string | null {
  if (!timezone) return null;
  const fixed = /^([+-])(\d{2}):(\d{2})$/.exec(timezone);
  if (fixed) {
    if (Number(fixed[2]) > 23 || Number(fixed[3]) > 59) return null;
    const offset = (Number(fixed[2]) * 60 + Number(fixed[3])) * (fixed[1] === '-' ? -1 : 1);
    return new Date(now + offset * 60_000).toISOString().slice(0, 10);
  }
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch { return null; }
}

export function shiftDay(day: string, days: number): string {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** A day window the log can read: both days included, either end open. */
export interface DayWindow { from?: string; to?: string }

type WindowPreset = Exclude<DatePreset, 'all'>;

/**
 * What a preset covers on the log, **today included**: "Last 7 days" is today
 * and the six days before it, because a submission log is read for what just
 * arrived. Analytics reads complete days and resolves the same names its own
 * way (ADR 0089); the presets are shared, their arithmetic is not.
 */
export function presetWindow(preset: WindowPreset, today: string): Required<DayWindow> {
  const month = `${today.slice(0, 7)}-01`;
  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'yesterday': return { from: shiftDay(today, -1), to: shiftDay(today, -1) };
    case '7': case '30': case '90': return { from: shiftDay(today, 1 - Number(preset)), to: today };
    case 'this_month': return { from: month, to: today };
    case 'last_month': {
      const end = shiftDay(month, -1);
      return { from: `${end.slice(0, 7)}-01`, to: end };
    }
  }
}

export const LEAD_PRESETS: readonly WindowPreset[] = ['today', 'yesterday', '7', '30', '90', 'this_month', 'last_month'];

/**
 * The preset a bookmarked `from`/`to` pair spells, decided on the site's day —
 * so a link saved last week reads as the dates it holds, not as "Last 7 days".
 * Anything else is custom dates, including a window open at one end.
 */
export function rangeOf({ from, to }: DayWindow, today: string | null): DateRange {
  if (!from && !to) return { preset: 'all' };
  if (today !== null && from && to) {
    const preset = LEAD_PRESETS.find((candidate) => {
      const window = presetWindow(candidate, today);
      return window.from === from && window.to === to;
    });
    if (preset) return { preset };
  }
  return { preset: 'custom', from: from ?? '', to: to ?? '' };
}
