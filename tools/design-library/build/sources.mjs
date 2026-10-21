import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

/**
 * Every folder a design is authored in, and what delivers it (ADR 0156, ADR 0157).
 *
 * `free` ships in the Free ZIP and `pro` in the Pro ZIP. `hosted` ships in
 * neither: it lives under `/tools`, which `.distignore` keeps out of both, and
 * reaches a site only from the catalogue as a Free design to install.
 *
 * The one list every Node review and publishing tool reads. The PHP exporter,
 * the pilot and `bin/verify-templates.php` glob the same folders themselves.
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
      const { id, tier } = JSON.parse(readFileSync(path, 'utf8'));
      if (typeof id !== 'string' || id === '') throw new Error(`Design without an id: ${relative(root, path)}`);
      if (ships === 'hosted' && tier !== 'free') throw new Error(`Design ${id} is hosted but not tier free: ${relative(root, path)}`);
      if (sources.has(id)) throw new Error(`Design ${id} is authored twice: ${sources.get(id).path} and ${relative(root, path)}`);
      sources.set(id, { path: relative(root, path), ships });
    }
  }
  return sources;
}

/** Where setups (Playbooks) are authored; a hosted one ships in neither ZIP either. */
export const HOSTED_PLAYBOOKS = 'tools/design-library/hosted/playbooks';

function setupDirectories(root) {
  const modules = existsSync(resolve(root, 'pro/modules'))
    ? readdirSync(resolve(root, 'pro/modules'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => `pro/modules/${entry.name}/playbooks`)
    : [];
  return ['resources/playbooks', ...modules, HOSTED_PLAYBOOKS];
}

/** Every authored setup's id, sorted: what the catalogue numbers and may publish (ADR 0162). */
export function setupIds(root) {
  return [...new Set(setupDirectories(root).filter(dir => existsSync(resolve(root, dir)))
    .flatMap(dir => readdirSync(resolve(root, dir)).filter(name => name.endsWith('.php')).map(name => name.slice(0, -4))))].sort();
}

/** The absolute path of one setup's Playbook file. */
export function setupSource(root, id) {
  const files = setupDirectories(root).map(dir => resolve(root, dir, id + '.php')).filter(existsSync);
  if (files.length !== 1) throw new Error(`Missing or ambiguous setup: ${id}`);
  return files[0];
}

/** The absolute path of one design's source file. Pass `sources` when looking up many. */
export function designSource(root, id, sources = designSources(root)) {
  const source = sources.get(id);
  if (!source) throw new Error(`Unknown design: ${id}`);
  return resolve(root, source.path);
}
