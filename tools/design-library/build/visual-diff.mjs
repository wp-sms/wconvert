import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { renderedIdentities } from './rendered-identity.mjs';
import { campaignRevision } from './revision.mjs';
import { latestReview, loadReviews, writeReviews } from './reviews.mjs';

/**
 * After a renderer change, ask only about campaigns that LOOK different
 * (ADR 0156, Phase 5).
 *
 *   npm run templates:visual-diff -- --base origin/main [--apply]
 *
 * Builds the renderer at `--base` beside the current one and finds every
 * campaign whose decision was current under the base renderer's output and
 * whose content is unchanged — so only the renderer moved. Each of those is
 * rendered by both renderers, every screen and result variant, at desktop and
 * phone width, in one browser, and compared pixel for pixel. A campaign whose
 * pixels are identical everywhere is reported as carried; with `--apply` its
 * decision is carried by a new chained record that says so. Every other
 * campaign is listed for review, and `out/visual-diff.html` shows only its
 * changed screens, before beside after, so the reviewer judges the change
 * rather than the whole setup again. No decision is invented: nothing that was
 * not current under the base renderer is ever carried.
 */
const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const { values } = parseArgs({ options: { base: { type: 'string' }, apply: { type: 'boolean', default: false }, 'all-approved': { type: 'boolean', default: false } } });
// `--all-approved` compares every current approval too: a check of the tool, never applied.
if (values['all-approved'] && values.apply) throw new Error('--all-approved is a diagnostic and cannot be applied');
if (!values.base) throw new Error('Usage: npm run templates:visual-diff -- --base <git ref> [--apply]');
const scratch = mkdtempSync(join(tmpdir(), 'wconvert-visual-diff-'));
try {
  const tree = join(scratch, 'base');
  execFileSync('git', ['-C', root, 'worktree', 'add', '--detach', tree, values.base], { stdio: 'ignore' });
  try {
    if (!existsSync(join(tree, 'node_modules'))) symlinkSync(join(root, 'node_modules'), join(tree, 'node_modules'));
    execFileSync('node', [join(root, 'tools/design-library/build/renderer.mjs')], { cwd: root, stdio: 'ignore', env: { ...process.env, WCONVERT_PLUGIN: tree, WCONVERT_RENDERER_OUT: scratch } });
  } finally { execFileSync('git', ['-C', root, 'worktree', 'remove', '--force', tree], { stdio: 'ignore' }); }
  const before = readFileSync(join(scratch, 'renderer.iife.js'), 'utf8');
  const after = readFileSync(resolve(root, 'tools/design-library/out/renderer.iife.js'), 'utf8');
  const entries = JSON.parse(readFileSync(resolve(root, 'tools/design-library/out/pilot.json'), 'utf8'));
  const store = loadReviews(root);
  const old = renderedIdentities(before, entries);
  const candidates = entries.filter(entry => {
    const latest = latestReview(store, entry.id);
    if (values['all-approved']) return latest?.decision === 'approved' && latest.revision === entry.revision;
    return latest && latest.revision !== entry.revision && latest.revision === campaignRevision(entry, old.get(entry.id));
  });
  const browser = await chromium.launch();
  const report = { base: values.base, carried: [], review: [] };
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await page.route('**/*', route => route.abort());
    const shots = async (renderer, entry, width) => {
      await page.setViewportSize({ width, height: 900 });
      const images = [];
      for (const [index, step] of entry.tree.steps.entries()) for (const variant of step.results?.length ? step.results : [null]) {
        await page.setContent('<!doctype html><body style="margin:0"><div id="sample"></div></body>');
        await page.addScriptTag({ content: renderer });
        await page.evaluate(([tree, tokens, index, variant, required]) => {
          const api = window.WConvertRenderer, node = api.render(tree, tokens, index);
          if (variant) api.previewResult?.(node, variant, required);
          document.getElementById('sample').innerHTML = `<style>${api.SHADOW_CSS}</style>${node.outerHTML}`;
        }, [entry.tree, entry.tokens ?? {}, index, variant, step.products_required]);
        await page.evaluate(async () => { await document.fonts.ready; });
        const png = await page.locator('#sample').screenshot({ animations: 'disabled' });
        images.push({ label: `${step.name ?? step.id}${variant ? ' · ' + (variant.heading ?? variant.id) : ''} · ${width}px`, png, hash: createHash('sha256').update(png).digest('hex') });
      }
      return images;
    };
    const changes = [];
    for (const entry of candidates) {
      const changed = [];
      for (const width of [1200, 375]) {
        const old = await shots(before, entry, width), now = await shots(after, entry, width);
        now.forEach((shot, index) => { if (shot.hash !== old[index]?.hash) changed.push({ label: shot.label, before: old[index]?.png, after: shot.png }); });
      }
      report[changed.length ? 'review' : 'carried'].push(entry.id);
      if (changed.length) changes.push({ id: entry.id, name: entry.name, changed });
    }
    // Only what moved, before beside after: the reviewer judges the change, not the whole setup again.
    const data = image => image ? `<img src="data:image/png;base64,${image.toString('base64')}" alt="">` : '<p>(no screen)</p>';
    const html = `<!doctype html><meta charset="utf-8"><title>Visual diff · ${values.base}</title><style>body{font:14px system-ui;margin:24px;background:#f6f4ee}h2{margin:32px 0 8px}figure{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:0 0 24px}img{max-width:100%;border:1px solid #ccc;background:#fff}</style>`
      + `<h1>${changes.length} setups look different from ${values.base}</h1>`
      + changes.map(item => `<h2>${item.name} <small>${item.id}</small></h2>` + item.changed.map(change => `<p>${change.label}</p><figure>${data(change.before)}${data(change.after)}</figure>`).join('')).join('');
    mkdirSync(resolve(root, 'tools/design-library/out'), { recursive: true });
    writeFileSync(resolve(root, 'tools/design-library/out/visual-diff.html'), html);
    report.page = 'tools/design-library/out/visual-diff.html';
  } finally { await browser.close(); }
  if (values.apply && report.carried.length) {
    const next = structuredClone(store), at = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    for (const id of report.carried) {
      const latest = latestReview(store, id), entry = entries.find(item => item.id === id);
      const body = { id, revision: entry.revision, base_id: latest.record_id, decision: latest.decision, reviewer: 'Visual diff (ADR 0156)',
        note: `Pixel-identical to the decision this follows under the renderer at ${values.base}, every screen at 1200 and 375 px; content unchanged. Not a new review.`, at, checks: latest.checks };
      next.records.push({ ...body, record_id: createHash('sha256').update(JSON.stringify(body)).digest('hex') });
    }
    report.written = writeReviews(root, store, next);
  }
  console.log(JSON.stringify(report, null, 2));
} finally { rmSync(scratch, { recursive: true, force: true }); }
