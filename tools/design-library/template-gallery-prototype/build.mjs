// PROTOTYPE build: inlines the shipping renderer and the real setups into one page.
// node build.mjs  (run from anywhere; PLUGIN points at the repo)
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = '/Users/navidkashani/Local Sites/wconvert/app/public/wp-content/plugins/wconvert';
const LIB = resolve(PLUGIN, 'tools/design-library/out');

const campaigns = JSON.parse(readFileSync(resolve(LIB, 'all-campaigns.json'), 'utf8'));
const renderer = readFileSync(resolve(LIB, 'renderer.iife.js'), 'utf8');

// Where each setup lives decides how a site gets it.
const sources = [
  ['bundled', resolve(PLUGIN, 'resources/playbooks')],
  ...readdirSync(resolve(PLUGIN, 'pro/modules')).map(m => ['pro', resolve(PLUGIN, 'pro/modules', m, 'playbooks')]),
  ['online', resolve(PLUGIN, 'tools/design-library/hosted/playbooks')],
];
const meta = {};
for (const [src, dir] of sources) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.php'))) {
    const php = readFileSync(resolve(dir, f), 'utf8');
    const id = (php.match(/'id'\s*=>\s*'([^']+)'/) || [])[1] || basename(f, '.php');
    const biz = (php.match(/'business_types'\s*=>\s*\[([^\]]*)\]/) || [])[1];
    meta[id] = { src, biz: biz ? [...biz.matchAll(/'([a-z]+)'/g)].map(m => m[1]) : [] };
  }
}

// Design names and catalogue tags, keyed by design id.
const designNames = {};
for (const dir of ['resources/templates/library', 'tools/design-library/hosted/templates', ...readdirSync(resolve(PLUGIN, 'pro/modules')).map(m => `pro/modules/${m}/templates`)]) {
  const abs = resolve(PLUGIN, dir);
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs).filter(f => f.endsWith('.json'))) {
    try { const d = JSON.parse(readFileSync(resolve(abs, f), 'utf8')); if (d.id) designNames[d.id] = d.name; } catch {}
  }
}
const idxDir = resolve(LIB, 'local-catalogue/v3/index');
const idxFile = readdirSync(idxDir).map(f => resolve(idxDir, f)).sort((a, b) => readFileSync(b).length - readFileSync(a).length)[0];
const catalogue = {};
for (const d of JSON.parse(readFileSync(idxFile, 'utf8')).details) catalogue[d.id] = { industries: d.industries, occasions: d.occasions, style: d.style, thumb: d.thumb };

const FLAGSHIP = ['welcome-discount', 'coupon-ticket', 'sale-announcement', 'cart-straight-away', 'read-to-the-end', 'article-end-newsletter', 'guide-download', 'reading-recommendation', 'request-a-callback', 'request-a-quote', 'consultation-invitation', 'launch-checklist'];

function walk(node, fn) {
  if (Array.isArray(node)) node.forEach(n => walk(n, fn));
  else if (node && typeof node === 'object') { fn(node); Object.values(node).forEach(v => walk(v, fn)); }
}

// One copy of each embedded picture; the page puts them back before drawing.
const images = [];
const imageIndex = new Map();
const dedupe = s => s.replace(/data:[a-z/+]+;base64,[A-Za-z0-9+/=]+/g, uri => {
  if (!imageIndex.has(uri)) { imageIndex.set(uri, images.length); images.push(uri); }
  return `wcimg:${imageIndex.get(uri)}`;
});

