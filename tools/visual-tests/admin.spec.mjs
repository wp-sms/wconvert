import { test, expect } from '@playwright/test';

const baseURL = 'http://127.0.0.1:9413';
const screens = [
  { route: 'optins', name: 'Campaigns', empty: 'Get your first campaign live', full: 'Grow the list', retry: 'Try again' },
  { route: 'analytics', name: 'Analytics', empty: 'Your first results start with a live campaign', full: 'Results by goal', retry: 'Try again' },
  { route: 'leads', name: 'Leads', empty: 'No submissions yet', full: 'Sarah Whitfield', retry: 'Try again' },
  { route: 'settings?group=connections', name: 'Settings', empty: 'Leads are kept in WConvert only', full: 'Welcome email', retry: 'Try again' },
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
  // WordPress defers initial focus; wait before typing so it cannot redirect a fill.
  await expect(page.getByLabel('Username or Email Address')).toBeFocused();
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
  if (direction === 'rtl') {
    // ADR 0184: letter-spacing pulls Arabic script's joined letters apart.
    const spaced = await page.evaluate(() => [...document.querySelectorAll('#wconvert-admin *')]
      .filter((node) => [...node.childNodes].some((child) => child.nodeType === 3 && child.nodeValue.trim()))
      .filter((node) => getComputedStyle(node).direction === 'rtl' && getComputedStyle(node).letterSpacing !== 'normal')
      .map((node) => node.className));
    expect(spaced).toEqual([]);
  }
  await expect(page.getByRole('img', { name: 'VeronaLabs', exact: true })).toBeVisible();
  const layout = await page.evaluate(() => {
    const style = (selector, pseudo) => getComputedStyle(document.querySelector(selector), pseudo);
    const header = style('.wconvert-navigation-row', '::before');
    let headingSurface = document.querySelector('.wconvert-page-heading');
    while (headingSurface.parentElement && ['transparent', 'rgba(0, 0, 0, 0)'].includes(getComputedStyle(headingSurface).backgroundColor)) {
      headingSurface = headingSurface.parentElement;
    }
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      font: style('.wconvert-page-title').fontFamily,
      headlineBackground: getComputedStyle(headingSurface).backgroundColor,
      divider: header.borderTopWidth,
      dividerStart: header.insetInlineStart,
      dividerEnd: header.insetInlineEnd,
      footer: style('.wconvert-service-footer').backgroundColor,
      publisherDecoration: style('.wconvert-publisher').textDecorationLine,
      headers: [...document.querySelectorAll('[data-slot="region-header"]')].map((node) => {
        const s = getComputedStyle(node);
        return [s.paddingTop, s.paddingBottom];
      }),
    };
  });
  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.font).toContain('DM Sans');
  expect(layout.headlineBackground).toBe('rgb(246, 245, 241)');
  expect(layout.divider).toBe('1px');
  expect(layout.dividerStart).toBe(layout.dividerEnd);
  expect(layout.footer).toBe('rgb(48, 39, 32)');
  expect(layout.publisherDecoration).toBe('none');
  await page.locator('.wconvert-publisher').hover();
  await expect(page.locator('.wconvert-publisher')).toHaveCSS('text-decoration-line', 'none');
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
          // A screen can hold more than one region that fails (Settings: destinations and AI agents),
          // and the first to fail is enough for the checks above. Let every region settle, then
          // retry each once, last first so a button that goes cannot shift the ones before it.
          await expect(page.getByRole('status').filter({ hasText: /Loading/ })).toHaveCount(0);
          await context.clearCookies({ name: 'wconvert_ds_state' });
          const retries = await page.getByRole('button', { name: screen.retry, exact: true }).all();
          for (const retry of retries.reverse()) await retry.click();
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
      // The date picker replaced the period select and its date-scope InfoTip (ADR 0132).
      const period = page.getByRole('button', { name: /^Report period/ });
      await expect(period).toBeVisible();
      // The picker is drawn before the report arrives (it names the window while
      // it loads), so wait for the report itself rather than for the control.
      await expect(page.locator('.wa-goal-card').first()).toBeVisible();
      const toolbar = await page.evaluate(() => {
        const trigger = document.querySelector('.wconvert-date-picker__trigger');
        const exportButton = [...document.querySelectorAll('button')].find((n) => n.textContent.includes('Export CSV'));
        return {
          period: trigger.getBoundingClientRect().toJSON(),
          export: exportButton.getBoundingClientRect().toJSON(),
        };
      });
      expect(toolbar.period.height).toBe(toolbar.export.height);
      if (mode.name === 'desktop') expect(toolbar.period.top).toBe(toolbar.export.top);
      const goalCards = page.locator('.wa-goal-card');
      expect(await goalCards.count()).toBeGreaterThan(0);
      for (const card of await goalCards.all()) await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      await period.click();
      await layerChecks(page, page.getByRole('dialog'));
      await screenshot(page, info, 'report-period');
      await page.keyboard.press('Escape');
      await expect(period).toBeFocused();
      await page.getByRole('button', { name: /Set a monthly target|Edit targets/ }).click();
      await layerChecks(page, page.getByRole('dialog'));
      await screenshot(page, info, 'monthly-targets');
      await page.keyboard.press('Escape');
      await page.getByRole('navigation', { name: 'WConvert sections' }).getByRole('link', { name: 'Leads', exact: true }).click();
      const open = page.getByRole('button', { name: /^Open submission from/ }).first();
      await open.click();
      await layerChecks(page, page.getByRole('dialog'));
      await screenshot(page, info, 'submission-details');
      await page.keyboard.press('Escape');
      await expect(open).toBeFocused();
      await page.getByRole('navigation', { name: 'WConvert sections' }).getByRole('link', { name: 'Campaigns', exact: true }).click();
      await page.getByRole('button', { name: /^More actions for/ }).first().click();
      await layerChecks(page, page.getByRole('menu', { name: /^More actions for/ }));
      await screenshot(page, info, 'campaign-menu');
      await page.keyboard.press('Escape');
      await page.getByRole('navigation', { name: 'WConvert sections' }).getByRole('link', { name: 'Settings', exact: true }).click();
      // Settings opens on Connections & destinations (ADR 0132); phones show the rail as a select.
      await expect(page.getByRole('heading', { name: 'Destinations', exact: true })).toBeVisible();
      await commonChecks(page, direction);
      // A destination's settings open in their own dialog (ADR 0132).
      await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
      const settings = page.getByRole('dialog');
      await expect(settings.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible();
      await layerChecks(page, settings);
      await screenshot(page, info, 'destination-settings');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Need a hand? Help' }).click();
      await layerChecks(page, page.getByRole('dialog'));
      await screenshot(page, info, 'footer-help');
      completed = true;
    } finally { await finish(context, info, !completed); }
  });
}

