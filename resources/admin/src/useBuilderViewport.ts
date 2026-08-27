import { useEffect, useState } from 'react';
import { BUILDER_MIN_WIDTH, builderFits } from './viewport';

/**
 * Whether this viewport is wide enough for the builder, kept current.
 *
 * The decision itself is {@see builderFits} — a pure translation, tested as
 * one. All this adds is the browser: a media query rather than a resize
 * listener, because the browser already knows when a threshold is crossed and
 * a listener asking on every frame is work to arrive at the same answer.
 *
 * **It answers `true` where it cannot ask.** `matchMedia` is absent in jsdom
 * and in any renderer that is not a browser, and the failure that matters is
 * the wrong one: a merchant on a desktop shown a message telling them to find
 * a desktop has lost the builder to a feature-detection miss, where one on a
 * phone briefly shown a builder has lost nothing they had.
 */
export function useBuilderViewport(): boolean {
  const [fits, setFits] = useState(() =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? true
      : builderFits(window.innerWidth)
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia(`(min-width: ${BUILDER_MIN_WIDTH}px)`);
    const follow = (event: MediaQueryListEvent | MediaQueryList) => setFits(event.matches);

    follow(query);
    query.addEventListener('change', follow);

    return () => query.removeEventListener('change', follow);
  }, []);

  return fits;
}
