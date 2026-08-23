// RTL -- the map's remaining fog. Two questions, and only the first belongs to #10:
//
//   1. Does writing direction reach INSIDE each container at all?
//   2. Once it does, does the template lay itself out correctly?
//
// If (1) has a per-container answer, RTL is a constraint this ticket absorbs. If
// all the work is in (2), it belongs to whoever owns templates.
//
// Run under a REAL RTL locale (fa_IR), so themes ship their own -rtl.css and the
// body carries the `rtl` class -- not just a dir attribute bolted on by the harness.
import { browser, probe, reference, wp, MODES, pad, padl } from './lib.mjs';

const THEMES = (process.env.WCV_THEMES || 'twentytwentyfive,astra,oceanwp,kadence').split(',');
const locale = wp('option', 'get', 'WPLANG') || '(none)';

const b = await browser();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });

const refLtr = await reference(ctx);
const refRtl = await reference(ctx, { wcv10_rtl: 1 });
console.log(`site locale: ${locale}\n`);
console.log('reference render (no theme):');
console.log(`  ltr  modal x=${refLtr.rects['.wcv-modal'].x}  close btn x=${refLtr.rects['.wcv-close'].x}`);
console.log(`  rtl  modal x=${refRtl.rects['.wcv-modal'].x}  close btn x=${refRtl.rects['.wcv-close'].x}`);

console.log('\nDOES dir="rtl" REACH INSIDE THE CONTAINER?\n');
console.log(pad('THEME', 18) + pad('MODE', 15) + pad('modal dir', 11) + pad('close btn', 11) + 'verdict');
console.log('-'.repeat(74));

for (const theme of THEMES) {
  wp('theme', 'activate', theme);
  for (const mode of MODES) {
    const r = await probe(ctx, { wcv10: mode }, { collect: ['dir'] });
    if (r.failed) { console.log(pad(theme, 18) + pad(mode, 15) + r.failed); continue; }
    const d = r.dir;
    const ok = d.modalDirection === 'rtl' && d.closeOnLeft;
    console.log(
      pad(theme, 18) + pad(mode, 15) + pad(d.modalDirection, 11) +
      pad(d.closeOnLeft ? 'left' : 'RIGHT', 11) + (ok ? 'ok' : 'WRONG -- renders LTR inside an RTL page')
    );
    await r._page.close();
  }
}

await b.close();
