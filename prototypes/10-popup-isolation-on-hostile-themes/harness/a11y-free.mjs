// What the CONTAINER gives you for free, with the hand-written a11y layer switched
// off (?wcv10_noa11y=1). Anything not free here is code every strategy must write.
import { browser, probe, wp, MODES, pad, padl } from './lib.mjs';

wp('theme', 'activate', process.env.WCV_THEME || 'twentytwentyfive');
const b = await browser();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });

console.log('NO HAND-WRITTEN FOCUS TRAP, Esc HANDLER, OR inert -- what the container does by itself\n');
console.log(pad('MODE', 16) + padl('tab escapes', 13) + padl('Esc closes', 12) + padl('page inert', 12) + '   where Tab went');
console.log('-'.repeat(90));

for (const mode of MODES) {
  const r = await probe(ctx, { wcv10: mode, wcv10_noa11y: 1 }, { collect: ['a11y'] });
  if (r.failed) { console.log(pad(mode, 16) + r.failed); continue; }
  const p = r._page;
  const n = r.a11y.focusables.length;
  const escapedTo = [];
  for (let i = 0; i < n + 3; i++) {
    await p.keyboard.press('Tab');
    const out = await p.evaluate(() => {
      const m = window.__WCV10._mounted;
      const a = document.activeElement;
      const ours = m.host === a || m.host.contains(a);
      if (ours) return null;
      return a ? (a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + (a.className ? '.' + String(a.className).trim().split(/\s+/)[0] : '')) : 'null';
    });
    if (out) escapedTo.push(out);
  }
  await p.keyboard.press('Escape');
  await p.waitForTimeout(100);
  const after = await p.evaluate(() => {
    const dlg = document.querySelector('dialog[data-wcv]');
    return {
      // A native dialog CLOSES without being removed, so "gone from the DOM" is
      // the wrong question for it.
      dismissed: dlg ? !dlg.open : !document.querySelector('[data-wcv]'),
      // Does the browser itself treat the rest of the page as inert?
      pageInert: (() => {
        const el = [...document.querySelectorAll('a[href],button,input')].find((e) => !e.closest('[data-wcv]'));
        if (!el) return 'n/a';
        if (el.closest('[inert]')) return 'attr';
        // top-layer modality is not an attribute; ask whether the element can be focused
        el.focus();
        return document.activeElement === el ? 'no' : 'yes';
      })(),
    };
  });
  console.log(
    pad(mode, 16) + padl(escapedTo.length, 13) + padl(after.dismissed ? 'yes' : 'no', 12) +
    padl(after.pageInert, 12) + '   ' + (escapedTo.length ? [...new Set(escapedTo)].slice(0, 3).join(', ') : '-')
  );
  await p.close();
}
await b.close();
