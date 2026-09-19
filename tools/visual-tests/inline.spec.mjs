import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Keep the production renderer's closed shadow root while retaining a test
  // handle for assertions about the actual form and rendered surface.
  await page.addInitScript(() => {
    const attach = Element.prototype.attachShadow;
    window.testShadows = [];
    window.testBeacons = [];
    window.testLayoutShift = 0;
    Element.prototype.attachShadow = function (options) {
      const shadow = attach.call(this, options);
      window.testShadows.push(shadow);
      return shadow;
    };
    const sendBeacon = navigator.sendBeacon?.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      window.testBeacons.push(String(url));
      return sendBeacon ? sendBeacon(url, data) : false;
    };
    if (window.PerformanceObserver?.supportedEntryTypes?.includes('layout-shift')) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.testLayoutShift += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    }
  });
});

// The editor check intentionally exercises the builder floor and the coarse
// pointer target rule; visitor cases retain the default desktop context.
const editorTest = test.extend({ viewport: { width: 782, height: 900 }, hasTouch: true });

async function openFixture(page, scenario, theme = 'classic', rtl = false) {
  const query = new URLSearchParams({ wconvert_inline: scenario, wconvert_theme: theme });
  if (rtl) query.set('rtl', '1');
  await page.goto(`/?${query.toString()}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Playground may answer the first request after a theme switch with its
  // same-URL canonical redirect. Reloading that URL gives the real rendered
  // document without coupling the test to Playground's redirect timing.
  if (await page.locator('meta[name="wconvert-inline-fixture"]').count() === 0) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  await expect(page.locator('meta[name="wconvert-inline-fixture"]')).toHaveAttribute('content', scenario);
  await expect(page.locator('meta[name="wconvert-inline-theme"]')).toHaveAttribute('content', theme === 'block' ? 'block' : 'classic');
}

async function markerState(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-wconvert-auto]')].map((node) => ({
    id: node.getAttribute('data-wconvert-auto'),
    owner: node.getAttribute('data-wconvert-owner'),
    anchor: node.getAttribute('data-wconvert-optin'),
    children: node.childElementCount,
    hidden: node.hidden,
    rect: node.getBoundingClientRect().toJSON(),
  })));
}

async function orderState(page) {
  return page.evaluate(() => {
    const marker = [...document.querySelectorAll('[data-wconvert-auto]')]
      .find((node) => node.childElementCount > 0) ?? document.querySelector('[data-wconvert-auto]');
    const one = document.querySelector('[data-inline-paragraph="one"]');
    const nested = document.querySelector('[data-inline-nested="true"]');
    const two = document.querySelector('[data-inline-paragraph="two"]');
    const three = document.querySelector('[data-inline-paragraph="three"]');
    const before = (left, right) => Boolean(left && right && (left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING));
    return {
      marker: Boolean(marker),
      beforeOne: before(marker, one),
      afterNested: before(nested, marker),
      afterTwo: before(two, marker),
      beforeThree: before(marker, three),
      markerTop: marker?.getBoundingClientRect().top ?? null,
      articleOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function selectedMarker(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-wconvert-auto]')]
    .map((node) => ({ id: node.getAttribute('data-wconvert-auto'), children: node.childElementCount, anchor: node.getAttribute('data-wconvert-optin') }))
    .find((entry) => entry.children > 0) ?? null);
}

test('automatic inline inserts before content in a classic theme and after content in a block theme', async ({ page }) => {
  await openFixture(page, 'before', 'classic');
  let order = await orderState(page);
  expect(order).toMatchObject({ marker: true, beforeOne: true });
  expect(order.afterNested).toBe(false);

  await openFixture(page, 'after', 'block');
  order = await orderState(page);
  expect(order).toMatchObject({ marker: true, afterTwo: true, afterNested: true });
  expect(order.beforeThree).toBe(false);
});

test('after-paragraph uses top-level paragraphs and ignores nested paragraphs', async ({ page }) => {
  for (const theme of ['classic', 'block']) {
    await openFixture(page, 'paragraph', theme);
    const order = await orderState(page);
    expect(order).toMatchObject({ marker: true, afterNested: true, afterTwo: true, beforeThree: true });
  }
});

test('out-of-range paragraph placement falls back after content or skips', async ({ page }) => {
  await openFixture(page, 'fallback-after', 'classic');
  let order = await orderState(page);
  expect(order).toMatchObject({ marker: true, afterTwo: true, afterNested: true });
  expect(order.beforeThree).toBe(false);

  await openFixture(page, 'fallback-skip', 'block');
  expect(await page.locator('[data-wconvert-auto]').count()).toBe(0);
  expect(await page.locator('[data-wconvert-optin]').count()).toBe(0);
});

test('manual anchor for the same campaign wins over its automatic placeholder', async ({ page }) => {
  await openFixture(page, 'manual', 'classic');
  const state = await markerState(page);
  expect(state).toHaveLength(1);
  expect(state[0]).toMatchObject({ anchor: null, children: 0 });
  const rendered = await page.evaluate(() => [...document.querySelectorAll('[data-wconvert-optin]')]
    .map((node) => ({ node: node.outerHTML.slice(0, 200), children: node.childElementCount })));
  expect(rendered).toHaveLength(1);
  expect(rendered[0].children).toBeGreaterThan(0);
});

test('recursive the_content from a secondary query does not duplicate automatic placement', async ({ page }) => {
  await openFixture(page, 'recursive', 'classic');
  await expect(page.locator('[data-inline-secondary="true"]')).toBeVisible();
  expect(await page.locator('[data-wconvert-auto]').count()).toBe(1);
  expect((await markerState(page))[0].children).toBeGreaterThan(0);
});

test('priority is resolved only among eligible automatic candidates', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, 'priority', 'classic');
  let selected = await selectedMarker(page);
  expect(selected).not.toBeNull();
  const desktopOrder = await orderState(page);
  expect(desktopOrder.beforeOne).toBe(false);
  expect(desktopOrder.beforeThree).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, 'priority', 'block');
  selected = await selectedMarker(page);
  expect(selected).not.toBeNull();
  const mobileOrder = await orderState(page);
  expect(mobileOrder.beforeOne).toBe(true);
});

test('automatic inline reports an impression on entry and captures a real lead', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, 'capture', 'block');
  const initial = await orderState(page);
  expect(initial.markerTop).toBeGreaterThan(844);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.testBeacons.filter((url) => url.includes('/wconvert/v1/beacon')).length)).toBe(0);

  // Chromium exposes a sendBeacon request without postData(), but the real
  // endpoint and POST method still prove the forwarded impression left the
  // browser. The test-only wrapper also lets us assert exact beacon count.
  const impression = page.waitForRequest((request) => request.url().includes('/wconvert/v1/beacon') && request.method() === 'POST');
  await page.locator('[data-wconvert-auto]').scrollIntoViewIfNeeded();
  const impressionRequest = await impression;
  expect(impressionRequest.method()).toBe('POST');
  await expect.poll(() => page.evaluate(() => window.testBeacons.filter((url) => url.includes('/wconvert/v1/beacon')).length)).toBe(1);

  const capture = page.waitForRequest((request) => request.url().includes('/wconvert/v1/capture') && request.method() === 'POST');
  await page.evaluate(() => {
    const root = window.testShadows.find((shadow) => shadow.querySelector('.wc-root'));
    const form = root?.querySelector('form');
    const email = root?.querySelector('input[name="email"]');
    if (!form || !email) throw new Error('Automatic inline form was not mounted');
    email.value = 'automatic-inline@example.test';
    form.requestSubmit();
  });
  const captureRequest = await capture;
  expect(JSON.parse(captureRequest.postData()).fields.email).toBe('automatic-inline@example.test');
  await expect.poll(() => page.evaluate(() => window.testShadows
    .map((shadow) => shadow.querySelector('h2')?.textContent ?? '')
    .find((text) => text !== '') ?? '')).toMatch(/Thanks for reading|Request received/);
});

test('RTL mobile automatic inline has no horizontal overflow, autofocus jump, or excessive layout shift', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, 'capture', 'block', true);
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => ({
    direction: document.documentElement.dir,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrollY,
    active: document.activeElement?.tagName,
    cls: window.testLayoutShift,
  }));
  expect(state.direction).toBe('rtl');
  expect(state.overflow).toBeLessThanOrEqual(1);
  expect(state.scrollY).toBe(0);
  expect(state.active).toBe('BODY');
  expect(state.cls).toBeLessThanOrEqual(0.1);
});

editorTest('goal-first inline setup enables automatic placement and publishes', async ({ page }, info) => {
  await page.goto('/wp-login.php');
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/wp-admin/admin.php?page=wconvert#optins');
  await page.getByRole('button', { name: 'Create campaign', exact: true }).click();
  await page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Grow my email list', exact: true }) }).getByRole('button', { name: 'Choose', exact: true }).click();
  await page.getByRole('combobox', { name: 'Format', exact: true }).selectOption('inline');
  await expect(page.getByText('Newsletter signup after an article', { exact: true })).toBeVisible();
  await expect(page.getByText('Inline form', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Use this setup', exact: true }).click();

  // Placement authoring belongs only to Display rules. Design must contain no
  // placement summary or route, in either the initial manual state or later
  // automatic state.
  const design = page.getByRole('tabpanel', { name: 'Design', exact: true });
  await expect(design).toBeVisible();
  await expect(design.getByText('Manual — block or shortcode', { exact: true })).toHaveCount(0);
  await expect(design.getByRole('button', { name: 'Change inline placement', exact: true })).toHaveCount(0);

  const rulesTab = page.getByRole('tab', { name: 'Display rules', exact: true });
  await rulesTab.click();
  await expect(rulesTab).toHaveAttribute('aria-selected', 'true');
  const placement = page.getByRole('button', { name: 'Placement Manual — block or shortcode', exact: true });
  await expect(placement).toBeVisible();
  await expect(placement).toHaveAttribute('aria-expanded', 'false');
  await placement.click();
  await expect(placement).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Loading placement settings…', { exact: true })).toBeHidden({ timeout: 30000 });
  const placementPanel = page.locator('#wconvert-section-placement');
  const method = placementPanel.getByRole('group', { name: 'Placement method', exact: true });
  await expect(method).toBeVisible();
  await expect(placementPanel.getByText('Inline placement', { exact: true })).toHaveCount(0);
  await expect(placementPanel.getByRole('heading')).toHaveCount(0);
  await expect(placementPanel.locator('fieldset')).toHaveCount(0);
  await expect(placementPanel.locator('.wconvert-overlay-placement')).toHaveCount(0);
  await expect(method).toHaveClass(/wconvert-choice-set/);
  const manual = method.getByRole('radio', { name: 'Manual — block or shortcode', exact: true });
  const automatic = method.getByRole('radio', { name: 'Automatic', exact: true });
  await expect(automatic).toBeVisible();
  const choices = method.locator('label.wconvert-choice');
  await expect(choices).toHaveCount(2);
  for (let index = 0; index < 2; index++) {
    const box = await choices.nth(index).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  // The builder floor must wrap the shared labels without horizontal overflow;
  // RTL exercises logical padding/flow and the same coarse hit targets.
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  const narrow = await page.evaluate(() => {
    const panel = document.querySelector('#wconvert-section-placement');
    return panel ? {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      panelOverflow: panel.scrollWidth - panel.clientWidth,
      whiteSpace: getComputedStyle(panel.querySelector('.wconvert-choice__label')).whiteSpace,
    } : null;
  });
  expect(narrow).not.toBeNull();
  expect(narrow.overflow).toBeLessThanOrEqual(1);
  expect(narrow.panelOverflow).toBeLessThanOrEqual(1);
  expect(narrow.whiteSpace).toBe('normal');
  await page.screenshot({ path: info.outputPath('inline-placement-manual-782-rtl.png'), fullPage: true });

  // The editor intentionally leaves the radio unchecked until the explicit
  // confirmation button commits automatic placement.
  await manual.focus();
  await page.keyboard.press('ArrowRight');
  await expect(automatic).toBeFocused();
  const enable = page.getByRole('group', { name: 'Enable automatic placement' });
  await expect(enable).toBeVisible();
  await enable.getByRole('button', { name: 'Enable automatic placement', exact: true }).click();
  await expect(automatic).toBeChecked();
  await expect(page.getByLabel('Position in content', { exact: true })).toHaveValue('after_content');
  await expect(page.getByLabel('Automatic placement priority', { exact: true })).toHaveValue('0');
  await page.screenshot({ path: info.outputPath('inline-placement-automatic-782-rtl.png'), fullPage: true });

  // Return to Design: placement remains entirely absent, including after the
  // automatic state has been committed.
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(design.getByText('Automatically after content', { exact: true })).toHaveCount(0);
  await expect(design.getByRole('button', { name: 'Change inline placement', exact: true })).toHaveCount(0);
  await expect(design.getByRole('radio', { name: 'Automatic', exact: true })).toHaveCount(0);

  // Return to Display rules to prove the placement survives the tab round trip.
  await rulesTab.click();
  await expect(rulesTab).toHaveAttribute('aria-selected', 'true');
  const persistedPlacement = page.getByRole('button', { name: 'Placement Automatically after content', exact: true });
  await expect(persistedPlacement).toBeVisible();
  if (await persistedPlacement.getAttribute('aria-expanded') !== 'true') await persistedPlacement.click();
  await expect(persistedPlacement).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Loading placement settings…', { exact: true })).toBeHidden({ timeout: 30000 });
  await expect(page.getByRole('radio', { name: 'Automatic', exact: true })).toBeChecked();
  await expect(page.getByLabel('Position in content', { exact: true })).toHaveValue('after_content');
  await expect(page.getByLabel('Automatic placement priority', { exact: true })).toHaveValue('0');

  // The disposable Playground has no connected service. Exercise the real
  // product's explicit local lead-storage choice so this test can publish
  // without inventing a destination or mutating an external account.
  await page.getByRole('tab', { name: 'Destinations', exact: true }).click();
  const collectOnly = page.getByRole('radio', { name: 'Collect only in WConvert', exact: true });
  await collectOnly.click();
  await expect(collectOnly).toBeChecked();
  await page.getByRole('button', { name: 'Review & publish', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review & publish' });
  await expect(review).toBeVisible();
  await expect(review).toContainText('Automatically after content');
  const publish = review.getByRole('button', { name: /Publish Campaign|Save & publish/, exact: true });
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByRole('status')).toContainText('Saved and published');
});

test.afterEach(async ({ page }, info) => {
  if (test.info().status !== test.info().expectedStatus) {
    await info.attach('failure', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' }).catch(() => undefined);
  }
});
