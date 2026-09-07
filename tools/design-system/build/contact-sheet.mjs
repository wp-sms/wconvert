/**
 * The grid — one image per direction, and the artefact that finds the
 * disagreements.
 *
 * **Two things answering the same question differently is obvious in a set of
 * captures laid side by side and invisible in a diff of either one**, which is
 * why the cards are built before anything is claimed about them.
 *
 * ============================================================================
 * A LIBRARY, PLUS THE ONE INVOCATION THIS TOOL MAKES OF IT.
 * ============================================================================
 * `tools/design-library` tiles a different subject — visitor-facing designs
 * rather than admin screens — and needs exactly this file's two hard-won
 * lessons and nothing else it does. Copying it there would have been a second
 * copy of both traps, one of which is only visible as *"three screens look
 * broken"*.
 *
 * So {@link contactSheets} takes the grid as data and knows nothing about
 * screens or situations, and the block at the bottom is this tool's own call —
 * it runs only when this file is executed directly, so `build.sh sheet` is
 * unchanged.
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * Tile a set of preview pages into one PNG per sheet.
 *
 * @param {object} options
 * @param {string} options.out            Directory to write the sheets into.
 * @param {string} options.previews       Directory holding the preview HTML, relative to `out`.
 * @param {number} options.columns        Cells across.
 * @param {{width: number, height: number}} options.cell  The size each preview is rendered at.
 * @param {number} options.scale          How much the cell is shrunk by in the grid.
 * @param {Array<{name: string, title: string, cells: Array<{label: string, file: string}>}>} options.sheets
 */
export async function contactSheets({ out, previews, columns, cell, scale, sheets }) {
  const browser = await chromium.launch();
  const have = new Set(readdirSync(resolve(out, previews)));
  const written = [];

  for (const sheet of sheets) {
    const cells = sheet.cells.map(({ label, file }) =>
      have.has(file)
        ? `<div class="cell"><div class="label">${label}</div>
             <div class="frame"><iframe src="${previews}/${file}" scrolling="no"></iframe></div></div>`
        : `<div class="cell missing"><div class="label">${label}</div><div class="frame">—</div></div>`,
    );

    const rows = Math.ceil(cells.length / columns);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { margin: 0; background: #1b1b1b; font: 13px/1.3 -apple-system, sans-serif; color: #eee; }
      h1 { font-size: 15px; margin: 12px 16px 4px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
      .grid { display: grid; grid-template-columns: repeat(${columns}, ${cell.width * scale}px); gap: 10px; padding: 8px 16px 16px; }
      .label { padding: 4px 2px; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: #9ab;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .frame { width: ${cell.width * scale}px; height: ${cell.height * scale}px; overflow: hidden; background: #fff; border: 1px solid #333; }
      iframe { width: ${cell.width}px; height: ${cell.height}px; border: 0; transform: scale(${scale}); transform-origin: 0 0; }
      .missing .frame { display: grid; place-items: center; color: #666; }
    </style></head><body>
    <h1>${sheet.title}</h1>
    <div class="grid">${cells.join('')}</div>
    </body></html>`;

    const path = resolve(out, `${sheet.name}.html`);

    writeFileSync(path, html);

    /*
     * The viewport holds the WHOLE grid rather than being scrolled through it.
     * Chromium does not load an iframe that has never been in view, so a short
     * viewport plus `fullPage` screenshots one row of loaded cards and the
     * rest as white — which looks exactly like a set of broken previews, and
     * was read as one for a minute.
     */
    const page = await browser.newPage({
      viewport: {
        width: Math.round(columns * cell.width * scale) + 60,
        height: Math.round(rows * (cell.height * scale + 34)) + 80,
      },
    });

    await page.goto(`file://${path}`);

    /*
     * Every frame, not a timer. A card can inline a large stylesheet and there
     * can be dozens of them, so the first sheet ever built here screenshotted
     * one row of loaded iframes and three rows of white.
     */
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: resolve(out, `${sheet.name}.png`), fullPage: true });
    await page.close();

    written.push(`${sheet.name}.png`);
  }

  await browser.close();

  return written;
}

// ---------------------------------------------------------------------------
// This tool's own grid: four screens down, four situations across (ADR 0060).

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../out');
  const SCREENS = ['optins', 'analytics', 'leads', 'destinations'];
  const STATES = ['empty', 'loading', 'failed', 'full'];

  const written = await contactSheets({
    out: OUT,
    previews: 'previews',
    columns: STATES.length,
    cell: { width: 1200, height: 900 },
    scale: 0.34,
    sheets: ['ltr', 'rtl'].map((direction) => ({
      name: `contact-sheet-${direction}`,
      title: `WConvert admin — ${direction.toUpperCase()} — four screens × four situations`,
      cells: SCREENS.flatMap((screen) =>
        STATES.map((state) => ({
          label: `${screen} · ${state}`,
          file: `screen-${screen}-${state}${direction === 'rtl' ? '-rtl' : ''}.html`,
        })),
      ),
    })),
  });

  for (const sheet of written) {
    console.log(sheet);
  }
}
