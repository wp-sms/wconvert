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
 * **It lives here rather than in each skeleton**, for the reason
 * {@see TableSkeleton} already gave for keeping it out of each CALL SITE: "do
 * not flash" is a property of a skeleton and not a decision anyone should be
 * able to get half right. It was true of one skeleton out of five, so four of
 * them flickered on every fast read.
 */
export function useShownAfterDelay(): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  return shown;
}