const out = campaigns.map(c => {
  const fields = new Set(); let hasImage = false; let hasButton = false; let products = false;
  walk(c.tree.steps[0], n => {
    if (n.type === 'field' && n.name) fields.add(n.name);
    if (n.type === 'image' || n.type === 'media') hasImage = true;
    if (n.type === 'button') hasButton = true;
    if (n.type === 'products') products = true;
  });
  if (Object.keys(c.tokens).some(k => /image/.test(k) && /url\(/.test(String(c.tokens[k])))) hasImage = true;
  const caps = ['email', 'phone', 'name'].filter(f => fields.has(f));
  const m = meta[c.id] || { src: 'online', biz: [] };
  const gist = (c.notes || '').split(/(?<=[.!?])\s/)[0];
  return {
    id: c.id, name: c.name, goal: c.goal, dt: c.display_type, tpl: c.template_id, dname: designNames[c.template_id] || c.template_id,
    tier: c.tier, dtier: c.design_tier, src: m.src, biz: m.biz, caps, click: caps.length === 0 && hasButton,
    shape: c.tree.steps[0]?.content?.type || 'stack', img: hasImage, products, steps: c.tree.steps.map(s => s.name || s.id),
    rec: FLAGSHIP.includes(c.id) ? FLAGSHIP.indexOf(c.id) : -1, gist, tags: catalogue[c.template_id] ? { ...catalogue[c.template_id], thumb: undefined } : null,
    tree: c.tree, tokens: c.tokens,
  };
});

const collections = readdirSync(resolve(PLUGIN, 'resources/collections')).filter(f => f.endsWith('.json')).map(f => {
  const c = JSON.parse(readFileSync(resolve(PLUGIN, 'resources/collections', f), 'utf8'));
  return { id: c.id, name: c.name, desc: c.description, biz: c.business_types, priority: c.priority, event: c.event ? { start: c.event.start, end: c.event.end_exclusive, from: c.event.feature_start, until: c.event.feature_end_exclusive } : null, items: c.items.map(i => ({ id: i.setup_id, stage: i.stage })) };
}).sort((a, b) => b.priority - a.priority);

// Catalogue-style pictures (thumbs.cjs) as files beside the page, plus three real catalogue thumbs to check them against.
const PUB = resolve(HERE, 'pub'); mkdirSync(resolve(PUB, 'thumbs'), { recursive: true });
const thumbs = {};
for (const f of readdirSync(resolve(HERE, 'thumbs')).filter(f => f.endsWith('.json'))) {
  const id = basename(f, '.json'), t = JSON.parse(readFileSync(resolve(HERE, 'thumbs', f), 'utf8'));
  writeFileSync(resolve(PUB, 'thumbs', `${id}.webp`), Buffer.from(t.x1.split(',')[1], 'base64'));
  writeFileSync(resolve(PUB, 'thumbs', `${id}@2x.webp`), Buffer.from(t.x2.split(',')[1], 'base64'));
  thumbs[id] = { w: t.w, h: t.h };
}
const real = {};
for (const id of ['inline-cta', 'bar-announcement', 'slide-in-question']) {
  const t = catalogue[id]?.thumb; if (!t) continue;
  for (const [name, sha] of [[`${id}.webp`, t.sha], [`${id}@2x.webp`, t.sha + '@2x']]) {
    const src = resolve(LIB, 'local-catalogue/v3/thumbs', `${sha}.webp`);
    if (existsSync(src)) writeFileSync(resolve(PUB, 'thumbs', `real-${name}`), readFileSync(src));
  }
  real[id] = { w: t.width, h: t.height };
}

const data = dedupe(JSON.stringify({ campaigns: out, collections }));
const page = readFileSync(resolve(HERE, 'template.html'), 'utf8')
  .replace('/*__RENDERER__*/', () => renderer)
  .replace('/*__DATA__*/', () => `var DATA=${data};var IMAGES=${JSON.stringify(images)};var THUMBS=${JSON.stringify(thumbs)};var REAL=${JSON.stringify(real)};`);
writeFileSync(resolve(PUB, 'template-gallery.html'), page);
console.log(`${out.length} setups, ${collections.length} collections, ${images.length} images, pictures: ${Object.keys(thumbs).length}, ${(page.length / 1e6).toFixed(1)} MB`);
const by = {}; out.forEach(c => { by[c.src + '/' + c.tier] = (by[c.src + '/' + c.tier] || 0) + 1; }); console.log(by);
