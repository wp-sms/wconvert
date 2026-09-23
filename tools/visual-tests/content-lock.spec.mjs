import { test, expect } from '@playwright/test';

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
  await page.frameLocator('iframe[name="editor-canvas"]').locator('body').evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path, fullPage: true });
}
const region = page => page.locator('[data-wconvert-locked-content]').first();
async function open(page, kind = 'basic', query = '') {
  await page.goto(`/?wconvert_lock=${kind}${query}`, { waitUntil: 'domcontentloaded' });
  // Playground can return an empty document on the request that switches themes.
  if (await page.locator("body").textContent() === "") await page.reload();
  await expect(region(page)).toBeAttached();
}
async function submit(page) {
  await page.evaluate(() => {
    const form = window.testShadows.flatMap(root => [...root.querySelectorAll('form')]).find(form => form.isConnected);
    form.querySelector('input[type=email]').value = 'reader@example.com';
    form.querySelector('button[type=submit]').click();
  });
}
for (const theme of ['classic', 'block']) test(`WordPress ${theme} block capture, reveal and remembered access`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await open(page, 'basic', `&theme=${theme}`);
  await expect(region(page)).toBeHidden();
  await expect(page.getByText('Read this public introduction.')).toBeVisible();
  const response = page.waitForResponse(response => response.url().includes('/capture') && response.request().method() === 'POST');
  await submit(page); expect((await response).ok()).toBe(true);
  await expect(region(page)).toBeVisible();
  expect(await page.evaluate(() => window.testShadows.some(root => root.textContent.includes('Content unlocked.')))).toBe(true);
  await page.reload(); await expect(region(page)).toBeVisible();
  await expect(page.locator('[data-wconvert-optin] > *')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('shortcode hides only its region at 320px in RTL and preserves public content', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await open(page, 'shortcode', '&theme=classic&rtl=1');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(region(page)).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // A descendant of the hidden region cannot receive focus.
  await page.locator('#bonus-link').evaluate(node => node.focus());
  expect(await page.locator('#bonus-link').evaluate(node => node === document.activeElement)).toBe(false);
  await submit(page); await expect(region(page)).toBeVisible();
  await page.evaluate(() => window.testShadows.flatMap(root => [...root.querySelectorAll('button')]).find(button => button.textContent === 'Continue to content').click());
  expect(await region(page).evaluate(node => document.activeElement === node)).toBe(true);
  await page.screenshot({ path: 'tools/visual-tests/out/content-lock/mobile-unlocked.png', fullPage: true });
});
test('divider technical failure opens the article with no unlock receipt', async ({ page }) => {
  await page.route('**/capture', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) }));
  await open(page, 'divider', '&theme=classic');
  await expect(page.getByText('Read this public introduction.')).toBeVisible();
  await expect(page.getByText('Public site footer.')).toBeVisible();
  await expect(region(page)).toBeHidden();
  await expect(page.getByText('Public end of article.')).toBeHidden();
  await submit(page);
  await expect(region(page)).toBeVisible();
  await expect(page.getByText('Public end of article.')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.testShadows.some(root => root.textContent.includes('Your submission could not be confirmed. The content is available below.')))).toBe(true);
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('wcv_unlock1:')))).toBe(false);
});
test('a missing campaign, disabled lock and absent JavaScript leave content readable', async ({ browser, page }) => {
  await open(page, 'missing'); await expect(region(page)).toBeVisible();
  await open(page, 'off'); await expect(region(page)).toBeVisible();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const noScript = await context.newPage(); await noScript.goto(new URL('/?wconvert_lock=basic', page.url()).href);
  await expect(region(noScript)).toBeVisible(); await context.close();
});
test('a duplicate wrapper cannot hide another region', async ({ page }) => {
  await open(page, 'duplicate');
  await expect(region(page)).toBeHidden();
  await expect(page.locator('[data-wconvert-locked-content]').nth(1)).toBeVisible();
});

