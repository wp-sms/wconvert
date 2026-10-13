import { Fragment, type ReactNode } from 'react';

/**
 * A translated frame with `%1$s`-style slots, filled with elements.
 *
 * `sprintf` returns a string, and `@wordpress/element`'s `createInterpolateElement`
 * is not a dependency, so this is the one small thing it would have done: split
 * on the numbered placeholders and put each element where the translator put
 * its number. A bare `%s` reads as the first.
 */
export function interpolate(frame: string, slots: readonly ReactNode[]): ReactNode {
  return frame.split(/(%(?:\d+\$)?s)/).map((piece, index) => {
    const slot = /^%(?:(\d+)\$)?s$/.exec(piece);
    return <Fragment key={index}>{slot ? slots[Number(slot[1] ?? 1) - 1] : piece}</Fragment>;
  });
}
