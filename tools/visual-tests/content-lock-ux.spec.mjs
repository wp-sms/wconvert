import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

const screenshotDir = resolve(process.cwd(), 'docs/guides/images');

test.beforeEach(async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: 'Welcome to the editor', exact: true }), async () => {
    await page.getByRole('dialog', { name: 'Welcome to the editor', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  });
  await page.addInitScript(() => {
    window.testShadows = [];
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      const root = attach.call(this, options); window.testShadows.push(root); return root;
    };
  });
});

async function editorScreenshot(page, path) {
  await page.evaluate(() => window.wp?.data?.dispatch('core/preferences').set('core', 'fixedToolbar', true));
  await page.frameLocator('iframe[name="editor-canvas"]').locator('body').evaluate(async () => {
    window.scrollTo(0, 0);
    for (const node of [document.scrollingElement, ...document.querySelectorAll('*')]) {
      if (node && node.scrollHeight > node.clientHeight) node.scrollTop = 0;
    }
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path, fullPage: true });
}

const editor = page => page.frameLocator('iframe[name="editor-canvas"]');

async function openFixture(page, kind, query = '') {
  await page.goto(`/?wconvert_lock=${kind}${query}`, { waitUntil: 'domcontentloaded' });
  if (await page.locator('body').textContent() === '') await page.reload();
  await expect(page.locator('[data-wconvert-content-lock]').first()).toBeAttached();
}

async function loginAndOpenEditor(page) {
  await page.goto('/wp-login.php');
  await expect(page.getByLabel('Username or Email Address')).toBeFocused();
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/wp-admin/post-new.php', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => !!window.wp?.blocks?.getBlockType('wconvert/content-lock-divider'))).toBe(true);
  await page.evaluate(() => window.wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false));
}

async function choose(page, name) {
  const picker = page.getByRole('combobox', { name: 'Campaign', exact: true });
  await picker.fill(name);
  await page.getByRole('option', { name: `Content lock ${name}`, exact: true }).click();
}

async function shadowText(page, selector = 'body') {
  return page.evaluate(selector => window.testShadows.flatMap(root => [...root.querySelectorAll(selector)].map(node => node.textContent?.trim() ?? '')), selector);
}

async function submitVisitor(page) {
  const response = page.waitForResponse(response => response.url().includes('/capture') && response.request().method() === 'POST');
  await page.evaluate(() => {
    const form = window.testShadows.flatMap(root => [...root.querySelectorAll('form')]).find(form => form.isConnected);
    form.querySelector('input[type=email]').value = 'browser-qa@example.test';
    form.querySelector('button[type=submit]').focus();
  });
  await page.keyboard.press('Enter');
  return response;
}

test('a long existing article keeps its ordinary blocks when the divider moves', async ({ page }) => {
  await openFixture(page, 'divider', '&theme=block');
  const campaignId = await page.locator('[data-wconvert-content-lock]').first().getAttribute('data-wconvert-content-lock');
  await loginAndOpenEditor(page);
  const state = await page.evaluate(campaignId => {
    const { createBlock, serialize } = window.wp.blocks;
    const intro = createBlock('core/paragraph', { content: 'Long article introduction.' });
    const first = createBlock('core/heading', { content: 'Existing heading' });
    const second = createBlock('core/paragraph', { content: 'Existing paragraph with a link.' });
    const divider = createBlock('wconvert/content-lock-divider', { optinId: campaignId });
    const rest = Array.from({ length: 7 }, (_, index) => createBlock('core/paragraph', { content: `Existing article paragraph ${index + 1}.` }));
    window.wp.data.dispatch('core/block-editor').resetBlocks([intro, first, second, divider, ...rest]);
    window.wp.data.dispatch('core/block-editor').selectBlock(divider.clientId);
    return { divider: divider.clientId, ordinary: serialize([intro, first, second, ...rest]) };
  }, campaignId);
  const canvas = editor(page);
  const marker = canvas.locator(`[data-block="${state.divider}"]`);
  await expect(marker.getByText('7 blocks below', { exact: true })).toBeVisible();
  const moveUp = page.getByRole('button', { name: 'Move up', exact: true });
  await expect(moveUp).toBeVisible();
  await moveUp.click();
  await expect.poll(() => page.evaluate(() => window.wp.blocks.serialize(window.wp.data.select('core/block-editor').getBlocks().filter(block => block.name !== 'wconvert/content-lock-divider')))).toBe(state.ordinary);
  await expect(marker.getByText('8 blocks below', { exact: true })).toBeVisible();
  const moveDown = page.getByRole('button', { name: 'Move down', exact: true });
  await expect(moveDown).toBeVisible();
  await moveDown.click();
  await expect.poll(() => page.evaluate(() => window.wp.blocks.serialize(window.wp.data.select('core/block-editor').getBlocks().filter(block => block.name !== 'wconvert/content-lock-divider')))).toBe(state.ordinary);
  await expect(marker.getByText('7 blocks below', { exact: true })).toBeVisible();
});

