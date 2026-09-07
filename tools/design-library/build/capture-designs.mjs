/**
 * One preview page per design per direction — the cards the contact sheets
 * tile.
 *
 * ============================================================================
 * NO PLAYGROUND, NO SEED, NO WORDPRESS. THAT IS THE WHOLE DIFFERENCE.
 * ============================================================================
 * `tools/design-system/build/capture-screens.mjs` boots a WordPress, seeds it,
 * forces a failure on the server and a pending request in the browser, and
 * resolves wp-admin's stylesheets against a candidate list because
 * `buttons.css` 301s into the front page at 200. None of that applies here.
 * The renderer is four files that import nothing, so a card is a blank page
 * plus `renderer.iife.js` plus a tree.
 *
 * So this file writes HTML and never launches a browser at all — the only
 * Playwright in this build is the tiler, which needs one to take a picture.
 *
 * ============================================================================
 * EVERY DESIGN IS SHOWN IN ITS OWN CONTAINER, WHICH IS WHY BARS ARE JUDGED.
 * ============================================================================
 * A `floating_bar` rendered as a 28rem box is a narrow popup, and it looks
 * fine as one — which is exactly how a bar that is broken at full width gets
 * shipped. `containers.mjs` supplies the real geometry and asserts it against
 * the shipping source.
 *
 * ============================================================================
 * ONE FILE PER STEP, BECAUSE A STEP IS A SCREEN AND A CELL HOLDS ONE SCREEN.
 * ============================================================================
 * A submit-metered design has two steps and the second one is a real screen a
 * real visitor sees — so capturing only step 0 is how a success state ends up
 * as two lines of unstyled text nobody ever looked at.
 *
 * The first version of this stacked both steps in one card, and it was wrong
 * in a way the contact sheet showed immediately: a popup taller than half the
 * cell was clipped top and bottom, so `split-hero` and `one-line-signup` read
 * as two designs colliding. One screen per file is the shape
 * `tools/design-system` already proved, and there is nothing left to clip.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { containerCss } from './containers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../out');
const PREVIEWS = resolve(OUT, 'previews');
const PLUGIN = process.env.WCONVERT_PLUGIN ?? process.cwd();

/** Free's one library, and every Pro module that keeps designs (ADR 0056). */
const LIBRARIES = [
  resolve(PLUGIN, 'resources/templates/library'),
  ...readdirSync(resolve(PLUGIN, 'pro/modules'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(PLUGIN, 'pro/modules', entry.name, 'templates'))
    .filter((path) => {
      try {
        return readdirSync(path).length > 0;
      } catch {
        return false;
      }
    }),
];

mkdirSync(PREVIEWS, { recursive: true });

const renderer = readFileSync(resolve(OUT, 'renderer.iife.js'), 'utf8');
const containers = containerCss();

const designs = LIBRARIES.flatMap((library) =>
  readdirSync(library)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(resolve(library, file), 'utf8')))
    // `locked.json` is metadata for designs this tree does not hold, so there
    // is nothing to draw. A stub reaching here would render an empty card,
    // which reads as a broken design rather than as an absent one.
    .filter((design) => design.tree !== undefined),
);

designs.sort((a, b) => `${a.display_type}/${a.id}`.localeCompare(`${b.display_type}/${b.id}`));

/**
 * One card.
 *
 * The tree and tokens are embedded as JSON and read back by the page, rather
 * than interpolated into DOM-building code: a design's placeholder copy is
 * arbitrary text and one apostrophe in it would otherwise end the script.
 */
