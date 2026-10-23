import { readFileSync } from 'node:fs';

// Licensed, local faces keep the inert catalogue preview deterministic and
// network-free. This does not change a merchant site's font-delivery consent.
const faces = [
  ['DM Sans', 400, 'dm-sans-400.ttf'],
  ['DM Sans', 700, 'dm-sans-700.ttf'],
  ['Instrument Serif', 400, 'instrument-serif-400.ttf'],
].map(([family, weight, file]) => ({ family, weight,
  css: `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(new URL(`../assets/fonts/${file}`, import.meta.url)).toString('base64')}) format("truetype");font-display:block}`,
}));

export function previewFonts(designs) {
  const requested = new Set(designs.flatMap(design => (design.tree?.fonts ?? [])
    .flatMap(font => font.faces.filter(face => !face.italic).map(face => `${font.family}:${face.weight}`))));
  return faces.filter(face => requested.has(`${face.family}:${face.weight}`)).map(face => face.css).join('\n');
}
