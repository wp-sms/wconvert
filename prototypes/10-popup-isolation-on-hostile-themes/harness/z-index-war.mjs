// The z-index war, asked honestly.
//
// Two separate questions, and they have different answers:
//   CLICKABLE  -- can the visitor reach the submit button? (`inert` decides this)
//   ON TOP     -- is anything painting over the popup?     (z-index decides this)
//
// A popup can be clickable and still be sitting under a cookie banner's scrim.
import { browser, probe, wp, MODES, pad, padl } from './lib.mjs';

wp('theme', 'activate', process.env.WCV_THEME || 'twentytwentyfive');

const b = await browser();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });

// Our container z-index vs the banner's 2147483647.
const OURS = [2147483646, 2147483647];

for (const z of OURS) {
  console.log(`\nour container at z-index ${z}, banner and sticky header at 2147483647\n`);
  console.log(pad('MODE', 16) + padl('CLICKABLE', 12) + padl('ON TOP', 10) + '   what is painting over us');
  console.log('-'.repeat(78));
  for (const mode of MODES) {
    const r = await probe(ctx, { wcv10: mode, wcv10_hostile: 5, wcv10_z: z }, { collect: ['hitTest', 'paintOrder'] });
    if (r.failed) { console.log(pad(mode, 16) + '  ' + r.failed); continue; }
    const click = r.hitTest['.wcv-submit'];
    const paint = r.paintOrder['.wcv-submit'];
    console.log(
      pad(mode, 16) + padl(click.ok ? 'yes' : 'no', 12) + padl(paint.ok ? 'yes' : 'NO', 10) +
      '   ' + (paint.ok ? '-' : paint.top)
    );
    await r._page.close();
  }
}

await b.close();
