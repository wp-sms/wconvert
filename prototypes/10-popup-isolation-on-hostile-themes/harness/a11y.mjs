// Accessibility, driven with REAL key presses -- not synthetic events, because the
// question is what the browser's own focus order does at each container boundary.
//
// Five things the ticket says are not optional: focus trapping, Esc, aria-modal,
// focus restoration, and what a screen reader can reach.
import { browser, probe, wp, MODES, pad, padl } from './lib.mjs';

wp('theme', 'activate', process.env.WCV_THEME || 'twentytwentyfive');

const b = await browser();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });

const rows = [];
for (const mode of MODES) {
  const r = await probe(ctx, { wcv10: mode }, { collect: ['a11y'] });
  if (r.failed) { rows.push({ mode, failed: r.failed }); continue; }
  const p = r._page;
  const a = r.a11y;

  // Real Tab presses, all the way round the dialog and one past it.
  const n = a.focusables.length;
  const visited = [];
  for (let i = 0; i < n + 2; i++) {
    await p.keyboard.press('Tab');
    visited.push(await p.evaluate(() => {
      const m = window.__WCV10._mounted;
      const inside = m.kind === 'shadow' ? m.root.activeElement
        : m.kind === 'iframe' ? (m.root.contentDocument && m.root.contentDocument.activeElement)
        : document.activeElement;
      const outside = document.activeElement;
      const ours = m.host === outside || m.host.contains(outside);
      return { inside: inside && inside.className, escaped: !ours };
    }));
  }
  const escaped = visited.filter((v) => v.escaped).length;

  // Esc, pressed for real.
  await p.keyboard.press('Escape');
  await p.waitForTimeout(80);
  const afterEsc = await p.evaluate(() => ({
    stillMounted: !!document.querySelector('[data-wcv]'),
    inertLeft: document.querySelectorAll('body > [data-wcv-inert]').length,
    activeNow: document.activeElement ? document.activeElement.tagName : null,
  }));

  rows.push({
    mode,
    role: a.role, ariaModal: a.ariaModal,
    label: a.labelResolves && a.describeResolves,
    focusables: n,
    docActive: a.documentActiveElement,
    realActive: a.actualActiveElement,
    trapped: escaped === 0,
    escaped,
    outsideReachable: a.outsideFocusables,
    inerted: a.inertedSiblings,
    escClosed: !afterEsc.stillMounted,
    inertLeaked: afterEsc.inertLeft,
  });
  await p.close();
}

console.log('FOCUS AND SEMANTICS\n');
console.log(pad('MODE', 16) + pad('role', 8) + pad('modal', 7) + pad('IDREFs', 8) + pad('tab-trapped', 13) + pad('Esc', 6) + pad('inerted', 9) + 'still reachable outside');
console.log('-'.repeat(100));
for (const r of rows) {
  if (r.failed) { console.log(pad(r.mode, 16) + r.failed); continue; }
  console.log(
    pad(r.mode, 16) + pad(r.role, 8) + pad(r.ariaModal, 7) + pad(r.label ? 'yes' : 'NO', 8) +
    pad(r.trapped ? 'yes' : `NO (${r.escaped})`, 13) + pad(r.escClosed ? 'yes' : 'NO', 6) +
    pad(r.inerted, 9) + r.outsideReachable
  );
}

console.log('\nWHAT OUTSIDE CODE SEES AS THE FOCUSED ELEMENT\n');
console.log(pad('MODE', 16) + pad('document.activeElement', 34) + 'actually focused');
console.log('-'.repeat(90));
for (const r of rows) {
  if (r.failed) continue;
  const lies = r.docActive !== r.realActive;
  console.log(pad(r.mode, 16) + pad(r.docActive, 34) + r.realActive + (lies ? '   <- differs' : ''));
}

await b.close();
