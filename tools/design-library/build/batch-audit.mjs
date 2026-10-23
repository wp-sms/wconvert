import { previewFonts } from './preview-fonts.mjs';
/**
 * Every prepared screen of a set of setups on one page, for the reviewer's judgement.
 *
 *   node tools/design-library/build/batch-audit.mjs <batch id | queue> [--capture docs/reviews/<batch>]
 *
 * `queue` is every setup the review queue does not show as approved. With
 * `--capture`, each setup's card (every screen) is saved at phone and desktop
 * width as `<id>-320.png` and `<id>-1440.png`: the visual evidence for its review.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
const root = resolve(import.meta.dirname, '../../..');
const out = resolve(root, 'tools/design-library/out');
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const { values, positionals } = parseArgs({ allowPositionals: true, options: { capture: { type: 'string' } } });
const selection = positionals[0];
const pilot = read('tools/design-library/out/pilot.json');
let name, entries;
if (selection === 'queue') {
  const approved = new Set(read('tools/design-library/out/review-queue.json').filter(row => row.state === 'approved').map(row => row.id));
  name = 'Setups to review'; entries = pilot.filter(entry => !approved.has(entry.id));
} else {
  const batch = read('tools/design-library/pilot/collection.json').batches.find(item => item.id === selection);
  if (!batch) throw new Error('Pass an existing batch ID or `queue`, for example: node tools/design-library/build/batch-audit.mjs queue');
  name = batch.name; entries = pilot.filter(entry => entry.batch === batch.id);
}
if (!entries.length) throw new Error('Nothing to review here. Rebuild the pilot if that is unexpected.');
const data = { title: name, intro: 'Prepared campaign setups, every screen. Review four widths, both directions, visible consent and longer copy. These previews create no leads or messages.', entries, before: [], decisions: {} };
const file = resolve(out, `${selection}-audit.html`);
writeFileSync(file, readFileSync(resolve(root, 'tools/design-library/review/library.html'), 'utf8')
  .replace('<style>', () => `<style>${previewFonts(entries)}`)
  .replace('/*__RENDERER__*/', () => readFileSync(resolve(out, 'renderer.iife.js'), 'utf8'))
  .replace('/*__DATA__*/', () => JSON.stringify(data).replaceAll('<', '\\u003c')));
console.log(`${selection}-audit.html: ${entries.length} prepared setups, every screen`);

if (values.capture) {
  if (!/^docs\/reviews\/[a-z0-9._-]+$/.test(values.capture)) throw new Error('Capture into docs/reviews/<batch>');
  const folder = resolve(root, values.capture); mkdirSync(folder, { recursive: true });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    await page.route(/^https?:/, route => route.abort());
    await page.goto('file://' + file);
    await page.evaluate(async () => { await document.fonts.ready; });
    // Phone and desktop: the widths visitors see most. The page has the others for a closer look.
    for (const width of ['320', '1440']) {
      await page.selectOption('#width', width);
      for (const entry of entries) {
        // The page shows six setups at a time; choosing one shows it alone.
        await page.selectOption('#design', entry.id);
        const card = page.locator(`article[data-design="${entry.id}"]`);
        await card.waitFor(); await page.waitForTimeout(300);
        await card.screenshot({ path: resolve(folder, `${entry.id}-${width}.png`), animations: 'disabled' });
      }
    }
  } finally { await browser.close(); }
  console.log(`Captured ${entries.length} setups at 320 and 1440 px into ${values.capture}`);
}
