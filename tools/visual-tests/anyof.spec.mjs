import { test, expect } from '@playwright/test';

// One answer line that matches several answers ("Home or Flat") must route a
// real visitor through the published campaign, not only the unit tests.
test.beforeAll(async ({ request }) => {
  expect(await (await request.get('/?wconvert_anyof_seed=1')).text()).toBe('seeded');
});

async function visit(browser, answer) {
  const context = await browser.newContext(); // A fresh visitor: no seen-it allowance.
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.testShadows = [];
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      const root = attach.call(this, options); window.testShadows.push(root); return root;
    };
  });
  await page.goto('/?wconvert_anyof_page=1', { waitUntil: 'load' });
  await expect(page.locator('dialog[open]')).toBeVisible();
  await page.evaluate(answer => {
    const root = window.testShadows.find(root => root.querySelector(`input[value="${answer}"]`));
    root.querySelector(`input[value="${answer}"]`).click(); root.querySelector('[data-action="next"]').click();
  }, answer);
  return { context, page };
}
// The home and business lines open on the same question; their options differ.
const questionOptions = page => page.evaluate(() => {
  const root = window.testShadows.find(root => root.querySelector('[data-question-id]'));
  return [...root.querySelectorAll('[data-question-id]')].map(input => input.value);
});

for (const [answer, line, options] of [
  ['home', 'the home line', ['garden', 'balcony', 'indoor', 'irrigation']],
  ['flat', 'the home line', ['garden', 'balcony', 'indoor', 'irrigation']],
  ['business', 'all other answers', ['office', 'hospitality', 'retail', 'maintenance']],
]) {
  test(`${answer} reaches ${line}`, async ({ browser }) => {
    const { context, page } = await visit(browser, answer);
    await expect.poll(() => questionOptions(page)).toEqual(options);
    await context.close();
  });
}
