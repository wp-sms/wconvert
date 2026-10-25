import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { designDirectories } from './sources.mjs';
import { ARTWORK_DIRECTORIES } from './artwork-files.mjs';

/**
 * Store every bundled photo once, as an optimised file (ADR 0172).
 *
 *   node tools/design-library/build/extract-artwork.mjs          # rewrite
 *   node tools/design-library/build/extract-artwork.mjs --check  # list, write nothing
 *
 * Each raster data URI in a Free or Pro design is re-saved with `cwebp` at the
 * same pixel size, written to that ZIP's `template-artwork/` as
 * `<sha256>.webp`, and the design names it `artwork:<sha256>.webp`. The rights
 * record moves to the new bytes' hash; the old one stays while a hosted design
 * still embeds those bytes. Files no bundled design names are deleted: a
 * campaign holds its own Media Library copy (ADR 0161) and the catalogue keeps
 * every asset it ever served. Hosted designs are left alone — the exporter
 * already splits their pictures. Run it again after authoring a new photo; it
 * changes nothing when every photo is already a file.
 */
const DATA_URI = /data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)/g;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** The smaller of the candidates, never larger than the source when it is already WebP. */
function optimise(bytes, mime, scratch) {
  const source = join(scratch, `source.${mime === 'image/jpeg' ? 'jpg' : mime.slice(6)}`);
  writeFileSync(source, bytes);
  const encode = (name, flags) => {
    const out = join(scratch, name);
    execFileSync('cwebp', ['-quiet', '-metadata', 'none', '-m', '6', ...flags, source, '-o', out]);
    return readFileSync(out);
  };
  const candidates = [encode('lossy.webp', ['-q', '75'])];
  // A flat drawing (a checker, a badge) is smaller lossless, and stays exact.
  if (mime === 'image/png') candidates.push(encode('lossless.webp', ['-lossless']));
  if (mime === 'image/webp') candidates.push(bytes);
  return candidates.reduce((best, candidate) => candidate.length < best.length ? candidate : best);
}

export function extractArtwork(root, { write = true } = {}) {
  const scratch = mkdtempSync(join(tmpdir(), 'wconvert-artwork-'));
  const converted = new Map(); // source sha256 → { bytes, name, before }
  const referenced = { free: new Set(), pro: new Set() };
  const rewritten = [];
  try {
    for (const { dir, ships } of designDirectories(root).filter(({ ships }) => ships !== 'hosted')) {
      for (const file of readdirSync(resolve(root, dir)).filter(name => name.endsWith('.json')).sort()) {
        const path = resolve(root, dir, file);
        const text = readFileSync(path, 'utf8');
        const next = text.replace(DATA_URI, (_, type, base64) => {
          const bytes = Buffer.from(base64, 'base64');
          const key = sha(bytes);
          if (!converted.has(key)) {
            const optimised = optimise(bytes, `image/${type}`, scratch);
            converted.set(key, { bytes: optimised, name: `${sha(optimised)}.webp`, before: bytes.length });
          }
          return `artwork:${converted.get(key).name}`;
        });
        for (const name of next.match(/artwork:[a-f0-9]{64}\.(?:webp|png|jpg)/g) ?? []) referenced[ships].add(name.slice('artwork:'.length));
        if (next !== text) {
          rewritten.push(`${dir}/${file}`);
          if (write) writeFileSync(path, next);
        }
      }
    }
    for (const [ships, names] of Object.entries(referenced)) {
      for (const { bytes, name } of converted.values()) if (write && names.has(name)) writeFileSync(resolve(root, ARTWORK_DIRECTORIES[ships], name), bytes);
    }
    const orphans = Object.entries(ARTWORK_DIRECTORIES).flatMap(([ships, directory]) => readdirSync(resolve(root, directory))
      .filter(name => /^[a-f0-9]{64}\.(webp|png|jpg)$/.test(name) && !referenced[ships].has(name)).map(name => `${directory}/${name}`));
    if (write) for (const orphan of orphans) unlinkSync(resolve(root, orphan));
    const rights = write ? rekeyRights(root, converted) : [];
    return { rewritten, converted: [...converted.values()], orphans, rights };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * `image_rights` is keyed by a raster's sha256 (`export-designs.php`). The new
 * bytes are the same picture, so they carry its record; the old key goes only
 * when no hosted design still embeds those bytes.
 */
function rekeyRights(root, converted) {
  const path = resolve(root, 'tools/design-library/publishing/catalog.json');
  const catalog = JSON.parse(readFileSync(path, 'utf8'));
  const hosted = new Set();
  for (const { dir } of designDirectories(root).filter(({ ships }) => ships === 'hosted')) {
    for (const file of readdirSync(resolve(root, dir)).filter(name => name.endsWith('.json'))) {
      for (const [, , base64] of readFileSync(resolve(root, dir, file), 'utf8').matchAll(DATA_URI)) hosted.add(sha(Buffer.from(base64, 'base64')));
    }
  }
  const moved = [];
  for (const [old, { bytes }] of converted) {
    const record = catalog.image_rights[old];
    if (!record) continue;
    catalog.image_rights[sha(bytes)] = record;
    if (!hosted.has(old) && sha(bytes) !== old) delete catalog.image_rights[old];
    moved.push(old);
  }
  catalog.image_rights = Object.fromEntries(Object.entries(catalog.image_rights).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(path, JSON.stringify(catalog, null, 2) + '\n');
  return moved;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
  const write = !process.argv.includes('--check');
  const size = directory => readdirSync(resolve(root, directory)).reduce((total, name) => total + statSync(resolve(root, directory, name)).size, 0);
  const result = extractArtwork(root, { write });
  const before = result.converted.reduce((total, item) => total + item.before, 0);
  const after = result.converted.reduce((total, item) => total + item.bytes.length, 0);
  console.log(`${result.converted.length} photo(s) in ${result.rewritten.length} design(s): ${before} → ${after} bytes.`);
  if (result.orphans.length) console.log(`${write ? 'Deleted' : 'Would delete'} ${result.orphans.length} unreferenced file(s):\n  ${result.orphans.join('\n  ')}`);
  if (write) console.log(`Rights moved for ${result.rights.length} photo(s). Folders now: ${Object.values(ARTWORK_DIRECTORIES).map(directory => `${directory} ${size(directory)} B`).join(', ')}.`);
  if (!write && result.rewritten.length) process.exitCode = 1;
}
