import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
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
 * campaign is listed for review. No decision is invented: nothing that was not
 * current under the base renderer is ever carried.
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
        images.push(createHash('sha256').update(await page.locator('#sample').screenshot({ animations: 'disabled' })).digest('hex'));
      }
      return images.join(',');
    };
    for (const entry of candidates) {
      let same = true;
      for (const width of [1200, 375]) same &&= (await shots(before, entry, width)) === (await shots(after, entry, width));
      report[same ? 'carried' : 'review'].push(entry.id);
    }
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
