import { __ } from '@wordpress/i18n';
import type { Tokens } from '@renderer/types';

/**
 * Ready-made looks, as **token bundles and nothing else**.
 *
 * ============================================================================
 * A PRESET CHANGES NO SHAPE, SO IT NEEDS NO NEW VOCABULARY.
 * ============================================================================
 * ADR 0010's bargain is that the gallery is the design surface and the settings
 * panel edits content, visibility and tokens — never arrangement. A preset is
 * an entry in the third of those: a map of token names the manifest already
 * declares to values the renderer already reads. It cannot express a layout,
 * because there is nowhere in this file to put one.
 *
 * That is what makes presets the answer to
 * [#71](https://github.com/navidkashani/wconvert/issues/71) rather than a
 * second design system. The panel asked a merchant for
 * `rgba(15, 23, 42, 0.55)` in a text box and gave them no way to find out what
 * it did but to type one and watch. Four bundles carry the median case; the raw
 * tokens stay reachable underneath for the brand-exact tail.
 *
 * **Every value here is a colour or a corner.** Type, spacing and width belong
 * to the DESIGN — a centred card and a wide banner do not want the same measure
 * — so a preset that set them would quietly restyle the layout the merchant
 * chose in the gallery, which is the boundary above stated in values.
 *
 * **Labels are built at render, never at module scope.** The translation
 * catalogue is not loaded when the bundle is evaluated, so a top-level `__()`
 * would freeze the English string into every locale — the same reason
 * `statusLabel()` in the Optin list is a function.
 *
 * **Twelve of them as of the library growth**, and the second eight vary on
 * ground lightness, ground chroma, corner and accent loudness rather than on
 * hue alone — see the comment above `forest`.
 */

export interface ThemePreset {
  /** Stable across releases and never shown: it is what a control's key is. */
  readonly id: string;
  readonly label: string;
  /** The tokens it sets. Anything absent is left as the design had it. */
  readonly tokens: Readonly<Record<string, string>>;
}