test('the paid WordPress block registers, accepts nested content and saves a readable fallback', async ({ page }) => {
  await open(page, 'basic', '&theme=block');
  const campaignId = await page.locator('[data-wconvert-content-lock]').getAttribute('data-wconvert-content-lock');
  await page.goto('/wp-login.php');
  await expect(page.getByLabel('Username or Email Address')).toBeFocused();
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/wp-admin/post-new.php', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => window.wp?.blocks?.getBlockType('wconvert/content-lock')?.name ?? null)).toBe('wconvert/content-lock');
  const saved = await page.evaluate(id => {
    const { createBlock, serialize, parse, getBlockType } = window.wp.blocks;
    const block = createBlock('wconvert/content-lock', { optinId: id }, [createBlock('core/paragraph', { content: 'Readable saved bonus' })]);
    window.wp.data.dispatch('core/block-editor').insertBlocks(block);
    const markup = serialize([block]);
    return { markup, valid: parse(markup)[0].isValid, inserter: getBlockType('wconvert/content-lock').supports.inserter };
  }, campaignId);
  expect(saved.inserter).toBe(true); expect(saved.valid).toBe(true);
  expect(saved.markup).toContain('<p>Readable saved bonus</p>');
  expect(saved.markup).not.toContain('hidden');
  await expect.poll(() => page.evaluate(() => window.wp.data.select('core/block-editor').getBlocks().some(block => block.name === 'wconvert/content-lock'))).toBe(true);
});

test('an author wraps existing mixed blocks, keeps their content, and can undo and unwrap', async ({ page }) => {
  await open(page, 'basic', '&theme=block');
  await page.goto('/wp-login.php');
  const username = page.getByLabel('Username or Email Address');
  await expect(username).toBeFocused();
  await username.fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/wp-admin/post-new.php', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => !!window.wp?.blocks?.getBlockType('wconvert/content-lock'))).toBe(true);
  const result = await page.evaluate(() => {
    const { createBlock, serialize, switchToBlockType } = window.wp.blocks;
    const blocks = [createBlock('core/heading', { content: 'Bonus title', anchor: 'bonus' }),
      createBlock('core/paragraph', { content: 'Keep <strong>this</strong> <a href="https://example.com">link</a>.' }),
      createBlock('core/list', {}, [createBlock('core/list-item', { content: 'Nested item' })])];
    window.wp.data.dispatch('core/block-editor').resetBlocks(blocks);
    window.testOriginalLockContent = serialize(blocks);
    const wrapped = switchToBlockType(blocks, 'wconvert/content-lock');
    if (!wrapped) return null;
    window.wp.data.dispatch('core/block-editor').replaceBlocks(blocks.map(block => block.clientId), wrapped);
    return { original: window.testOriginalLockContent, content: serialize(wrapped[0].innerBlocks) };
  });
  expect(result).not.toBeNull();
  expect(result.content).toBe(result.original);
  // Undo and redo use the editor's history, not a WConvert content cache.
  await page.evaluate(() => window.wp.data.dispatch('core/editor').undo());
  await expect.poll(() => page.evaluate(() => window.wp.blocks.serialize(window.wp.data.select('core/block-editor').getBlocks()))).toBe(result.original);
  await page.evaluate(() => window.wp.data.dispatch('core/editor').redo());
  await expect.poll(() => page.evaluate(() => window.wp.data.select('core/block-editor').getBlocks()[0]?.name)).toBe('wconvert/content-lock');
  await page.evaluate(() => window.wp.data.dispatch('core/block-editor').selectBlock(window.wp.data.select('core/block-editor').getBlocks()[0].clientId));
  await page.getByRole('button', { name: 'Remove lock, keep content', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.wp.blocks.serialize(window.wp.data.select('core/block-editor').getBlocks()))).toBe(result.original);
  const unsupported = await page.evaluate(() => {
    const { createBlock, switchToBlockType } = window.wp.blocks;
    return switchToBlockType([createBlock('core/paragraph', {content: 'Keep me'}), createBlock('core/embed', { url: 'https://example.com' })], 'wconvert/content-lock');
  });
  expect(unsupported).toBeNull();
});

