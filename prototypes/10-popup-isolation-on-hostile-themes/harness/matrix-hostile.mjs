// The CEILING: the synthetic hostile theme, five escalating levels, every mode.
//
// Real themes are hostile in ordinary ways. This is every documented sin at once,
// so a strategy that survives level 5 has nothing left to be surprised by.
//
//   1  bare-tag overrides, no !important        (every theme does this)
//   2  the same, with !important                (one-click-demo themes)
//   3  * { ... !important }                     (the nuclear theme)
//   4  + transform/filter/overflow on body      (kills position: fixed)
//   5  + sticky header and cookie banner at z-index 2147483647
//   6  + the transform moved onto <html>, so there is no ancestor left to escape
import { browser, reference, probe, diff, wp, MODES, pad, padl } from './lib.mjs';

const LEVELS = [1, 2, 3, 4, 5, 6];
const THEME = process.env.WCV_THEME || 'twentytwentyfive';

wp('theme', 'activate', THEME);
for (const p of ['elementor', 'cookie-notice', 'cookie-law-info']) {
  try { wp('plugin', 'deactivate', p); } catch { /* already */ }
}

const b = await browser();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const ref = await reference(ctx);

const grid = {};
for (const level of LEVELS) {
  grid[level] = {};
  for (const mode of MODES) {
    const r = await probe(ctx, { wcv10: mode, wcv10_hostile: level });
    if (r.failed) { grid[level][mode] = { deltas: 'X' }; continue; }
    const d = diff(ref.styles, r.styles);
    const ov = r.rects['.wcv-overlay'], vp = r.rects['@viewport'];
    grid[level][mode] = {
      deltas: d.length,
      hit: Object.values(r.hitTest).every((h) => h.ok),
      fontOk: Math.abs(r.font.textWidth - ref.font.textWidth) < 0.5,
      covers: !!(ov && ov.w >= vp.w - 1 && ov.h >= vp.h - 1),
      detail: d,
      hitDetail: r.hitTest,
      rects: r.rects,
    };
    await r._page.close();
  }
  process.stderr.write(`. level ${level}\n`);
}

console.log(`synthetic hostile theme, on top of ${THEME}\n`);
console.log('COMPUTED-STYLE PROPERTIES DIFFERING FROM THE REFERENCE\n');
console.log(pad('LEVEL', 8) + MODES.map((m) => padl(m.replace('shadow', 'sh'), 13)).join(''));
console.log('-'.repeat(8 + 13 * MODES.length));
for (const l of LEVELS) console.log(pad(l, 8) + MODES.map((m) => padl(grid[l][m].deltas, 13)).join(''));

const flag = (c) => (c.deltas === 'X' ? 'X' : [c.hit ? '' : 'z', c.fontOk ? '' : 'f', c.covers ? '' : 'p'].join('') || 'ok');
console.log('\nOTHER FAILURES   z = something else is on top   f = webfont lost   p = fixed positioning broken\n');
console.log(pad('LEVEL', 8) + MODES.map((m) => padl(m.replace('shadow', 'sh'), 13)).join(''));
console.log('-'.repeat(8 + 13 * MODES.length));
for (const l of LEVELS) console.log(pad(l, 8) + MODES.map((m) => padl(flag(grid[l][m]), 13)).join(''));

console.log('\nWHAT LEAKED AT EACH LEVEL\n');
for (const l of LEVELS) {
  for (const m of MODES) {
    const c = grid[l][m];
    if (!c.detail || !c.detail.length) continue;
    console.log(`  level ${l}  ${m}  (${c.detail.length})`);
    for (const d of c.detail.slice(0, 10)) {
      console.log(`      ${pad(d.sel + ' ' + d.prop, 32)} want ${pad(d.want, 24)} got ${d.got}`);
    }
    if (c.detail.length > 10) console.log(`      ... and ${c.detail.length - 10} more`);
  }
}

console.log('\nSTACKING AT LEVEL 5 (what is on top of the submit button)\n');
for (const m of MODES) {
  const c = grid[5][m];
  const h = c.hitDetail && c.hitDetail['.wcv-submit'];
  console.log(`  ${pad(m, 14)} ${h ? (h.ok ? 'ours' : 'BLOCKED by ' + h.top) : '-'}`);
}

console.log('\nOVERLAY GEOMETRY AT LEVEL 4 (viewport 1280x900)\n');
for (const m of MODES) {
  const r = grid[4][m].rects;
  console.log(`  ${pad(m, 14)} overlay ${JSON.stringify(r && r['.wcv-overlay'])}`);
}

await b.close();
