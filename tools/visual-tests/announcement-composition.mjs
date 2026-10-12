/* global WConvertRenderer */
/** Content-aware regression: an announcement must never sit beside a broken-up form. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.WCONVERT_STUDIO_URL || 'http://127.0.0.1:9452';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local studio required');
const output = process.env.WCONVERT_COMPOSITION_EVIDENCE || '/tmp/wconvert-announcement-composition';
fs.mkdirSync(output, { recursive: true });
const entries = JSON.parse(fs.readFileSync('tools/design-library/out/pilot.json')).filter(e => e.template_id === 'bar-email-capture');
if (!entries.length) throw Error('Rebuild the pilot: announcement setups are missing');
const browser = await chromium.launch();
try {
 const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, hasTouch: true });
 await page.goto(base + '/proof.html');
 const report = await page.evaluate(entries => {
  document.body.replaceChildren(); document.body.style.cssText = 'margin:0;background:#f4f4f2';
  const frame = document.createElement('div'), host = document.createElement('div'); frame.append(host); document.body.append(frame);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = WConvertRenderer.SHADOW_CSS; shadow.append(style);
  const cases = [], failures = [];
  const widths = [...new Set([...Array.from({ length: 71 }, (_, i) => 320 + i * 16), 808, 960, 1000, 1015, 1016, 1017, 1207, 1208, 1209, 1271, 1272, 1273, 1343, 1344, 1345])].sort((a,b) => a-b);
  const walk = (value, visit) => { if (!value || typeof value !== 'object') return; visit(value); for (const child of Object.values(value)) if (typeof child === 'object') walk(child, visit); };
  for (const original of entries) for (const stress of [false, true]) for (const width of widths) for (const rtl of [false, true]) {
   const entry = structuredClone(original);
   if (stress) walk(entry.tree, node => { if (node.role === 'headline') node.text += ' — a little more to explore together'; if (node.type === 'button') node.label += ' and explore the details'; });
   frame.style.width = width + 'px'; frame.dir = rtl ? 'rtl' : 'ltr';
   const root = WConvertRenderer.render(entry.tree, entry.tokens, 0); shadow.append(root);
   const close = document.createElement('button'); close.className = 'wc-close'; close.textContent = '×'; close.setAttribute('aria-label', 'Close'); root.append(close);
   const heading = root.querySelector('[data-role="headline"]') || root.querySelector('h2');
   const field = root.querySelector('input[type="email"]');
   const button = root.querySelector('[data-action="submit"]');
   const h = heading.getBoundingClientRect(), f = field.getBoundingClientRect(), b = button.getBoundingClientRect();
   const beside = (rtl ? h.left >= f.right - 1 : h.right <= f.left + 1) && h.bottom > f.top && h.top < b.bottom;
   const splitForm = b.top >= f.bottom - 1;
   const actualWidth = root.getBoundingClientRect().width;
   const wrongWidth = Math.abs(actualWidth - width) > 1;
   const unevenControls = !splitForm && Math.abs(f.height - b.height) > 2;
   const overflow = root.scrollWidth > root.clientWidth + 1;
   const c = close.getBoundingClientRect();
   const closeOverlap = [heading, field, button, root.querySelector('.wc-consent')].filter(Boolean).some(el => { const r=el.getBoundingClientRect(); return r.left<c.right && r.right>c.left && r.top<c.bottom && r.bottom>c.top; });
   const result = { id: entry.id, width, actualWidth, rtl, stress, beside, splitForm, closeOverlap, wrongWidth, unevenControls, overflow, passed: !(beside && splitForm) && !closeOverlap && !wrongWidth && !unevenControls && !overflow };
   cases.push(result); if (!result.passed) failures.push(result);
   root.remove();
  }
  return { cases: cases.length, failures };
 }, entries);
 // Save actual-size transitions for visual judgement, not a pass/fail substitute.
 for (const original of entries) for (const stress of [false, true]) for (const width of (stress ? [320, 808, 1343, 1344, 1440] : [320, 390, 640, 808, 960, 1343, 1344, 1440])) {
  const entry = structuredClone(original);
  const walk = node => { if (!node || typeof node !== 'object') return; if (node.role === 'headline') node.text += ' — a little more to explore together'; if (node.type === 'button') node.label += ' and explore the details'; for (const child of Object.values(node)) if (typeof child === 'object') walk(child); };
  if (stress) walk(entry.tree);
  await page.evaluate(({ entry, width }) => {
   const frame = document.body.firstElementChild, host = frame.firstElementChild; frame.style.width = width + 'px'; frame.dir = 'ltr';
   const shadow = host.shadowRoot; shadow.querySelector('.wc-root')?.remove();
   const root = WConvertRenderer.render(entry.tree, entry.tokens, 0); shadow.append(root);
   const close = document.createElement('button'); close.className = 'wc-close'; close.textContent = '×'; close.setAttribute('aria-label', 'Close'); root.append(close);
  }, { entry, width });
  await page.locator('body > div').screenshot({ path: `${output}/${entry.id}-${width}${stress ? '-long' : ''}.png` });
 }
 fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
 console.log(`${report.cases} measured compositions; ${report.failures.length} composition failures.`);
 if (report.failures.length) { console.log(JSON.stringify(report.failures.slice(0, 4))); process.exitCode = 1; }
} finally { await browser.close(); }
