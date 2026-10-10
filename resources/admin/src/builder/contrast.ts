/**
 * WCAG contrast, measured where a colour is CHOSEN.
 *
 * ============================================================================
 * THIS IS THE FIRST CONTROL THAT LETS A MERCHANT FAIL AA FOR A VISITOR.
 * ============================================================================
 * ADR 0038 holds the admin to WCAG 2.1 AA and holds it three ways, one of which
 * is *"contrast is measured at the token, once, rather than per component"* —
 * and every one of those three is about **our** colours. The Optin's tokens are
 * the merchant's, they are shipped to a visitor, and nothing in this codebase
 * has ever computed a ratio for them.
 *
 * A preset cannot fail: the four bundles are ours and were chosen. The picker
 * can, in one click, and until now the merchant would find out from a customer.
 * So it is measured beside the control rather than discovered later.
 *
 * ============================================================================
 * IT READS HEX AND REFUSES EVERYTHING ELSE, INCLUDING `rgba()`.
 * ============================================================================
 * Not a parser limitation — a refusal to report a number that would be wrong.
 * A ratio is a fact about two OPAQUE colours; a translucent one composites over
 * whatever is behind it, which this cannot know. `rgba(15, 23, 42, 0.55)` is a
 * real value in the shipped vocabulary and the honest answer for it is *"cannot
 * measure that pair"*.
 *
 * A named colour and `color-mix()` are refused for the plainer reason that
 * resolving them means a browser, and a guess here would be a green tick over a
 * design that fails.
 */

import { __ } from '@wordpress/i18n';

/** The AA floor for body text, which is what every pair measured here is. */
export const AA_NORMAL = 4.5;

/**
 * Every place the renderer paints words on a surface.
 *
 * ============================================================================
 * ONE LIST, BECAUSE THREE SCREENS ASK THE SAME QUESTION.
 * ============================================================================
 * The Design panel draws a readout with a lettered sample, `structure/problems`
 * reports a sentence in the readiness verdict, and {@see ScopeStyle} measures
 * the same pairs resolved at one BOX. Each had its own array, keyed the same way
 * and carrying one extra column of its own — which is three places for the AA
 * check to quietly stop covering something. It already nearly happened: a field
 * took the design's `bg` until `input-bg` gave it a ground of its own, and the
 * pair had to be added to every copy in lockstep or the one control a visitor
 * must find would go unchecked on exactly the designs a scope is for.
 *
 * So the PAIRS live here and each screen maps its own extra onto them by
 * `"{fg}/{bg}"`. `backdrop` is deliberately absent: it sits behind the popup
 * rather than behind text, so a ratio for it would be a number about nothing.
 */
export const READABLE_PAIRS: readonly (readonly [fg: string, bg: string])[] = [
  ['fg', 'bg'],
  ['muted', 'bg'],
  ['accent-fg', 'accent'],
  /*
   * The field's own ground, since `input-bg` gave it one (ADR 0062). A light
   * form on a dark panel is the design a scoped bag exists for, and without this
   * the ratio reported would be about a surface the field is no longer sitting
   * on.
   */
  ['fg', 'input-bg'],
];

/** A pair's key in the per-screen maps that hang words or a sample off it. */
export const pairKey = (fg: string, bg: string): string => `${fg}/${bg}`;

/**
 * Which leaves read a pair's foreground, so a box holding none of them says
 * nothing about it.
 *
 * ============================================================================
 * THREE OF THE FOUR PAIRS WARN ABOUT COLOURS A BOX MAY NOT DRAW AT ALL.
 * ============================================================================
 * At the DESIGN there is nothing to filter: every pair is somewhere in the
 * tree, and a design's `muted` is read by its fine print wherever that sits.
 * At a SCOPE it is different — `fieldwork`'s photo pane holds two headings and
 * nothing else, so measuring `muted` on it reported *"Quiet text on Background
 * is 1.1 to 1"* about a colour with no text in that box to draw it, beside a
 * second warning about a field ground with no field.
 *
 * Two sentences that change nothing a merchant would do, on the box they are
 * most likely to be restyling — which is [ADR 0042](../../../docs/adr/0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md)
 * rule 2 exactly, and it teaches them to read past the one warning that
 * matters.
 *
 * **An empty list means always**, which `fg`/`bg` is: a box that paints has a
 * ground and everything in it has ink, whatever kind of leaf it turns out to
 * be.
 *
 * **By node TYPE and not by [[Slot Role]]**, and that over-reports slightly: a
 * `text` reads `--wc-muted` only where its Role is `fine_print`, so a box
 * holding one body paragraph still measures the pair. That is the right
 * direction to err — the alternative is a pair going unmeasured on a design
 * that later adds fine print to the box — and it is a far smaller error than
 * measuring all four everywhere.
 */