function page(design, direction, step) {
  const steps = design.tree.steps.length;

  return `<!DOCTYPE html>
<html lang="en" dir="${direction}">
<head><meta charset="utf-8"><title>${design.id}</title>
<style>
  html, body { margin: 0; height: 100%; }
  body { background: #f1f5f9; font: 14px system-ui, sans-serif; }
  .sheet { display: flex; flex-direction: column; height: 100%; }
  .caption { padding: .5rem .75rem; background: #0f172a; color: #e2e8f0; font-size: 12px;
    letter-spacing: .04em; display: flex; gap: .5rem; align-items: baseline; }
  .caption b { font-weight: 600; }
  .caption span { color: #7dd3fc; }
  .caption em { color: #94a3b8; font-style: normal; margin-inline-start: auto; }
  .stage { position: relative; flex: 1; overflow: hidden; }
${containers}
</style></head>
<body>
<div class="sheet">
  <div class="caption"><b>${design.name}</b><span>${design.display_type}</span>
    <em>${design.tier ?? 'free'} · step ${step + 1} of ${steps}</em></div>
  <div class="stage" id="stage"></div>
</div>
<script>${renderer}</script>
<script id="design" type="application/json">${JSON.stringify({ tokens: design.tokens ?? {}, tree: design.tree, displayType: design.display_type, step })}</script>
<script>
  (function () {
    var design = JSON.parse(document.getElementById('design').textContent);
    var stage = document.getElementById('stage');

    stage.className = 'stage wc-container-' + design.displayType;

    // The container is a WRAPPER around the shadow host and never the host
    // itself. SHADOW_CSS opens with an all:initial !important rule on :host,
    // and an !important declaration in :host beats a normal one from out
    // here — so position:absolute on the host is silently reverted to
    // static. See containers.mjs; the shipping code wraps for the same
    // reason.
    var box = document.createElement('div');

    box.className = 'wc-box';

    /*
      THE BOX CARRIES THE DESIGN'S OWN WIDTH, AND IT HAS TO.

      The panel is sized min(var(--wc-width), 100%), and that 100% resolves
      against whatever holds the shadow host. A centring grid makes its item
      shrink-to-fit, so the percentage resolved against a width that was
      itself derived from the content — and every design whose declared width
      exceeded its natural content width collapsed to the content. wide-banner
      asked for 40rem and drew 396px; benefit-grid asked for 32rem, got 369px,
      and its three-up grid wrapped to two.

      It reads as a design that does not fit its own content and it is nothing
      of the sort: the same tree in the real container measures exactly 640px.
      So the box is given a definite width and the percentage has something
      true to resolve against.
    */
    if (design.displayType === 'popup') {
      box.style.inlineSize = 'min(' + (design.tokens.width || '28rem') + ', 100%)';
    }

    var host = document.createElement('div');

    host.className = 'wc-host';

    // An OPEN shadow root, not the closed one the product mounts. The shipping
    // root is closed so a theme script sweeping querySelectorAll('input')
    // cannot reach the capture field — but a closed root is also unreachable
    // from Playwright, and this page has no theme to defend against.
    var root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');

    style.textContent = WConvertRenderer.SHADOW_CSS;
    root.appendChild(style);
    root.appendChild(WConvertRenderer.render(design.tree, design.tokens, design.step));

    box.appendChild(host);
    stage.appendChild(box);
  })();
</script>
</body></html>`;
}

let written = 0;

for (const design of designs) {
  for (const direction of ['ltr', 'rtl']) {
    for (let step = 0; step < design.tree.steps.length; step++) {
      writeFileSync(
        resolve(PREVIEWS, `design-${design.id}-${step}${direction === 'rtl' ? '-rtl' : ''}.html`),
        page(design, direction, step),
      );
      written++;
    }
  }
}

const byType = designs.reduce((seen, design) => {
  seen[design.display_type] = (seen[design.display_type] ?? 0) + 1;

  return seen;
}, {});

console.log(
  `  ${written} card(s) — ${designs.length} designs (${Object.entries(byType)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ')}), every step, × 2 directions`,
);

writeFileSync(
  resolve(OUT, 'designs.json'),
  JSON.stringify(
    designs.map(({ id, name, display_type, tier, tree }) => ({
      id,
      name,
      display_type,
      tier: tier ?? 'free',
      steps: tree.steps.length,
    })),
    null,
    2,
  ),
);
