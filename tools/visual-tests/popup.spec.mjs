import { test, expect } from '@playwright/test';

// Retain test-only handles without weakening the production closed shadow mode.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const attach = Element.prototype.attachShadow;
    window.testShadows = [];
    Element.prototype.attachShadow = function (options) {
      const shadow = attach.call(this, options);
      window.testShadows.push(shadow);
      return shadow;
    };
  });
});

for (const viewport of [{ width: 320, height: 600 }, { width: 1100, height: 700 }]) {
  for (const rtl of [false, true]) {
    test(`free popup is centred in the viewport at ${viewport.width}px ${rtl ? 'rtl' : 'ltr'}`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`/?wconvert_popup=1${rtl ? '&rtl=1' : ''}`);
      await expect(page.locator('dialog[open]')).toBeVisible();

      const geometry = await page.evaluate(() => {
        const dialog = document.querySelector('dialog');
        const shadow = window.testShadows.find((root) => root.querySelector('.wc-root'));
        const panel = shadow.querySelector('.wc-root');
        const dialogBox = dialog.getBoundingClientRect();
        const panelBox = panel.getBoundingClientRect();
        return {
          dialog: { x: dialogBox.x, y: dialogBox.y, width: dialogBox.width, height: dialogBox.height },
          panel: { x: panelBox.x, y: panelBox.y, width: panelBox.width, height: panelBox.height },
          viewport: { width: innerWidth, height: innerHeight },
          overflow: Math.max(0, panelBox.right - innerWidth, -panelBox.left),
          closed: shadow.host.shadowRoot === null,
          font: getComputedStyle(panel.querySelector('h2')).fontFamily,
        };
      });

      const dialogCentre = {
        x: geometry.dialog.x + geometry.dialog.width / 2,
        y: geometry.dialog.y + geometry.dialog.height / 2,
      };
      const panelCentre = {
        x: geometry.panel.x + geometry.panel.width / 2,
        y: geometry.panel.y + geometry.panel.height / 2,
      };

      expect(Math.abs(dialogCentre.x - geometry.viewport.width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(dialogCentre.y - geometry.viewport.height / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(panelCentre.x - geometry.viewport.width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(panelCentre.y - geometry.viewport.height / 2)).toBeLessThanOrEqual(1);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      expect(geometry.closed).toBe(true);
      expect(geometry.font).not.toContain('Comic');
      expect(errors).toEqual([]);
      await page.screenshot({ path: info.outputPath(`popup-${viewport.width}-${rtl ? 'rtl' : 'ltr'}.png`) });
    });
  }
}
