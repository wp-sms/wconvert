import { test, expect } from '@playwright/test';

const baseURL = 'http://127.0.0.1:9413';
const screens = [
  { route: 'optins', name: 'Campaigns', empty: 'Start with one good campaign.', full: 'Grow the list', retry: 'Try again' },
  { route: 'analytics', name: 'Analytics', empty: 'Your first results start with a live campaign', full: 'Results by goal', retry: 'Retry loading report' },
  { route: 'leads', name: 'Leads', empty: 'No submissions yet', full: 'Sarah Whitfield', retry: 'Retry loading submissions' },
  { route: 'settings?group=connections', name: 'Settings', empty: 'Leads are saved in WConvert only', full: 'Welcome email', retry: 'Refresh' },
];
const modes = [
  { name: 'desktop', viewport: { width: 1440, height: 1100 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
];
let auth;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(180000);
  // Repositories create the full fixtures; this never uses a saved WordPress database.
  const seed = await request.get('/?wconvert_visual_seed=1', { timeout: 120000 });
  expect(await seed.text()).toContain('seeded');
  const page = await browser.newPage({ baseURL });
  await page.goto('/wp-login.php');
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  auth = await page.context().storageState();
  await page.close();
});

async function commonChecks(page, direction) {
  await expect(page.locator('html')).toHaveCSS('direction', direction);
  await expect(page.locator('#wpfooter')).toBeHidden();
  await expect(page.getByRole('img', { name: 'VeronaLabs', exact: true })).toBeVisible();
  const layout = await page.evaluate(() => {
    const style = (selector, pseudo) => getComputedStyle(document.querySelector(selector), pseudo);
    const header = style('.wc-navigation-row', '::before');
    let headingSurface = document.querySelector('.wc-page-heading');
    while (headingSurface.parentElement && ['transparent', 'rgba(0, 0, 0, 0)'].includes(getComputedStyle(headingSurface).backgroundColor)) {
      headingSurface = headingSurface.parentElement;
    }
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      font: style('.wc-page-title').fontFamily,
      headlineBackground: getComputedStyle(headingSurface).backgroundColor,
      divider: header.borderTopWidth,
      dividerStart: header.insetInlineStart,
      dividerEnd: header.insetInlineEnd,
      footer: style('.wc-service-footer').backgroundColor,
      publisherDecoration: style('.wc-publisher').textDecorationLine,
      headers: [...document.querySelectorAll('[data-slot="region-header"]')].map((node) => {
        const s = getComputedStyle(node);
        return [s.paddingTop, s.paddingBottom];
      }),
    };
  });
  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.font).toContain('DM Sans');
  expect(layout.headlineBackground).toBe('rgb(234, 240, 237)');
  expect(layout.divider).toBe('1px');
  expect(layout.dividerStart).toBe(layout.dividerEnd);
  expect(layout.footer).toBe('rgb(24, 60, 64)');
  expect(layout.publisherDecoration).toBe('none');
  await page.locator('.wc-publisher').hover();
  await expect(page.locator('.wc-publisher')).toHaveCSS('text-decoration-line', 'none');
  for (const [top, bottom] of layout.headers) expect(top).toBe(bottom);
}