export function themePresets(): readonly ThemePreset[] {
  return [
    {
      id: 'classic',
      label: __('Classic', 'wconvert'),
      tokens: {
        bg: '#ffffff',
        fg: '#111827',
        muted: '#6b7280',
        accent: '#2563eb',
        'accent-fg': '#ffffff',
        border: '#e5e7eb',
        radius: '0.5rem',
        backdrop: 'rgba(15, 23, 42, 0.55)',
      },
    },
    {
      id: 'midnight',
      label: __('Midnight', 'wconvert'),
      tokens: {
        bg: '#0f172a',
        fg: '#f8fafc',
        muted: '#94a3b8',
        accent: '#38bdf8',
        'accent-fg': '#0f172a',
        border: '#1e293b',
        radius: '0.75rem',
        backdrop: 'rgba(2, 6, 23, 0.7)',
      },
    },
    {
      id: 'warm',
      label: __('Warm', 'wconvert'),
      tokens: {
        bg: '#fffaf3',
        fg: '#3f2d20',
        /*
         * 4.30:1 until the contrast assertion in
         * `tests/js/builder-themes.test.ts` was written, which is under AA and
         * was shipped. `muted` carries the fine print — the consent wording
         * and the unsubscribe line — so it is the token that most has to be
         * readable and the one whose failure looks most like a design choice.
         * Darkened to 4.68:1; the hue is unchanged.
         */
        muted: '#846d5b',
        accent: '#c2410c',
        'accent-fg': '#ffffff',
        border: '#efe0cf',
        radius: '0.75rem',
        backdrop: 'rgba(67, 41, 20, 0.55)',
      },
    },
    {
      id: 'minimal',
      label: __('Minimal', 'wconvert'),
      tokens: {
        bg: '#ffffff',
        fg: '#18181b',
        muted: '#71717a',
        accent: '#18181b',
        'accent-fg': '#ffffff',
        border: '#d4d4d8',
        radius: '0rem',
        backdrop: 'rgba(9, 9, 11, 0.45)',
      },
    },

    /*
     * ========================================================================
     * THE SECOND EIGHT, AND THEY VARY ON MORE THAN HUE.
     * ========================================================================
     * Four presets could be four hues and read as four presets. Twelve cannot:
     * a dozen palettes that differ only in `accent` is one preset shown twelve
     * times, which is the failure the design library itself is being grown to
     * avoid.
     *
     * So each of these moves at least two of the four levers a preset actually
     * has — **the ground's lightness, the ground's chroma, the corner, and how
     * loud the accent is against it.** Three are dark grounds where there was
     * one; the corner runs from square to 1.5rem where it ran 0 to 0.75; and
     * two of them (Carbon, Slate) deliberately have no hue at all, because a
     * merchant whose brand is a photograph wants the panel to get out of the
     * way.
     *
     * **Every value here is a colour or a corner**, as above: type, spacing and
     * width belong to the DESIGN, so a preset that set them would quietly
     * restyle the layout the merchant chose in the gallery.
     *
     * `muted` carries the fine print, which is small text — so it is held to
     * AA against its own `bg` like everything else, and that is why several of
     * these are darker than a muted grey usually looks on its own.
     * `tests/js/builder-themes.test.ts` asserts all three pairs.
     */

    {
      /* translators: a colour preset — deep green on a barely-tinted white. */
      id: 'forest',
      label: __('Forest', 'wconvert'),
      tokens: {
        bg: '#f6faf7',
        fg: '#14281d',
        muted: '#4a6356',
        accent: '#15803d',
        'accent-fg': '#ffffff',
        border: '#d3e3d8',
        radius: '0.75rem',
        backdrop: 'rgba(20, 40, 29, 0.6)',
      },
    },
    {
      /* translators: a colour preset — a dark teal ground with a bright cyan accent. */
      id: 'ocean',
      label: __('Ocean', 'wconvert'),
      tokens: {
        bg: '#07303a',
        fg: '#e8fbff',
        muted: '#8fc2cc',
        accent: '#22d3ee',
        'accent-fg': '#05252d',
        border: '#124a56',
        radius: '1rem',
        backdrop: 'rgba(3, 22, 27, 0.72)',
      },
    },
    {
      /* translators: a colour preset — magenta on a pale pink white. */
      id: 'berry',
      label: __('Berry', 'wconvert'),
      tokens: {
        bg: '#fdf7fd',
        fg: '#3b0d3b',
        muted: '#7a5878',
        accent: '#a21caf',
        'accent-fg': '#ffffff',
        border: '#efdcef',
        radius: '1.25rem',
        backdrop: 'rgba(59, 13, 59, 0.55)',
      },
    },
    {
      /* translators: a colour preset — warm paper and a burnt-orange accent, with a nearly square corner. */
      id: 'sand',
      label: __('Sand', 'wconvert'),
      tokens: {
        bg: '#f5f1ea',
        fg: '#2b2620',
        muted: '#6b6155',
        accent: '#9a5b23',
        'accent-fg': '#ffffff',
        border: '#e0d7c7',
        radius: '0.25rem',
        backdrop: 'rgba(43, 38, 32, 0.5)',
      },
    },
    {
      /* translators: a colour preset — cool grey, with the accent as quiet as the text. */
      id: 'slate',
      label: __('Slate', 'wconvert'),
      tokens: {
        bg: '#ffffff',
        fg: '#1e293b',
        muted: '#556377',
        accent: '#475569',
        'accent-fg': '#ffffff',
        border: '#cbd5e1',
        radius: '0.375rem',
        backdrop: 'rgba(15, 23, 42, 0.6)',
      },
    },
    {
      /* translators: a colour preset — near-black with square corners. The dark counterpart to Minimal. */
      id: 'carbon',
      label: __('Carbon', 'wconvert'),
      tokens: {
        bg: '#0a0a0a',
        fg: '#fafafa',
        muted: '#a1a1aa',
        accent: '#fafafa',
        'accent-fg': '#0a0a0a',
        border: '#2b2b2b',
        radius: '0rem',
        backdrop: 'rgba(0, 0, 0, 0.75)',
      },
    },
    {
      /* translators: a colour preset — a loud red on cream, with a very round corner. */
      id: 'punch',
      label: __('Punch', 'wconvert'),
      tokens: {
        bg: '#fffbeb',
        fg: '#1c1917',
        muted: '#6d6154',
        accent: '#c2261d',
        'accent-fg': '#ffffff',
        border: '#fcdf9e',
        radius: '1.5rem',
        backdrop: 'rgba(28, 25, 23, 0.6)',
      },
    },
    {
      /* translators: a colour preset — a soft indigo on near-white, the quietest of the twelve. */
      id: 'mist',
      label: __('Mist', 'wconvert'),
      tokens: {
        bg: '#f8fafc',
        fg: '#334155',
        muted: '#5a6b80',
        accent: '#4f46e5',
        'accent-fg': '#ffffff',
        border: '#e2e8f0',
        radius: '1rem',
        backdrop: 'rgba(51, 65, 85, 0.45)',
      },
    },
  ];
}

