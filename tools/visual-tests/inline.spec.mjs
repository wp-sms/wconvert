import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Keep the production renderer's closed shadow root while retaining a test
  // handle for assertions about the actual form and rendered surface.
  await page.addInitScript(() => {
    const attach = Element.prototype.attachShadow;
    window.testShadows = [];
    window.testBeacons = [];
    window.testBeaconEvents = [];
    window.testLayoutShift = 0;
    Element.prototype.attachShadow = function (options) {
      const shadow = attach.call(this, options);
      window.testShadows.push(shadow);
      return shadow;
    };
    const sendBeacon = navigator.sendBeacon?.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      window.testBeacons.push(String(url));
      if (String(url).includes("/wconvert/v1/beacon") && data instanceof Blob) void data.text().then(text => window.testBeaconEvents.push(...JSON.parse(text).events));
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

test('the native block widget renders a manual Campaign in a narrow classic-theme sidebar', async ({ page }) => {
  await openFixture(page, 'widget', 'classic');
  const read = () => page.evaluate(() => {
    const area = document.querySelector('[data-inline-widget-area="true"]');
    const anchor = area?.querySelector('[data-wconvert-optin]');
    return {
      area: area !== null,
      width: area?.getBoundingClientRect().width ?? 0,
      children: anchor?.childElementCount ?? 0,
      overflow: area ? area.scrollWidth - area.clientWidth : 999,
    };
  });
  await expect.poll(read).toMatchObject({ area: true, width: 280, children: 1 });
  const state = await read();
  expect(state.overflow).toBeLessThanOrEqual(1);
  expect(await page.locator('[data-wconvert-auto]').count()).toBe(0);
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
  // browser. The wrapper distinguishes Campaign impressions from screen activity.
  const impression = page.waitForRequest((request) => request.url().includes('/wconvert/v1/beacon') && request.method() === 'POST');
  await page.locator('[data-wconvert-auto]').scrollIntoViewIfNeeded();
  const impressionRequest = await impression;
  expect(impressionRequest.method()).toBe('POST');
  await expect.poll(() => page.evaluate(() => window.testBeaconEvents.filter(event => event.kind === 'impression').length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.testBeaconEvents.filter(event => event.kind === 'screen_shown').length)).toBe(1);

  const capture = page.waitForRequest((request) => request.url().includes('/wconvert/v1/capture') && request.method() === 'POST' && Boolean(request.postDataJSON()?.submission));
  await page.evaluate(() => {
    const root = window.testShadows.find((shadow) => shadow.querySelector('.wc-root'));
    const form = root?.querySelector('form');
    const email = root?.querySelector('input[name="email"]');
    if (!form || !email) throw new Error('Automatic inline form was not mounted');
    email.value = 'automatic-inline@example.test';
    for (const checkbox of root.querySelectorAll('input[type="checkbox"][required]')) checkbox.checked = true;
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

test('the Campaign picker loads in WordPress Widgets and Site Editor contexts', async ({ page }) => {
  await openFixture(page, 'widget', 'classic');
  await page.goto('/wp-login.php');
  await expect(page.getByLabel('Username or Email Address')).toBeFocused();
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');

  await page.goto('/wp-admin/widgets.php');
  await expect.poll(() => page.evaluate(() => window.wp?.blocks?.getBlockType('wconvert/inline-optin')?.name ?? null)).toBe('wconvert/inline-optin');
  await expect.poll(() => page.evaluate(() => Array.isArray(window.wconvertInlineOptins?.campaigns) ? window.wconvertInlineOptins.campaigns.length : -1)).toBeGreaterThan(0);

  await openFixture(page, 'widget', 'block');
  await page.goto('/wp-admin/site-editor.php');
  await expect.poll(() => page.evaluate(() => window.wp?.blocks?.getBlockType('wconvert/inline-optin')?.name ?? null)).toBe('wconvert/inline-optin');
  await expect.poll(() => page.evaluate(() => Array.isArray(window.wconvertInlineOptins?.campaigns) ? window.wconvertInlineOptins.campaigns.length : -1)).toBeGreaterThan(0);
});

editorTest('goal-first inline setup enables automatic placement and publishes', async ({ page }, info) => {
  await page.goto('/wp-login.php');
  await expect(page.getByLabel('Username or Email Address')).toBeFocused();
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/wp-admin/admin.php?page=wconvert#optins');
  await page.getByRole('button', { name: 'Create campaign', exact: true }).click();
  await page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Grow my email list', exact: true }) }).getByRole('button', { name: 'Choose: Grow my email list', exact: true }).click();
  const inline = page.getByRole('radio', { name: 'Inline form', exact: true });
  await page.locator('label').filter({ has: inline }).click();
  await expect(inline).toBeChecked();
  await expect(page.getByText('Newsletter signup after an article', { exact: true })).toBeVisible();
  await expect(page.getByText('Inline form', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Setup details for Newsletter signup after an article', exact: true }).click();
  await page.getByRole('button', { name: 'Use this setup', exact: true }).click();

  // Placement authoring belongs only to Display rules. Design must contain no
  // placement summary or route, in either the initial manual state or later
  // automatic state.
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const design = page.getByRole('tabpanel', { name: 'Design', exact: true });
  await expect(design).toBeVisible();
  await expect(design.getByText('Manual', { exact: true })).toHaveCount(0);
  await expect(design.getByRole('button', { name: 'Change inline placement', exact: true })).toHaveCount(0);

  const rulesTab = page.getByRole('tab', { name: 'Display rules', exact: true });
  await rulesTab.click();
  await expect(rulesTab).toHaveAttribute('aria-selected', 'true');
  const rulesPanel = page.getByRole('tabpanel', { name: 'Display rules', exact: true });
  const pages = rulesPanel.getByRole('navigation', { name: 'Display rules', exact: true }).getByRole('button', { name: /^Where does it show\?/ });
  await pages.click();
  await expect(pages).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('Loading placement settings…', { exact: true })).toBeHidden({ timeout: 30000 });
  const placementPanel = rulesPanel.getByRole('heading', { name: 'Placement', exact: true }).locator('..');
  const method = placementPanel.getByRole('group', { name: 'Placement method', exact: true });
  await expect(method).toBeVisible();
  await expect(placementPanel.getByText('Inline placement', { exact: true })).toHaveCount(0);
  await expect(placementPanel.getByRole('heading', { name: 'Placement', exact: true })).toBeVisible();
  await expect(placementPanel.locator('fieldset')).toHaveCount(0);
  await expect(placementPanel.locator('.wconvert-overlay-placement')).toHaveCount(0);
  // The method is the shared quick-pick row (ADR 0129), on its 2.25rem floor.
  await expect(method).toHaveClass(/wconvert-quick-picks/);
  const manual = method.getByRole('radio', { name: 'Manual', exact: true });
  const automatic = method.getByRole('radio', { name: 'Automatic', exact: true });
  await expect(manual).toBeChecked();
  const choices = method.locator('label.wconvert-quick-pick');
  await expect(choices).toHaveCount(3);
  for (let index = 0; index < 3; index++) {
    const box = await choices.nth(index).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);
  }

  // The builder floor must wrap the shared labels without horizontal overflow;
  // RTL exercises logical padding/flow and the same coarse hit targets.
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  const narrow = await placementPanel.evaluate(panel => {
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      panelOverflow: panel.scrollWidth - panel.clientWidth,
      whiteSpace: getComputedStyle(panel.querySelector('.wconvert-quick-pick')).whiteSpace,
    };
  });
  expect(narrow).not.toBeNull();
  expect(narrow.overflow).toBeLessThanOrEqual(1);
  expect(narrow.panelOverflow).toBeLessThanOrEqual(1);
  expect(narrow.whiteSpace).toBe('normal');
  await page.screenshot({ path: info.outputPath('inline-placement-manual-782-rtl.png'), fullPage: true });

  // Choosing Automatic applies at once. The playbook already opens right away
  // on blog posts, so it changes no other answer and asks for no confirmation.
  await manual.focus();
  await page.keyboard.press('ArrowLeft'); // Forward through native radios in RTL.
  await expect(automatic).toBeFocused();
  await expect(automatic).toBeChecked();
  await expect(placementPanel.getByText('Switch to automatic placement?', { exact: true })).toHaveCount(0);
  const position = placementPanel.getByRole('group', { name: 'Position in the content', exact: true });
  await expect(position.getByRole('radio', { name: 'After the content', exact: true })).toBeChecked();
  await expect(placementPanel.getByLabel('Priority', { exact: true })).toHaveValue('0');
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
  await pages.click();
  await expect(pages).toHaveAttribute('aria-current', 'true');
  await expect(placementPanel).toBeVisible();
  await expect(page.getByText('Loading placement settings…', { exact: true })).toBeHidden({ timeout: 30000 });
  await expect(page.getByRole('radio', { name: 'Automatic', exact: true })).toBeChecked();
  await expect(position.getByRole('radio', { name: 'After the content', exact: true })).toBeChecked();
  await expect(placementPanel.getByLabel('Priority', { exact: true })).toHaveValue('0');

  // The disposable Playground has no connected service. Exercise the real
  // product's explicit local lead-storage choice so this test can publish
  // without inventing a destination or mutating an external account.
  await page.getByRole('tab', { name: 'Destinations', exact: true }).click();
  // The tab is cards and tiles rather than a checkbox list: it must hold at
  // the widest admin and at phone width, in both directions, with no
  // horizontal scroll on the page or inside the tab.
  const destinationsPanel = page.getByRole('tabpanel', { name: 'Destinations', exact: true });
  await expect(destinationsPanel.getByText('Saved in Leads', { exact: true })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const direction of ['ltr', 'rtl']) {
      await page.evaluate(dir => { document.documentElement.dir = dir; }, direction);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await expect.poll(() => destinationsPanel.evaluate(panel => panel.scrollWidth - panel.clientWidth)).toBeLessThanOrEqual(1);
      const always = await destinationsPanel.locator('.wconvert-destination-always').boundingBox();
      const panelBox = await destinationsPanel.boundingBox();
      expect(always && panelBox && always.x >= panelBox.x - 1 && always.x + always.width <= panelBox.x + panelBox.width + 1).toBe(true);
      await page.screenshot({ path: info.outputPath(`destinations-${width}-${direction}.png`), fullPage: true });
    }
  }
  await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
  await page.setViewportSize({ width: 782, height: 900 });
  const collectOnly = page.getByRole('radio', { name: 'Keep in WConvert only', exact: true });
  await collectOnly.click();
  await expect(collectOnly).toBeChecked();
  await page.getByRole('button', { name: 'Review & publish', exact: true }).click();
  const review = page.getByRole('dialog');
  await expect(review).toBeVisible();
  await expect(review).toContainText('Automatically after content');
  const publish = review.getByRole('button', { name: /^(Publish campaign|Save & publish)$/ });
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(review.getByRole('status')).toContainText('It’s live.');

  await page.getByRole('button', { name: 'Done', exact: true }).click();

  // The same published inline Campaign can explicitly switch from automatic
  // placement to a content region, preview fallback, and publish that choice.
  await rulesTab.click();
  await pages.click();
  await method.getByText('Content lock', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Content lock', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Automatic', exact: true })).not.toBeChecked();
  const previewButton = page.getByRole('button', { name: 'Preview & test', exact: true });
  const previewDialog = page.getByRole('dialog', { name: 'Preview & test', exact: true });
  const canvas = previewDialog.getByRole('region', { name: 'Design canvas', exact: true });
  const preview = canvas.getByLabel('Preview content lock', { exact: true });
  await expect(placementPanel.getByLabel('Preview content lock', { exact: true })).toHaveCount(0);
  // Display rules owns the full pane at every width; its preview opens in the
  // same dialog on desktop and at the builder floor.
  for (const width of [1440, 782]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(rulesPanel.getByRole('region', { name: 'Design canvas', exact: true })).toHaveCount(0);
    await previewButton.click();
    await expect(previewDialog).toBeVisible();
    await previewDialog.locator('label').filter({ has: page.getByRole('radio', { name: 'Check the design', exact: true }) }).click();
    await expect(preview).toBeVisible();
    for (const direction of ['ltr', 'rtl']) {
      await page.evaluate(dir => { document.documentElement.dir = dir; }, direction);
      for (const state of ['locked', 'unlocked', 'unavailable']) {
        await preview.selectOption(state);
        const example = canvas.getByLabel('Content lock example', { exact: true });
        await expect.poll(() => example.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      }
    }
    await page.keyboard.press('Escape');
    await expect(previewDialog).toBeHidden();
    await expect(previewButton).toBeFocused();
    for (const direction of ['ltr', 'rtl']) {
      await page.evaluate(dir => { document.documentElement.dir = dir; }, direction);
      await expect.poll(() => placementPanel.evaluate(panel => panel.scrollWidth - panel.clientWidth)).toBeLessThanOrEqual(1);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
  await expect(placementPanel.getByRole('button', { name: /Google/ })).toHaveCount(0);
  await expect(placementPanel).not.toContainText('—');
  await previewButton.click();
  await expect(previewDialog).toBeVisible();
  await previewDialog.locator('label').filter({ has: page.getByRole('radio', { name: 'Check the design', exact: true }) }).click();
  await preview.selectOption('locked');
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('content-lock-workspace.png'), fullPage: true });
  await preview.selectOption('unavailable');
  await expect(canvas.getByText('No submission recorded.', { exact: true })).toBeVisible();
  await preview.selectOption('locked');
  await page.keyboard.press('Escape');
  await expect(previewDialog).toBeHidden();
  await page.getByRole('button', { name: 'Review & publish', exact: true }).click();
  await expect(review).toContainText('Locks the selected region');
  await expect(publish).toBeEnabled();
  const published = page.waitForResponse(response => response.url().includes('/publish') && response.request().method() === 'POST');
  await publish.click(); expect((await published).ok()).toBe(true);
  await expect(review.getByRole('status')).toContainText('It’s live.');
  await expect(page.getByRole('dialog')).toContainText('Add the “WConvert lock from here” divider');
});

test.afterEach(async ({ page }, info) => {
  if (test.info().status !== test.info().expectedStatus) {
    await info.attach('failure', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' }).catch(() => undefined);
  }
});
