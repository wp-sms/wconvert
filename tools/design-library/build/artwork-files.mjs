import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * A bundled design names each photo once, as a file (ADR 0161, amended by
 * ADR 0172): an image's `src` is `artwork:<sha256>.webp`, a background is
 * `url("artwork:<sha256>.webp")`, and the bytes live in the ZIP's own
 * `template-artwork/` folder. The JavaScript twin of
 * `src/Template/BundledArtwork.php`.
 */
export const REFERENCE = /^artwork:([a-f0-9]{64})\.(webp|png|jpg)$/;

/** The folder each ZIP's photos ship in. */
export const ARTWORK_DIRECTORIES = { free: 'resources/template-artwork', pro: 'pro/resources/template-artwork' };

const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' };

/** The file one reference names, verified against its name. Free's folder first: a name is its bytes, so either copy is the same. */
export function artworkBytes(root, reference) {
  const match = reference.match(REFERENCE);
  if (!match) throw new Error(`Not an artwork reference: ${reference}`);
  for (const directory of Object.values(ARTWORK_DIRECTORIES)) {
    const file = resolve(root, directory, reference.slice('artwork:'.length));
    if (!existsSync(file)) continue;
    const bytes = readFileSync(file);
    if (createHash('sha256').update(bytes).digest('hex') !== match[1]) throw new Error(`Bundled artwork was altered: ${reference}`);
    return { bytes, mime: MIME[match[2]] };
  }
  throw new Error(`Bundled artwork is missing: ${reference}`);
}

/**
 * The design with every artwork reference written back as a data URI: what a
 * renderer outside WordPress, the exporter and the studio draw from. Anything
 * else — an inline SVG, a gradient, a merchant URL — is left as it is.
 */
export function inlineArtwork(design, root) {
  const inline = reference => {
    const { bytes, mime } = artworkBytes(root, reference);
    return `data:${mime};base64,${bytes.toString('base64')}`;
  };
  const walk = value => {
    if (typeof value === 'string') {
      if (REFERENCE.test(value)) return inline(value);
      const background = value.match(/^url\((["']?)(artwork:[^"')]+)\1\)$/);
      return background && REFERENCE.test(background[2]) ? `url("${inline(background[2])}")` : value;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
    return value;
  };
  return walk(design);
}

/** Every artwork reference in a design, as `artwork:<name>`. */
export function artworkReferences(design) {
  return [...new Set(JSON.stringify(design).match(/artwork:[a-f0-9]{64}\.(?:webp|png|jpg)/g) ?? [])];
}
