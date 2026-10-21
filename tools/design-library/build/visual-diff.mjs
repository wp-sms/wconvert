import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { renderedIdentities } from './rendered-identity.mjs';
import { SAMPLE_DEADLINE, SAMPLE_ERROR, SAMPLE_NOW, drawWithChrome } from './chrome.mjs';
import { carryCollections } from './collections.mjs';
import { campaignRevision } from './revision.mjs';
import { evidenceFile, latestReview, loadReviews, reviewQueue, writeReviews } from './reviews.mjs';

/**
 * After a renderer change, ask only about campaigns that LOOK different
 * (ADR 0156, Phase 5).
 *
 *   npm run templates:visual-diff -- [--base <git ref>] [--apply]
 *
 * `--base` defaults to where this branch left `origin/main`, which is what
 * `templates:releasable` asks for. Builds the renderer at `--base` beside the
 * current one and finds every
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
 *
 * Every screen is drawn as a visitor meets it — with the close control, a
 * refused first field and a countdown painted at a fixed clock
 * ({@link drawWithChrome}) — so "pixel-identical" covers the three pieces a
 * design colours (ADR 0159). With `--apply`, each Collection whose setups were
 * all carried is carried too, with a note under `docs/reviews/` as its
 * evidence, and the runtime Collections are republished
 * (`templates:collections:publish`).
 */
/**
 * Campaigns whose decision was current under the base renderer and whose
 * content is unchanged, so only the renderer moved. `previous` gives each
 * campaign's revision under the base renderer, one per identity scheme it may
 * have been reviewed under. Nothing that was not current there is a candidate.
 */
export function carryCandidates(entries, store, previous) {
  return entries.filter(entry => {
    const latest = latestReview(store, entry.id);
    return latest && latest.revision !== entry.revision && previous.get(entry.id).includes(latest.revision);
  });
}

/** One chained record per pixel-identical campaign, carrying its decision and evidence. */
export function carriedRecords({ carried, entries, store, base, at }) {
  return carried.map(id => {
    const latest = latestReview(store, id), entry = entries.find(item => item.id === id);
    const body = { id, revision: entry.revision, base_id: latest.record_id, decision: latest.decision, reviewer: 'Visual diff (ADR 0156)',
      note: `Pixel-identical to the decision this follows under the renderer at ${base}, every screen at 1200 and 375 px with the close control, an error and the countdown drawn; content unchanged. Not a new review.`, at, checks: latest.checks };
    return { ...body, record_id: createHash('sha256').update(JSON.stringify(body)).digest('hex') };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
  const { values } = parseArgs({ options: { base: { type: 'string' }, apply: { type: 'boolean', default: false }, 'all-approved': { type: 'boolean', default: false } } });
  // `--all-approved` compares every current approval too: a check of the tool, never applied.
  if (values['all-approved'] && values.apply) throw new Error('--all-approved is a diagnostic and cannot be applied');
  // Where this branch left main: what the approvals were last current against.
  values.base ??= execFileSync('git', ['-C', root, 'merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim();
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
    // A decision may have been recorded under either identity scheme; both are
    // computed for the BASE renderer, so only what was current there is carried.
    const schemes = [renderedIdentities(before, entries, { version: 1 }), renderedIdentities(before, entries)];
    const previous = new Map(entries.map(entry => [entry.id, schemes.map(identities => campaignRevision(entry, identities.get(entry.id)))]));
    const candidates = values['all-approved']
      ? entries.filter(entry => { const latest = latestReview(store, entry.id); return latest?.decision === 'approved' && latest.revision === entry.revision; })
      : carryCandidates(entries, store, previous);
    const browser = await chromium.launch();
    const report = { base: values.base, carried: [], review: [] };
    try {
      const page = await browser.newPage({ deviceScaleFactor: 1 });
      await page.route('**/*', route => route.abort());
      await page.clock.setFixedTime(SAMPLE_NOW);
      const shots = async (renderer, entry, width) => {
        await page.setViewportSize({ width, height: 900 });
        const images = [];
        for (const [index, step] of entry.tree.steps.entries()) for (const variant of step.results?.length ? step.results : [null]) {
          await page.setContent('<!doctype html><body style="margin:0"><div id="sample"></div></body>');
          await page.addScriptTag({ content: renderer });
          await page.evaluate(([draw, entry, index, variant, deadline, message]) => {
            const { host } = new Function(`return ${draw}`)()(window.WConvertRenderer, entry, index, variant, deadline, message);
            document.getElementById('sample').append(host);
          }, [drawWithChrome.toString(), entry, index, variant, SAMPLE_DEADLINE, SAMPLE_ERROR]);
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
      next.records.push(...carriedRecords({ carried: report.carried, entries, store, base: values.base, at }));
      // The Collections that moved only because these setups did, carried with a
      // note saying so — the record PR #314 wrote by hand.
      const source = JSON.parse(readFileSync(resolve(root, 'tools/design-library/collections/source.json'), 'utf8'));
      const pending = carryCollections({ source, entries, store, carried: report.carried, previous, at });
      if (pending.length) {
        const note = `docs/reviews/visual-diff-${at.slice(0, 10)}/collections-carry-${values.base.replace(/[^a-zA-Z0-9]+/g, '-')}.md`;
        mkdirSync(resolve(root, note, '..'), { recursive: true });
        writeFileSync(resolve(root, note), `# Collections carried over a renderer change\n\n`
          + `\`npm run templates:visual-diff -- --base ${values.base} --apply\` rendered every setup whose decision was current under ${values.base} with both renderers, `
          + `each screen and result at 1200 and 375 px with the close control, a refused field and the countdown drawn. ${report.carried.length} were pixel-identical and carried; `
          + `${report.review.length} are listed for review.\n\nA Collection's revision hashes its setups' revisions, so these went stale with no change to their items, order, words or screens. `
          + `Each is carried with its previous evidence. Not a new review.\n\n${pending.map(record => `- ${record.id.replace(/^collection-/, '')}`).join('\n')}\n`);
        const evidence = [evidenceFile(root, note)];
        next.records.push(...carryCollections({ source, entries, store, carried: report.carried, previous, at, evidence }));
        report.collections = pending.map(record => record.id);
      }
      report.written = writeReviews(root, store, next);
      // The queue the Collections are published from, refreshed with what was just carried.
      writeFileSync(resolve(root, 'tools/design-library/out/review-queue.json'), JSON.stringify(reviewQueue(loadReviews(root), entries, root), null, 2) + '\n');
      if (pending.length) execFileSync('node', [resolve(root, 'tools/design-library/build/collections.mjs'), '--publish'], { cwd: root, stdio: 'inherit' });
    }
    console.log(JSON.stringify(report, null, 2));
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
