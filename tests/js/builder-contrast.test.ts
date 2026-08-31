import { describe, expect, it } from 'vitest';
import { AA_NORMAL, contrastOf, luminanceOf, meetsAA } from '../../resources/admin/src/builder/contrast';
import { measureOf, rangeFor } from '../../resources/admin/src/builder/themes';

/**
 * ============================================================================
 * THE TWO THINGS THE DESIGN TAB DECIDES BEFORE IT DRAWS ANYTHING.
 * ============================================================================
 * **Whether a pair of colours can be read**, which is the first question in
 * this product a merchant can get wrong on a VISITOR's behalf rather than their
 * own — ADR 0038's three contrast defences are all about our own tokens, and
 * the Optin's are the merchant's.
 *
 * **Whether a value is something a slider can say**, which is what keeps
 * `clamp(20rem, 50vw, 30rem)` typeable: token names are checked and their
 * values are not, and a control that could only express one number would
 * silently end that.
 *
 * Both are pure, so they are tested here rather than through a component that
 * would be asserting jsdom.
 */

describe('contrast', () => {
  /** The two ends of the scale, which is what a formula error moves first. */
  it('measures the extremes the specification names', () => {
    expect(contrastOf('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastOf('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('gives the same answer whichever way round the pair is handed over', () => {
    expect(contrastOf('#1a4fd8', '#ffffff')).toBe(contrastOf('#ffffff', '#1a4fd8'));
  });

  /**
   * Either side of the AA floor, because a rounded exponent or a missing gamma
   * step moves a real pair across it rather than breaking the extremes.
   */
  it('puts a readable pair above the floor and a washed-out one below it', () => {
    // The shipped Classic palette: `#6b7280` quiet text on white.
    expect(contrastOf('#6b7280', '#ffffff')).toBeGreaterThan(AA_NORMAL);
    // One step lighter, and it stops being body text.
    expect(contrastOf('#9ca3af', '#ffffff')).toBeLessThan(AA_NORMAL);
  });

  it('reads the short forms as the long ones', () => {
    expect(luminanceOf('#fff')).toBe(luminanceOf('#ffffff'));
    expect(luminanceOf('#0f0')).toBe(luminanceOf('#00ff00'));
  });

  /**
   * ==========================================================================
   * A REFUSAL RATHER THAN A WRONG NUMBER.
   * ==========================================================================
   * A translucent colour composites over whatever is behind it, which this
   * cannot know; a named colour and `color-mix()` need a browser to resolve.
   * Reporting a ratio for any of them would be a green tick over a design that
   * fails, which is worse than saying nothing.
   */
  it.each([
    'rgba(15, 23, 42, 0.55)',
    'rgb(15, 23, 42)',
    'rebeccapurple',
    'color-mix(in srgb, #fff 50%, #000)',
    '#ffffff80',
    '',
    'nonsense',
  ])('refuses to measure %s', (colour) => {
    expect(luminanceOf(colour)).toBeNull();
    expect(contrastOf(colour, '#ffffff')).toBeNull();
  });

  /** Full alpha is opaque, so it is readable and must not be refused. */
  it('reads a hex that spells its opacity out', () => {
    expect(luminanceOf('#ffffffff')).toBe(luminanceOf('#ffffff'));
  });

  it('carries null through the verdict rather than answering false', () => {
    expect(meetsAA(null)).toBeNull();
    expect(meetsAA(AA_NORMAL)).toBe(true);
    expect(meetsAA(AA_NORMAL - 0.1)).toBe(false);
  });
});

describe('which control a token takes', () => {
  it('reads one plain number and unit', () => {
    expect(measureOf('28rem')).toEqual({ amount: 28, unit: 'rem' });
    expect(measureOf('0.75rem')).toEqual({ amount: 0.75, unit: 'rem' });
    expect(measureOf(' 16px ')).toEqual({ amount: 16, unit: 'px' });
    expect(measureOf('0rem')).toEqual({ amount: 0, unit: 'rem' });
  });

  /**
   * **The values a slider must never be able to clobber.** These already work
   * today — a value lands straight on the element as a custom property — and
   * the specimen book calls the asymmetry out: names are checked, values are
   * not. Adding the slider has to take nothing away.
   */
  it.each([
    'clamp(20rem, 50vw, 30rem)',
    '0.5rem 0.5rem 0 0',
    'min(28rem, 100%)',
    'calc(1rem + 2px)',
    'start',
    "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    '#ffffff',
    '',
  ])('refuses %s, so the text box stays', (value) => {
    expect(measureOf(value)).toBeNull();
  });

  /** A range wide enough to be useful, from the design's own value. */
  it('offers twice the design’s value, and always reaches zero', () => {
    expect(rangeFor({ amount: 28, unit: 'rem' })).toEqual({ min: 0, max: 56, step: 0.125 });
    expect(rangeFor({ amount: 16, unit: 'px' })).toEqual({ min: 0, max: 32, step: 1 });
  });

  /**
   * A square corner is a real design, and a slider pinned at both ends would be
   * a control with nowhere to go.
   */
  it('still has a range for a token the design set to zero', () => {
    expect(rangeFor({ amount: 0, unit: 'rem' }).max).toBe(2);
  });
});
