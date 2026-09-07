/**
 * The grid — every screen down, every situation across, one image per
 * direction.
 *
 * **This is the artefact that finds the disagreements.** Two screens answering
 * the same situation differently is obvious in a set of captures laid side by
 * side and invisible in a diff of either one, which is why the cards are built
 * before anything is claimed about them.
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../out');
const PREVIEWS = resolve(OUT, 'previews');

const SCREENS = ['optins', 'analytics', 'leads', 'destinations'];
const STATES = ['empty', 'loading', 'failed', 'full'];
const CELL = { width: 1200, height: 900 };
const SCALE = 0.34;

const browser = await chromium.launch();

for (const direction of ['ltr', 'rtl']) {
  const suffix = direction === 'rtl' ? '-rtl' : '';
  const have = new Set(readdirSync(PREVIEWS));

  const rows = SCREENS.map((screen) => {
    const cells = STATES.map((state) => {
      const file = `screen-${screen}-${state}${suffix}.html`;

      return have.has(file)
        ? `<div class="cell"><div class="label">${screen} · ${state}</div>
             <div class="frame"><iframe src="previews/${file}" scrolling="no"></iframe></div></div>`
        : `<div class="cell missing"><div class="label">${screen} · ${state}</div><div class="frame">—</div></div>`;
    });

    return cells.join('');
  });

  const sheet = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin: 0; background: #1b1b1b; font: 13px/1.3 -apple-system, sans-serif; color: #eee; }
    h1 { font-size: 15px; margin: 12px 16px 4px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(4, ${CELL.width * SCALE}px); gap: 10px; padding: 8px 16px 16px; }
    .label { padding: 4px 2px; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: #9ab; }
    .frame { width: ${CELL.width * SCALE}px; height: ${CELL.height * SCALE}px; overflow: hidden; background: #fff; border: 1px solid #333; }
    iframe { width: ${CELL.width}px; height: ${CELL.height}px; border: 0; transform: scale(${SCALE}); transform-origin: 0 0; }
    .missing .frame { display: grid; place-items: center; color: #666; }
  </style></head><body>
  <h1>WConvert admin — ${direction.toUpperCase()} — four screens × four situations</h1>
  <div class="grid">${rows.join('')}</div>
  </body></html>`;

  const path = resolve(OUT, `contact-sheet-${direction}.html`);

  writeFileSync(path, sheet);

  /*
   * The viewport holds the WHOLE grid rather than being scrolled through it.
   * Chromium does not load an iframe that has never been in view, so a short
   * viewport plus `fullPage` screenshots one row of loaded cards and three
   * rows of white — which looks exactly like three broken screens, and was
   * read as one for a minute.
   */
  const page = await browser.newPage({
    viewport: {
      width: Math.round(4 * CELL.width * SCALE) + 60,
      height: Math.round(SCREENS.length * (CELL.height * SCALE + 34)) + 80,
    },
  });

  await page.goto(`file://${path}`);

  /*
   * Every frame, not a timer. Each card inlines ~135KB of stylesheet and there
   * are sixteen of them, so the first sheet built here screenshotted one row
   * of loaded iframes and three rows of white — a contact sheet that looked
   * exactly like three broken screens.
   */
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: resolve(OUT, `contact-sheet-${direction}.png`), fullPage: true });
  await page.close();

  console.log(`contact-sheet-${direction}.png`);
}

await browser.close();
