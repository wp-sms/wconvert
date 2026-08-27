import { describe, expect, it } from 'vitest';
import {
  BUILDER_MIN_WIDTH,
  builderFits,
  widerScreenMessage,
} from '../../resources/admin/src/viewport';

/**
 * The builder's viewport floor.
 *
 * **A translation, not chrome.** #29 drew the line — *"Not a TDD seam: React
 * component structure, panel layout, gallery chrome"* — and this sits on the
 * other side of it for the same reason `nav.ts` does: which of two things a
 * merchant is shown is behaviour, and the panel it renders is not.
 *
 * ADR 0038 decided both halves. The builder is a sticky live preview beside a
 * settings panel and there is no arrangement of those two that works on a
 * 375px viewport, so it is desktop-only — and **saying so is the load-bearing
 * half**, because a builder that silently degrades on a narrow viewport is a
 * bug report where one that says what it needs is a decision the merchant can
 * act on.
 */
describe('whether the builder fits the viewport', () => {
  /**
   * 782px is where wp-admin's own menu collapses, so it is the line WordPress
   * already draws and the honest place to draw this one (ADR 0038). Asserted
   * as a number rather than left implicit: the message below quotes it, and
   * the two drifting apart is how a screen comes to ask for a width it does
   * not actually need.
   */
  it('draws the line where WordPress already draws it', () => {
    expect(BUILDER_MIN_WIDTH).toBe(782);
  });

  it('builds at the floor and above it', () => {
    expect(builderFits(BUILDER_MIN_WIDTH)).toBe(true);
    expect(builderFits(1440)).toBe(true);
  });

  /**
   * ADR 0038 says the builder "says so **below** 782px", so the floor itself
   * is a building width and 781 is not. The one-pixel question is written
   * down because wp-admin's own query is `max-width: 782px` — inclusive — and
   * a later reader comparing the two will otherwise assume one of them is a
   * typo.
   */
  it('does not build below the floor, down to the narrowest phone', () => {
    expect(builderFits(BUILDER_MIN_WIDTH - 1)).toBe(false);
    expect(builderFits(360)).toBe(false);
  });

  /**
   * A viewport width arrives from `matchMedia` and from tests, and neither is
   * a place a negative or a NaN should reach a merchant from. Whatever it is,
   * it is not a screen the builder fits.
   */
  it('refuses a width that is not a width', () => {
    expect(builderFits(Number.NaN)).toBe(false);
    expect(builderFits(-1)).toBe(false);
  });
});

describe('what the merchant is told instead', () => {
  /**
   * **What is needed, not that something is unsupported** (ADR 0038). The
   * assertion is not on the wording — that is copy, and asserting it is the
   * churn #29 refused. It is that the sentence quotes the SAME number the gate
   * uses, which is the one way the message can be wrong without anybody
   * noticing.
   */
  it('names the width it is asking for', () => {
    expect(widerScreenMessage()).toContain(String(BUILDER_MIN_WIDTH));
  });

  it('is a sentence rather than an empty string', () => {
    expect(widerScreenMessage().trim().length).toBeGreaterThan(0);
  });
});
