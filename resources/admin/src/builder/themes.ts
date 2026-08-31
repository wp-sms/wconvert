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
        muted: '#8a7361',
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
 * Read off the value, like {@link isColour} and {@link measureOf}, and for the
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
 * A token's value as **one plain number and unit**, or null.
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
 */
export function measureOf(value: string): { readonly amount: number; readonly unit: string } | null {
  const found = /^(-?\d*\.?\d+)(px|rem|em|%|ch|vw|vh)$/.exec(value.trim());

  if (found === null) {
    return null;
  }

  return { amount: Number(found[1]), unit: found[2] };
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
 */
export function rangeFor(measure: { amount: number; unit: string }): {
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
