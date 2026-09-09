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
 * WCAG relative luminance, or null for a colour this cannot honestly read.
 *
 * The formula is the specification's, including the 0.03928 threshold and the
 * 2.4 exponent — it is not sRGB gamma and rounding it would move a pair across
 * the floor.
 */
export function luminanceOf(colour: string): number | null {
  const channels = rgbOf(colour);

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
function rgbOf(colour: string): [number, number, number] | null {
  const hex = colour.trim();

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
