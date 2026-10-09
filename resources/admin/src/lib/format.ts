import { __ } from '@wordpress/i18n';
import { adminSettings } from '../settings';
import { wallKey, wallNow } from './wallTime';

/**
 * **One way to show each kind of data** (ADR 0131). Every date, count, rate,
 * amount and stored key on an admin screen goes through here, so no screen
 * prints a raw timestamp, a browser-locale number or a slug.
 *
 * - The SITE's locale (`<html lang>`, which WordPress writes) and the SITE's
 *   timezone, never the browser's: a merchant in Berlin reading a Tehran shop
 *   reads the shop's day.
 * - Stored datetimes are MySQL wall times already in the site's zone, so they
 *   are formatted as written, never shifted. An ISO instant (`…Z`, `…+02:00`)
 *   is converted into the site's zone first.
 */

/** The site's locale as WordPress wrote it on `<html lang>`, or the runtime default. */
export function siteLocale(): string | undefined {
  const lang = typeof document === 'undefined' ? '' : document.documentElement.lang;
  return lang === '' ? undefined : lang;
}

type Wall = { day: string; time: string | null };

/** Splits any stored date into the site's calendar day and wall clock. */
function wallOf(value: string, timezone: string | undefined): Wall | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { day: trimmed, time: null };
  if (/T.*(?:[zZ]|[+-]\d\d:?\d\d)$/.test(trimmed)) {
    const instant = Date.parse(trimmed);
    if (Number.isNaN(instant)) return null;
    const wall = wallNow(timezone, instant);
    return { day: wall.slice(0, 10), time: wall.slice(11) };
  }
  const key = wallKey(trimmed);
  return key === null ? null : { day: key.slice(0, 10), time: key.slice(11) };
}

/** A wall day and time as a UTC instant, so `timeZone: 'UTC'` prints it unshifted. */
const instantOf = ({ day, time }: Wall) => new Date(`${day}T${time ?? '12:00'}:00Z`);

function shiftDay(day: string, days: number): string {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Today in the site's zone, as `YYYY-MM-DD`. */
export function siteDay(now = Date.now(), timezone = adminSettings()?.timezone): string {
  return wallNow(timezone, now).slice(0, 10);
}

/**
 * A stored date for a person to read.
 *
 * - `list`: "Today, 2:22 PM", "Yesterday", "Oct 3" — and "Oct 3, 2025" once
 *   it is not this year. A row is scanned, not studied.
 * - `detail`: "Oct 9, 2026, 2:22 PM" — the whole fact, once.
 *
 * Something unreadable comes back as an em dash rather than as itself: a raw
 * string on screen is the bug this file exists to stop.
 */
export function formatWhen(
  value: string | null | undefined,
  style: 'list' | 'detail' = 'list',
  now = Date.now(),
  timezone = adminSettings()?.timezone,
): string {
  if (!value) return '—';
  const wall = wallOf(value, timezone);
  if (wall === null) return '—';

  const locale = siteLocale();
  const at = instantOf(wall);
  const time = wall.time === null ? null : new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: 'UTC' }).format(at);

  if (style === 'detail') {
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(at);
    return time === null ? date : `${date}, ${time}`;
  }

  const today = siteDay(now, timezone);
  if (wall.day === today) return time === null ? __('Today', 'wconvert') : `${__('Today', 'wconvert')}, ${time}`;
  if (wall.day === shiftDay(today, -1)) return __('Yesterday', 'wconvert');

  const sameYear = wall.day.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(at);
}

/** A calendar day from PHP, e.g. "Oct 3, 2026". Never shifted to the browser's zone. */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat(siteLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${day}T12:00:00Z`));
}

/** Two calendar days as one range, e.g. "Sep 9 – Oct 8, 2026". */
export function formatRange(from: string, to: string): string {
  return new Intl.DateTimeFormat(siteLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .formatRange(new Date(`${from}T12:00:00Z`), new Date(`${to}T12:00:00Z`));
}

/** A count in the site's digits and grouping. */
export const formatCount = (count: number) => new Intl.NumberFormat(siteLocale()).format(count);

/** A 0–1 rate as a percentage to one decimal, or an em dash where there is none. */
export const formatRate = (rate: number | null) =>
  rate === null ? '—' : `${new Intl.NumberFormat(siteLocale(), { maximumFractionDigits: 1 }).format(rate * 100)}%`;

/**
 * An amount in the store's currency, with its symbol — "$1,240.50", "€1.240,50".
 * The currency is the ISO code the server reported beside the amount; an
 * unknown code still prints the number rather than throwing.
 */
export function formatMoney(amount: number, currency: string, decimals?: number): string {
  try {
    return new Intl.NumberFormat(siteLocale(), {
      style: 'currency',
      currency,
      ...(decimals === undefined ? {} : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat(siteLocale()).format(amount)} ${currency}`;
  }
}

/**
 * A stored key as words — a field key, a Woo status slug, a source type.
 * `fallback` is what an unknown key reads as; it is never the key itself, so
 * no screen prints `wc-processing` or `utm_campaign` at a merchant.
 */
export function labelOf(key: string | null | undefined, map: Readonly<Record<string, string>>, fallback: string): string {
  return key !== null && key !== undefined && Object.hasOwn(map, key) ? map[key] : fallback;
}

/**
 * A key nobody mapped, made readable as a last resort: `utm_campaign` becomes
 * "Utm campaign". For custom fields the merchant named themselves, where no map
 * can exist.
 */
export function humanize(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return words === '' ? key : words.charAt(0).toUpperCase() + words.slice(1);
}
