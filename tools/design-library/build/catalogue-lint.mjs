import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;
const BASELINE = 'tools/design-library/publishing/colour-baseline.json';

/**
 * Colour inside a design belongs in its top-level tokens, so a later Brand
 * setting can restyle every design by rewriting those (ADR 0156). A literal
 * colour in a node's own `tokens` or `narrow` bag is invisible to that.
 *
 * Existing designs are a ratchet, not a cliff: `colour-baseline.json` records
 * how many each already has, and a design may only go down. A new design
 * starts at zero.
 */
export function literalColours(design) {
  let count = 0;
  const walk = node => {
    for (const bag of ['tokens', 'narrow']) for (const value of Object.values(node[bag] ?? {})) if (typeof value === 'string' && LITERAL.test(value)) count++;
    for (const key of ['children', 'start', 'end']) for (const child of node[key] ?? []) walk(child);
  };
  for (const step of design.tree?.steps ?? []) if (step.content) walk(step.content);
  return count;
}

function sourceOf(root, id) {
  const files = [resolve(root, 'resources/templates/library', id + '.json'),
    ...readdirSync(resolve(root, 'pro/modules')).map(module => resolve(root, 'pro/modules', module, 'templates', id + '.json'))].filter(existsSync);
  return JSON.parse(readFileSync(files[0], 'utf8'));
}

export function literalColourReport(root, ids) {
  const baseline = existsSync(resolve(root, BASELINE)) ? JSON.parse(readFileSync(resolve(root, BASELINE), 'utf8')).designs : {};
  const rows = ids.map(id => ({ id, count: literalColours(sourceOf(root, id)), baseline: baseline[id] ?? 0 }));
  return { total: rows.reduce((sum, row) => sum + row.count, 0), increased: rows.filter(row => row.count > row.baseline) };
}

// `node catalogue-lint.mjs --record` lowers (never raises) the baseline to today's counts.
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--record')) {
  const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
  const ids = [...readdirSync(resolve(root, 'resources/templates/library')), ...readdirSync(resolve(root, 'pro/modules')).flatMap(module => existsSync(resolve(root, 'pro/modules', module, 'templates')) ? readdirSync(resolve(root, 'pro/modules', module, 'templates')) : [])]
    .filter(file => file.endsWith('.json')).map(file => file.slice(0, -5)).sort();
  const previous = existsSync(resolve(root, BASELINE)) ? JSON.parse(readFileSync(resolve(root, BASELINE), 'utf8')).designs : null;
  const designs = {};
  for (const id of ids) {
    const count = literalColours(sourceOf(root, id));
    const allowed = previous === null ? count : Math.min(count, previous[id] ?? 0);
    if (allowed > 0) designs[id] = allowed;
  }
  writeFileSync(resolve(root, BASELINE), JSON.stringify({ _note: 'Literal colours each design already had in node-level tokens on 2026-10-20. A design may only go down; new designs start at zero. Lower with node tools/design-library/build/catalogue-lint.mjs --record.', designs }, null, 2) + '\n');
  console.log(`${Object.keys(designs).length} designs keep a baseline.`);
}
