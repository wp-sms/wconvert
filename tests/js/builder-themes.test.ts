import { describe, expect, it } from 'vitest';
import vocabulary from '../../resources/templates/manifest.json';
import { AA_NORMAL, contrastOf } from '../../resources/admin/src/builder/contrast';
import { isApplied, isColour, isTranslucent, themePresets } from '../../resources/admin/src/builder/themes';

/**
 * The theme presets, against the two claims they have to keep.
 *
 * **A preset is a bundle of token values and nothing else** (#71), so it
 * changes no shape and needs no new vocabulary — which is what lets it fix the
 * panel that asked a merchant for `rgba(15, 23, 42, 0.55)` in a text box
 * WITHOUT moving ADR 0010's boundary. A preset naming something the manifest
 * does not declare would be exactly that boundary moving, silently: PHP drops
 * the unknown key on the way in, so the preset would half-apply and the merchant
 * would watch two of six colours change.
 */

const TOKENS = vocabulary.tokens as Readonly<Record<string, string>>;

describe('a theme preset', () => {
  /** The manifest is the closed vocabulary, and a preset lives inside it. */
  it('names only tokens the manifest declares', () => {
    for (const preset of themePresets()) {
      for (const name of Object.keys(preset.tokens)) {
        expect(TOKENS).toHaveProperty(name);
      }
    }
  });

  /**
   * **Colours and corners only.** Type, spacing and width belong to the DESIGN
   * — a centred card and a wide banner do not want the same measure — so a
   * preset that set them would quietly restyle the layout the merchant chose in
   * the gallery.
   */
  it('sets nothing that would restyle the layout the gallery chose', () => {
    for (const preset of themePresets()) {
      for (const name of Object.keys(preset.tokens)) {
        expect(['font', 'heading-size', 'text-size', 'pad', 'gap', 'width', 'align']).not.toContain(name);
      }
    }
  });

  /** Three or four ready looks, each distinguishable from the others (#71). */
  /**
   * ==========================================================================
   * A PRESET THAT CANNOT BE READ IS NOT A PRESET, IT IS A BUG WITH A NAME.
   * ==========================================================================
   * Four presets could be eyeballed. Twelve cannot, and the failure is not
   * loud: a `muted` two points under AA looks like a design choice on the
   * author's monitor and is unreadable fine print on somebody's phone in
   * daylight — and `muted` is the token the **consent wording and the
   * unsubscribe line** are set in, which are the two sentences that most have
   * to be read.
   *
   * All three pairs, because each is a different reading job:
   *
   * - `fg` on `bg` — the headline and the body.
   * - `muted` on `bg` — the fine print. Held to AA NORMAL and not to the large
   *   text threshold, because fine print is the opposite of large.
   * - `accent-fg` on `accent` — the button label, which is the one piece of
   *   text a visitor has to read to convert.
   *
   * The border is not checked: it is a line rather than text, and holding a
   * hairline to a text contrast ratio would mean no design could have a subtle
   * one. The backdrop is not checked either — it is translucent, and
   * `contrastOf` correctly refuses a colour that composites over something it
   * cannot see.
   */
  it('is readable in all three of the pairs that carry text', () => {
    for (const preset of themePresets()) {
      const pairs: ReadonlyArray<readonly [string, string, string]> = [
        ['fg', preset.tokens.fg ?? '', preset.tokens.bg ?? ''],
        ['muted', preset.tokens.muted ?? '', preset.tokens.bg ?? ''],
        ['accent-fg', preset.tokens['accent-fg'] ?? '', preset.tokens.accent ?? ''],
      ];

      for (const [name, ink, ground] of pairs) {
        const ratio = contrastOf(ink, ground);

        expect(ratio, `${preset.id}: ${name} (${ink}) on ${ground} could not be read as two opaque colours`).not.toBeNull();
        expect(
          ratio ?? 0,
          `${preset.id}: ${name} (${ink}) on ${ground} is ${(ratio ?? 0).toFixed(2)}:1, under AA`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    }
  });

  it('offers several, and none of them is another one', () => {
    const presets = themePresets();

    expect(presets.length).toBeGreaterThanOrEqual(3);
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(presets.length);
    expect(new Set(presets.map((preset) => JSON.stringify(preset.tokens))).size).toBe(presets.length);
  });

  /**
   * **Which one is current is COMPUTED, never stored.** A stored name would be
   * a link, and a link is what would let a later edit to `themes.ts` restyle an
   * Optin already running — the surprise ADR 0010 keeps a Template's snapshot
   * away from.
   */
  it('is current when the Optin wears every value it sets, and not otherwise', () => {
    const [first, second] = themePresets();

    expect(isApplied(first, { ...first.tokens })).toBe(true);
    expect(isApplied(first, { ...first.tokens, bg: '#123456' })).toBe(false);
    expect(isApplied(first, {})).toBe(false);
    expect(isApplied(second, { ...first.tokens })).toBe(false);
  });

  /** Tokens the preset does not name are the merchant's, and it keeps them. */
  it('stays current over a token it never claimed', () => {
    const [first] = themePresets();

    expect(isApplied(first, { ...first.tokens, width: '40rem' })).toBe(true);
  });
});

/**
 * Which control a token gets is read off the manifest's own fallback rather
 * than from a list spelled in the panel, so a token added to the manifest
 * arrives wearing the right control with nothing edited.
 */
describe('what a token holds', () => {
  it('recognises the shipped colours as colours', () => {
    for (const name of ['bg', 'fg', 'muted', 'accent', 'accent-fg', 'border', 'backdrop']) {
      expect(isColour(TOKENS[name] ?? '')).toBe(true);
    }
  });

  it('leaves type, measures and alignment as typed values', () => {
    for (const name of ['font', 'heading-size', 'text-size', 'radius', 'pad', 'gap', 'width', 'align']) {
      expect(isColour(TOKENS[name] ?? '')).toBe(false);
    }
  });

  /**
   * The backdrop is the one token with an alpha channel, and it is exactly the
   * one a merchant wants a slider for: "how dark is the page behind the popup"
   * is unanswerable by typing a fourth number into `rgba()`.
   */
  it('gives the backdrop the picker that has an alpha channel', () => {
    expect(isTranslucent(TOKENS.backdrop ?? '')).toBe(true);
    expect(isTranslucent(TOKENS.bg ?? '')).toBe(false);
  });
});
