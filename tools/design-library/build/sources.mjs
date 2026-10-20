import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

/**
 * Every folder a design is authored in, and what delivers it (ADR 0156, ADR 0157).
 *
 * `free` ships in the Free ZIP and `pro` in the Pro ZIP. `hosted` ships in
 * neither: it lives under `/tools`, which `.distignore` keeps out of both, and
 * reaches a site only from the catalogue as a Free design to install.
 *
 * The one list every review and publishing tool reads, so a new place to
 * author designs is added here once instead of in each reader.
 */
export const HOSTED = 'tools/design-library/hosted/templates';

export function designDirectories(root) {
  const modules = existsSync(resolve(root, 'pro/modules'))
    ? readdirSync(resolve(root, 'pro/modules'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
    : [];
  return [
    { dir: 'resources/templates/library', ships: 'free' },
    ...modules.map(module => ({ dir: `pro/modules/${module}/templates`, ships: 'pro' })),
    { dir: HOSTED, ships: 'hosted' },
  ].filter(({ dir }) => existsSync(resolve(root, dir)));
}

/** id → { path (relative to root), ships }. One id authored twice is refused. */
export function designSources(root) {
  const sources = new Map();
  for (const { dir, ships } of designDirectories(root)) {
    for (const file of readdirSync(resolve(root, dir)).filter(name => name.endsWith('.json')).sort()) {
      const path = resolve(root, dir, file);
      const { id } = JSON.parse(readFileSync(path, 'utf8'));
      if (typeof id !== 'string' || id === '') throw new Error(`Design without an id: ${relative(root, path)}`);
      if (sources.has(id)) throw new Error(`Design ${id} is authored twice: ${sources.get(id).path} and ${relative(root, path)}`);
      sources.set(id, { path: relative(root, path), ships });
    }
  }
  return sources;
}

/** The absolute path of one design's source file. */
export function designSource(root, id) {
  const source = designSources(root).get(id);
  if (!source) throw new Error(`Unknown design: ${id}`);
  return resolve(root, source.path);
}
