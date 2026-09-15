import { describe, expect, it } from 'vitest';
import { hasScheduleEnded, momentOf, readable } from '../../resources/admin/src/lib/wallTime';

/**
 * ============================================================================
 * A SCHEDULE BOUNDARY IS A WALL TIME, AND `new Date(string)` IS NOT ONE ANSWER.
 * ============================================================================
 * `starts_at` and `ends_at` are `Y-m-d H:i` with no offset on them, which is the
 * point of them (`src/Optin/Schedule.php`): the merchant types a local date and
 * the SITE's timezone resolves it, once, on the server.
 *
 * The trap is in the reading. `new Date('2026-11-27T09:00')` is local by spec;
 * `new Date('2026-11-27')` is **UTC**; and the stored shape, with a space, is
 * implementation-defined. Parsing the parts is what makes the round trip a
 * round trip on every engine — which is what these assert.
 */
describe('reading a stored wall time', () => {
  it('reads the parts as local components, not as a string a parser guesses at', () => {
    const moment = momentOf('2026-11-27 09:00');

    expect(moment?.getFullYear()).toBe(2026);
    expect(moment?.getMonth()).toBe(10);
    expect(moment?.getDate()).toBe(27);
    expect(moment?.getHours()).toBe(9);
    expect(moment?.getMinutes()).toBe(0);
  });

  /** A `datetime-local` input hands back the `T` form; storage uses the space. */
  it('takes either separator, because two controls write two shapes', () => {
    expect(momentOf('2026-11-27T09:00')?.getTime()).toBe(momentOf('2026-11-27 09:00')?.getTime());
  });

  /**
   * **A date with no time is the shape that would have shifted the hour.**
   * `new Date('2026-11-27')` is midnight UTC, so a merchant east of it reads
   * back a different day. It is refused rather than read.
   */
  it.each([['2026-11-27'], [''], ['tomorrow'], ['27/11/2026 09:00']])(
    'refuses %s rather than guessing at it',
    (value) => {
      expect(momentOf(value)).toBeNull();
    },
  );

  it('answers null for a boundary that was never set', () => {
    expect(momentOf(undefined)).toBeNull();
    expect(readable(undefined)).toBeNull();
  });

  /**
   * The spelling is `Intl`'s and the locale is the SITE's, so nothing here pins
   * a format — what is asserted is that the wall time survives the round trip.
   */
  it('spells the same wall time back, in the reader’s own format', () => {
    const spelled = readable('2026-11-27 09:00') ?? '';

    expect(spelled).toMatch(/2026/);
    expect(spelled).toMatch(/27/);
    expect(spelled).toMatch(/9|09/);
  });

  it.each([
    '2026-02-29 09:00', '2026-13-01 09:00', '2026-11-27 24:00',
    '2026-11-27 09:60', '2026-11-27 09:00 tomorrow',
  ])('does not turn invalid authored components into another date: %s', (value) => {
    expect(momentOf(value)).toBeNull();
    expect(readable(value)).toBeNull();
  });

  it('keeps valid seconds input at the stored minute precision', () => {
    expect(momentOf('2026-11-27T09:00:45')?.getTime()).toBe(momentOf('2026-11-27 09:00')?.getTime());
  });

  it('keeps a 02:30 label even when that hour does not exist on the admin’s clock', () => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = 'en-US';
    try {
      // Run this file with TZ=America/New_York as well: a local Date would
      // silently change this label to 03:30 before Intl formats it.
      expect(readable('2026-03-08 02:30')).toBe(new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
      }).format(Date.UTC(2026, 2, 8, 2, 30)));
    } finally {
      document.documentElement.lang = previous;
    }
  });
});

describe('schedule status on the site’s clock', () => {
  it.each([
    ['Asia/Muscat', '2026-09-10 09:00', '2026-09-10T05:00:00Z'],
    ['America/Los_Angeles', '2026-09-10 09:00', '2026-09-10T16:00:00Z'],
    ['Europe/London', '2026-03-01 09:00', '2026-03-01T09:00:00Z'],
    ['Europe/London', '2026-06-01 09:00', '2026-06-01T08:00:00Z'],
    ['Australia/Adelaide', '2026-07-01 09:00', '2026-06-30T23:30:00Z'],
    ['Australia/Adelaide', '2026-01-01 09:00', '2025-12-31T22:30:00Z'],
    ['+05:30', '2026-09-10 00:15', '2026-09-09T18:45:00Z'],
    ['-03:30', '2026-09-10 23:45', '2026-09-11T03:15:00Z'],
    ['+00:00', '2026-09-10 09:00', '2026-09-10T09:00:00Z'],
  ])('ends at the exclusive boundary in %s, independent of the admin zone', (zone, end, instant) => {
    const boundary = Date.parse(instant);
    expect(hasScheduleEnded(end, zone, boundary - 1)).toBe(false);
    expect(hasScheduleEnded(end, zone, boundary)).toBe(true);
  });

  it('does not claim a repeated European hour ended during its first occurrence', () => {
    expect(hasScheduleEnded('2026-10-25 02:30', 'Europe/Berlin', Date.parse('2026-10-25T00:45:00Z'))).toBe(false);
    expect(hasScheduleEnded('2026-10-25 02:30', 'Europe/Berlin', Date.parse('2026-10-25T01:29:59Z'))).toBe(false);
    expect(hasScheduleEnded('2026-10-25 02:30', 'Europe/Berlin', Date.parse('2026-10-25T01:30:00Z'))).toBe(true);
  });

  it('stays conservative through both readings of an American repeated hour', () => {
    expect(hasScheduleEnded('2026-11-01 01:30', 'America/New_York', Date.parse('2026-11-01T05:45:00Z'))).toBe(false);
    expect(hasScheduleEnded('2026-11-01 01:30', 'America/New_York', Date.parse('2026-11-01T06:30:00Z'))).toBe(true);
  });

  it.each([
    ['America/New_York', '2026-03-08 02:30', '2026-03-08T07:30:00Z'],
    ['Australia/Lord_Howe', '2026-10-04 02:15', '2026-10-03T15:45:00Z'],
  ])('waits for the normalized end when %s skips the authored hour', (zone, end, instant) => {
    const boundary = Date.parse(instant);
    expect(hasScheduleEnded(end, zone, boundary - 1)).toBe(false);
    expect(hasScheduleEnded(end, zone, boundary)).toBe(true);
  });

  it.each([undefined, '', 'Not/A_Zone', '+24:00', '-03:99'])('does not guess an ended status for zone %s', (zone) => {
    expect(hasScheduleEnded('2020-01-01 00:00', zone, Date.parse('2026-01-01T00:00:00Z'))).toBe(false);
  });

  it.each([undefined, '', 'yesterday', '2020-02-30 12:00'])('stays neutral for an absent or invalid end %s', (end) => {
    expect(hasScheduleEnded(end, 'UTC', Date.parse('2026-01-01T00:00:00Z'))).toBe(false);
  });

  it('stays neutral when the current clock cannot be read', () => {
    expect(hasScheduleEnded('2026-01-01 00:00', 'UTC', NaN)).toBe(false);
  });
});
