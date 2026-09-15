/**
 * A stored wall-clock value, read and spelled — **once, for all screens that
 * show one.**
 *
 * ============================================================================
 * IT IS A WALL TIME WITH NO ZONE ON IT, AND THAT IS THE WHOLE TRAP.
 * ============================================================================
 * `starts_at` and `ends_at` are `Y-m-d H:i` and carry no offset, which is the
 * point of them (`src/Optin/Schedule.php`): the merchant types a local date and
 * time, and resolving it against the SITE's timezone happens once, on the
 * server. A browser that resolved it would resolve it against the admin's zone,
 * which is not the site's.
 *
 * Labels preserve those components. Schedule status separately compares them
 * through the site's explicit zone; it never defaults to the admin's zone.
 *
 * ============================================================================
 * THE PARTS ARE PARSED, BECAUSE `new Date(string)` IS NOT ONE ANSWER.
 * ============================================================================
 * `new Date('2026-11-27T09:00')` is local time by spec; `new Date('2026-11-27')`
 * is **UTC**; and `new Date('2026-11-27 09:00')` — the shape actually stored —
 * is neither, it is implementation-defined, and the engines only happen to
 * agree. A stored value one character short of the expected shape therefore
 * shifts the hour, silently, on somebody else's browser.
 *
 * `momentOf` retains local Date compatibility for controls that need one.
 * Labels use a UTC container instead, so even an admin's missing DST hour
 * cannot alter the components a merchant authored for another timezone.
 */
export function momentOf(wallTime: string | undefined): Date | null {
  const parts = wallParts(wallTime);

  if (parts === null) {
    return null;
  }

  const [year, month, day, hour, minute] = parts;
  const moment = new Date(0);
  moment.setFullYear(year, month - 1, day);
  moment.setHours(hour, minute, 0, 0);

  return moment;
}

type WallParts = readonly [year: number, month: number, day: number, hour: number, minute: number];

/** Validate components without letting a browser timezone normalize a DST gap. */
function wallParts(wallTime: string | undefined): WallParts | null {
  const found = wallTime === undefined
    ? null
    : /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::[0-5]\d(?:\.\d+)?)?$/.exec(wallTime.trim());

  if (found === null) return null;

  const [, year, month, day, hour, minute] = found.map(Number);
  const parts: WallParts = [year, month, day, hour, minute];
  const checked = new Date(asUtc(parts));

  return checked.getUTCFullYear() === year && checked.getUTCMonth() + 1 === month &&
    checked.getUTCDate() === day && checked.getUTCHours() === hour && checked.getUTCMinutes() === minute
    ? parts
    : null;
}

/** A numeric container for wall components, not their actual scheduled instant. */
function asUtc([year, month, day, hour, minute]: WallParts): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, 0, 0);
  return date.getTime();
}

/**
 * Is the end definitely past on the site's clock?
 *
 * PHP resolves the actual published boundary. At a repeated or skipped local
 * hour its choice is not portable to Intl, so this advisory waits for the
 * latest plausible instant. It can remain neutral briefly, but cannot label a
 * still-running schedule finished. Missing or unreadable zones stay neutral too.
 */
export function hasScheduleEnded(
  ends: string | undefined,
  timezone: string | undefined,
  now = Date.now(),
): boolean {
  const parts = wallParts(ends);
  if (parts === null || !timezone || !Number.isFinite(now)) return false;

  const wall = asUtc(parts);
  const fixed = /^([+-])(\d\d):(\d\d)$/.exec(timezone);

  if (fixed !== null) {
    const hours = Number(fixed[2]);
    const minutes = Number(fixed[3]);
    if (hours > 23 || minutes > 59) return false;
    const offset = (hours * 60 + minutes) * 60_000 * (fixed[1] === '-' ? -1 : 1);
    return now >= wall - offset;
  }

  try {
    const clock = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const wallAt = (instant: number): number => {
      const fields = Object.fromEntries(clock.formatToParts(instant).map(({ type, value }) => [type, value]));
      return asUtc([
        Number(fields.year), Number(fields.month), Number(fields.day),
        Number(fields.hour), Number(fields.minute),
      ]);
    };

    // Sampling either side includes both offsets when a transition skips or
    // repeats the requested hour, including zones with half-hour DST changes.
    const span = 36 * 60 * 60_000;
    const offsets = new Set([-span, 0, span].map((delta) => wallAt(wall + delta) - wall - delta));
    const candidates = [...offsets].map((offset) => wall - offset);
    const exact = candidates.filter((instant) => wallAt(instant) === wall);
    const latest = Math.max(...(exact.length > 0 ? exact : candidates));

    return now >= latest;
  } catch {
    return false;
  }
}

/**
 * The same wall time, spelled the way this SITE spells dates.
 *
 * ============================================================================
 * THE SITE'S LOCALE, NOT THE BROWSER'S.
 * ============================================================================
 * WordPress prints its own locale on `<html lang>`, and that is the language
 * the rest of this screen is already in — a merchant running a German site from
 * an English laptop reads every other word in German and would read this one
 * date in English. `undefined` is the fallback, which is the browser's, and it
 * is what a page with no `lang` gets.
 *
 * A format is never spelled out: `dateStyle` and `timeStyle` are what let the
 * same call print *27 Nov 2026, 09:00* and *2026年11月27日 9:00* without this
 * file knowing either.
 */
export function readable(wallTime: string | undefined): string | null {
  const parts = wallParts(wallTime);

  return parts === null
    ? null
    : new Intl.DateTimeFormat(documentLocale(), {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
      }).format(asUtc(parts));
}

/**
 * A stored daily window — `HH:MM-HH:MM` — spelled the way this SITE spells
 * times.
 *
 * ============================================================================
 * IT IS HERE BECAUSE THE CONTROL IS ALREADY DOING IT.
 * ============================================================================
 * An `<input type="time">` renders in the reader's own locale, so a merchant
 * on a 12-hour clock types into a box that says *10:00 PM* — and would then
 * read *22:00-02:00* in the sentence directly above it. Two spellings of one
 * value on one screen is what {@see readable} exists to prevent for the
 * schedule beside it, and this is the same job for the same reason.
 *
 * **The stored value is unchanged and stays 24-hour.** This is presentation
 * only: `time_of_day`'s `between` is one canonical spelling, because the
 * loader re-parses it on every evaluation and two spellings would be two
 * parses of one fact.
 *
 * Null where the window is not a whole one, which is what a half-filled
 * control writes — the summary says the rule needs its hours rather than
 * printing half of one.
 */
export function readableHours(window: unknown): string | null {
  const found = typeof window === 'string' ? /^(\d\d):(\d\d)-(\d\d):(\d\d)$/.exec(window) : null;

  if (found === null) {
    return null;
  }

  const [, fromHour, fromMinute, toHour, toMinute] = found.map(Number);
  const clock = new Intl.DateTimeFormat(documentLocale(), { timeStyle: 'short' });

  // An arbitrary date, because only the time is read off it. The components
  // are passed separately for {@see momentOf}'s reason: a string would be
  // parsed differently on different engines.
  const at = (hour: number, minute: number) => clock.format(new Date(2026, 0, 1, hour, minute));

  return `${at(fromHour, fromMinute)}\u2009\u2013\u2009${at(toHour, toMinute)}`;
}

/** What `<html lang>` says, or nothing — in which case `Intl` uses the browser's. */
function documentLocale(): string | undefined {
  const lang = typeof document === 'undefined' ? '' : document.documentElement.lang;

  return lang === '' ? undefined : lang;
}
