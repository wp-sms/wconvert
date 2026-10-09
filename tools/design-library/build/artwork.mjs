import { readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { evidenceFile } from './reviews.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

/** Explicit reviewed derivatives, never an automatic build-time conversion. */
export function artworkExports(root, declarations = {}) {
  const allowed = realpathSync(resolve(root, 'tools/design-library/pilot/assets')) + sep;
  return Object.fromEntries(Object.entries(declarations).map(([sourceHash, declaration]) => {
    if (!/^[a-f0-9]{64}$/.test(sourceHash) || !/^[a-f0-9]{64}$/.test(declaration.sha256)
      || !['image/png', 'image/jpeg', 'image/webp'].includes(declaration.mime)) throw new Error('Invalid artwork export identity');
    const file = realpathSync(resolve(root, declaration.path));
    if (!file.startsWith(allowed)) throw new Error('Artwork export must stay in pilot/assets');
    const bytes = readFileSync(file);
    if (bytes.length > 5242880 || hash(bytes) !== declaration.sha256) throw new Error('Artwork export changed; review the new bytes');
    if (evidenceFile(root, declaration.evidence.path).sha256 !== declaration.evidence.sha256) throw new Error('Artwork export evidence changed');
    return [sourceHash, `data:${declaration.mime};base64,${bytes.toString('base64')}`];
  }));
}
