/**
 * The library, all of it, at one viewport, in one picture.
 *
 * ============================================================================
 * THE QUESTION THIS ANSWERS IS "ARE THESE 40 DESIGNS, OR ONE DESIGN 40 TIMES?"
 * ============================================================================
 * That is the failure ADR 0010 named when it widened the vocabulary the first
 * time — *"twelve shipped designs are the same eight-slot skeleton in
 * different colours, and the next thirty would be too"* — and it is invisible
 * in any view that shows one design at a time. It is obvious here.
 *
 * ============================================================================
 * SIX SHEETS: THREE VIEWPORTS × TWO DIRECTIONS.
 * ============================================================================
 * The viewport is the axis that matters for THIS subject, in a way it is not
 * for the admin's. A `split` stacks its panes below a narrow width, a
 * `floating_bar` spans whatever the page is wide, and a `grid` recounts its
 * own columns — so a design is three different designs at 320, 768 and 1440,
 * and only one of the three has ever been looked at.
 *
 * 320 first on purpose. It is the width most of this traffic actually arrives
 * at, and the one a design authored on a desktop is least likely to survive.
 *
 * The tiler is `tools/design-system/build/contact-sheet.mjs`, imported rather
 * than copied. It already solves two traps that cost a day between them — an
 * offscreen iframe Chromium never loads, and `fullPage` growing the image
 * instead of scrolling the page — and a second copy of it here would be a
 * second copy of both.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contactSheets } from '../../design-system/build/contact-sheet.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../out');

/**
 * The three widths, and how tall a card is at each.
 *
 * Height is not proportional to width, and 320 gets the TALLEST cell of the
 * three despite being the narrowest. Everything wraps at 320 — a `split`
 * stacks its two panes, a `row` breaks, a `grid` drops to one column — so a
 * design is at its tallest exactly where the screen is shortest. At 900 the
 * `split-hero` popup was clipped top and bottom, which hides the very thing
 * the narrow sheet exists to show.
 */
const VIEWPORTS = [
  { width: 320, height: 1150, scale: 0.55 },
  { width: 768, height: 820, scale: 0.4 },
  { width: 1440, height: 900, scale: 0.24 },
];

const designs = JSON.parse(readFileSync(resolve(OUT, 'designs.json'), 'utf8'));

/*
 * One call per viewport, because the tiler takes ONE cell size per run and
 * three viewports are three cell sizes. Reading its shape rather than widening
 * its signature: three calls is the honest spelling of three grids.
 *
 * Four across at every viewport, so the six sheets are comparable to each
 * other rather than each being whatever shape its own width suggested.
 */
const sheets = [];

for (const viewport of VIEWPORTS) {
  for (const direction of ['ltr', 'rtl']) {
    sheets.push(
      ...(await contactSheets({
        out: OUT,
        previews: 'previews',
        columns: 4,
        cell: { width: viewport.width, height: viewport.height },
        scale: viewport.scale,
        sheets: [
          {
            name: `contact-sheet-${viewport.width}-${direction}`,
            title: `WConvert designs — ${viewport.width}px — ${direction.toUpperCase()} — ${designs.length} designs, ${designs.reduce((total, design) => total + design.steps * design.placements.length, 0)} screens`,
            /*
             * One cell per STEP, not per design. A step is a screen, and a
             * cell holds one screen — stacking both into one card clipped
             * every popup taller than half a cell, which read as two designs
             * colliding rather than as a card that was too short.
             */
            cells: designs.flatMap((design) => design.placements.flatMap((placement) =>
              Array.from({ length: design.steps }, (unused, step) => ({
                label: `${design.name}${design.tier === 'free' ? '' : ' ⭑'} · ${placement ?? design.display_type}${design.steps === 1 ? '' : ` · step ${step + 1}`}`,
                file: `design-${design.id}-${step}${placement ? `-${placement}` : ''}${direction === 'rtl' ? '-rtl' : ''}.html`,
              })),
            )),
          },
        ],
      })),
    );
  }
}

for (const sheet of sheets) {
  console.log(`  ${sheet}`);
}
