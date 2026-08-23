// THE MATRIX: real wp.org themes and plugins x every isolation strategy.
//
// One number per cell: how many computed-style properties differ from the
// reference render. Zero means the theme did not reach the popup at all.
import { browser, reference, probe, diff, wp, MODES, pad, padl } from './lib.mjs';

const SCENARIOS = [
  { name: 'twentytwentyfive',     theme: 'twentytwentyfive', plugins: [] },
  { name: 'twentytwentyfour',     theme: 'twentytwentyfour', plugins: [] },
  { name: 'astra',                theme: 'astra',            plugins: [] },
  { name: 'oceanwp',              theme: 'oceanwp',          plugins: [] },
  { name: 'generatepress',        theme: 'generatepress',    plugins: [] },
  { name: 'kadence',              theme: 'kadence',          plugins: [] },
  { name: 'storefront',           theme: 'storefront',       plugins: [] },
  { name: 'hello + elementor',    theme: 'hello-elementor',  plugins: ['elementor'] },
  { name: 'tt5 + cookie-notice',  theme: 'twentytwentyfive', plugins: ['cookie-notice'] },
  { name: 'tt5 + cookieyes',      theme: 'twentytwentyfive', plugins: ['cookie-law-info'] },
];

const ALL_PLUGINS = ['elementor', 'cookie-notice', 'cookie-law-info'];

const b = await browser();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const ref = await reference(ctx);
console.log(`reference: modal ${JSON.stringify(ref.rects['.wcv-modal'])}  title text ${ref.font.textWidth}px\n`);

const rows = [];
for (const sc of SCENARIOS) {
  wp('theme', 'activate', sc.theme);
  for (const p of ALL_PLUGINS) {
    try { wp('plugin', sc.plugins.includes(p) ? 'activate' : 'deactivate', p); } catch { /* already */ }
  }
  const row = { name: sc.name, cells: {} };
  for (const mode of MODES) {
    const r = await probe(ctx, { wcv10: mode });
    if (r.failed) { row.cells[mode] = { deltas: 'X', note: r.failed }; continue; }
    const d = diff(ref.styles, r.styles);
    const hit = Object.values(r.hitTest).every((h) => h.ok);
    const fontOk = Math.abs(r.font.textWidth - ref.font.textWidth) < 0.5;
    const ov = r.rects['.wcv-overlay'];
    const vp = r.rects['@viewport'];
    const covers = ov && ov.w >= vp.w - 1 && ov.h >= vp.h - 1;
    row.cells[mode] = { deltas: d.length, hit, fontOk, covers, detail: d };
    await r._page.close();
  }
  rows.push(row);
  process.stderr.write(`. ${sc.name}\n`);
}

// ---- style leakage ---------------------------------------------------------
console.log('COMPUTED-STYLE PROPERTIES DIFFERING FROM THE REFERENCE (0 = perfect)\n');
console.log(pad('SCENARIO', 22) + MODES.map((m) => padl(m.replace('shadow', 'sh'), 13)).join(''));
console.log('-'.repeat(22 + 13 * MODES.length));
for (const r of rows) {
  console.log(pad(r.name, 22) + MODES.map((m) => padl(r.cells[m].deltas, 13)).join(''));
}

// ---- the other three failure modes ----------------------------------------
const flag = (c) => (c.deltas === 'X' ? 'X' : [c.hit ? '' : 'z', c.fontOk ? '' : 'f', c.covers ? '' : 'p'].join('') || 'ok');
console.log('\nOTHER FAILURES   z = something else is on top   f = webfont lost   p = fixed positioning broken\n');
console.log(pad('SCENARIO', 22) + MODES.map((m) => padl(m.replace('shadow', 'sh'), 13)).join(''));
console.log('-'.repeat(22 + 13 * MODES.length));
for (const r of rows) {
  console.log(pad(r.name, 22) + MODES.map((m) => padl(flag(r.cells[m]), 13)).join(''));
}

// ---- what actually leaked, once ------------------------------------------
console.log('\nWHAT LEAKED (first scenario that shows each property, per mode)\n');
for (const m of MODES) {
  const seen = new Set();
  const lines = [];
  for (const r of rows) {
    for (const d of (r.cells[m].detail || [])) {
      const k = d.sel + ' ' + d.prop;
      if (seen.has(k)) continue;
      seen.add(k);
      lines.push(`    ${pad(r.name, 20)} ${pad(d.sel + ' ' + d.prop, 34)} want ${pad(d.want, 26)} got ${d.got}`);
    }
  }
  console.log(`  ${m}: ${lines.length ? lines.length + ' distinct properties' : 'nothing'}`);
  lines.slice(0, 14).forEach((l) => console.log(l));
  if (lines.length > 14) console.log(`    ... and ${lines.length - 14} more`);
}

await b.close();
