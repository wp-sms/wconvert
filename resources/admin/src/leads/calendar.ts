import { __ } from '@wordpress/i18n';
import { adminSettings } from '../settings';
import { readable } from '../lib/wallTime';

/** Calendar arithmetic uses the site's day, never the administrator's timezone. */
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

export function captureTime(value: string, today = siteToday()): string {
  const full = readable(value);
  if (!full) return value;
  const day = value.slice(0, 10);
  const relative = today && (day === today ? __('Today', 'wconvert') : day === shiftDay(today, -1) ? __('Yesterday', 'wconvert') : null);
  if (!relative) return full;
  const time = new Intl.DateTimeFormat(document.documentElement.lang || undefined, { timeZone: 'UTC', timeStyle: 'short' }).format(new Date(value.replace(' ', 'T') + 'Z'));
  return `${relative}, ${time}`;
}