test('post authors refresh ready Campaigns without losing unsaved content or gaining management access', async ({ page, context, request }, info) => {
  await open(page, 'basic', '&theme=block');
  const id = await page.locator('[data-wconvert-content-lock]').getAttribute('data-wconvert-content-lock');
  expect((await request.get('/wp-json/wconvert/v1/content-lock-campaigns')).status()).toBe(401);
  await page.goto('/wp-login.php');
  const username = page.getByLabel('Username or Email Address');
  await expect(username).toBeFocused();
  await username.fill('lock-author');
  await page.getByLabel('Password', { exact: true }).fill('author-fixture');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/wp-admin/post-new.php', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => !!window.wp?.blocks?.getBlockType('wconvert/content-lock'))).toBe(true);
  const original = await page.evaluate(async campaignId => {
    const { createBlock, serialize } = window.wp.blocks;
    const blocks = [createBlock('wconvert/content-lock', { optinId: campaignId }, [createBlock('core/paragraph', { content: 'Unsaved bonus stays here.' })])];
    window.wp.data.dispatch('core/block-editor').resetBlocks(blocks);
    const data = await window.wp.apiFetch({ path: '/wconvert/v1/content-lock-campaigns' });
    const denied = await window.wp.apiFetch({ path: '/wconvert/v1/optins' }).then(() => false, () => true);
    return { markup: serialize(blocks), data, denied };
  }, id);
  expect(original.data.manageUrl).toBeNull();
  expect(original.data.campaigns.find(item => item.id === id)?.status).toBe('ready');
  expect(original.denied).toBe(true);
  const editor = page.frameLocator('iframe[name="editor-canvas"]');
  await page.evaluate(() => window.wp.data.dispatch('core/block-editor').selectBlock(window.wp.data.select('core/block-editor').getBlocks()[0].clientId));
  await expect(page.getByRole('link', { name: /Manage Campaigns/ })).toHaveCount(0);
  await expect(editor.getByRole('combobox', { name: 'Campaign', exact: true })).toHaveCount(0);
  // Another tab changes publication while this editor still has unsaved blocks.
  const other = await context.newPage();
  await open(other, 'second', '&theme=block');
  const nextId = await other.locator('[data-wconvert-content-lock]').getAttribute('data-wconvert-content-lock');
  await other.close();
  await page.getByRole('button', { name: 'Refresh Campaigns', exact: true }).click();
  await expect(page.getByText('Campaign choices updated.', { exact: true })).toBeVisible();
  await expect(editor.getByText(/no longer published as inline/)).toBeVisible();
  expect(await page.evaluate(() => window.wp.blocks.serialize(window.wp.data.select('core/block-editor').getBlocks()))).toBe(original.markup);
  await expect(page.locator('.wconvert-lock-picker__selected')).toContainText('Previously selected Campaign');
  await page.getByRole('button', { name: 'Change Campaign', exact: true }).click();
  const picker = page.getByRole('combobox', { name: 'Campaign', exact: true });
  await picker.fill('second');
  await page.getByRole('option', { name: 'Content lock second', exact: true }).click();
  expect(await page.evaluate(() => window.wp.data.select('core/block-editor').getBlocks()[0].attributes.optinId)).toBe(nextId);
  await page.evaluate(async () => {
    window.wp.data.dispatch('core/editor').editPost({ title: 'Saved content lock bonus' });
    await window.wp.data.dispatch('core/editor').savePost();
  });
  await expect.poll(() => page.evaluate(() => window.wp.data.select('core/editor').isEditedPostDirty())).toBe(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => window.wp?.data?.select('core/block-editor').getBlocks()[0]?.attributes.optinId)).toBe(nextId);
  expect(await page.evaluate(() => window.wp.blocks.serialize(window.wp.data.select('core/block-editor').getBlocks()))).toContain('Unsaved bonus stays here.');
  await expect(editor.getByText('Unsaved bonus stays here.', { exact: true })).toBeVisible();
  await page.evaluate(() => window.wp.data.dispatch('core/block-editor').selectBlock(window.wp.data.select('core/block-editor').getBlocks()[0].clientId));
  await expect(page.locator('.wconvert-lock-picker__selected')).toContainText('Content lock second');
  await expect(editor.getByText('Content lock starts', { exact: true })).toBeVisible();
  await expect(editor.getByText('Content lock ends', { exact: true })).toBeVisible();
  await editorScreenshot(page, info.outputPath('content-lock-block-editor.png'));
});

