/** Native local captures only; never run this against a merchant installation. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const evidence = process.env.WCONVERT_REVIEW_EVIDENCE || 'docs/reviews';
fs.mkdirSync(evidence, { recursive: true });
const base = process.env.WCONVERT_TEMPLATE_REVIEW_URL || 'http://127.0.0.1:9453';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Disposable local site required');
const ids = ['project-planning-guide', 'project-readiness-guide', 'repair-workshop-news', 'local-class-news'];
const browser = await chromium.launch(); const results = []; const errors = [];
try {
 for (const id of ids) for (const width of [1280, 320]) {
  console.log('Checking', id, width);
  const context = await browser.newContext({ viewport: { width, height: 740 }, hasTouch: width <= 390 });
  await context.addCookies([{ name: 'wcv_test_consent', value: 'allow', url: base }]);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.reviewRoots = []; const attach = Element.prototype.attachShadow; Element.prototype.attachShadow = function(o) { const r = attach.call(this, o); window.reviewRoots.push(r); return r; }; });
  await page.goto(base + '/?wconvert_older_essentials=' + id);
  await page.waitForFunction(() => window.reviewRoots.some(r => r.host.isConnected && r.querySelector('[name="email"]')), { timeout: 15000 });
  // Presence is insufficient: an entering floating bar can still be translated offscreen.
  await page.waitForFunction(() => {
   const r = window.reviewRoots.find(r => r.host.isConnected && r.querySelector('[name="email"]'));
   if (!r) return false;
   const moving = [...document.getAnimations(), ...r.getAnimations()].some(a => a.playState === 'running' || a.pending);
   const popover = r.host.closest('.wcv-p');
   return !moving && (!popover || Number(getComputedStyle(popover).opacity) === 1);
  });
  const checkAnnouncement = async () => { if (!id.endsWith('-news')) return;
   const visible = await page.evaluate(() => {
    const r = window.reviewRoots.find(r => r.host.isConnected && r.querySelector('.wc-root'));
    const close = r.querySelector('.wc-close').getBoundingClientRect();
    return [...r.querySelectorAll('.wc-heading,.wc-text,[name="email"],[data-action="submit"],.wc-consent')].every(el => {
     const b = el.getBoundingClientRect();
     const overlap = b.left < close.right && b.right > close.left && b.top < close.bottom && b.bottom > close.top;
     return !overlap && b.width > 0 && b.height > 0 && b.top >= 0 && b.bottom <= innerHeight + 1 && b.left >= 0 && b.right <= innerWidth + 1;
    });
   });
   if (!visible) throw Error(id + ': announcement content clipped or overlapping the close control');
  };
  await checkAnnouncement();
  await page.screenshot({ path: `${evidence}/older-live-${id}-${width}-details.png`, fullPage: true });
  const form = () => page.evaluate(() => window.reviewRoots.some(r => r.host.isConnected && r.querySelector('[name="email"]')));
  await page.evaluate(() => window.reviewRoots.find(r => r.host.isConnected && r.querySelector('[name="email"]')).querySelector('[data-action="submit"]').click());
  if (!await form()) throw Error(id + ': empty email advanced');
  const endpoint = await page.locator('#wconvert-payload').getAttribute('data-capture');
  const captured = page.waitForResponse(r => r.url() === endpoint && r.request().method() === 'POST' && r.request().postDataJSON()?.submission === 'primary');
  await page.evaluate(({ id, width }) => {
   const r = window.reviewRoots.find(r => r.host.isConnected && r.querySelector('[name="email"]'));
   const input = r.querySelector('[name="email"]'); input.value = `${id}-${width}@example.test`; input.dispatchEvent(new Event('input', { bubbles: true }));
   for (const c of r.querySelectorAll('input[type="checkbox"]')) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }
   r.querySelector('[data-action="submit"]').click();
  }, { id, width });
  const response = await captured;
  if (response.status() >= 300) throw Error(id + ': capture ' + response.status() + ' ' + await response.text());
  const reply = await response.json();
  if (!reply.id) throw Error(id + ': capture response lacks a saved lead ID');
  await page.waitForFunction(() => window.reviewRoots.some(r => r.host.isConnected && r.querySelector('.wc-root') && !r.querySelector('[name="email"]')));
  await checkAnnouncement();
  await page.screenshot({ path: `${evidence}/older-live-${id}-${width}-received.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || window.reviewRoots.some(r => r.host.isConnected && [...r.querySelectorAll('.wc-root')].some(el => el.scrollWidth > el.clientWidth + 1)));
  if (overflow) throw Error(id + ': horizontal overflow');
  results.push({ id, width, requiredEmail: true, nativeCaptureStatus: response.status(), acknowledgement: true, overflow: false });
  await context.close();
 }
 if (errors.length) throw Error(errors.join('\n'));
 fs.writeFileSync(`${evidence}/older-essentials-2026-10-12-live.json`, JSON.stringify(results, null, 2) + '\n');
 console.log(`${results.length} native WordPress journeys passed; local capture only.`);
} finally { await browser.close(); }
