import type { PayloadEntry } from './types';

/**
 * Is this Optin inside the window the merchant scheduled?
 *
 * ============================================================================
 * THE INSTANT WAS RESOLVED ON THE SERVER. THIS DOES NO TIMEZONE ARITHMETIC.
 * ============================================================================
 * The merchant authors a local date and time, because that is the only thing
 * they can reason about; what reaches here is one absolute instant, already
 * resolved against the site's zone at publish time
 * ({@link ../../../src/Optin/Schedule.php}). The visitor's clock is not the
 * site's clock, so a comparison that read the browser's offset would mean
 * different things in different browsers — which is not a schedule.
 *
 * So this is two comparisons against `Date.now()` and nothing else. There is
 * no `Date` constructed, no parsing, and no zone named anywhere in the loader.
 *
 * **Half-open: `starts_at <= now < ends_at`.** A merchant authoring 09:00 to
 * 17:00 means live AT nine and over AT five, and an end that included its own
 * instant would leave two adjacent windows both live for a millisecond.
 *
 * Beside `frequency.ts` because it answers the same kind of question — may
 * this show AT ALL, before any rule is asked — and is checked in the same
 * place for the same reason.
 */
export const isWithinWindow = (entry: PayloadEntry, now: number): boolean =>
  (entry.starts_at === undefined || entry.starts_at <= now) &&
  (entry.ends_at === undefined || now < entry.ends_at);
