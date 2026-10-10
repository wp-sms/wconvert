import { test, expect } from '@playwright/test';

// Retain test-only handles without changing the production closed shadow mode.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const attach = Element.prototype.attachShadow;
    window.testShadows = [];
    window.testFocus = [];
    Element.prototype.attachShadow = function (options) {
      const shadow = attach.call(this, options);
      shadow.addEventListener('focusin', (event) => window.testFocus.push(event.target.tagName));
      window.testShadows.push(shadow);
      return shadow;
    };
  });
});

for (const width of [320, 768, 1440]) for (const rtl of [false, true]) {
  test(`fullscreen geometry, focus, capture and dismissal ${width} ${rtl ? 'rtl' : 'ltr'}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 800 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/?wconvert_fullscreen=fullscreen-guide${rtl ? '&rtl=1' : ''}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('dialog[open]')).toBeVisible();
    const state = await page.evaluate(() => {
      const dialog = document.querySelector('dialog');
      const shadow = window.testShadows.find((root) => root.querySelector('.wc-root'));
      window.fullShadow = shadow;
      const box = dialog.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        overflow: dialog.scrollWidth - dialog.clientWidth,
        focused: shadow.activeElement?.tagName, closed: shadow.host.shadowRoot === null,
        lock: document.documentElement.style.overflow,
        font: getComputedStyle(shadow.querySelector('h2')).fontFamily };
    });
    expect(state).toMatchObject({ x: 0, y: 0, width, height: 800, focused: 'H2', closed: true, lock: 'hidden' });
    expect(state.overflow).toBeLessThanOrEqual(1);
    expect(state.font).not.toContain('Comic');
    expect(await page.evaluate(() => window.testFocus)).not.toContain('INPUT');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => window.fullShadow.activeElement?.tagName)).toBe('INPUT');
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press('Tab');
      // Native dialogs may yield to browser chrome (activeElement is body),
      // but never to a control on the inert page.
      expect(await page.evaluate(() => document.activeElement === document.body || document.querySelector('dialog').contains(document.activeElement))).toBe(true);
    }
    await page.evaluate(() => document.querySelector('#opener').focus());
    await expect(page.locator('#opener')).not.toBeFocused();
    const priorScroll = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 900);
    await page.evaluate(() => { document.querySelector('dialog').scrollTop = 10000; });
    const close = await page.evaluate(() => {
      const box = window.fullShadow.querySelector('.wc-close').getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });
    expect(close.y).toBeGreaterThanOrEqual(0);
    expect(close.y + close.height).toBeLessThanOrEqual(800);
    expect(close.width).toBe(44);
    expect(rtl ? close.x < 60 : close.x > width - 100).toBe(true);
    expect(await page.evaluate(() => scrollY)).toBe(priorScroll);
    // Real capture endpoint on the real published campaign, no mocked response.
    await page.evaluate(() => {
      const form = window.fullShadow.querySelector('form');
      form.querySelector('input[name=email]').value = 'fullscreen@example.test';
      form.requestSubmit();
    });
    await expect.poll(() => page.evaluate(() => window.fullShadow.querySelector('h2')?.textContent)).toBe('Request received');
    expect(await page.evaluate(() => window.fullShadow.activeElement?.tagName)).toBe('H2');
    expect(await page.evaluate(() => document.querySelector('dialog').scrollTop)).toBe(0);
    await page.screenshot({ path: info.outputPath(`success-${width}-${rtl}.png`) });
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
    await expect(page.locator('#opener')).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test('all starter designs, short viewport, enlarged text and reduced motion', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 420 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const setup of ['fullscreen-newsletter', 'fullscreen-guide', 'fullscreen-announcement']) {
    await page.goto(`/?wconvert_fullscreen=${setup}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('dialog[open]')).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    // Wait for rem-dependent shadow styles to catch up with the enlarged root.
    await expect.poll(() => page.evaluate(() => {
      const shadow = window.testShadows.find(root => root.querySelector('.wc-root'));
      return getComputedStyle(shadow.querySelector('.wc-root')).fontSize;
    })).toBe('32px');
    const geometry = await page.evaluate(() => {
      const dialog = document.querySelector('dialog');
      dialog.scrollTop = 10000;
      const shadow = window.testShadows.find((root) => root.querySelector('.wc-root'));
      const close = shadow.querySelector('.wc-close').getBoundingClientRect();
      return { overflow: dialog.scrollWidth - dialog.clientWidth, y: close.y };
    });
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.y).toBeLessThan(420);
    await page.screenshot({ path: info.outputPath(`${setup}.png`) });
    await page.keyboard.press('Escape');
  }
});

test('goal-first setup filtering creates a fullscreen draft with a viewport preview', async ({ page }, info) => {
  await page.goto('/wp-login.php');
  await expect(page.getByLabel('Username or Email Address')).toBeFocused();
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/wp-admin/admin.php?page=wconvert#optins');
  await page.getByRole('button', { name: 'Create campaign', exact: true }).click();
  await page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Grow my email list', exact: true }) }).getByRole('button', { name: 'Choose: Grow my email list', exact: true }).click();
  const fullscreen = page.getByRole('radio', { name: 'Fullscreen', exact: true });
  await page.locator('label').filter({ has: fullscreen }).click();
  await expect(fullscreen).toBeChecked();
  await expect(page.getByText('Offer a weekly email in fullscreen', { exact: true })).toBeVisible();
  await expect(page.getByText('Fullscreen', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Setup details for Offer a weekly email in fullscreen', exact: true }).click();
  await page.getByRole('button', { name: 'Use this setup', exact: true }).click();
  const fullscreenSite = page.getByRole('tabpanel', { name: 'Edit', exact: true }).locator('.wconvert-site[data-display-type="fullscreen"]');
  await expect(fullscreenSite).toBeVisible();
  const geometry = await fullscreenSite.evaluate(site => {
    const shadow = window.testShadows.findLast((root) => root.host.isConnected && site.contains(root.host));
    return { page: site.getBoundingClientRect().width, surface: shadow.querySelector('.wc-root').getBoundingClientRect().width };
  });
  expect(Math.abs(geometry.page - geometry.surface)).toBeLessThan(3);
  await page.screenshot({ path: info.outputPath('fullscreen-editor.png') });
});
