import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readPublicRelease, promote } from './storage.mjs';
import { verifyService } from './verify-service.mjs';

// Local Workerd and Chromium only. HTTPS hostnames are intercepted, never contacted.
const directory = process.argv[2], output = process.argv[3];
assert(directory, 'Usage: node scripts/verify-gallery.mjs /private/release [/evidence/directory]');
const release = readPublicRelease(directory);
const catalogue = JSON.parse(release.objects.get(`releases/${release.id}/designs.json`));
for (const [id, plugins] of [['coffee-finder-board', ['woocommerce']], ['accessory-workbench', ['woocommerce']], ['sample-envelope', []], ['excerpt-window', []]]) {
  const design = catalogue.designs.find(design => design.id === id);
  if (design) assert.deepEqual(design.prerequisites.plugins, plugins, `Incorrect authored prerequisites: ${id}`);
}
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url)));
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'),
  compatibilityDate: config.compatibility_date, r2Buckets: ['PUBLIC_TEMPLATES', 'PRIVATE_TEMPLATES'],
  bindings: config.vars,
}));
const browser = await chromium.launch();
try {
  await promote(await mf.getR2Bucket('PUBLIC_TEMPLATES'), release, null);
  const report = await verifyService(release.origin, { expected: release.id, fetcher: (url, options) => mf.dispatchFetch(url, options) });
  const page = await browser.newPage(), errors = [], violations = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/frame-ancestors/.test(message.text())) violations.push(message.text()); });
  const representative = catalogue.designs.find(design => design.availability === 'pro') ?? catalogue.designs[0];
  assert(representative, 'Browser acceptance needs at least one preview');
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    requests.push({ method: request.method(), url: request.url() });
    if (url.origin === release.origin) {
      const response = await mf.dispatchFetch(url.href);
      await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
    } else if (['https://wconvert.io', 'https://www.wconvert.io', 'https://dev.wconvert-website.pages.dev', 'https://blocked.example'].includes(url.origin)) {
      await route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Embedding test</title><iframe title="WConvert design preview" sandbox="allow-scripts" referrerpolicy="no-referrer" style="width:90vw;height:80vh" src="${representative.embed_url}"></iframe>` });
    } else { throw Error(`Unexpected preview request: ${request.url()}`); }
  });
  let screens = 0;
  for (const design of catalogue.designs) {
    if (design.preview_status !== 'available') continue;
    for (const device of ['desktop', 'mobile']) {
      await page.setViewportSize(device === 'desktop' ? { width: 1200, height: 900 } : { width: 390, height: 844 });
      for (const [index, screen] of design.screens.entries()) {
        await page.goto(screen.embed_url + '&device=' + device);
        assert.equal(await page.locator('#screen').inputValue(), String(index));
        assert.equal(await page.locator('#error').isVisible(), false);
        assert.equal(await page.locator('header').isVisible(), false);
        assert.equal(await page.locator('#' + device).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('#sample').isVisible(), true);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${design.id} overflows ${device}`);
        assert(await page.evaluate(() => [...document.querySelectorAll('template')].every(t =>
          [...t.content.querySelectorAll('input,select,textarea,button')].every(control => control.disabled && !control.hasAttribute('name')) && !t.content.querySelector('a[href]'))));
        screens++;
      }
      await page.locator('#screen').focus();
      if (design.screens.length > 1) {
        // Native select type-ahead wraps from the last screen to the first.
        // macOS headless Chromium does not operate native popup menus with arrows.
        await page.keyboard.press(design.name.charAt(0).toLowerCase());
        assert.equal(await page.locator('#screen').inputValue(), '0');
      }
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'desktop');
      await page.keyboard.press('Tab'); await page.keyboard.press('Space');
      assert.equal(await page.locator('#mobile').getAttribute('aria-pressed'), 'true');
      if (output && ['excerpt-window', 'sample-envelope', 'coffee-finder-board'].includes(design.id)) {
        mkdirSync(resolve(output), { recursive: true });
        await page.goto(design.screens[0].embed_url + '&device=' + device);
        await page.screenshot({ path: resolve(output, `${design.id}-${device}.png`), fullPage: true });
      }
    }
    // Actual decoded thumbnail dimensions, not assumed viewport dimensions.
    await page.goto(design.thumbnail.url);
    const dimensions = await page.evaluate(async () => {
      const image = document.querySelector('img'); await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    });
    assert.deepEqual(dimensions, [design.thumbnail.width, design.thumbnail.height]);
  }
  await page.goto(representative.embed_url + '#screen=missing');
  assert.equal(await page.locator('#error').isVisible(), true);
  assert.equal(await page.locator('#sample').isVisible(), false);
  await page.goto(representative.embed_url + '#device=unknown');
  assert.equal(await page.locator('#error').isVisible(), true);
  await page.goto(representative.preview_url);
  assert.equal(await page.locator('header h1').isVisible(), true);
  for (const origin of ['https://wconvert.io', 'https://www.wconvert.io', 'https://dev.wconvert-website.pages.dev']) {
    await page.goto(origin);
    await page.frameLocator('iframe').locator('#sample').waitFor({ state: 'visible' });
  }
  await page.goto('https://blocked.example');
  assert.equal(await page.frameLocator('iframe').locator('#sample').count(), 0);
  assert(violations.length > 0, 'Browser must enforce frame-ancestors');
  assert.deepEqual(errors, []);
  assert(requests.every(request => request.method === 'GET'));
  const result = { ...report, localOnly: true, network: 'intercepted; no external requests', screenDeviceChecks: screens, allowedParents: 3, blockedParents: 1, pageErrors: errors.length };
  if (output) writeFileSync(resolve(output, 'gallery-acceptance.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); await mf.dispose(); }
