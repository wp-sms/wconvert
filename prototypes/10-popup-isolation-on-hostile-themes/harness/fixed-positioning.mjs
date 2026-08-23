// A transformed ancestor makes `position: fixed` resolve against that ancestor
// instead of the viewport. This asks the only question that matters about it:
// after the visitor scrolls, is the popup still on their screen?
//
// The off-canvas mobile menu pattern -- `body { transform: translateX(...) }` --
// is why this is not a hypothetical.
import { browser, probe, wp, MODES, pad, padl } from './lib.mjs';

const THEME = process.env.WCV_THEME || 'twentytwentyfive';
wp('theme', 'activate', THEME);

const b = await browser();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });

async function measure(params, scrollTo) {
  const r = await probe(ctx, params, { collect: ['rects', 'hitTest'] });
  if (r.failed) return { failed: r.failed };
  // Give the page something to scroll, then scroll it.
  await r._page.evaluate((y) => {
    document.body.style.minHeight = '4000px';
    window.scrollTo(0, y);
  }, scrollTo);
  await r._page.waitForTimeout(120);
  const out = await r._page.evaluate(() => window.__WCV10.rects());
  const hit = await r._page.evaluate(() => window.__WCV10.hitTest());
  const scrollY = await r._page.evaluate(() => window.scrollY);
  await r._page.close();
  return { rects: out, hit, scrollY };
}

// A 4000px page, sampled the whole way down. A strategy is only correct if the
// popup is on screen at EVERY scroll position -- being visible at one of them is
// luck, not fixed positioning.
const SCROLLS = [0, 500, 1500, 2500, 3100];

for (const hostile of [0, 4, 6]) {
  console.log(hostile ? '\nWITH `body { transform: translateZ(0) }` (hostile level 4)\n'
                      : 'BASELINE -- no transformed ancestor\n');
  console.log(pad('MODE', 16) + SCROLLS.map((s) => padl('y=' + s, 11)).join('') + padl('ON SCREEN', 12));
  console.log('-'.repeat(16 + 11 * SCROLLS.length + 12));
  for (const mode of MODES) {
    const cells = [];
    let good = 0;
    for (const s of SCROLLS) {
      const params = hostile ? { wcv10: mode, wcv10_hostile: hostile } : { wcv10: mode };
      const m = await measure(params, s);
      if (m.failed) { cells.push('X'); continue; }
      const modal = m.rects['.wcv-modal'];
      const off = mode === 'iframe' ? m.rects['@host'] : { x: 0, y: 0 };
      const y = Math.round(modal.y + off.y);
      const on = y > -modal.h && y < 900 && m.hit['.wcv-submit'].ok;
      if (on) good++;
      cells.push((on ? '' : '!') + y);
    }
    console.log(pad(mode, 16) + cells.map((c) => padl(c, 11)).join('') + padl(`${good}/${SCROLLS.length}`, 12));
  }
}

await b.close();
