import { __, sprintf } from '@wordpress/i18n';

/**
 * A color's plain name, for the swatch that shows it (ADR 0135).
 *
 * A swatch read "#2f4f37"; a merchant reads "Forest". The name is the nearest
 * of a small palette, measured in Lab so "near" means near to an eye, and a
 * color far from all of them is honestly a "Custom color" rather than the
 * least-wrong name. The hex is still there under Advanced.
 */
export function colorName(value: string): string {
  const rgba = channelsOf(value);

  if (rgba === null) {
    return __('Custom color', 'wconvert');
  }

  const [r, g, b, alpha] = rgba;
  const lab = labOf(r, g, b);
  let best: { name: () => string; distance: number } | null = null;

  for (const [hex, name] of PALETTE) {
    const [pr, pg, pb] = channelsOf(hex)!;
    const [l, a, bb] = labOf(pr, pg, pb);
    const distance = Math.hypot(lab[0] - l, lab[1] - a, lab[2] - bb);

    if (best === null || distance < best.distance) {
      best = { name, distance };
    }
  }

  if (best === null || best.distance > NEAR_ENOUGH) {
    return __('Custom color', 'wconvert');
  }

  return alpha < 1
    ? sprintf(/* translators: %s: a color name, e.g. “Navy”. */ __('%s, see-through', 'wconvert'), best.name())
    : best.name();
}

/** How far (ΔE, CIE76) a color may be from a name and still be called it. */
const NEAR_ENOUGH = 25;

const PALETTE: readonly (readonly [string, () => string])[] = [
  ['#ffffff', () => __('White', 'wconvert')],
  ['#000000', () => __('Black', 'wconvert')],
  ['#1f2023', () => __('Charcoal', 'wconvert')],
  ['#52525b', () => __('Slate', 'wconvert')],
  ['#808080', () => __('Gray', 'wconvert')],
  ['#c4c4c8', () => __('Silver', 'wconvert')],
  ['#e9e9ec', () => __('Mist', 'wconvert')],
  ['#a8a29e', () => __('Stone', 'wconvert')],
  ['#f5efe0', () => __('Cream', 'wconvert')],
  ['#e2d3b5', () => __('Sand', 'wconvert')],
  ['#3b2a20', () => __('Espresso', 'wconvert')],
  ['#7b4a2a', () => __('Brown', 'wconvert')],
  ['#b5502a', () => __('Rust', 'wconvert')],
  ['#7f1d1d', () => __('Maroon', 'wconvert')],
  ['#c62828', () => __('Red', 'wconvert')],
  ['#e11d48', () => __('Rose', 'wconvert')],
  ['#f9a8d4', () => __('Pink', 'wconvert')],
  ['#f97316', () => __('Orange', 'wconvert')],
  ['#f59e0b', () => __('Amber', 'wconvert')],
  ['#facc15', () => __('Yellow', 'wconvert')],
  ['#84cc16', () => __('Lime', 'wconvert')],
  ['#a7f3d0', () => __('Mint', 'wconvert')],
  ['#16a34a', () => __('Green', 'wconvert')],
  ['#2f4f37', () => __('Forest', 'wconvert')],
  ['#6b6b2a', () => __('Olive', 'wconvert')],
  ['#0f766e', () => __('Teal', 'wconvert')],
  ['#38bdf8', () => __('Sky', 'wconvert')],
  ['#2563eb', () => __('Blue', 'wconvert')],
  ['#0f172a', () => __('Navy', 'wconvert')],
  ['#4f46e5', () => __('Indigo', 'wconvert')],
  ['#ddd6fe', () => __('Lavender', 'wconvert')],
  ['#7e22ce', () => __('Purple', 'wconvert')],
  ['#5b2140', () => __('Plum', 'wconvert')],
];

/** Hex (3, 4, 6 or 8 digits) or rgb()/rgba() as 0–255 channels and an alpha, or null. */
function channelsOf(value: string): [number, number, number, number] | null {
  const color = value.trim();
  const hex = color.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];

  if (hex !== undefined) {
    const full = hex.length <= 4 ? Array.from(hex, (digit) => digit + digit).join('') : hex;
    const [r, g, b] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16));

    return [r, g, b, full.length === 8 ? parseInt(full.slice(6), 16) / 255 : 1];
  }

  const parts = color.match(/^rgba?\(([^()]+)\)$/i)?.[1].trim().split(/[\s,/]+/) ?? [];

  if (parts.length < 3 || parts.length > 4 || parts.some((part) => !/^(?:\d*\.)?\d+%?$/.test(part))) {
    return null;
  }

  const channel = (part: string, maximum: number) =>
    Math.min(maximum, Math.max(0, parseFloat(part) * (part.endsWith('%') ? maximum / 100 : 1)));
  const [r, g, b] = parts.slice(0, 3).map((part) => channel(part, 255));

  return [r, g, b, parts[3] === undefined ? 1 : channel(parts[3], 1)];
}

/** sRGB to CIE Lab (D65). */
function labOf(r: number, g: number, b: number): [number, number, number] {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);

  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
