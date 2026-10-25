/**
 * Every bar's and slide-in's close control against everything it could cover.
 *
 * Renders each floating_bar and slide_in design with the shipping renderer,
 * close control and reserveBesideClose, in both directions, with its own and
 * with longer copy: bars at every width from 320 to 1440 px, slide-ins from
 * 288 to 416 px (the corner card's whole range), in 16 px steps. Fails if the
 * control overlaps any text, field or button or a design scrolls sideways.
 *
 *   node tools/visual-tests/close-reserve.mjs docs/reviews/<batch>/close-reserve.json
 *
 * Needs `./tools/design-library/build.sh renderer` first.
 */
import { chromium } from 'playwright';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readDesigns } from '../design-library/build/inventory.mjs';

const output = process.argv[2];
if (!output || !/^docs\/reviews\/[a-z0-9._-]+\/close-reserve\.json$/.test(output)) throw Error('Usage: node tools/visual-tests/close-reserve.mjs docs/reviews/<batch>/close-reserve.json');
const bars = readDesigns(process.cwd(), { pictures: true }).filter(design => ['floating_bar', 'slide_in'].includes(design.display_type)).map(({ id, display_type, tree, tokens }) => ({ id, display_type, tree, tokens }));
const scratch = mkdtempSync(join(tmpdir(), 'wconvert-bar-close-'));
writeFileSync(join(scratch, 'bars.html'), `<!doctype html><meta charset="utf-8"><body style="margin:0"><script>${readFileSync('tools/design-library/out/renderer.iife.js', 'utf8')}</script>`);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, hasTouch: true });
  await page.goto('file://' + join(scratch, 'bars.html'));
  const report = await page.evaluate(async bars => {
    const R = window.WConvertRenderer;
    if (typeof R.reserveBesideClose !== 'function') throw Error('Rebuild the renderer: reserveBesideClose is missing');
    const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rows = [];
    for (const design of bars) {
      const row = { id: design.id, display_type: design.display_type, cases: 0, overlaps: [], overflows: [] };
      const bar = design.display_type === 'floating_bar', [from, to] = bar ? [320, 1440] : [288, 416];
      for (let step = 0; step < design.tree.steps.length; step++) for (const longer of [false, true]) for (const rtl of [false, true]) for (let width = from; width <= to; width += 16) {
        const tree = structuredClone(design.tree);
        if (longer) JSON.stringify(tree, (key, value) => { if (value?.role === 'headline' && value.text) value.text += ' with a little more to say'; if (value?.type === 'button' && value.label) value.label += ' today'; return value; });
        const host = document.createElement('div'); host.style.width = width + 'px'; host.dir = rtl ? 'rtl' : 'ltr'; document.body.append(host);
        const shadow = host.attachShadow({ mode: 'open' }); const style = document.createElement('style'); style.textContent = R.SHADOW_CSS; shadow.append(style);
        const root = R.render(tree, design.tokens, step); shadow.append(root);
        const close = R.closeButton(() => {}); if (bar) close.dataset.bar = ''; root.append(close); R.reserveBesideClose(root, close);
        await frame();
        const c = close.getBoundingClientRect(), at = `step ${step + 1} ${width}px ${rtl ? 'rtl' : 'ltr'}${longer ? ' longer' : ''}`;
        for (const element of root.querySelectorAll('.wc-heading,.wc-text,.wc-eyebrow,.wc-badge,.wc-rating,.wc-code,.wc-countdown,.wc-input,.wc-button,.wc-label')) {
          const range = document.createRange(); range.selectNodeContents(element);
          const boxes = element.matches('.wc-input,.wc-button') ? [element.getBoundingClientRect()] : [...range.getClientRects()];
          if (boxes.some(b => b.width > 0 && b.left < c.right && b.right > c.left && b.top < c.bottom && b.bottom > c.top)) row.overlaps.push(`${at}: ${element.className.split(' ')[0]}`);
        }
        if (root.scrollWidth > root.clientWidth + 1) row.overflows.push(at);
        row.cases++; host.remove();
      }
      rows.push(row);
    }
    return rows;
  }, bars);
  const failures = report.reduce((sum, row) => sum + row.overlaps.length + row.overflows.length, 0);
  writeFileSync(output, JSON.stringify({ schema: 1, at: new Date().toISOString(), widths: { floating_bar: '320–1440 px', slide_in: '288–416 px', step: '16 px' }, designs: report }, null, 2) + '\n');
  for (const row of report) console.log(`${row.id}: ${row.cases} cases, ${row.overlaps.length} overlaps, ${row.overflows.length} overflows`);
  if (failures) process.exitCode = 1;
} finally {
  await browser.close();
  rmSync(scratch, { recursive: true, force: true });
}