/**
 * Is this preset what the Optin is currently wearing?
 *
 * Every token the preset names has to match, and tokens it does not name are
 * ignored — a merchant who widened the panel is still on Midnight. Nothing is
 * STORED saying which preset was applied, for the same reason nothing records
 * where a copied theme colour came from: a stored name would be a link, and a
 * link is what would let a later change to this file restyle an Optin already
 * running (ADR 0010).
 */
export function isApplied(preset: ThemePreset, tokens: Tokens): boolean {
  return Object.entries(preset.tokens).every(([name, value]) => tokens[name] === value);
}

/**
 * Does this token take a colour?
 *
 * Read off the value rather than from a list spelled here, so a token added to
 * `resources/templates/manifest.json` gets the right control without this file
 * being edited — the same argument `TOKENS` in `panel.ts` makes for the panel
 * drawing one field per manifest entry.
 */
export function isColour(value: string): boolean {
  // A hex, or the one other notation the vocabulary uses — which is exactly
  // what {@see isTranslucent} tests for, so it is tested there and not twice.
  return /^#[0-9a-f]{3,8}$/i.test(value.trim()) || isTranslucent(value);
}

/**
 * Does it carry an alpha channel, and therefore need a picker that has one?
 *
 * The backdrop is the only one in the shipped vocabulary, and it is exactly the
 * token a merchant most wants a slider for: "how dark is the page behind the
 * popup" is unanswerable by typing a fourth number into `rgba()`.
 */
