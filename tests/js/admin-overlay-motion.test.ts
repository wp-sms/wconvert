import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ============================================================================
 * ADMIN LAYERS ANIMATE IN AND DISMISS IMMEDIATELY.
 * ============================================================================
 *
 * Radix keeps a layer mounted while its CSS exit animation runs. By the time a
 * merchant dismisses one, focus and the underlying screen have already moved,
 * so those 150–200ms paint a shrinking, translucent copy of stale UI over the
 * control they just reached. Modal layers also hold their body scroll lock for
 * that stale frame.
 *
 * This is a shared primitive rule rather than a call-site convention. The
 * dropdown, Browse designs dialog, confirms, colour picker, verdict popover and
 * lead filter all inherit it here; a future vendored layer has to make the same
 * decision explicitly instead of rediscovering the ghost one screen at a time.
 *
 * ============================================================================
 * THE NO-EXIT RULE READS THE DIRECTORY; ONLY THE ARRIVALS ARE NAMED.
 * ============================================================================
 * A hand-written list of layers is a list of the layers that HAD the ghost when
 * someone last looked. Vendor a sheet, a drawer or a tooltip tomorrow and it
 * ships an exit animation past a green suite, because the guard never opens a
 * file whose name nobody added. That is the hole the lazy-boundary scanner
 * already had — its regex took single quotes while every vendored file wrote
 * double, so it passed on a graph it could not see into.
 *
 * So the prohibition is universal and derives its own scope: no file in `ui/`
 * animates a dismissal, and a new one is covered the moment it lands. Only the
 * positive claim is named, because "these five animate their arrival" is a
 * statement about five specific components, and a missing entry there costs a
 * check nobody was owed rather than one they were.
 */

// ADR 0097 disables runtime motion, including these retained vendored classes.
// These source checks do not assert the computed animation behavior.
const UI = resolve(import.meta.dirname, '../../resources/admin/src/components/ui');

/** tailwindcss-animate's four exit families, each with any suffix. */
const EXIT_ANIMATION = /data-\[state=closed\]:(?:animate-out|fade-out|zoom-out|slide-out)/;

const vendored = readdirSync(UI).filter((file) => file.endsWith('.tsx'));

const arrivals = [
  'alert-dialog.tsx',
  'dialog.tsx',
  'dropdown-menu.tsx',
  'popover.tsx',
] as const;

describe('admin overlay motion', () => {
  it('has vendored components to check', () => {
    expect(vendored).toEqual(expect.arrayContaining([...arrivals]));
  });

  it.each(vendored)('%s never animates its dismissal', (component) => {
    expect(readFileSync(resolve(UI, component), 'utf8')).not.toMatch(EXIT_ANIMATION);
  });

  it.each(arrivals)('%s retains vendored arrival classes (the admin stylesheet disables motion)', (component) => {
    expect(readFileSync(resolve(UI, component), 'utf8')).toContain(
      'data-[state=open]:animate-in',
    );
  });
});