export const PAIR_READERS: Readonly<Record<string, readonly string[]>> = {
  [pairKey('fg', 'bg')]: [],
  [pairKey('muted', 'bg')]: ['text', 'eyebrow', 'field', 'consent', 'rating'],
  [pairKey('accent-fg', 'accent')]: ['button', 'badge'],
  [pairKey('fg', 'input-bg')]: ['field'],
};

/**
 * The contrast ratio between two colours, or null where either cannot be read.
 *
 * Between 1 (identical) and 21 (black on white). Order does not matter: the
 * lighter of the two is the numerator either way, which is what the formula
 * says and what stops "text on background" and "background on text" disagreeing.
 */
export function contrastOf(a: string, b: string): number | null {
  const first = luminanceOf(a);
  const second = luminanceOf(b);

  if (first === null || second === null) {
    return null;
  }

  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

/** Does this pair clear the AA floor for body text? Null stays null. */
export const meetsAA = (ratio: number | null): boolean | null =>
  ratio === null ? null : ratio >= AA_NORMAL;

/**
 * One verdict on a pair, in words (ADR 0135).
 *
 * Every place that judges a pair says the same thing: "Easy to read", or
 * "Hard to read on this background" and which way to move the color — darker
 * on a light background, lighter on a dark one. The ratio is kept, at one
 * precision, for Advanced only: a merchant has no intuition for 4.5, and
 * "Under AA" was the editor's word, not theirs.
 */
export interface Readability {
  /** Null where the pair cannot be measured (a translucent or named color). */
  readonly readable: boolean | null;
  readonly direction: 'darker' | 'lighter' | null;
  readonly said: string;
  /** "4.5", or null. */
  readonly ratio: string | null;
}

export function readability(fg: string, bg: string): Readability {
  const ratio = contrastOf(fg, bg);
  const ground = luminanceOf(bg);

  if (ratio === null || ground === null) {
    return { readable: null, direction: null, ratio: null, said: __('This color can’t be measured here. Check it by eye.', 'wconvert') };
  }

  // Shown rounded down, so a pair just under the floor never reads "4.5:1" beside "Hard to read".
  const shown = (Math.floor(ratio * 10) / 10).toFixed(1);

  if (ratio >= AA_NORMAL) {
    return { readable: true, direction: null, ratio: shown, said: __('Easy to read', 'wconvert') };
  }

  // 0.179 is where black and white read equally well: above it, dark text wins.
  const direction = ground > 0.179 ? 'darker' : 'lighter';

  return {
    readable: false,
    direction,
    ratio: shown,
    said: direction === 'darker'
      ? __('Hard to read on this background. Choose a darker color.', 'wconvert')
      : __('Hard to read on this background. Choose a lighter color.', 'wconvert'),
  };
}

/**
 * The color a Fix writes: the first of the look's own colors that reads on
 * this background, so a fix stays inside the palette, else black or white.
 */
export function readableOn(bg: string, candidates: readonly string[]): string {
  const found = candidates.find((color) => (contrastOf(color, bg) ?? 0) >= AA_NORMAL);

  if (found !== undefined) {
    return found;
  }

  return (contrastOf('#000000', bg) ?? 0) >= (contrastOf('#ffffff', bg) ?? 0) ? '#000000' : '#ffffff';
}

/** What Fix writes for a pair on `bg`, given how the panel resolves a token: the look's text, then background, then black or white. */
export const readableFix = (value: (token: string) => string, bg: string): string => readableOn(value(bg), [value('fg'), value('bg')]);

/**
 * WCAG relative luminance, or null for a colour this cannot honestly read.
 *
 * The formula is the specification's, including the 0.03928 threshold and the
 * 2.4 exponent — it is not sRGB gamma and rounding it would move a pair across
 * the floor.
 */
export function luminanceOf(color: string): number | null {
  const channels = rgbOf(color);

  if (channels === null) {
    return null;
  }

  const [red, green, blue] = channels.map(linear);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** One channel, un-gamma'd. */
function linear(channel: number): number {
  const value = channel / 255;

  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/**
 * A hex colour as three channels, or null.
 *
 * `#rgb` and `#rrggbb`, and their alpha forms **only where the alpha is
 * full** — a colour that is partly transparent has no ratio of its own, and
 * silently ignoring the alpha would report the ratio of a colour nobody sees.
 */
function rgbOf(color: string): [number, number, number] | null {
  const hex = color.trim();

  if (!/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) {
    return null;
  }

  const digits = hex.slice(1);
  const short = digits.length <= 4;
  const pairs = short
    ? Array.from(digits, (digit) => digit + digit)
    : (digits.match(/../g) ?? []);
  const [red, green, blue, alpha] = pairs.map((pair) => parseInt(pair, 16));

  if (red === undefined || green === undefined || blue === undefined) {
    return null;
  }

  return alpha !== undefined && alpha < 255 ? null : [red, green, blue];
}
