/* global mount, settled, WConvertRenderer */
/** Default campaign labels stay on one line at the supported review widths. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const ids = new Set(JSON.parse(fs.readFileSync('docs/reviews/black-friday-2026-10-24/prototype-map.json')).map(x => x.native_id));
const entries = JSON.parse(fs.readFileSync('tools/design-library/out/pilot.json')).filter(x => ids.has(x.id));
const base = process.env.WCONVERT_STUDIO_URL || 'http://127.0.0.1:9458';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local studio required');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base + '/library-review.html');
  const report = await page.evaluate(async entries => {
    const cases = [], failures = [];
    for (const entry of entries) for (const width of [320,390,520,640,768,960,1280,1440]) for (const rtl of [false,true]) {
      const { root, frame } = mount(entry, 0, width, false, rtl, null);
      document.body.append(frame); await settled(root);
      for (const label of root.querySelectorAll('.wc-button>span:first-child')) {
        const row = { id: entry.id, width, rtl, label: label.textContent,
          wrapped: label.getBoundingClientRect().height > parseFloat(getComputedStyle(label).lineHeight) * 1.2 };
        cases.push(row); if (row.wrapped) failures.push(row);
      }
      WConvertRenderer.disposePreview(frame); frame.remove();
    }
    return { cases: cases.length, failures };
  }, entries);
  if (process.env.WCONVERT_CTA_EVIDENCE) fs.writeFileSync(process.env.WCONVERT_CTA_EVIDENCE, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) process.exitCode = 1;
} finally { await browser.close(); }
