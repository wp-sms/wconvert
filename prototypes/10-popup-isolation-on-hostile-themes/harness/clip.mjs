// The `inline` display type is the one that cannot escape to <body>: it renders
// where it was embedded, so a clipping ancestor is its problem and no other type's.
// The ancestor here is `overflow:hidden; height:120px; transform:translateZ(0)`.
import { browser, wp, url, MODES, pad, padl } from './lib.mjs';

wp('theme', 'activate', 'twentytwentyfive');
const b = await browser();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });

console.log('MOUNTED INSIDE overflow:hidden; height:120px; transform:translateZ(0)\n');
console.log(pad('MODE', 16) + pad('parent box', 22) + pad('modal box', 26) + 'visible at its own centre');
console.log('-'.repeat(92));

for (const mode of MODES) {
  const page = await ctx.newPage();
  await page.goto(url({ wcv10: mode, wcv10_clip: 1, wcv10_inline: '#wcv10-clip' }), { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('html[data-wcv10-ready]', { state: 'attached', timeout: 15000 });
  } catch { console.log(pad(mode, 16) + 'never mounted'); await page.close(); continue; }
  const c = await page.evaluate(() => window.__WCV10.clip);
  const box = (r) => `${r.x},${r.y} ${r.w}x${r.h}`;
  console.log(pad(mode, 16) + pad(box(c.parent), 22) + pad(box(c.modal), 26) + (c.visibleAtCentre ? 'yes' : 'NO -- clipped away'));
  await page.close();
}
await b.close();
