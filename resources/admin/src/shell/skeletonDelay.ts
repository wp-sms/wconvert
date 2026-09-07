import { useEffect, useState } from 'react';

/**
 * How long a fetch may take before anything is drawn to say it is happening.
 *
 * **A skeleton that flashes is worse than no skeleton.** A local REST call
 * lands in tens of milliseconds, and a placeholder that appears and vanishes
 * inside one is a screen that flickers on every filter change. 160ms is under
 * the threshold where a person reads a delay as the interface being slow, and
 * over the time a fast response takes — so the skeleton appears exactly when
 * there is a wait worth acknowledging.
 */
const DELAY_MS = 160;

/**
 * Whether a placeholder has waited long enough to be worth drawing.
 *
 * ============================================================================
 * NOT EVERY SKELETON WANTS THIS, AND THE DIVIDING LINE IS WHAT IT REPLACES.
 * ============================================================================
 * One skeleton of five delayed and four painted at once, which read as drift.
 * It is not: the two behaviours answer different situations, and nothing in
 * the admin said which was which.
 *
 * **A skeleton that replaces content the merchant was already reading waits.**
 * That is the flicker case — the region has something in it, a re-read lands
 * in tens of milliseconds, and a placeholder that appears and vanishes inside
 * one is a screen that blinks. {@see TableSkeleton} is written for exactly
 * this, and {@see ChoiceSkeleton} and {@see GallerySkeleton} join it because
 * picking a different [[Goal]] puts a filled step back into `loading`.
 *
 * **A skeleton filling a region for the first time paints at once.** There is
 * nothing to flicker against — the region is blank either way — and drawing
 * the shape immediately is what reserves the height, which is the whole job of
 * {@see StatRowSkeleton} (its numbers arrive after the page and would push the
 * tab strip down) and of {@see RegionSkeleton}. {@see BuilderSkeleton} is the
 * sharpest case: it carries the way OUT of the builder while the chunk loads,
 * so 160ms of nothing is 160ms with no way back.
 */
export function useShownAfterDelay(): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  return shown;
}
