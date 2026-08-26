import type { LoaderModule } from '@loader/types';

/**
 * `scroll_up` — `exit_intent`'s distinct mobile sibling.
 *
 * ============================================================================
 * A SEPARATE TYPE, NEVER A SECOND MEANING FOR `exit_intent`.
 * ============================================================================
 * The tempting shape is one `exit_intent` type that watches `mouseout` on a
 * desktop and an upward scroll on a phone. It is the specific mistake #32
 * exists not to make. Such a type is unreportable — "why didn't my popup
 * show" has no per-rule answer when one row means two things — and
 * unpairable, because a merchant could never ask for one gesture without the
 * other. Two ids, two modules, two rows in the builder.
 *
 * On a phone there is no pointer to leave the viewport, and the gesture that
 * precedes leaving is a deliberate turn back UP the page: toward the address
 * bar, the back button, and the tab the visitor came from.
 *
 * Two thresholds rather than one, and both are what stop this being a
 * page-load Trigger with a gesture's name:
 *
 * - **They must have gone down first.** Near the top there is nothing to come
 *   back FROM, and a visitor who has barely entered the page and nudges up is
 *   arriving.
 * - **The rise must be deliberate.** A few pixels back is reading. Without
 *   this, the first overshoot of a tap-scroll fires — which on a phone is
 *   every scroll.
 *
 * Constants rather than params, because the merchant has no opinion to express
 * in pixels: "they are about to leave" is one thing, and a rule asking how
 * many pixels of upward scroll counts as leaving would be a control nobody can
 * answer honestly. `exit_intent` is paramless for the same reason, which is
 * what keeps the pair symmetrical on screen.
 */

/** How deep they must have been for a rise to mean anything. */
const DEPTH = 300;

/** How far back up from their deepest point counts as the gesture. */
const RISE = 200;

export const scrollUp: LoaderModule = {
  id: 'scroll_up',
  kind: 'trigger',
  consentCategory: null,
  create: (changed) => {
    // Read at instantiation, before any listener is attached — the finding
    // `scroll_depth` is built on. Under delayed JS the visitor is already deep
    // when the loader runs and the scrolls we missed are never replayed, so a
    // module starting from zero would read their first rise as a descent.
    let deepest = window.scrollY;
    let rose = false;

    const onScroll = (): void => {
      const y = window.scrollY;

      if (y > deepest) {
        deepest = y;

        return;
      }

      if (rose || deepest < DEPTH || deepest - y < RISE) {
        return;
      }

      rose = true;
      // Once, on the transition — the same reason `exit_intent` reports once.
      changed();
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return {
      // High-water, like every other gesture Trigger: scrolling back down does
      // not un-make the turn.
      holds: () => rose,
      stop: () => window.removeEventListener('scroll', onScroll),
    };
  },
};