test('an empty content lock is writable and keeps a public conclusion outside its boundaries', async ({ page }, info) => {
  await open(page, 'basic', '&theme=block');
  const id = await page.locator('[data-wconvert-content-lock]').getAttribute('data-wconvert-content-lock');
  await page.goto('/wp-login.php');
  await expect(page.getByLabel('Username or Email Address')).toBeFocused();
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/wp-admin/post-new.php', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => !!window.wp?.blocks?.getBlockType('wconvert/content-lock'))).toBe(true);
  const lockId = await page.evaluate(() => {
    window.wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false);
    const { createBlock } = window.wp.blocks;
    const lock = createBlock('wconvert/content-lock');
    window.wp.data.dispatch('core/block-editor').resetBlocks([
      createBlock('core/paragraph', { content: 'Read this public introduction.' }), lock,
      createBlock('core/paragraph', { content: 'This conclusion stays public.' }),
    ]);
    window.wp.data.dispatch('core/block-editor').selectBlock(lock.clientId);
    return lock.clientId;
  });
  const editor = page.frameLocator('iframe[name="editor-canvas"]');
  const lock = editor.locator(`[data-block="${lockId}"]`);
  await expect(lock.getByRole('combobox', { name: 'Campaign', exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Campaign', exact: true }).fill('basic');
  await page.getByRole('option', { name: 'Content lock basic', exact: true }).click();
  await expect(lock.getByRole('combobox', { name: 'Campaign', exact: true })).toHaveCount(0);
  await expect(page.locator('.wconvert-lock-picker__selected')).toContainText('Content lock basic');
  await expect(lock.locator('[data-type="core/paragraph"]')).toBeVisible();
  await lock.locator('[data-type="core/paragraph"]').fill('Your checklist: plan, focus, review.');
  const saved = await page.evaluate(() => window.wp.data.select('core/block-editor').getBlocks());
  expect(saved[1].attributes.optinId).toBe(id);
  expect(saved[1].innerBlocks[0].attributes.content).toBe('Your checklist: plan, focus, review.');
  expect(saved[2].name).toBe('core/paragraph');
  expect(saved[2].attributes.content).toBe('This conclusion stays public.');
  // The theme's article typography must not enlarge the editor controls.
  await expect.poll(() => lock.locator('.wconvert-lock-editor__boundary').first().evaluate(node => getComputedStyle(node).fontSize)).toBe('13px');
  await editorScreenshot(page, info.outputPath('compact-content-lock.png'));
});

for (const theme of ['classic', 'block']) test(`the divider gates ordinary following blocks in the ${theme} theme`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await open(page, 'divider', `&theme=${theme}`);
  await expect(page.getByText('Read this public introduction.')).toBeVisible();
  await expect(region(page)).toBeHidden();
  await expect(page.getByText('Public end of article.')).toBeHidden();
  if (theme === 'classic') await expect(page.getByText('Public site footer.')).toBeVisible();
  await submit(page);
  await expect(region(page)).toBeVisible();
  await expect(page.getByText('Public end of article.')).toBeVisible();
  await page.reload();
  await expect(region(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test('ambiguous, unsupported and empty divider scopes leave the article readable', async ({ page }) => {
  for (const kind of ['duplicate', 'nested', 'unsupported', 'shortcode', 'empty']) {
    await page.goto(`/?wconvert_lock=divider-${kind}&theme=classic`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Public end of article.')).toBeVisible();
    await expect(page.locator('[data-wconvert-content-lock]')).toHaveCount(0);
    if (kind !== 'empty') await expect(page.getByRole('heading', { name: 'Bonus checklist' })).toBeVisible();
  }
});

test('writers insert a divider, keep ordinary blocks, move it, save and remove it without losing content', async ({ page }, info) => {
  await open(page, 'divider', '&theme=block');
  const campaignId = await page.locator('[data-wconvert-content-lock]').getAttribute('data-wconvert-content-lock');
  await page.goto('/wp-login.php');
  await expect(page.getByLabel('Username or Email Address')).toBeFocused();
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/wp-admin/post-new.php', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => !!window.wp?.blocks?.getBlockType('wconvert/content-lock-divider'))).toBe(true);
  const initial = await page.evaluate(() => {
    window.wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false);
    const { createBlock, serialize } = window.wp.blocks;
    const intro = createBlock('core/paragraph', { content: 'Public introduction.' });
    const divider = createBlock('wconvert/content-lock-divider');
    const rest = [createBlock('core/heading', { content: 'Existing heading' }), createBlock('core/paragraph', { content: 'Keep <strong>the original formatting</strong>.' })];
    window.wp.data.dispatch('core/block-editor').resetBlocks([intro, divider, ...rest]);
    window.wp.data.dispatch('core/block-editor').selectBlock(divider.clientId);
    return { id: divider.clientId, content: serialize([intro, ...rest]) };
  });
  const editor = page.frameLocator('iframe[name="editor-canvas"]');
  const marker = editor.locator(`[data-block="${initial.id}"]`);
  await expect(marker.getByText('Everything below, to the end of this article.', { exact: true })).toBeVisible();
  await expect(marker.locator('[contenteditable=true]')).toHaveCount(0);
  await expect(marker.getByRole('combobox', { name: 'Campaign', exact: true })).toHaveCount(0);
  // Setup remains available when the sidebar is closed, including on narrow screens.
  await page.getByRole('button', { name: 'Lock from here', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Campaign', exact: true })).toHaveCount(0);
  await marker.getByRole('button', { name: 'Choose Campaign', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Campaign', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 420, height: 900 });
  await page.evaluate(() => window.wp.data.dispatch('core/interface').disableComplementaryArea('core'));
  await marker.getByRole('button', { name: 'Choose Campaign', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Campaign', exact: true })).toBeFocused();
  await editorScreenshot(page, info.outputPath('divider-empty-sidebar.png'));
  const initialPicker = page.getByRole('combobox', { name: 'Campaign', exact: true });
  await initialPicker.fill('divider');
  await initialPicker.press('ArrowDown');
  await initialPicker.press('Enter');
  await expect.poll(() => page.evaluate(() => window.wp.data.select('core/block-editor').getBlocks().find(block => block.name === 'wconvert/content-lock-divider')?.attributes.optinId)).toBe(campaignId);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(marker.getByRole('combobox', { name: 'Campaign', exact: true })).toHaveCount(0);
  await expect(page.locator('.wconvert-lock-picker__selected')).toContainText('Content lock divider');
  await page.getByRole('button', { name: 'Change Campaign', exact: true }).click();
  // WordPress clears the search text on focus while retaining the saved choice.
  await expect(page.getByRole('combobox', { name: 'Campaign', exact: true })).toBeFocused();
  await expect(page.getByRole('option', { name: 'Content lock divider', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.wp.data.select('core/block-editor').getBlocks().find(block => block.name === 'wconvert/content-lock-divider')?.attributes.optinId)).toBe(campaignId);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change Campaign', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Clear Campaign', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Campaign', exact: true })).toBeFocused();
  await expect(marker.getByText('Not set up', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Campaign', exact: true }).fill('divider');
  await page.getByRole('option', { name: 'Content lock divider', exact: true }).click();
  await expect(marker.getByText('2 blocks below', { exact: true })).toBeVisible();
  // Native movement changes only the boundary, not the article blocks or their formatting.
  await page.evaluate(id => window.wp.data.dispatch('core/block-editor').moveBlocksDown([id]), initial.id);
  await expect(marker.getByText('1 block below', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.wp.blocks.serialize(window.wp.data.select('core/block-editor').getBlocks().filter(b => b.name !== 'wconvert/content-lock-divider')))).toBe(initial.content);
  await page.evaluate(() => window.wp.data.dispatch('core/block-editor').insertBlocks(window.wp.blocks.createBlock('core/paragraph')));
  const last = editor.locator('[data-type="core/paragraph"]').last();
  await last.fill('A newly appended paragraph belongs to the article remainder.');
  await expect(marker.getByText('2 blocks below', { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    window.wp.data.dispatch('core/editor').editPost({ title: 'Divider authoring' });
    await window.wp.data.dispatch('core/editor').savePost();
  });
  await expect.poll(() => page.evaluate(() => window.wp.data.select('core/editor').isEditedPostDirty())).toBe(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(editor.getByText('Content lock starts here', { exact: true })).toBeVisible();
  const saved = await page.evaluate(() => window.wp.data.select('core/block-editor').getBlocks());
  expect(saved.map(b => b.name)).toEqual(['core/paragraph', 'core/heading', 'wconvert/content-lock-divider', 'core/paragraph', 'core/paragraph']);
  expect(saved[2].innerBlocks).toEqual([]);
  await page.evaluate(id => window.wp.data.dispatch('core/block-editor').selectBlock(id), saved[2].clientId);
  await expect(page.locator('.wconvert-lock-picker__selected')).toContainText('Content lock divider');
  await page.getByRole('button', { name: 'Remove divider, keep content', exact: true }).click();
  await expect(editor.getByText('Content lock starts here', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.wp.data.select('core/block-editor').getBlocks().length)).toBe(4);
  await page.evaluate(() => window.wp.data.dispatch('core/editor').undo());
  await expect(editor.getByText('Content lock starts here', { exact: true })).toBeVisible();
  await expect(last).toContainText('A newly appended paragraph belongs to the article remainder.');
  await page.evaluate(() => {
    const marker = window.wp.data.select('core/block-editor').getBlocks().find(block => block.name === 'wconvert/content-lock-divider');
    window.wp.data.dispatch('core/block-editor').selectBlock(marker.clientId);
  });
  // Undo runs the editor's block movement animation; inspect its settled layout.
  await expect.poll(async () => {
    const boundary = await editor.locator('[data-type="wconvert/content-lock-divider"]').boundingBox();
    const paragraph = await editor.locator('[data-type="core/paragraph"]').nth(1).boundingBox();
    return !!boundary && !!paragraph && paragraph.y >= boundary.y + boundary.height;
  }).toBe(true);
  await editorScreenshot(page, info.outputPath('divider-editor.png'));
  const unsupportedId = await page.evaluate(() => {
    const block = window.wp.blocks.createBlock('core/html', { content: '<form>External form</form>' });
    window.wp.data.dispatch('core/block-editor').insertBlocks(block);
    return block.clientId;
  });
  await expect(editor.getByText(/The Custom HTML block below is not supported here/)).toBeVisible();
  await editor.getByRole('button', { name: 'Find unsupported block', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.wp.data.select('core/block-editor').getSelectedBlockClientId())).toBe(unsupportedId);
});

test('divider content stays readable with missing Campaigns, disabled locking, no JavaScript and draft previews', async ({ page, browser }) => {
  for (const kind of ['divider-missing', 'divider-off']) {
    await open(page, kind, '&theme=classic');
    await expect(region(page)).toBeVisible();
    await expect(page.getByText('Public end of article.')).toBeVisible();
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  const noScript = await context.newPage();
  await noScript.goto(new URL('/?wconvert_lock=divider&theme=classic', page.url()).href, { waitUntil: 'domcontentloaded' });
  await expect(region(noScript)).toBeVisible();
  await context.close();
  await page.goto('/wp-login.php');
  await expect(page.getByLabel('Username or Email Address')).toBeFocused();
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/?wconvert_lock=divider-preview&theme=classic&preview=true', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Bonus checklist' })).toBeVisible();
  await expect(page.locator('[data-wconvert-content-lock]')).toHaveCount(0);
});

test('a saved divider is inert without Pro and its ordinary article remains readable', async ({ page }) => {
  await open(page, 'divider', '&theme=classic');
  const id = await page.locator('meta[name="wconvert-lock-post"]').getAttribute('content');
  await page.goto(`/?p=${id}&wconvert_visual_free_only=1`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Bonus checklist' })).toBeVisible();
  await expect(page.getByText('Public end of article.')).toBeVisible();
  await expect(page.locator('[data-wconvert-content-lock]')).toHaveCount(0);
});