/*
 * Nothing above opens a goal report or reads its chart, so these do (ADR 0185).
 * Each one has the fixture's report handed a finding, because whether the seeded
 * numbers trip a rule depends on the random days they drew.
 */
const FINDING = {
  rule_id: 'no_appearances', fingerprint: 'visual', optin_id: 'visual', goal: 'grow_email_list', name: 'Visual check',
  result_label: 'Email submissions', rate_label: 'Email submission rate', title: 'Not shown in this period', note: 'Review display rules.',
  limitation: 'The cause is unknown.', action: 'display',
  facts: { current: { appearances: 0, results: 0, rate: null }, previous: null },
  periods: { from: '2026-09-01', to: '2026-09-30', previous_from: null, previous_to: null },
};

async function openReadableReport(browser, width, direction = 'ltr') {
  const context = await browser.newContext({ baseURL, storageState: auth, viewport: { width, height: 1000 } });
  await context.addCookies([{ name: 'wconvert_ds_dir', value: direction, url: baseURL }]);
  const page = await context.newPage();
  await page.route(/wconvert(?:%2F|\/)v1(?:%2F|\/)dashboard\b/, async (route) => {
    const response = await route.fetch();
    const report = await response.json();
    await route.fulfill({ response, json: { ...report, insights: [FINDING] } });
  });
  await page.goto('/wp-admin/admin.php?page=wconvert#analytics');
  // `a`, because the skeleton draws the same class on a plain box.
  await expect(page.locator('a.wa-goal-card').first()).toBeVisible();
  // A later read may still be on its way when a test ends.
  return { page, close: async () => { await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); } };
}

const noSidewaysScroll = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

