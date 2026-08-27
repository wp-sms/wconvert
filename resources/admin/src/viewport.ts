import { __, sprintf } from '@wordpress/i18n';

/**
 * The width the builder needs, and what a merchant is told below it.
 *
 * **782px is where wp-admin's own menu collapses**, so it is the line
 * WordPress already draws and the honest place to draw this one (ADR 0038).
 * The builder is a sticky live preview beside a settings panel; there is no
 * arrangement of those two that works on a 375px viewport, and pretending
 * otherwise means real work producing something nobody can use. The four
 * reading screens hold the other floor — 360px — because a conversion count
 * and yesterday's leads are lists and numbers, and those reflow.
 *
 * The number lives here rather than in a media query because the message
 * quotes it. Two spellings of one width is how a screen comes to ask for a
 * size it does not actually need, and no CSS breakpoint can be asserted
 * against the sentence beside it.
 */
export const BUILDER_MIN_WIDTH = 782;

/**
 * Whether the builder fits a viewport of this width.
 *
 * ADR 0038 says the builder "says so **below** 782px", so the floor itself
 * builds. wp-admin's own query is `max-width: 782px` and therefore inclusive;
 * the one-pixel disagreement is deliberate and recorded rather than tidied,
 * because the alternative is a reader assuming one of the two is a typo.
 *
 * A width that is not a number is not a screen the builder fits. It arrives
 * from `matchMedia` and from tests, and neither is a place a `NaN` should
 * reach a merchant from.
 */
export function builderFits(width: number): boolean {
  return Number.isFinite(width) && width >= BUILDER_MIN_WIDTH;
}

/**
 * **What the builder needs, not that something is unsupported.**
 *
 * That distinction is the load-bearing half of ADR 0038's decision: a merchant
 * told "unsupported" has learned nothing they can act on, and one told the
 * width has learned to open the same URL on a laptop. The width is
 * interpolated rather than written into the sentence so the message and
 * {@see builderFits} cannot disagree.
 *
 * A function rather than a constant because `__()` must not run at module
 * scope — the catalogue is not loaded when the bundle is evaluated, so a
 * top-level call would freeze the English string into every locale.
 */
export function widerScreenMessage(): string {
  return sprintf(
    /* translators: %d: minimum viewport width in pixels. */
    __(
      'The Optin builder needs a screen at least %dpx wide. Open this page on a desktop to design an Optin — everything else in WConvert works here.',
      'wconvert'
    ),
    BUILDER_MIN_WIDTH
  );
}
