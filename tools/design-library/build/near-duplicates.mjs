import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyseDesigns } from './inventory.mjs';

/**
 * Two published designs that are the same design (ADR 0156, Phase 5).
 *
 * The inventory's similarity score was advisory; at 500 designs authored
 * mostly by agents, a near copy is the likeliest way the library fills with
 * noise. A pair is refused when all three agree, each catching what the
 * others miss:
 *
 * - **structure** — the inventory's canonical-tree score, words and styles out;
 * - **palette** — the background, text and accent tokens are near the same;
 * - **picture** — the rendered thumbnails' 64-bit difference hashes are close.
 *
 * A pair that is deliberate (a family, a variant someone chose) is listed in
 * `publishing/near-duplicates.json` with its reason.
 */
export const THRESHOLDS = { structure: 90, palette: 0.08, picture: 10 };

const rgb = value => {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value ?? '').trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map(c => c + c).join('') : match[1];
  return [0, 2, 4].map(at => parseInt(hex.slice(at, at + 2), 16));
};

/** The largest distance among the three tokens that carry a design's colour, 0–1; null when unknown. */
export function paletteDistance(a, b) {
  let worst = 0;
  for (const token of ['bg', 'fg', 'accent']) {
    const x = rgb(a?.[token]), y = rgb(b?.[token]);
    if (!x || !y) return null;
    worst = Math.max(worst, Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) / 441.7);
  }
  return worst;
}

export function hamming(a, b) {
  let bits = 0;
  for (let at = 0; at < a.length; at += 4) {
    let x = parseInt(a.slice(at, at + 4), 16) ^ parseInt(b.slice(at, at + 4), 16);
    while (x) { bits += x & 1; x >>= 1; }
  }
  return bits;
}

/**
 * @param designs {id, display_type, tree, tokens}[] the published designs
 * @param pictures Map<id, 16-hex dHash> where a thumbnail was rendered
 */
export function nearDuplicates(designs, pictures = new Map(), allowed = []) {
  const allow = new Set(allowed.map(pair => [pair.a, pair.b].sort().join('|')));
  const byId = new Map(designs.map(design => [design.id, design]));
  const found = new Map();
  for (const entry of analyseDesigns(designs)) {
    for (const near of entry.nearest) {
      if (near.score < THRESHOLDS.structure) continue;
      const a = byId.get(entry.id), b = byId.get(near.id);
      if (!b || a.display_type !== b.display_type) continue;
      const palette = paletteDistance(a.tokens, b.tokens);
      if (palette === null || palette > THRESHOLDS.palette) continue;
      const picture = pictures.has(a.id) && pictures.has(b.id) ? hamming(pictures.get(a.id), pictures.get(b.id)) : null;
      if (picture !== null && picture > THRESHOLDS.picture) continue;
      const key = [a.id, b.id].sort().join('|');
      if (!allow.has(key)) found.set(key, { a: key.split('|')[0], b: key.split('|')[1], structure: near.score, palette: Math.round(palette * 1000) / 1000, picture });
    }
  }
  return [...found.values()];
}

export function allowedPairs(root) {
  const file = resolve(root, 'tools/design-library/publishing/near-duplicates.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).pairs : [];
}