for (const [width, dates] of [[1440, 5], [360, 3]]) {
  test(`analytics at ${width}: the chart reaches the plot's edges and reads one day`, async ({ browser }, info) => {
    const { close, page } = await openReadableReport(browser, width);
    try {
      await noSidewaysScroll(page);
      await page.locator('a.wa-goal-card').first().click();
      const plot = page.locator('.wa-chart-plot');
      await expect(plot).toBeVisible();
      await noSidewaysScroll(page);
      const edges = await page.evaluate(() => {
        const box = document.querySelector('.wa-chart-plot').getBoundingClientRect();
        const lines = [...document.querySelectorAll('.wa-current-line')].map((line) => line.getBoundingClientRect());
        return { start: Math.min(...lines.map((line) => line.left)) - box.left, end: box.right - Math.max(...lines.map((line) => line.right)) };
      });
      expect(Math.abs(edges.start)).toBeLessThanOrEqual(1);
      expect(Math.abs(edges.end)).toBeLessThanOrEqual(1);
      await expect(page.locator('.wa-chart-dates > span')).toHaveCount(dates);
      const text = await page.evaluate(() => getComputedStyle(document.querySelector('.wa-chart text')).fontSize);
      const tip = page.locator('.wa-chart-tip');
      await expect(tip).toHaveCount(0);
      const box = await plot.boundingBox();
      for (const along of [0.02, 0.5, 0.98]) {
        await page.mouse.move(box.x + box.width * along, box.y + box.height / 2);
        await expect(tip).toBeVisible();
        const shown = await tip.boundingBox();
        expect(shown.x).toBeGreaterThanOrEqual(box.x - 1);
        expect(shown.x + shown.width).toBeLessThanOrEqual(box.x + box.width + 1);
        await noSidewaysScroll(page);
      }
      await screenshot(page, info, 'chart-hover');
      await expect(page.locator('.wa-chart-cursor')).toHaveCount(1);
      await page.mouse.move(0, 0);
      await expect(tip).toHaveCount(0);
      // Real pixels, not a scaled drawing: the same size at every width.
      expect(text).toBe('11px');
    } finally { await close(); }
  });
}

test('analytics: a problem card has an amber header over white rows', async ({ browser }, info) => {
  const { close, page } = await openReadableReport(browser, 1440);
  try {
    const header = page.locator('[data-slot="region-header"]').filter({ hasText: 'Needs attention' });
    await expect(header).toHaveCSS('background-color', 'rgb(254, 248, 234)');
    await expect(header.locator('.wconvert-region-icon')).toHaveCSS('background-color', 'rgb(253, 236, 200)');
    const card = page.locator('section').filter({ has: header });
    await expect(card).toHaveCSS('border-top-color', 'rgb(239, 220, 180)');
    await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await screenshot(page, info, 'needs-attention');
  } finally { await close(); }
});

test('analytics: Jump to sits in the header and focuses the section it names', async ({ browser }) => {
  const { close, page } = await openReadableReport(browser, 1440);
  try {
    const trigger = page.getByRole('button', { name: 'Jump to' });
    const exportButton = page.getByRole('button', { name: 'Export CSV' });
    expect((await trigger.boundingBox()).y).toBe((await exportButton.boundingBox()).y);
    expect((await trigger.boundingBox()).x).toBeLessThan((await page.locator('.wconvert-date-picker__trigger').boundingBox()).x);
    await trigger.click();
    await page.getByRole('menuitem', { name: 'Results by goal' }).click();
    await expect(page.getByRole('group', { name: 'Results by goal' })).toBeFocused();
  } finally { await close(); }
});

test('analytics in right-to-left: the dates sit under their own end of the line', async ({ browser }, info) => {
  const { close, page } = await openReadableReport(browser, 1440, 'rtl');
  try {
    await page.locator('a.wa-goal-card').first().click();
    await expect(page.locator('.wa-chart-plot')).toBeVisible();
    const ends = await page.evaluate(() => {
      const box = document.querySelector('.wa-chart-plot').getBoundingClientRect();
      const dates = [...document.querySelectorAll('.wa-chart-dates > span')].map((date) => date.getBoundingClientRect());
      return { first: dates[0].left - box.left, last: box.right - dates.at(-1).right };
    });
    expect(Math.abs(ends.first)).toBeLessThanOrEqual(1);
    expect(Math.abs(ends.last)).toBeLessThanOrEqual(1);
    await screenshot(page, info, 'chart-rtl');
  } finally { await close(); }
});

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
