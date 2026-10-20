import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readPublicRelease, promote } from './storage.mjs';
import { verifyService } from './verify-service.mjs';

// Default: local Workerd. --remote verifies the exact candidate against live HTTPS.
const directory = process.argv[2], output = process.argv[3];
const remote = process.argv[4] === '--remote';
assert(directory && (process.argv.length < 5 || process.argv[4] === '--remote'), 'Usage: node scripts/verify-gallery.mjs /private/release [/evidence/directory] [--remote]');
const release = readPublicRelease(directory);
const catalogue = JSON.parse(release.objects.get(`releases/${release.id}/designs.json`));
const designs = [...catalogue.designs, ...(catalogue.extensions?.bundled_designs ?? [])];
for (const [id, plugins] of [['coffee-finder-board', ['woocommerce']], ['accessory-workbench', ['woocommerce']], ['sample-envelope', []], ['excerpt-window', []]]) {
  const design = designs.find(design => design.id === id);
  if (design) assert.deepEqual(design.prerequisites.plugins, plugins, `Incorrect authored prerequisites: ${id}`);
}
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url)));
const mf = remote ? null : new Miniflare(convertV4MiniflareOptions({
  modules: true, script: readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'),
  compatibilityDate: config.compatibility_date, r2Buckets: ['PUBLIC_TEMPLATES', 'PRIVATE_TEMPLATES'],
  bindings: config.vars,
}));
const browser = await chromium.launch();
try {
  if (mf) await promote(await mf.getR2Bucket('PUBLIC_TEMPLATES'), release, null);
  const report = await verifyService(release.origin, { expected: release.id,
    premiumMode: remote ? 'configured' : 'unconfigured',
    fetcher: remote ? fetch : (url, options) => mf.dispatchFetch(url, options) });
  const page = await browser.newPage(), errors = [], violations = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/frame-ancestors/.test(message.text())) violations.push(message.text()); });
  const representative = designs.find(design => design.availability === 'pro' && design.screens.length > 1) ?? designs[0];
  assert(representative, 'Browser acceptance needs at least one preview');
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    requests.push({ method: request.method(), url: request.url() });
    if (url.origin === release.origin) {
      if (remote) { await route.continue(); return; }
      const response = await mf.dispatchFetch(url.href);
      await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
    } else if (['https://wconvert.io', 'https://www.wconvert.io', 'https://dev.wconvert-website.pages.dev', 'https://blocked.example'].includes(url.origin)) {
      const supplied = representative.screens.at(-1).design_only_embed_url ?? representative.screens.at(-1).embed_url;
      await route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Embedding test</title><button id="parent-mobile">Mobile</button><button id="parent-desktop">Desktop</button><iframe title="WConvert design preview" sandbox="allow-scripts" referrerpolicy="no-referrer" style="width:90vw;height:80vh" src="${supplied}"></iframe><script>
for (const device of ['mobile','desktop']) document.getElementById('parent-'+device).onclick = () => {
  const frame = document.querySelector('iframe'), url = new URL(frame.src), params = new URLSearchParams(url.hash.slice(1));
  params.set('device', device); url.hash = params.toString(); frame.src = url.href;
};</script>` });
    } else { throw Error(`Unexpected preview request: ${request.url()}`); }
  });
  let screens = 0, designOnlyChecks = 0, keyboardScrollChecks = 0;
  for (const design of designs) {
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
      if (design.design_only_embed) {
        for (const screen of design.screens) {
          await page.goto(screen.design_only_embed_url + '&device=' + device);
          assert.equal(await page.locator('#sample').getAttribute('data-screen'), screen.id);
          assert.equal(await page.locator('#sample').getAttribute('data-device'), device);
          assert.equal(await page.locator('#error').isVisible(), false);
          assert.equal(await page.locator('header,nav,section,.disclosure,#screen,#desktop,#mobile,#format').count(), 0);
          assert.equal(await page.locator('meta[name="wconvert-embed"]').getAttribute('content'), 'design-only:1');
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${design.id} design-only overflows ${device}`);
          assert.equal(await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
          if (await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 10)) {
            await page.locator('main').focus();
            await page.keyboard.press('End');
            await page.waitForFunction(() => scrollY > 0);
            keyboardScrollChecks++;
          }
          // Change only the fragment on the existing document: retain the selected screen.
          const other = device === 'desktop' ? 'mobile' : 'desktop';
          await page.evaluate(other => {
            window.__sameDocument = true;
            const params = new URLSearchParams(location.hash.slice(1)); params.set('device', other); location.hash = params.toString();
          }, other);
          await page.waitForFunction(other => document.getElementById('sample').dataset.device === other, other);
          assert.equal(await page.locator('#sample').getAttribute('data-screen'), screen.id);
          assert.equal(await page.evaluate(() => window.__sameDocument), true);
          designOnlyChecks += 2;
        }
        if (output && ['excerpt-window', 'sample-envelope', 'coffee-finder-board', 'after-hours', 'bar-countdown', 'collection-poster'].includes(design.id)) {
          mkdirSync(resolve(output), { recursive: true });
          await page.goto(design.screens[0].design_only_embed_url + '&device=' + device);
          await page.screenshot({ path: resolve(output, `${design.id}-design-only-${device}.png`), fullPage: true });
        }
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
  for (const url of [representative.embed_url, representative.design_only_embed?.url].filter(Boolean)) {
    await page.goto(url);
    assert.equal(await page.locator('#sample').getAttribute('data-screen'), representative.screens[0].id);
    assert.equal(await page.locator('#sample').getAttribute('data-device'), 'desktop');
    for (const fragment of ['screen=missing', 'device=tablet', 'screen=', 'device=', 'screen=s1&screen=s1', 'device=mobile&device=desktop', 'mode=clean', 'design=unknown', 'screen=%2Fmissing']) {
      await page.goto(url + '#' + fragment);
      assert.equal(await page.locator('#error').isVisible(), true, fragment);
      assert.equal(await page.locator('#sample').isVisible(), false, fragment);
    }
    await page.goto(url + '#device=mobile');
    assert.equal(await page.locator('#sample').getAttribute('data-screen'), representative.screens[0].id);
    assert.equal(await page.locator('#sample').getAttribute('data-device'), 'mobile');
  }
  for (const origin of ['https://wconvert.io', 'https://www.wconvert.io', 'https://dev.wconvert-website.pages.dev']) {
    await page.goto(origin);
    await page.frameLocator('iframe').locator('#sample').waitFor({ state: 'visible' });
    for (const device of ['mobile', 'desktop']) {
      await page.locator('#parent-' + device).focus(); await page.keyboard.press('Space');
      const sample = page.frameLocator('iframe').locator('#sample');
      await page.frameLocator('iframe').locator(`#sample[data-device="${device}"]`).waitFor();
      assert.equal(await sample.getAttribute('data-screen'), representative.screens.at(-1).id);
    }
  }
  await page.goto('https://blocked.example');
  assert.equal(await page.frameLocator('iframe').locator('#sample').count(), 0);
  assert(violations.length > 0, 'Browser must enforce frame-ancestors');
  assert.deepEqual(errors, []);
  assert(requests.every(request => request.method === 'GET'));
  let staging;
  if (remote) {
    // Real staging document and CSP, with an ephemeral test iframe in this browser
    // only. This never edits or deploys the website.
    const stagingPage = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const stagingResponse = await stagingPage.goto('https://dev.wconvert-website.pages.dev/', { waitUntil: 'domcontentloaded' });
    assert.equal(stagingResponse.status(), 200);
    assert.equal(new URL(stagingPage.url()).origin, 'https://dev.wconvert-website.pages.dev');
    const quiz = designs.find(design => design.id === 'coffee-finder-board');
    const screen = quiz.screens.findLast(screen => screen.result_id);
    assert(screen && screen.id.includes('/'));
    await stagingPage.evaluate(src => {
      const frame = document.createElement('iframe');
      frame.id = 'wconvert-live-acceptance'; frame.title = 'Temporary live embed verification';
      frame.setAttribute('sandbox', 'allow-scripts'); frame.referrerPolicy = 'no-referrer';
      frame.style.cssText = 'position:fixed;inset:5vh 5vw;width:90vw;height:90vh;border:0;z-index:2147483647;background:#fff';
      frame.src = src; document.body.append(frame);
    }, screen.design_only_embed_url);
    const sample = stagingPage.frameLocator('#wconvert-live-acceptance').locator('#sample');
    await sample.waitFor({ state: 'visible' });
    for (const device of ['mobile', 'desktop']) {
      await stagingPage.evaluate(device => {
        const frame = document.getElementById('wconvert-live-acceptance'), url = new URL(frame.src);
        const params = new URLSearchParams(url.hash.slice(1)); params.set('device', device); url.hash = params.toString(); frame.src = url.href;
      }, device);
      await stagingPage.frameLocator('#wconvert-live-acceptance').locator(`#sample[data-device="${device}"]`).waitFor();
      assert.equal(await sample.getAttribute('data-screen'), screen.id);
    }
    const isolated = await stagingPage.evaluate(() => {
      try { void document.getElementById('wconvert-live-acceptance').contentWindow.document; return false; }
      catch { return true; }
    });
    assert(isolated, 'Sandboxed preview DOM must remain inaccessible to the parent');
    if (output) await stagingPage.screenshot({ path: resolve(output, 'live-staging-embed.png') });
    staging = { origin: new URL(stagingPage.url()).origin, httpStatus: stagingResponse.status(),
      actualWebsiteDocument: true, temporaryBrowserIframeOnly: true, design: quiz.id,
      screen: screen.id, devices: ['mobile', 'desktop'], parentDomAccessBlocked: isolated };
    await stagingPage.close();
  }
  const result = { ...report, verifiedAt: new Date().toISOString(), localOnly: !remote,
    network: remote ? 'live service HTTPS; synthetic parent harnesses plus actual staging document' : 'intercepted; no external requests', screenDeviceChecks: screens,
    designOnlyChecks, keyboardScrollChecks, allowedParents: 3, blockedParents: 1, pageErrors: errors.length };
  if (staging) result.staging = staging;
  if (output) writeFileSync(resolve(output, 'gallery-acceptance.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); await mf?.dispose(); }
