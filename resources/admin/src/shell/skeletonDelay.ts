import { createContext, useContext, useEffect, useState } from 'react';

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
 * A FIRST FILL PAINTS AT ONCE. ONLY A RE-READ WAITS (GUIDELINES §12).
 * ============================================================================
 * The line is what the skeleton replaces, and the CALLER is the one who knows,
 * so it is a flag at the call site rather than a property of each skeleton.
 *
 * **A region filling for the first time paints at once** — `wait` false, the
 * default. There is nothing to flicker against: the region is blank either
 * way, and 160ms of blank before the shape is 160ms of a screen that has not
 * started. Drawing the shape immediately is also what reserves the height.
 * The section fallbacks hand off to these same components, so a delay here
 * was a blank frame at the chunk's end and another at the read's start.
 *
 * **A re-read over content the merchant was already reading waits** — `wait`
 * true. A second [[Goal]] picked in creation, a Settings category switch: a local REST call lands in tens of milliseconds, and
 * a placeholder that appears and vanishes inside one is a screen that blinks.
 * Leads' filters are not this case: their re-read keeps the rows on screen,
 * dimmed, and draws no skeleton.
 */
export function useShownAfterDelay(asked = false): boolean {
  const inherited = useContext(Reread);
  const wait = asked || inherited;
  const [shown, setShown] = useState(!wait);

  useEffect(() => {
    if (!wait) return undefined;
    const timer = setTimeout(() => setShown(true), DELAY_MS);

    return () => clearTimeout(timer);
  }, [wait]);

  return shown || !wait;
}

/**
 * Every skeleton under it is a re-read, so each waits as if it had been asked
 * to. For a screen that swaps a whole column over content the merchant was
 * reading — Settings' category switch — where the regions inside cannot know
 * they are not the first thing drawn there.
 */
export const Reread = createContext(false);
