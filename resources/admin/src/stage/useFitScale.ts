import { useLayoutEffect, useState, type RefObject } from 'react';
import { place, type Framing, type Placed, type Size } from './geometry';

/** Where the design stands, and the size of the stage it stands on. */
export type Fitted = Placed & { readonly stage: Size };

/**
 * The design's place on the stage, kept current by one ResizeObserver over the
 * stage and the design's content (ADR 0170).
 *
 * The design is measured at its render width, unscaled: `offsetWidth` and
 * `offsetHeight` ignore transforms, so the scale this sets never feeds back
 * into the next measurement. `null` until both have a size, which is what keeps
 * a design hidden for the frame before it is placed.
 */
export function useFitScale(stage: RefObject<HTMLElement | null>, design: RefObject<HTMLElement | null>, framing: Omit<Framing, 'rtl'>, active: boolean, content: unknown): Fitted | null {
  const [placed, setPlaced] = useState<Fitted | null>(null);
  const { format, device, zoom, cap, placement } = framing;

  useLayoutEffect(() => {
    const area = stage.current;
    const box = design.current;

    if (!active || area === null || box === null) {
      setPlaced(null);
      return;
    }

    const measure = () => {
      // The content, not the box: a fullscreen's box is given its height from here.
      const content = (box.firstElementChild as HTMLElement | null) ?? box;
      const width = box.offsetWidth;
      const height = content.offsetHeight;

      if (!area.clientWidth || !area.clientHeight || !width || !height) return;

      const rtl = getComputedStyle(area).direction === 'rtl';
      const size = { width: area.clientWidth, height: area.clientHeight };
      const next = { ...place({ format, device, zoom, cap, placement, rtl }, size, { width, height }), stage: size };

      setPlaced(previous => previous !== null && same(previous, next) ? previous : next);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    const inner = box.firstElementChild;

    observer.observe(area);
    observer.observe(box);
    if (inner) observer.observe(inner);

    return () => observer.disconnect();
    // `content` names what is drawn: a new one is a new element to observe.
  }, [stage, design, format, device, zoom, cap, placement, active, content]);

  return placed;
}

function same(a: Fitted, b: Fitted): boolean {
  return a.stage.width === b.stage.width && a.stage.height === b.stage.height && a.x === b.x && a.y === b.y && a.scale === b.scale && a.fill === b.fill && a.barHeight === b.barHeight
    && a.page.width === b.page.width && a.page.height === b.page.height && a.page.scale === b.page.scale
    && a.page.x === b.page.x && a.page.y === b.page.y
    && a.plate?.x === b.plate?.x && a.plate?.y === b.plate?.y && a.plate?.width === b.plate?.width && a.plate?.height === b.plate?.height;
}
