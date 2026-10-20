import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readPublicRelease, promote } from './storage.mjs';
import { verifyService } from './verify-service.mjs';
import { cloudTarget } from './cloud-config.mjs';

/**
 * What the website reads: the release's detail pages, each detail's preview,
 * og image and thumbnail. Previews are design-only embed v1 documents
 * (GALLERY-CONTRACT.md): `#screen=` and `#device=` fragments, a `#sample`
 * carrying data-screen/data-device, and an `#error` region.
 *
 * Default: local Workerd. --remote verifies the exact candidate against live HTTPS.
 */
const directory = process.argv[2], output = process.argv[3];
const remote = process.argv[4] === '--remote';
assert(directory && (process.argv.length < 5 || remote), 'Usage: node scripts/verify-gallery.mjs /private/release [/evidence/directory] [--remote]');
const release = await readPublicRelease(directory);
const closure = release.closures.get(release.id);
for (const [id, plugins] of [['coffee-finder-board', ['woocommerce']], ['accessory-workbench', ['woocommerce']], ['sample-envelope', []], ['excerpt-window', []]]) {
  const entry = closure.designs.get(id);
  if (entry) assert.deepEqual(entry.prerequisites ?? [], plugins, `Incorrect authored prerequisites: ${id}`);
}
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url)));
const origin = remote ? cloudTarget().origin : 'https://templates.example';
const mf = remote ? null : new Miniflare(convertV4MiniflareOptions({
  modules: true, script: readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'),
  compatibilityDate: config.compatibility_date, r2Buckets: ['PUBLIC_TEMPLATES', 'PRIVATE_TEMPLATES'],
  bindings: config.vars,
}));
const screenIds = detail => (detail.screens ?? []).map(screen => typeof screen === 'string' ? screen : screen?.id).filter(id => typeof id === 'string');
const previewUrl = detail => `${origin}/v3/previews/${detail.preview}.html`;
const browser = await chromium.launch();
try {
  if (mf) await promote(await mf.getR2Bucket('PUBLIC_TEMPLATES'), release, null);
  const report = await verifyService(origin, { expected: release.id, premiumMode: remote ? 'configured' : 'unconfigured',
    fetcher: remote ? fetch : (url, options) => mf.dispatchFetch(url, options) });
  const page = await browser.newPage(), errors = [], violations = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/frame-ancestors/.test(message.text())) violations.push(message.text()); });
  const previews = closure.details.filter(detail => detail.preview);
  const representative = previews.find(detail => screenIds(detail).length > 1) ?? previews[0];
  assert(representative, 'Browser acceptance needs at least one preview');
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    requests.push({ method: request.method(), url: request.url() });
    if (url.origin === origin) {
      if (remote) { await route.continue(); return; }
      const response = await mf.dispatchFetch(url.href);
      await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
    } else if (['https://wconvert.io', 'https://www.wconvert.io', 'https://dev.wconvert-website.pages.dev', 'https://blocked.example'].includes(url.origin)) {
      const last = screenIds(representative).at(-1);
      const supplied = previewUrl(representative) + (last ? '#screen=' + encodeURIComponent(last) : '');
      await route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Embedding test</title><button id="parent-mobile">Mobile</button><button id="parent-desktop">Desktop</button><iframe title="WConvert design preview" sandbox="allow-scripts" referrerpolicy="no-referrer" style="width:90vw;height:80vh" src="${supplied}"></iframe><script>
for (const device of ['mobile','desktop']) document.getElementById('parent-'+device).onclick = () => {
  const frame = document.querySelector('iframe'), url = new URL(frame.src), params = new URLSearchParams(url.hash.slice(1));
  params.set('device', device); url.hash = params.toString(); frame.src = url.href;
};</script>` });
    } else { throw Error(`Unexpected preview request: ${request.url()}`); }
  });
  let screens = 0, images = 0;
  for (const detail of previews) {
    for (const device of ['desktop', 'mobile']) {
      await page.setViewportSize(device === 'desktop' ? { width: 1200, height: 900 } : { width: 390, height: 844 });
      for (const screen of screenIds(detail).length ? screenIds(detail) : [null]) {
        const params = new URLSearchParams(screen ? { screen, device } : { device });
        await page.goto(previewUrl(detail) + '#' + params);
        assert.equal(await page.locator('#error').isVisible(), false, `${detail.id} ${screen} ${device}`);
        if (screen) assert.equal(await page.locator('#sample').getAttribute('data-screen'), screen);
        assert.equal(await page.locator('#sample').getAttribute('data-device'), device);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${detail.id} overflows ${device}`);
        assert(await page.evaluate(() => [...document.querySelectorAll('template')].every(t =>
          [...t.content.querySelectorAll('input,select,textarea,button')].every(control => control.disabled && !control.hasAttribute('name')) && !t.content.querySelector('a[href]'))));
        screens++;
      }
      if (output && ['excerpt-window', 'sample-envelope', 'coffee-finder-board'].includes(detail.id)) {
        mkdirSync(resolve(output), { recursive: true });
        await page.goto(previewUrl(detail) + '#device=' + device);
        await page.screenshot({ path: resolve(output, `${detail.id}-${device}.png`), fullPage: true });
      }
    }
    // Actual decoded dimensions, not assumed ones.
    if (detail.thumb) {
      await page.goto(`${origin}/v3/thumbs/${detail.thumb.sha}.webp`);
      const dimensions = await page.evaluate(async () => { const image = document.querySelector('img'); await image.decode(); return [image.naturalWidth, image.naturalHeight]; });
      assert.deepEqual(dimensions, [detail.thumb.width, detail.thumb.height], `${detail.id} thumbnail`);
      images++;
    }
    if (detail.og) {
      await page.goto(`${origin}/v3/og/${detail.og}.jpg`);
      assert(await page.evaluate(async () => { const image = document.querySelector('img'); await image.decode(); return image.naturalWidth > 0; }), `${detail.id} og image`);
      images++;
    }
  }
  for (const fragment of ['screen=missing', 'device=tablet', 'screen=', 'device=', 'device=mobile&device=desktop', 'mode=clean', 'design=unknown', 'screen=%2Fmissing']) {
    await page.goto(previewUrl(representative) + '#' + fragment);
    assert.equal(await page.locator('#error').isVisible(), true, fragment);
    assert.equal(await page.locator('#sample').isVisible(), false, fragment);
  }
  for (const parent of ['https://wconvert.io', 'https://www.wconvert.io', 'https://dev.wconvert-website.pages.dev']) {
    if (!config.vars.PREVIEW_EMBED_ORIGINS.split(' ').includes(parent)) continue;
    await page.goto(parent);
    await page.frameLocator('iframe').locator('#sample').waitFor({ state: 'visible' });
    for (const device of ['mobile', 'desktop']) {
      await page.locator('#parent-' + device).focus(); await page.keyboard.press('Space');
      await page.frameLocator('iframe').locator(`#sample[data-device="${device}"]`).waitFor();
    }
  }
  await page.goto('https://blocked.example');
  assert.equal(await page.frameLocator('iframe').locator('#sample').count(), 0);
  assert(violations.length > 0, 'Browser must enforce frame-ancestors');
  assert.deepEqual(errors, []);
  assert(requests.every(request => request.method === 'GET'));
  const result = { ...report, verifiedAt: new Date().toISOString(), localOnly: !remote,
    network: remote ? 'live service HTTPS; synthetic parent harnesses' : 'intercepted; no external requests',
    screenDeviceChecks: screens, imagesDecoded: images, blockedParents: 1, pageErrors: errors.length };
  if (output) { mkdirSync(resolve(output), { recursive: true }); writeFileSync(resolve(output, 'gallery-acceptance.json'), JSON.stringify(result, null, 2) + '\n'); }
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); await mf?.dispose(); }