export function isTranslucent(value: string): boolean {
  return /^rgba?\(/i.test(value.trim());
}

/**
 * Does this value name a **font stack**?
 *
 * Read off the value, like {@link isColour} and {@link measuresOf}, and for the
 * same reason: a token added to `resources/templates/manifest.json` gets the
 * right control and lands in the right group with nothing here edited.
 *
 * A stack is a comma-separated list of family names. The two exclusions are
 * what stop it claiming things it is not: a `(` means a function — `rgba()`,
 * `clamp()`, `var()` — and a digit means a length or a weight rather than a
 * family. Neither is a heuristic about what fonts are called; both are about
 * what the other token shapes in this vocabulary look like.
 */
export function isFontStack(value: string): boolean {
  const trimmed = value.trim();

  return trimmed.includes(',') && !trimmed.includes('(') && !/\d/.test(trimmed);
}

/**
 * Is it a bare number — a ratio or a weight rather than a length?
 *
 * ============================================================================
 * THE THIRD TYPOGRAPHIC SHAPE, AND IT IS WHY `type` HELD ONLY ONE TOKEN.
 * ============================================================================
 * `groupOf` reads shapes and never names a token, which is what lets a token
 * added to `resources/templates/manifest.json` land in the right section with
 * nothing here edited. It knew two typographic shapes — a colour is not one, a
 * font stack is — and everything else with a number in it fell to *Size and
 * space*. So `heading-weight` (`700`) and `leading` (`1.5`) would have arrived
 * under a heading about spacing, which is where a merchant does not look for
 * how bold their headline is.
 *
 * A bare number is the shape both of them have and no length has:
 * {@link measuresOf} takes a unit on everything but zero, so `1.5rem` is a
 * measure and `1.5` is this. It is not a heuristic about what the token MEANS —
 * CSS has exactly two unitless typographic properties in this vocabulary, and
 * both are type.
 *
 * **`0` answers yes to both, and the order in `groupOf` settles it.** Zero is
 * the one length CSS writes without a unit, so it is genuinely ambiguous read on
 * its own; this arm runs first, and it never sees one anyway because `groupOf`
 * reads the MANIFEST's declared value and no token in it is `0`.
 */
export function isBareNumber(value: string): boolean {
  const trimmed = value.trim();

  return trimmed !== '' && Number.isFinite(Number(trimmed));
}

/**
 * Is it a CSS `<image>` — the shape a background layer has?
 *
 * ============================================================================
 * READ OFF THE VALUE, SO THIS FILE STILL NAMES NO TOKEN.
 * ============================================================================
 * `none` is the keyword a background layer takes when there is no picture, and
 * `url()` and the gradient functions are the only other things this vocabulary
 * can put in one. Together they are a shape as recognisable as a hex colour,
 * which is what earns the token a control of its own rather than a text box a
 * merchant is expected to type `url(https://…)` into.
 *
 * The gradient arm is deliberately included and deliberately NOT given a
 * control: {@link urlIn} answers null for one, so the panel falls back to the
 * plain box and a merchant who typed a gradient keeps it. That is the same
 * refusal `measuresOf` makes for a `clamp()`.
 */
export function isCssImage(value: string): boolean {
  const trimmed = value.trim();

  return trimmed === 'none' || /^(?:url|(?:repeating-)?(?:linear|radial|conic)-gradient)\(/i.test(trimmed);
}

/**
 * The address inside a `url()`, or null for anything else.
 *
 * Null is what sends a gradient — or a value this cannot parse — to the plain
 * text box, which is the escape hatch every control in this panel keeps.
 */
export function urlIn(value: string): string | null {
  const found = /^url\(\s*(['"]?)([^'")]*)\1\s*\)$/.exec(value.trim());

  return found === null ? null : found[2];
}

/**
 * The same address as a background layer, or `''` to clear the token.
 *
 * ============================================================================
 * QUOTES AND PARENTHESES ARE STRIPPED, AND NOT AS A SECURITY BOUNDARY.
 * ============================================================================
 * A token value lands as a CUSTOM PROPERTY, and a custom property cannot
 * introduce a second declaration however it is written — the same door
 * `mountPopover` already goes through for the width token. What a stray quote
 * DOES do is make the declaration invalid at computed-value time, so the
 * merchant's picture silently does not appear and nothing says why. Stripping
 * them is about that.
 *
 * **Anything that does not look like an address is stored verbatim**, which is
 * what keeps a `linear-gradient()` typeable in the one box the panel offers for
 * this token. A merchant pasting a URL gets it wrapped; a merchant writing CSS
 * gets their CSS.
 */
export function asBackgroundLayer(typed: string): string {
  const trimmed = typed.trim();

  if (trimmed === '') {
    return '';
  }

  return /[()'"]/.test(trimmed) ? trimmed : `url("${trimmed}")`;
}

/** One plain number and the unit it is measured in — `28rem`, `16px`, `0`. */
export interface Measure {
  readonly amount: number;
  /** Empty only for a bare `0`, the one length CSS lets you write without one. */
  readonly unit: string;
}

/**
 * A token's value as **one or two** plain numbers and units, or null.
 *
 * ============================================================================
 * A SLIDER MUST NEVER BE ABLE TO CLOBBER A VALUE IT CANNOT EXPRESS.
 * ============================================================================
 * Token *names* are checked and their *values are not*: they land straight on
 * the element as custom properties, so `clamp(20rem, 50vw, 30rem)` for `width`
 * and an asymmetric `radius` already work today. That freedom is real and this
 * must not quietly end it.
 *
 * So the slider appears only where the stored value is something a slider can
 * say. Anything else keeps the text box it always had — the same shape
 * {@link isColour} already uses to decide picker versus not-picker, read off the
 * value rather than off a list of token names spelled here, so a token added to
 * `resources/templates/manifest.json` gets the right control with nothing in
 * this file edited.
 *
 * The text box stays beside the slider even when the slider appears, which is
 * what makes that true in both directions: a merchant on `28rem` can still type
 * a `clamp()` and watch the slider step aside. They cannot disagree, because
 * both write the one value.
 *
 * ============================================================================
 * IT READS TWO COMPONENTS BECAUSE FOUR DESIGNS SHIP TWO, AND IT STOPS THERE.
 * ============================================================================
 * `measureOf` read exactly one, which is the whole reason `pad` never got a
 * control: the three bars and `inline-cart-nudge` ship `0.75rem 1.25rem`, and
 * no single slider expresses two axes. A two-value CSS shorthand is the block
 * axis then the inline one — which is a fact about the SHAPE and not about
 * `pad`, so this file still names no token.
 *
 * **CSS allows three and four values and this stops at two.** That is a stated
 * limit rather than an oversight: `padding: a b c d` falls to the text box,
 * which is the same refusal a `clamp()` gets and the reason the box is still
 * there (ADR 0054 rule 2).
 *
 * ============================================================================
 * AND A BARE `0` IS A LENGTH, WHICH IS WHY THE UNIT IS OPTIONAL FOR IT ALONE.
 * ============================================================================
 * `split-hero` ships `"pad": "0"`. The old pattern required a unit, so that
 * returned null and every Optin started from that design inherited a permanent
 * text box for its inner spacing.
 *
 * Zero is the one length CSS lets you write unitless, and the exception is
 * spelled that narrowly on purpose: `1.5` stays a bare number rather than
 * becoming a unitless length, so {@link isBareNumber} keeps `leading` and
 * `heading-weight` in the type group and this widening moves nothing.
 *
 * A zero carries no unit to drag along, so the caller supplies one — see
 * `TokenField`, which takes it from the manifest's own declared value.
 */
export function measuresOf(value: string): readonly Measure[] | null {
  const parts = value.trim().split(/\s+/);

  if (parts.length < 1 || parts.length > 2) {
    return null;
  }

  const measures: Measure[] = [];

  for (const part of parts) {
    const found = /^(-?\d*\.?\d+)(px|rem|em|%|ch|vw|vh)?$/.exec(part);
    const amount = found === null ? NaN : Number(found[1]);

    // A unit, or an amount of zero. Anything else — `1.5`, `auto`, `clamp(…)`
    // — is not a length and must not be handed a slider.
    if (found === null || (found[2] === undefined && amount !== 0)) {
      return null;
    }

    measures.push({ amount, unit: found[2] ?? '' });
  }

  return measures;
}

/**
 * The range a slider offers for a measure, derived from the DESIGN's own value.
 *
 * No per-token table, deliberately: `width` is 28rem and `gap` is 0.75rem, and
 * a hand-written min/max for each would be a sixth cross-cutting list that a
 * token added to the manifest would arrive missing from. Twice the design's own
 * value is a range wide enough to be useful and narrow enough that the whole
 * slider is not spent on the first tenth.
 *
 * The floor is zero because every one of these measures is a length that may be
 * absent — a square corner, no gap — and a slider that could not reach zero
 * would be a control with a value the text box has and it does not.
 *
 * **One range per axis, and the axes are not reconciled.** A design shipping
 * `1rem 20px` gets a rem slider and a px slider, each with its own scale and
 * each writing back its own unit. Normalising them to one unit would be this
 * panel deciding a design's value was written wrong.
 */
export function rangeFor(measure: Measure): {
  readonly min: number;
  readonly max: number;
  readonly step: number;
} {
  const step = measure.unit === 'px' ? 1 : 0.125;

  return {
    min: 0,
    // `+ 2` so a design whose value is 0 — a square corner — still has a range
    // to drag along rather than a slider pinned at both ends.
    max: Math.max(measure.amount * 2, measure.amount + 2),
    step,
  };
}

/**
 * The sliders a token's value earns, one per axis, or null for none at all.
 *
 * ============================================================================
 * THREE VALUES DECIDE THIS AND EACH ONE IS A DIFFERENT QUESTION.
 * ============================================================================
 * - `fallback` is what the token resolves to with nothing stored — the design's
 *   own value, else the manifest's. It sets the **scale**, and it is read here
 *   rather than the stored value for the reason `TokenField` has always given:
 *   a range derived from what is currently stored moves under the thumb on
 *   every drag.
 * - `standard` is the manifest's own declared value, and it is here for exactly
 *   one job: **a unit for a design that shipped a bare `0` to grow into.**
 *   `split-hero` ships `"pad": "0"`, a drag has to write something, and `1.5rem`
 *   → `rem` is the vocabulary's own answer. Reading a computed value off the
 *   admin document would be answering a question about the merchant's design
 *   with a fact about the browser.
 * - `shown` is what the thumb sits on now.
 *
 * **All or nothing, per token.** One axis the panel cannot honestly express
 * means the whole token keeps the text box, because half a control over a
 * two-value shorthand would write the other half away.
 *
 * Null therefore still means what it always meant: a `clamp()`, a px value
 * against a rem design, a three-value padding, a width pushed past twice the
 * design's — the panel refuses rather than clobbers, and the text box beside it
 * is the escape hatch that keeps ADR 0010's unvalidated values reachable.
 */
export interface Axis {
  /** Where the thumb sits now. */
  readonly amount: number;
  /** What a drag writes. Never empty — a token with nothing to grow into is null. */
  readonly unit: string;
  readonly range: { readonly min: number; readonly max: number; readonly step: number };
}

export function axesOf(fallback: string, standard: string, shown: string): readonly Axis[] | null {
  const scale = measuresOf(fallback);
  const held = measuresOf(shown);

  // A merchant who typed a second component onto a one-value design has said
  // something this control cannot draw over the design's scale, so it steps
  // aside rather than guessing which axis the design meant.
  if (scale === null || held === null || scale.length !== held.length) {
    return null;
  }

  const declared = measuresOf(standard);
  const axes: Axis[] = [];

  for (const [index, axis] of scale.entries()) {
    // The design's own unit, else the manifest's for this axis, else the
    // manifest's first — `pad: "1.5rem"` answers for both axes of a design that
    // wrote `0`.
    const unit = axis.unit !== '' ? axis.unit : (declared?.[index] ?? declared?.[0])?.unit ?? '';

    if (unit === '') {
      return null;
    }

    const range = rangeFor({ amount: axis.amount, unit });
    const now = held[index];

    // A unitless amount is a zero ({@see measuresOf}), which is every unit at
    // once and always inside the range.
    if (now.unit !== '' && (now.unit !== unit || now.amount < range.min || now.amount > range.max)) {
      return null;
    }

    axes.push({ amount: now.amount, unit, range });
  }

  return axes;
}
