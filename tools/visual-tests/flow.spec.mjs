import { test, expect } from '@playwright/test';

/**
 * The Flow map on a real WordPress (ADR 0142): readable at Fit, nothing on top
 * of anything, Tab and the arrow keys in reading order, and Ctrl+wheel zooms
 * the map rather than the page. Each case is an unpublished draft that
 * `mu/flow.php` seeds once.
 */
const wide = { width: 1280, height: 800 };
const cases = ['branches', 'enquiry', 'coffee', 'straight', 'large-12', 'large-20'];
const sizes = [{ width: 1440, height: 900 }, wide, { width: 900, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 700 }];
const runs = [
  ...cases.flatMap(name => ['ltr', 'rtl'].map(direction => ({ name, direction, viewport: wide }))),
  ...['branches', 'large-20'].flatMap(name => sizes.filter(size => size !== wide).map(viewport => ({ name, direction: 'ltr', viewport }))),
];

async function login(page) {
  await page.goto('/wp-login.php');
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
}

async function openFlow(page, name) {
  await page.goto(`/?wconvert_visual_flow=${name}`);
  await page.getByRole('link', { name: 'Open flow editor' }).click();
  // The strip's label carries the click; the radio itself is visually hidden.
  await page.getByRole('radio', { name: 'Flow' }).check({ force: true });
  await expect(page.locator('.wconvert-flow-card').first()).toBeVisible();
  // Let measuring and Fit settle.
  await page.waitForTimeout(400);
}

for (const run of runs) {
  test(`${run.name} ${run.direction} ${run.viewport.width}×${run.viewport.height}`, async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ baseURL, viewport: run.viewport });
    await context.addCookies([{ name: 'wconvert_ds_dir', value: run.direction, url: baseURL }]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await login(page);
    await openFlow(page, run.name);

    const zoom = () => page.getByLabel('Zoom level').textContent().then(text => Number.parseInt(text ?? '0', 10));
    expect(await zoom(), 'Fit stays readable').toBeGreaterThanOrEqual(70);

    const geometry = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('.wconvert-flow-card, .wconvert-flow-group, .wconvert-flow-pill')]
        .map(element => ({ name: element.getAttribute('data-flow-node') ?? element.textContent?.slice(0, 30), rect: element.getBoundingClientRect() }));
      const overlaps = [];
      for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
        const [x, y] = [boxes[a].rect, boxes[b].rect];
        if (x.left < y.right - 0.5 && y.left < x.right - 0.5 && x.top < y.bottom - 0.5 && y.top < x.bottom - 0.5) overlaps.push(`${boxes[a].name} × ${boxes[b].name}`);
      }
      return { overlaps, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        order: [...document.querySelectorAll('[data-flow-key]')].map(element => element.getAttribute('data-flow-key')) };
    });
    expect(geometry.overlaps).toEqual([]);
    expect(geometry.overflow, 'no sideways page scroll').toBeLessThanOrEqual(1);

    // Tab reaches the map once; ↓ walks the cards in DOM (reading) order.
    await page.locator('[data-flow-key]').first().focus();
    const walked = [await page.evaluate(() => document.activeElement?.getAttribute('data-flow-key'))];
    for (let step = 1; step < geometry.order.length; step++) {
      await page.keyboard.press('ArrowDown');
      walked.push(await page.evaluate(() => document.activeElement?.getAttribute('data-flow-key')));
    }
    expect(walked).toEqual(geometry.order);

    // Ctrl+wheel zooms the map, and only the map.
    const before = await zoom();
    const viewport = page.locator('.wconvert-flow-viewport');
    const box = await viewport.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, before >= 100 ? 120 : -120);
    await page.keyboard.up('Control');
    await expect.poll(zoom).not.toBe(before);
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);

    await info.attach(`${run.name}-${run.direction}-${run.viewport.width}`, { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
    expect(errors).toEqual([]);
    await context.close();
  });
}
