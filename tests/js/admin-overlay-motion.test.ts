import { readFileSync } from 'node:fs';
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
 */

const UI = resolve(import.meta.dirname, '../../resources/admin/src/components/ui');

const layers = [
  'alert-dialog.tsx',
  'dialog.tsx',
  'dropdown-menu.tsx',
  'popover.tsx',
  'select.tsx',
] as const;

describe('admin overlay motion', () => {
  it.each(layers)('%s animates its arrival, never its dismissal', (component) => {
    const source = readFileSync(resolve(UI, component), 'utf8');

    expect(source).toContain('data-[state=open]:animate-in');
    expect(source).not.toMatch(
      /data-\[state=closed\]:(?:animate-out|fade-out-0|zoom-out-95)/,
    );
  });
});
