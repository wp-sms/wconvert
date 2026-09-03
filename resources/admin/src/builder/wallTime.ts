/**
 * A stored schedule boundary, read and spelled — **once, for both screens that
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
 * So what this does is read the string back as the same wall time, and nothing
 * else. No zone is named and none is applied.
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
 * `new Date(y, m, d, h, min)` takes local components and has no string to
 * misread, so the round trip is a round trip on every engine.
 */
export function momentOf(wallTime: string | undefined): Date | null {
  if (wallTime === undefined || wallTime === '') {
    return null;
  }

  // Space or `T`, because the stored form uses one and a `datetime-local` input
  // hands back the other.
  const found = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(wallTime.trim());

  if (found === null) {
    return null;
  }

  const [, year, month, day, hour, minute] = found.map(Number);
  const moment = new Date(year, month - 1, day, hour, minute);

  return Number.isNaN(moment.getTime()) ? null : moment;
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
  const moment = momentOf(wallTime);

  return moment === null
    ? null
    : new Intl.DateTimeFormat(documentLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
        moment,
      );
}

/** What `<html lang>` says, or nothing — in which case `Intl` uses the browser's. */
function documentLocale(): string | undefined {
  const lang = typeof document === 'undefined' ? '' : document.documentElement.lang;

  return lang === '' ? undefined : lang;
}
