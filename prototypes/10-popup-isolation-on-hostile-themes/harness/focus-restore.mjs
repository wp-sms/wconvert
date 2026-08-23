// Focus restoration, asked correctly: focus a real link in the page FIRST, then open
// the popup, then close it. The earlier version opened the popup on page load, so
// focus had never left the opener and every mode passed trivially.
//
// Uses the shipping-shaped implementations so the dialog's NATIVE behaviour is what
// is measured -- shadow.js writes restoration by hand, dialog.js does not write any.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { WP, SITE, pad } from './lib.mjs';

execFileSync(WP, ['theme', 'activate', 'twentytwentyfive'], { encoding: 'utf8' });
const FONT = SITE + '/wp-content/plugins/wconvert/prototypes/10-popup-isolation-on-hostile-themes/assets/fraunces.woff2';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });

console.log('focus the opener -> open -> close -> where did focus go?\n');
console.log(pad('IMPLEMENTATION', 34) + pad('opener', 18) + pad('after close', 18) + 'restored');
console.log('-'.repeat(80));

for (const [name, file, global, hand] of [
  ['dialog + shadow (native restore)', '../dist/.t-dialog.js', 'SHIPDIALOG', false],
  ['closed shadow (hand-written)',     '../dist/.t-shadow.js', 'SHIPSHADOW', true],
]) {
  const p = await ctx.newPage();
  await p.goto(SITE + '/');
  await p.addScriptTag({ content: readFileSync(file, 'utf8') });
  const out = await p.evaluate(async ([g, font]) => {
    const d = (e) => (e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') : 'null');
    const opener = document.querySelector('a[href]');
    opener.id = 'the-opener';
    opener.focus();
    const before = d(document.activeElement);
    const close = window[g].show(font, () => {});
    await new Promise((r) => setTimeout(r, 300));
    const during = d(document.activeElement);
    close();
    await new Promise((r) => setTimeout(r, 200));
    return { before, during, after: d(document.activeElement) };
  }, [global, FONT]);
  console.log(
    pad(name, 34) + pad(out.before, 18) + pad(out.after, 18) +
    (out.before === out.after ? 'yes' : 'NO') + (hand ? '   (written by hand)' : '   (native)')
  );
  await p.close();
}
await b.close();
