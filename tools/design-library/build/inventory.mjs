import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';

/** Discover every module; a malformed source must fail the review build. */
export function readDesigns(root) {
  const directories = ['resources/templates/library', ...readdirSync(resolve(root, 'pro/modules'), { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => `pro/modules/${entry.name}/templates`)];
  const ids = new Set();
  return directories.filter(dir => existsSync(resolve(root, dir))).flatMap(dir =>
    readdirSync(resolve(root, dir)).filter(name => name.endsWith('.json')).sort().map(name => {
      const path = resolve(root, dir, name);
      const design = JSON.parse(readFileSync(path, 'utf8'));
      if (!design.id || !design.tree || ids.has(design.id)) throw new Error(`Missing or repeated design: ${path}`);
      ids.add(design.id);
      return { ...design, source: relative(root, path) };
    }));
}

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value;
const COPY = new Set(['text', 'label', 'placeholder', 'help', 'src', 'alt', 'href', 'link_label', 'heading', 'body', 'emphasis', 'italic', 'details_note', 'copy_label', 'copied_label', 'copy_failed_label']);

/** IDs are renamed consistently, including conditional and submission references. */
export function canonicalDesign(design, includeStyle = false) {
  const ids = new Map();
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.id === 'string' && !ids.has(value.id)) ids.set(value.id, `ref${ids.size}`);
    Object.values(value).forEach(collect);
  }
  collect(design.tree);
  function normal(value, key = '') {
    if (Array.isArray(value)) return value.map(item => normal(item, key));
    if (!value || typeof value !== 'object') return ['id', 'question', 'submission', 'fields', 'consents', 'to'].includes(key) && ids.has(value) ? ids.get(value) : value;
    return Object.fromEntries(Object.entries(value).filter(([k]) =>
      !COPY.has(k) && k !== 'name' && (includeStyle || !['tokens', 'narrow'].includes(k)))
      .map(([k, v]) => [k, normal(v, k)]));
  }
  // Field names and screen kind/action remain meaningful even though display names do not.
  function preserveFields(original, target) {
    if (!original || typeof original !== 'object') return;
    if (['field', 'icon'].includes(original.type)) target.name = original.name;
    for (const [key, value] of Object.entries(original)) if (target[key] && typeof value === 'object') preserveFields(value, target[key]);
  }
  const tree = normal(design.tree);
  preserveFields(design.tree, tree);
  return sort({ display_type: design.display_type, tree, ...(includeStyle ? { tokens: design.tokens } : {}) });
}

function features(value, path = '', result = new Set()) {
  if (Array.isArray(value)) value.forEach((item, index) => features(item, `${path}/${index}`, result));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => features(item, `${path}/${key}`, result));
  else result.add(`${path}:${value}`);
  return result;
}

export function analyseDesigns(designs) {
  const entries = designs.map(design => {
    const canonical = canonicalDesign(design);
    return { id: design.id, name: design.name, source: design.source, display_type: design.display_type, tier: design.tier,
      screens: design.tree.steps.length, fingerprint: hash(canonicalDesign(design, true)), structure: hash(canonical), features: features(canonical) };
  });
  return entries.map(entry => ({ ...entry, features: undefined,
    nearest: entries.filter(other => other.id !== entry.id).map(other => {
      const intersection = [...entry.features].filter(feature => other.features.has(feature)).length;
      return { id: other.id, name: other.name, score: Math.round(100 * intersection / (entry.features.size + other.features.size - intersection)),
        same_structure: entry.structure === other.structure, same_design: entry.fingerprint === other.fingerprint };
    }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 5) }));
}