async function screenshot(page, info, name) {
  await page.evaluate(() => document.fonts.ready);
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

for (const mode of modes) for (const direction of ['ltr', 'rtl']) {
  for (const state of ['full', 'empty', 'loading', 'failed']) for (const screen of screens) {
    test(`${mode.name} ${direction} ${state} ${screen.name}`, async ({ browser }, info) => {
      const context = await browser.newContext({ baseURL, storageState: auth, viewport: mode.viewport });
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      let completed = false;
      try {
        await context.addCookies([
          { name: 'wconvert_ds_dir', value: direction, url: 'http://127.0.0.1:9413' },
          { name: 'wconvert_ds_state', value: state === 'full' ? '' : state, url: 'http://127.0.0.1:9413' },
        ]);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`/wp-admin/admin.php?page=wconvert#${screen.route}`);
        await expect(page.getByRole('heading', { name: screen.name, exact: true, level: 1 })).toBeVisible();
        if (state === 'full' || state === 'empty') {
          await expect(page.getByText(screen[state], { exact: true }).first()).toBeVisible();
        } else if (state === 'loading') {
          await expect(page.getByRole('status').filter({ hasText: /Loading/ }).first()).toBeVisible();
        } else {
          await expect(page.getByText('The database server is not responding.', { exact: false }).first()).toBeVisible();
          await expect(page.getByRole('button', { name: screen.retry, exact: true }).first()).toBeVisible();
        }
        await commonChecks(page, direction);
        await screenshot(page, info, 'page');
        if (state === 'failed') {
          await context.clearCookies({ name: 'wconvert_ds_state' });
          await page.getByRole('button', { name: screen.retry, exact: true }).first().click();
          await expect(page.getByText(screen.full, { exact: true }).first()).toBeVisible();
        }
        expect(errors).toEqual([]);
        completed = true;
      } finally { await finish(context, info, !completed); }
    });
  }

  test(`${mode.name} ${direction} dialogs and menus`, async ({ browser }, info) => {
    const context = await browser.newContext({ baseURL, storageState: auth, viewport: mode.viewport });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    let completed = false;
    try {
      await context.addCookies([{ name: 'wconvert_ds_dir', value: direction, url: 'http://127.0.0.1:9413' }]);
      const page = await context.newPage();
      await page.goto('/wp-admin/admin.php?page=wconvert#analytics');
      const tip = page.getByRole('button', { name: 'About reporting dates', exact: true });
      await expect(tip).toBeVisible();
      const toolbar = await page.evaluate(() => {
        const select = document.querySelector('[aria-label="Report period"]');
        const exportButton = [...document.querySelectorAll('button')].find((n) => n.textContent.includes('Export report'));
        const icon = document.querySelector('.wconvert-info-trigger svg');
        return {
          select: select.getBoundingClientRect().toJSON(),
          export: exportButton.getBoundingClientRect().toJSON(),
          arrow: getComputedStyle(select).backgroundImage,
          icon: icon.getBoundingClientRect().toJSON(),
        };
      });
      expect(toolbar.arrow).toContain('data:image/svg+xml');
      expect(toolbar.icon.width).toBe(16);
      expect(toolbar.icon.height).toBe(16);
      expect(toolbar.select.height).toBe(toolbar.export.height);
      if (mode.name === 'desktop') expect(toolbar.select.top).toBe(toolbar.export.top);
      const goalCards = page.locator('.wa-goal-card');
      expect(await goalCards.count()).toBeGreaterThan(0);
      for (const card of await goalCards.all()) await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      await tip.click();
      await layerChecks(page, page.getByRole('dialog', { name: 'About reporting dates' }));
      await screenshot(page, info, 'report-help');
      await page.keyboard.press('Escape');
      await expect(tip).toBeFocused();
      await page.getByRole('button', { name: /Set a monthly target|Edit targets/ }).click();
      await layerChecks(page, page.getByRole('dialog'));
      await screenshot(page, info, 'monthly-targets');
      await page.keyboard.press('Escape');
      await page.getByRole('navigation', { name: 'WConvert sections' }).getByRole('link', { name: 'Leads', exact: true }).click();
      const open = page.getByRole('button', { name: /^Open submission from/ }).first();
      await open.click();
      await layerChecks(page, page.getByRole('dialog', { name: 'Submission details', exact: true }));
      await screenshot(page, info, 'submission-details');
      await page.keyboard.press('Escape');
      await expect(open).toBeFocused();
      await page.getByRole('navigation', { name: 'WConvert sections' }).getByRole('link', { name: 'Campaigns', exact: true }).click();
      await page.getByRole('button', { name: /^More actions for/ }).first().click();
      await layerChecks(page, page.getByRole('menu', { name: /^More actions for/ }));
      await screenshot(page, info, 'campaign-menu');
      await page.keyboard.press('Escape');
      await page.getByRole('navigation', { name: 'WConvert sections' }).getByRole('link', { name: 'Settings', exact: true }).click();
      await page.getByRole('link', { name: 'Connections & destinations Accounts and where leads go', exact: true }).click();
      await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
      await expect(page.getByRole('textbox', { name: 'Name', exact: true }).first()).toBeVisible();
      await commonChecks(page, direction);
      await screenshot(page, info, 'destination-settings');
      await page.getByRole('button', { name: 'Need a hand? Help and resources' }).click();
      await layerChecks(page, page.getByRole('dialog'));
      await screenshot(page, info, 'footer-help');
      completed = true;
    } finally { await finish(context, info, !completed); }
  });
}

async function layerChecks(page, layer) {
  await expect(layer).toBeVisible();
  await expect(layer).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const rect = await layer.boundingBox();
  const size = page.viewportSize();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 1);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.y + rect.height).toBeLessThanOrEqual(size.height + 1);
}

async function finish(context, info, failed) {
  if (failed) {
    const page = context.pages()[0];
    if (page && !page.isClosed()) await screenshot(page, info, 'failure').catch(() => undefined);
    const path = info.outputPath('trace.zip');
    await context.tracing.stop({ path });
    await info.attach('trace', { path, contentType: 'application/zip' });
  } else {
    await context.tracing.stop();
  }
  await context.close();
}
