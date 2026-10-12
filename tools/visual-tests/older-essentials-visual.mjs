/** Final output, every screen, four widths, RTL and longer copy. Rebuild the batch first. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const evidence = process.env.WCONVERT_REVIEW_EVIDENCE || 'docs/reviews';
fs.mkdirSync(evidence, { recursive: true });
const base = process.env.WCONVERT_STUDIO_URL || 'http://127.0.0.1:9452';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local studio required');
const browser = await chromium.launch();
try {
 const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
 await page.goto(base + '/proof.html');
 for (const id of ['project-planning-guide', 'project-readiness-guide', 'repair-workshop-news', 'local-class-news']) {
  await page.locator('#campaign').selectOption(id);
  await page.locator('main article').first().waitFor();
  await page.locator('main').screenshot({ path: `${evidence}/older-essentials-${id}.png` });
 }
 await page.goto(base + '/older-essentials-audit.html');
 await page.locator('#run').click();
 await page.waitForSelector('#check-summary', { timeout: 180000 });
 const report = JSON.parse(await page.locator('#results').textContent());
 fs.writeFileSync(`${evidence}/older-essentials-2026-10-12-audit.json`, JSON.stringify(report, null, 2) + '\n');
 console.log(report.summary);
 if (report.failures.length) throw Error(`${report.failures.length} audit failures`);
} finally { await browser.close(); }
