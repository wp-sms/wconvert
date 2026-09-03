import { describe, expect, it } from 'vitest';
import { momentOf, readable } from '../../resources/admin/src/builder/wallTime';

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
});
