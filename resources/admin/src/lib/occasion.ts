import type { Occasion } from '../discovery/api';
import type { DashboardPayload } from '../stats/api';
import { addNumbers } from '../stats/reporting';

/**
 * What an [[Occasion]]'s screens compute from its dates, kept pure so each
 * answer is tested once (ADR 0149).
 *
 * An occasion's days are inclusive `Y-m-d`. A campaign's `starts_at` and
 * `ends_at` are wall times in the site's timezone, and the end is exclusive
 * (ADR 0050). Everything here compares those strings as wall clocks read in
 * UTC, so no browser timezone ever moves a day.
 */

const DAY = 86_400_000;
const wall = (value: string): number => Date.parse(`${value.replace(' ', 'T').slice(0, 16)}:00Z`);
const dayAfter = (day: string): string => new Date(Date.parse(`${day}T00:00:00Z`) + DAY).toISOString().slice(0, 10);

/**
 * A new campaign inside an occasion starts with its dates (ADR 0149 §3): the
 * first day at 00:00 to the day after the last at 00:00, so the campaign shows
 * all of the last day.
 */
export function occasionSchedule(start: string, end: string): { starts_at: string; ends_at: string } {
  return { starts_at: `${start} 00:00`, ends_at: `${dayAfter(end)} 00:00` };
}

/** Where a campaign sits on its occasion's date line, as percentages of the occasion. */
export interface Bar {
  /** Start of the visible part, 0–100. */
  left: number;
  /** Width of the visible part, 0–100; 0 when it shows only outside. */
  width: number;
  /** Shows before the occasion's first day. */
  before: boolean;
  /** Still shows after the occasion's last day. */
  after: boolean;
}

/**
 * One campaign's bar. A missing start or end runs without limit that way, so
 * a campaign with no dates shows before and after the occasion, and the line
 * says so rather than drawing it as if it fitted.
 */
export function placeBar(occasion: Pick<Occasion, 'start' | 'end'>, startsAt: string | null, endsAt: string | null): Bar {
  const from = wall(`${occasion.start} 00:00`), to = wall(`${dayAfter(occasion.end)} 00:00`);
  const start = startsAt ? wall(startsAt) : -Infinity, end = endsAt ? wall(endsAt) : Infinity;
  const clamp = (at: number) => Math.min(100, Math.max(0, ((at - from) / (to - from)) * 100));
  const left = clamp(start), right = clamp(end);
  return { left, width: end > from && start < to ? right - left : 0, before: start < from, after: end > to };
}

/** Where today falls in an occasion. */
export type Phase = { kind: 'before'; days: number } | { kind: 'during'; day: number; of: number } | { kind: 'after' };

export function occasionPhase(occasion: Pick<Occasion, 'start' | 'end'>, today: string): Phase {
  const at = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY;
  const of = at(occasion.end) - at(occasion.start) + 1, day = at(today) - at(occasion.start) + 1;
  if (day < 1) return { kind: 'before', days: 1 - day };
  return day > of ? { kind: 'after' } : { kind: 'during', day, of };
}

/** The occasion's days that have happened, or null before it starts. */
export function occasionWindow(occasion: Pick<Occasion, 'start' | 'end'>, today: string): { from: string; to: string } | null {
  if (today < occasion.start) return null;
  return { from: occasion.start, to: occasion.end < today ? occasion.end : today };
}

export interface OccasionTotals {
  views: number;
  /** Conversions of the campaigns that convert on a click. */
  clicks: number;
  /** Clicks out of the views of those same campaigns, or null where none was shown. */
  clickRate: number | null;
  closes: number;
  /** Whether any campaign here converts on a click, so Clicks means something. */
  counted: boolean;
}

/**
 * One occasion's numbers, added from its campaigns' rows in a report.
 *
 * **Clicks counts click goals only.** A signup and a click are different acts
 * (ADR 0020), so adding them would be a number nobody can read; a teaser's
 * signups stay in its own row. Arms count toward their campaign.
 */
export function occasionTotals(report: Pick<DashboardPayload, 'goals'>, ids: ReadonlySet<string>): OccasionTotals {
  const rows = report.goals.flatMap((goal) => goal.optins
    .filter((row) => ids.has(row.id) || (row.parent_id !== null && ids.has(row.parent_id)))
    .map((row) => ({ goal, row })));
  const all = addNumbers(rows.map(({ row }) => row));
  const clicking = rows.filter(({ goal }) => goal.action === 'click');
  const clicks = addNumbers(clicking.map(({ row }) => row));
  return { views: all.impressions, closes: all.dismissals, clicks: clicks.conversions, clickRate: clicks.conversion_rate, counted: clicking.length > 0 };
}

const yearLater = (day: string): string => {
  const next = `${Number(day.slice(0, 4)) + 1}${day.slice(4)}`;
  return next.endsWith('-02-29') ? next.replace(/-29$/, '-28') : next;
};

/**
 * What Copy to next year will make, for the question before it (ADR 0153 §3).
 * `NextYear` on the server is what makes it; this only names it.
 */
export function nextYearOf(occasion: Pick<Occasion, 'name' | 'start' | 'end'>): Pick<Occasion, 'name' | 'start' | 'end'> {
  const year = occasion.start.slice(0, 4), next = String(Number(year) + 1);
  const pattern = new RegExp(`(?<!\\d)${year}(?!\\d)`, 'g');
  return {
    name: pattern.test(occasion.name) ? occasion.name.replace(pattern, next) : `${occasion.name.trimEnd()} ${next}`,
    start: yearLater(occasion.start),
    end: yearLater(occasion.end),
  };
}

/**
 * The days a campaign shows, as a merchant reads them: an end at midnight is
 * exclusive (ADR 0050), so `ends_at` 2 Dec 00:00 shows through 1 Dec. Null
 * where either end is open or a time other than midnight is involved, which
 * the caller spells with its times instead.
 */
export function shownDays(startsAt: string | null, endsAt: string | null): { from: string; to: string } | null {
  if (!startsAt || !endsAt || !startsAt.endsWith(' 00:00') || !endsAt.endsWith(' 00:00')) return null;
  const to = new Date(Date.parse(`${endsAt.slice(0, 10)}T00:00:00Z`) - DAY).toISOString().slice(0, 10);
  return to < startsAt.slice(0, 10) ? null : { from: startsAt.slice(0, 10), to };
}
