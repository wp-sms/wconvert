import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCHEDULE_FIELDS } from '../../resources/admin/src/builder/api';

/**
 * ============================================================================
 * ONE SCHEDULE, TWO REPRESENTATIONS, AND THE NAMES ARE DELIBERATELY THE SAME.
 * ============================================================================
 * `starts_at` and `ends_at` name one domain fact at two layers, and they hold
 * different things at each:
 *
 * - **In `config`, and in this admin, they are the LOCAL WALL TIME** the
 *   merchant authored — `2026-11-27 09:00`, with no zone on it, because a wall
 *   time is the only thing a merchant can reason about and because storing the
 *   instant would freeze it against whatever timezone the site was on the day
 *   they pressed Publish.
 * - **In the payload they are an absolute INSTANT in milliseconds**, resolved
 *   once by `PublishedProjection` against `wp_timezone()`, because the
 *   visitor's clock is not the site's clock.
 *
 * One converter sits between them (`src/Optin/Schedule.php`) and there is no
 * other. This file is what stops somebody "fixing" the asymmetry by making the
 * admin post an instant — which would delete the re-resolution — or by making
 * the loader parse a wall time, which would make one schedule mean a different
 * moment in every browser that read it.
 */
const ROOT = resolve(import.meta.dirname, '../..');

const source = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

describe('the schedule', () => {
  it('spells the same two keys in the engine, the value object and this bundle', () => {
    const loader = source('resources/loader/src/types.ts');
    const php = source('src/Optin/Schedule.php');

    for (const field of SCHEDULE_FIELDS) {
      expect(loader, field).toMatch(new RegExp(`readonly ${field}\\?: number;`));
      expect(php, field).toContain(`'${field}'`);
    }
  });

  /**
   * **The types differ under one name, and that is the decision.** A payload
   * key declared `string` would mean the browser was handed a wall time; a
   * config key holding a number would mean the instant was frozen at publish.
   * Both are pinned from the side that would have to change.
   */
  it('hands the browser a number and keeps the wall time in the admin', () => {
    const admin = source('resources/admin/src/builder/api.ts');

    for (const field of SCHEDULE_FIELDS) {
      expect(admin, field).toMatch(new RegExp(`${field}\\?: string;`));
    }
  });

  /**
   * ==========================================================================
   * THE LOADER NAMES NO TIMEZONE, AND THERE IS NOWHERE FOR ONE TO HIDE.
   * ==========================================================================
   * The whole feature turns on the instant being resolved once, on the server.
   * A `new Date(…)`, a `getTimezoneOffset()` or a parsed string anywhere on
   * this path would put the visitor's own offset back into the answer — which
   * is a schedule that means a different moment in every browser, and is the
   * failure a test asserting only `capped` would sail straight past.
   */
  it('does no timezone arithmetic anywhere on the path that reads it', () => {
    for (const path of ['resources/loader/src/schedule.ts', 'resources/loader/src/decide.ts']) {
      const text = source(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

      expect(text, path).not.toMatch(/new Date\(/);
      expect(text, path).not.toMatch(/getTimezoneOffset|toISOString|Date\.parse|Intl\./);
    }
  });

  /**
   * And the comparison is against the instant it was handed, never a fresh
   * reading: `decide` is pure, and a clock read inside it would make the same
   * inputs give two answers.
   */
  it('compares against the instant the shell read, not one of its own', () => {
    for (const path of ['resources/loader/src/schedule.ts', 'resources/loader/src/decide.ts']) {
      const text = source(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

      expect(text, path).not.toMatch(/Date\.now\(\)/);
    }
  });
});
