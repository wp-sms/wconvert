import { describe, expect, it } from 'vitest';
import { AA_NORMAL, contrastOf, luminanceOf, meetsAA, readability, readableOn } from '../../resources/admin/src/builder/contrast';
import { axesOf, measuresOf, rangeFor } from '../../resources/admin/src/builder/themes';

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
  ])('refuses to measure %s', (color) => {
    expect(luminanceOf(color)).toBeNull();
    expect(contrastOf(color, '#ffffff')).toBeNull();
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
    expect(measuresOf('28rem')).toEqual([{ amount: 28, unit: 'rem' }]);
    expect(measuresOf('0.75rem')).toEqual([{ amount: 0.75, unit: 'rem' }]);
    expect(measuresOf(' 16px ')).toEqual([{ amount: 16, unit: 'px' }]);
    expect(measuresOf('0rem')).toEqual([{ amount: 0, unit: 'rem' }]);
  });

  /**
   * Four designs ship one — the three bars and `inline-cart-nudge` — and until
   * this read two components every one of them had a text box for its inner
   * spacing, because no single slider expresses two axes.
   */
  it('reads a two-value shorthand as its two axes, units and all', () => {
    expect(measuresOf('0.75rem 1.25rem')).toEqual([
      { amount: 0.75, unit: 'rem' },
      { amount: 1.25, unit: 'rem' },
    ]);
    expect(measuresOf('1rem 20px')).toEqual([
      { amount: 1, unit: 'rem' },
      { amount: 20, unit: 'px' },
    ]);
  });

  /**
   * `split-hero` ships `"pad": "0"`, and zero is the one length CSS lets you
   * write without a unit — so refusing it was refusing a design the library
   * actually contains.
   */
  it('reads a bare zero as a length, and nothing else unitless', () => {
    expect(measuresOf('0')).toEqual([{ amount: 0, unit: '' }]);
    expect(measuresOf('0 1rem')).toEqual([
      { amount: 0, unit: '' },
      { amount: 1, unit: 'rem' },
    ]);
    // A line-height, not a length. `isBareNumber` keeps this in the type group.
    expect(measuresOf('1.5')).toBeNull();
  });

  /**
   * **The values a slider must never be able to clobber.** These already work
   * today — a value lands straight on the element as a custom property — and
   * the specimen book calls the asymmetry out: names are checked, values are
   * not. Adding the slider has to take nothing away.
   */
  it.each([
    'clamp(20rem, 50vw, 30rem)',
    // Three and four values are CSS this parser deliberately stops short of.
    '0.5rem 0.5rem 0 0',
    '1rem 2rem 3rem',
    'min(28rem, 100%)',
    'calc(1rem + 2px)',
    'start',
    "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    '#ffffff',
    '',
  ])('refuses %s, so the text box stays', (value) => {
    expect(measuresOf(value)).toBeNull();
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

/**
 * The three values that decide whether a token gets sliders, and how many.
 *
 * `axesOf(fallback, standard, shown)` — what the design shipped, what the
 * manifest declares, and what is stored now.
 */
describe('the sliders a token earns', () => {
  it('offers one for a plain length', () => {
    expect(axesOf('28rem', '28rem', '30rem')).toEqual([
      { amount: 30, unit: 'rem', range: { min: 0, max: 56, step: 0.125 } },
    ]);
  });

  it('offers one per axis for a two-value shorthand', () => {
    const axes = axesOf('0.75rem 1.25rem', '1.5rem', '0.75rem 1.25rem');

    expect(axes).toHaveLength(2);
    expect(axes?.[0].amount).toBe(0.75);
    expect(axes?.[1].amount).toBe(1.25);
  });

  /**
   * Each axis keeps its own unit and its own scale. Normalising them would be
   * the panel deciding a design's value was written wrong.
   */
  it('does not reconcile two axes onto one unit', () => {
    const axes = axesOf('1rem 20px', '1.5rem', '1rem 20px');

    expect(axes?.[0]).toEqual({ amount: 1, unit: 'rem', range: { min: 0, max: 3, step: 0.125 } });
    expect(axes?.[1]).toEqual({ amount: 20, unit: 'px', range: { min: 0, max: 40, step: 1 } });
  });

  /**
   * `split-hero`'s `"pad": "0"` has no unit to drag along, so the unit comes
   * from the manifest's own declared value — never from the browser.
   */
  it('takes a unit from the manifest where the design shipped a bare zero', () => {
    expect(axesOf('0', '1.5rem', '0')).toEqual([
      { amount: 0, unit: 'rem', range: { min: 0, max: 2, step: 0.125 } },
    ]);
  });

  /** And once dragged, the value it wrote is still on the slider it came from. */
  it('keeps the slider after a drag off a bare zero', () => {
    expect(axesOf('0', '1.5rem', '1.25rem')?.[0].amount).toBe(1.25);
  });

  it.each([
    // A px value against a rem design.
    ['28rem', '28rem', '400px'],
    // Pushed past twice the design's own.
    ['28rem', '28rem', '90rem'],
    // Something no slider can say.
    ['28rem', '28rem', 'clamp(20rem, 50vw, 30rem)'],
    // A second component the design does not have: which axis did they mean?
    ['1.5rem', '1.5rem', '1rem 2rem'],
    // Three values — past where the parser stops.
    ['1rem 2rem 3rem', '1.5rem', '1rem 2rem 3rem'],
  ])('refuses %s / %s / %s and keeps the text box', (fallback, standard, shown) => {
    expect(axesOf(fallback, standard, shown)).toBeNull();
  });

  /**
   * A design and a manifest that are both unitless leave nothing to grow into,
   * so the panel says so rather than inventing a unit.
   */
  it('offers nothing where no unit can be found at all', () => {
    expect(axesOf('0', '0', '0')).toBeNull();
  });
});

/**
 * One verdict for every place that judges a pair (ADR 0135): in words, with
 * the way to fix it and a color that does, and the ratio only for Advanced.
 */
describe('readability', () => {
  it('reads a clear pair as easy, with no fix', () => {
    expect(readability('#18181b', '#ffffff')).toMatchObject({ readable: true, direction: null, said: 'Easy to read' });
  });

  it('says which way a hard pair should move, from the background it sits on', () => {
    expect(readability('#bbbbbb', '#ffffff')).toMatchObject({ readable: false, direction: 'darker',
      said: 'Hard to read on this background. Choose a darker color.' });
    expect(readability('#444444', '#111111')).toMatchObject({ readable: false, direction: 'lighter',
      said: 'Hard to read on this background. Choose a lighter color.' });
  });

  it('keeps one precision for the ratio, rounded down so a failing pair never reads 4.5', () => {
    expect(readability('#767676', '#ffffff').ratio).toBe('4.5');
    // #777777 on white is 4.48:1 — hard to read, and shown as 4.4.
    expect(readability('#777777', '#ffffff')).toMatchObject({ readable: false, ratio: '4.4' });
  });

  it('refuses a pair it cannot measure rather than guessing', () => {
    expect(readability('rgba(0,0,0,0.5)', '#ffffff')).toMatchObject({ readable: null, ratio: null });
  });

  it('fixes with the first of the look’s own colors that reads, else black or white', () => {
    expect(readableOn('#ffffff', ['#dddddd', '#18181b'])).toBe('#18181b');
    expect(readableOn('#ffffff', ['#dddddd', '#eeeeee'])).toBe('#000000');
    expect(readableOn('#0b1020', ['#111111'])).toBe('#ffffff');
  });
});