test('a new article keeps ordinary blocks after a configured divider', async ({ page }) => {
  await openFixture(page, 'divider', '&theme=block');
  await loginAndOpenEditor(page);
  const ids = await page.evaluate(() => {
    const { createBlock } = window.wp.blocks;
    const intro = createBlock('core/paragraph', { content: 'New article introduction.' });
    const divider = createBlock('wconvert/content-lock-divider');
    const conclusion = createBlock('core/paragraph', { content: 'New article public conclusion.' });
    window.wp.data.dispatch('core/block-editor').resetBlocks([intro, divider, conclusion]);
    window.wp.data.dispatch('core/block-editor').selectBlock(divider.clientId);
    return { divider: divider.clientId, conclusion: conclusion.clientId };
  });
  await choose(page, 'divider');
  const marker = editor(page).locator(`[data-block="${ids.divider}"]`);
  await expect(marker.getByText('1 block below', { exact: true })).toBeVisible();
  expect(await page.evaluate(id => window.wp.data.select('core/block-editor').getBlock(id).innerBlocks, ids.divider)).toEqual([]);
  await expect(editor(page).locator(`[data-block="${ids.conclusion}"]`)).toContainText('New article public conclusion.');
});

test('a bounded section keeps a public conclusion and its configured editor is screenshot-ready', async ({ page }) => {
  await openFixture(page, 'basic', '&theme=block');
  await loginAndOpenEditor(page);
  const lockId = await page.evaluate(() => {
    const { createBlock } = window.wp.blocks;
    const lock = createBlock('wconvert/content-lock', {}, [createBlock('core/heading', { content: 'Bonus checklist' }), createBlock('core/paragraph', { content: 'Bounded bonus content.' })]);
    window.wp.data.dispatch('core/block-editor').resetBlocks([
      createBlock('core/paragraph', { content: 'Public introduction.' }), lock,
      createBlock('core/paragraph', { content: 'Public conclusion after the bonus.' }),
    ]);
    window.wp.data.dispatch('core/block-editor').selectBlock(lock.clientId);
    window.wp.data.dispatch('core/editor').editPost({ title: 'Weekly writing guide' });
    return lock.clientId;
  });
  await choose(page, 'basic');
  const selected = editor(page).locator(`[data-block="${lockId}"]`);
  await expect(selected.getByText('Content lock ends', { exact: true })).toBeVisible();
  await expect(editor(page).getByText('Public conclusion after the bonus.', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await editorScreenshot(page, resolve(screenshotDir, 'content-lock-section.png'));
  await expect.poll(() => selected.locator('.wconvert-lock-editor__boundary').first().evaluate(node => getComputedStyle(node).fontSize)).toBe('13px');
});

test('the configured divider editor screenshot settles with its campaign visible', async ({ page }) => {
  await openFixture(page, 'divider', '&theme=block');
  const campaignId = await page.locator('[data-wconvert-content-lock]').first().getAttribute('data-wconvert-content-lock');
  await loginAndOpenEditor(page);
  const dividerId = await page.evaluate(campaignId => {
    const { createBlock } = window.wp.blocks;
    const divider = createBlock('wconvert/content-lock-divider', { optinId: campaignId });
    window.wp.data.dispatch('core/block-editor').resetBlocks([
      createBlock('core/paragraph', { content: 'Public introduction.' }), divider,
      createBlock('core/heading', { content: 'Bonus checklist' }),
      createBlock('core/paragraph', { content: 'Bonus content below the divider.' }),
    ]);
    window.wp.data.dispatch('core/block-editor').selectBlock(divider.clientId);
    window.wp.data.dispatch('core/editor').editPost({ title: 'Weekly writing guide' });
    return divider.clientId;
  }, campaignId);
  await expect(editor(page).locator(`[data-block="${dividerId}"]`).getByText('Content lock starts here', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await editorScreenshot(page, resolve(screenshotDir, 'content-lock-divider.png'));
});

test('Change, Cancel and Clear leave a usable focus target and preserve long selected names', async ({ page }) => {
  await openFixture(page, 'divider', '&theme=block');
  await loginAndOpenEditor(page);
  await page.evaluate(() => {
    const { createBlock } = window.wp.blocks;
    const divider = createBlock('wconvert/content-lock-divider');
    window.wp.data.dispatch('core/block-editor').resetBlocks([divider, createBlock('core/paragraph', { content: 'Locked content.' })]);
    window.wp.data.dispatch('core/block-editor').selectBlock(divider.clientId);
    window.wp.data.dispatch('core/interface').disableComplementaryArea('core');
  });
  const canvas = editor(page);
  await canvas.getByRole('button', { name: 'Choose Campaign', exact: true }).click();
  const picker = page.getByRole('combobox', { name: 'Campaign', exact: true });
  await expect(picker).toBeVisible();
  await expect(picker).toBeFocused();
  await choose(page, 'divider');
  const selected = page.locator('.wconvert-lock-picker__selected');
  await expect(selected).toContainText('Content lock divider');
  await page.getByRole('button', { name: 'Change campaign', exact: true }).click();
  await expect(picker).toBeVisible();
  await expect(picker).toBeFocused();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(selected).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change campaign', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Clear campaign', exact: true }).click();
  await expect(picker).toBeVisible();
  await expect(picker).toBeFocused();
  await page.route('**/wconvert/v1/content-lock-campaigns**', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.campaigns = data.campaigns.map(item => item.status === 'ready' ? { ...item, name: 'A very long Content lock campaign name for narrow editor widths' } : item);
    await route.fulfill({ response, json: data });
  });
  await choose(page, 'divider');
  await page.getByRole('button', { name: 'Refresh Campaigns', exact: true }).click();
  await expect(page.getByText('Campaign choices updated.', { exact: true })).toBeVisible();
  await expect(selected.locator('strong')).toContainText('A very long Content lock campaign name');
  const overflow = await selected.evaluate(node => node.scrollWidth <= node.clientWidth);
  expect(overflow).toBe(true);
});

for (const kind of ['divider', 'section']) test(`canvas Choose Campaign focuses the picker for the ${kind} block`, async ({ page }) => {
  await openFixture(page, 'basic', '&theme=block');
  await loginAndOpenEditor(page);
  const blockId = await page.evaluate(kind => {
    const { createBlock } = window.wp.blocks;
    const block = kind === 'divider'
      ? createBlock('wconvert/content-lock-divider')
      : createBlock('wconvert/content-lock', {}, [createBlock('core/paragraph', { content: 'Write the bounded bonus here.' })]);
    window.wp.data.dispatch('core/block-editor').resetBlocks([block]);
    window.wp.data.dispatch('core/block-editor').selectBlock(block.clientId);
    return block.clientId;
  }, kind);
  const panel = kind === 'divider' ? 'Lock from here' : 'Content lock';
  await expect(page.getByRole('button', { name: panel, exact: true })).toBeVisible();
  await page.getByRole('button', { name: panel, exact: true }).click();
  await expect(page.getByRole('button', { name: panel, exact: true })).toHaveAttribute('aria-expanded', 'false');
  if (kind === 'divider') await page.setViewportSize({ width: 420, height: 900 });
  await page.evaluate(() => window.wp.data.dispatch('core/interface').disableComplementaryArea('core'));
  const canvasBlock = editor(page).locator(`[data-block="${blockId}"]`);
  await canvasBlock.getByRole('button', { name: 'Choose Campaign', exact: true }).click();
  const picker = page.getByRole('combobox', { name: 'Campaign', exact: true });
  await expect(picker).toBeVisible();
  await expect(picker).toBeFocused();
  await choose(page, 'basic');
  await expect(page.locator('.wconvert-lock-picker__selected')).toContainText('Content lock basic');
});

test('missing Campaigns remain repairable and unsupported content warning can jump to the block', async ({ page }) => {
  await openFixture(page, 'divider-missing', '&theme=block');
  const missingId = await page.locator('[data-wconvert-content-lock]').first().getAttribute('data-wconvert-content-lock');
  await loginAndOpenEditor(page);
  const unsupportedId = await page.evaluate(missingId => {
    const { createBlock } = window.wp.blocks;
    const divider = createBlock('wconvert/content-lock-divider', { optinId: missingId });
    const unsupported = createBlock('core/html', { content: '<form><input aria-label="External form"></form>' });
    window.wp.data.dispatch('core/block-editor').resetBlocks([divider, createBlock('core/paragraph', { content: 'Bonus text.' }), unsupported]);
    window.wp.data.dispatch('core/block-editor').selectBlock(divider.clientId);
    return unsupported.clientId;
  }, missingId);
  await expect(page.locator('.wconvert-lock-picker__selected')).toContainText('Previously selected campaign');
  await expect(page.locator('.components-notice__content').filter({ hasText: /no longer published as inline/ }).first()).toBeVisible();
  const warning = editor(page).getByText(/Custom HTML block below is not supported here/);
  await expect(warning).toBeVisible();
  await editor(page).getByRole('button', { name: 'Find unsupported block', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.wp.data.select('core/block-editor').getSelectedBlockClientId())).toBe(unsupportedId);
});

test('visitor form preserves focus semantics at narrow RTL and reveals with a polite announcement', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openFixture(page, 'shortcode', '&theme=classic&rtl=1');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const content = page.locator('[data-wconvert-locked-content]').first();
  await expect(content).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const response = await submitVisitor(page);
  expect((await response).ok()).toBe(true);
  await expect(content).toBeVisible();
  await expect.poll(async () => (await shadowText(page, '[role="status"]')).includes('Content unlocked.')).toBe(true);
  expect((await shadowText(page, '[role="status"]')).some(text => text === 'Content unlocked.')).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testShadows.some(root => [...root.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Continue to content')))).toBe(true);
  await page.evaluate(() => window.testShadows.flatMap(root => [...root.querySelectorAll('button')]).find(button => button.textContent?.trim() === 'Continue to content')?.focus());
  await page.keyboard.press('Enter');
  expect(await content.evaluate(node => node === document.activeElement)).toBe(true);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
