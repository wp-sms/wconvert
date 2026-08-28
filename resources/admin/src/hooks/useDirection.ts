import { useEffect, useState } from 'react';

/**
 * Which way this page reads, as the vendored Radix wrappers have to be told.
 *
 * ============================================================================
 * RADIX STAMPS `dir="ltr"` ON EVERYTHING, AND IT PINS WHAT IS INSIDE IT.
 * ============================================================================
 * Every Radix primitive resolves its direction through `useDirection()`, which
 * reads a `DirectionProvider` from context and **falls back to `ltr`** when
 * there is none — then writes that answer onto the DOM as a real `dir`
 * attribute. A `dir` attribute beats inheritance, so `Tabs.Root` saying `ltr`
 * turns the whole builder left-to-right inside an admin the browser had
 * correctly laid out right-to-left.
 *
 * Found under `fa_IR`: the tab strip and everything under it read LTR while the
 * page around them read RTL. It cost the block tree both halves of its RTL
 * story at once — the indentation stopped inverting, and the ← → keys stopped
 * being mirrored, because `BlockTree` reads the direction off the rendered
 * element and the rendered element had been told the wrong thing.
 *
 * ============================================================================
 * READ, NOT ASSUMED, AND NOT `DirectionProvider`.
 * ============================================================================
 * Radix ships `DirectionProvider` for exactly this, and it is the wrong tool
 * here for a reason that is about this repo rather than about Radix: it would
 * put a `radix-ui` import at the admin's root, and
 * `tests/js/admin-split.test.ts` exists to keep that package off the four
 * reading screens. A four-line hook costs nothing and keeps the boundary where
 * ADR 0038 put it.
 *
 * WordPress puts the answer on `<html dir>` and it never changes mid-session in
 * practice — but a listener is cheaper than being wrong, and RTL is exactly the
 * case nobody re-tests. It answers `ltr` where it cannot ask, which is the same
 * direction the browser would have assumed.
 */
export function useDirection(): 'ltr' | 'rtl' {
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(() => read());

  useEffect(() => {
    const follow = () => setDirection(read());

    follow();

    const watching = new MutationObserver(follow);

    watching.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });

    return () => watching.disconnect();
  }, []);

  return direction;
}

function read(): 'ltr' | 'rtl' {
  if (typeof document === 'undefined') {
    return 'ltr';
  }

  // The computed direction rather than the attribute, so a stylesheet setting
  // `direction` — which is what a right-to-left WordPress locale actually does
  // to `body` — is read as well as the attribute WordPress also writes.
  return getComputedStyle(document.documentElement).direction === 'rtl' ? 'rtl' : 'ltr';
}
