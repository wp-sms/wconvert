/** Real internal pages: palette, contrast, responsive controls and preview isolation. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.WCONVERT_STUDIO_URL || 'http://127.0.0.1:9452';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local studio required');
const out = process.env.WCONVERT_STUDIO_EVIDENCE || '/tmp/wconvert-studio-chrome';
mkdirSync(out, { recursive: true });
const report = [];
const browser = await chromium.launch();
try {
  for (const width of [1440, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 600, isMobile: width < 600 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const route of ['pilot.html?batch=commerce-refresh', 'collection-studio.html', 'roadmap.html?view=library', 'library-review.html', 'gallery.html', 'bench.html', 'flagships.html', 'starting-points.html']) {
      await page.goto(base + '/' + route);
      await page.evaluate(() => document.fonts.ready);
      const measurement = await page.evaluate(() => {
        const rgb = value => value.match(/[\d.]+/g)?.map(Number);
        const luminance = color => rgb(color).slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
        const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
        const failures = [];
        for (const el of document.body.querySelectorAll('*')) {
          if (['SCRIPT', 'STYLE', 'OPTION'].includes(el.tagName) || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
          if (!el.getClientRects().length || el.closest('[hidden],#workbench')) continue;
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.opacity !== '1') continue;
          let parent = el, bg = 'rgb(255, 255, 255)';
          while (parent) {
            const c = getComputedStyle(parent).backgroundColor;
            if ((rgb(c)?.[3] ?? 1) === 1) { bg = c; break; }
            parent = parent.parentElement;
          }
          const ratio = contrast(style.color, bg);
          const threshold = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700) ? 3 : 4.5;
          if (ratio < threshold) failures.push({ text: el.textContent.trim().slice(0, 50), ratio: +ratio.toFixed(2), color: style.color, bg });
        }
        const fields = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),select,textarea')].filter(el => el.getClientRects().length && !el.closest('[hidden]'));
        const fieldBoundaries = fields.map(el => { const s = getComputedStyle(el); return { id: el.id, ratio: contrast(s.borderTopColor, s.backgroundColor) }; }).filter(item => item.ratio < 3);
        const contextHeights = [...document.querySelectorAll('.studio-context input:not([type=checkbox]),.studio-context select')].map(el => Math.round(el.getBoundingClientRect().height));
        const controls = [...document.querySelectorAll('.toolbar button,.toolbar select,.toolbar input')].filter(el => el.getClientRects().length).map(el => Math.round(el.getBoundingClientRect().height));
        const shadows = [...document.querySelectorAll('*')].filter(el => el.shadowRoot);
        const colors = () => shadows.map(el => [...el.shadowRoot.querySelectorAll('.wc-root,.wc-root *')].map(node => { const s = getComputedStyle(node); return [s.color, s.backgroundColor, s.borderColor]; }));
        const before = colors();
        document.getElementById('studio-theme').sheet.disabled = true;
        const unchanged = JSON.stringify(before) === JSON.stringify(colors());
        document.getElementById('studio-theme').sheet.disabled = false;
        return { overflow: document.documentElement.scrollWidth > innerWidth, palette: getComputedStyle(document.body).backgroundColor, failures, controls, fieldBoundaries, contextHeights, templateColorsUnchanged: unchanged, previews: shadows.length };
      });
      report.push({ route, width, ...measurement });
      assert.equal(measurement.overflow, false, `${route} ${width}: page overflow`);
      assert.equal(measurement.palette, 'rgb(246, 245, 241)');
      assert.equal(measurement.templateColorsUnchanged, true, `${route}: template colour leak`);
      assert.deepEqual(measurement.failures, [], `${route} ${width}: text contrast`);
      assert.deepEqual(measurement.fieldBoundaries, [], `${route}: field boundary contrast`);
      if (measurement.contextHeights.length) assert.deepEqual([...new Set(measurement.contextHeights)], [width < 600 ? 44 : 36]);
      if (measurement.controls.length) assert.deepEqual([...new Set(measurement.controls)], [width < 600 ? 44 : 32]);
      await page.screenshot({ path: `${out}/${route.split('.')[0]}-${width}.png` });
    }
    await page.goto(base + '/pilot.html?batch=commerce-refresh');
    await page.getByRole('button', { name: 'Explore campaign' }).first().click();
    const dialog = page.locator('#detail');
    await dialog.waitFor({ state: 'visible' });
    assert.equal((await page.locator('#detail-meta').textContent()).includes('undefined'), false);
    for (const viewport of [320, 800]) {
      await page.locator(`button[data-width="${viewport}"]`).click();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      assert.equal(await page.locator('#preview').evaluate(el => el.getBoundingClientRect().width <= el.parentElement.clientWidth), true, 'selected viewport fits the preview pane');
    }
    if (width < 600) await page.locator('button[data-width="320"]').click();
    const position = await page.evaluate(() => {
      const body = document.querySelector('#detail .detail'); body.scrollTop = body.scrollHeight;
      const close = document.getElementById('close').getBoundingClientRect();
      return { scrolls: body.scrollTop > 0, closeVisible: close.top >= 0 && close.bottom <= innerHeight };
    });
    assert.equal(position.scrolls, true); assert.equal(position.closeVisible, true);
    await page.locator('#detail .detail').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: `${out}/dialog-${width}.png` });
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), false);
    assert.match(await page.evaluate(() => document.activeElement.textContent), /Explore campaign/);
    assert.deepEqual(errors, []);
    report.push({ width, dialogScrollAndEscape: true, errors });
    await page.close();
  }
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(`PASS ${report.length} studio checks; screenshots and measurements in ${out}`);
