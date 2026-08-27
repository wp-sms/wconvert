import { useEffect, useState } from 'react';
import { builderFits } from '../viewport';

/**
 * Whether this viewport is wide enough for the builder, kept current.
 *
 * The decision itself is {@see builderFits} — a pure translation, tested as
 * one — and this asks it. **One mechanism, deliberately.** An earlier version
 * seeded the state from `builderFits(window.innerWidth)` and then followed a
 * `matchMedia('(min-width: 782px)')` query, which is the same question asked
 * two ways: the constant appeared twice, and the two do not agree at the
 * boundary, because `innerWidth` counts the scrollbar and a media query does
 * not. A resize listener re-asking the tested function is a little more work
 * and cannot disagree with itself.
 *
 * The extra work is a comparison per resize event. React re-renders only when
 * the boolean actually flips, which happens once per crossing.
 *
 * **It answers `true` where it cannot ask.** `window` is absent in jsdom's
 * module scope and in any renderer that is not a browser, and the failure that
 * matters is the wrong one: a merchant on a desktop shown a message telling
 * them to find a desktop has lost the builder to a feature-detection miss,
 * where one on a phone briefly shown a builder has lost nothing they had.
 */
export function useBuilderViewport(): boolean {
  const [fits, setFits] = useState(() =>
    typeof window === 'undefined' ? true : builderFits(window.innerWidth)
  );

  useEffect(() => {
    const follow = () => setFits(builderFits(window.innerWidth));

    follow();
    window.addEventListener('resize', follow);

    return () => window.removeEventListener('resize', follow);
  }, []);

  return fits;
}
