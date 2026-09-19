/**
 * The four containers, as CSS a blank page can use — **and a guard that fails
 * when the real ones move.**
 *
 * ============================================================================
 * THIS IS THE ONE MIRROR IN THIS TOOL, SO IT IS THE ONE THING THAT CAN DRIFT.
 * ============================================================================
 * Everything else here is generated: `VOCABULARY.md` from the manifest, the
 * renderer from its own source. A container cannot be, because the shipping
 * ones are built IMPERATIVELY — free's `mount.ts` sets `DIALOG_ARMOUR` inline
 * on a `<dialog>` and Pro's `popover.ts` sets `PLACEMENT` inline on a popover,
 * property by property, with `!important`. There is no stylesheet to lift.
 *
 * Bundling those modules instead was the alternative and it is worse: free's
 * needs `showModal()` and a real top layer, Pro's needs the Popover API and a
 * `@starting-style` transition, and neither survives being screenshotted by a
 * headless browser that must capture a still frame. The capture wants the
 * GEOMETRY, not the machinery.
 *
 * So the geometry is restated here — and then **asserted against the source**,
 * which is the posture `tools/design-system/build/tokens.mjs` takes toward
 * `index.css`: fail loudly if the thing you are mirroring has moved, rather
 * than emit a stale file. A bar captured 1rem off the edge it is actually
 * pinned to is a design judged against a lie.
 *
 * ============================================================================
 * THE CONTAINER IS A WRAPPER AROUND THE SHADOW HOST, NEVER THE HOST ITSELF.
 * ============================================================================
 * This is not a stylistic choice and it cost an hour. `SHADOW_CSS` opens with
 * `:host{all:initial!important;display:block!important}`, and while a `:host`
 * rule normally loses to the outer document, an **`!important` declaration in
 * `:host` beats a normal declaration outside it** — that is the one direction
 * the cascade inverts for shadow hosts.
 *
 * So `position: absolute` set on the host from out here is silently reverted
 * to `static` by `all: initial`. The failure is quiet and looks like a design
 * problem: the bar renders full width at the TOP of the frame, which reads as
 * a bar that does not know where it goes rather than as CSS that never
 * applied.
 *
 * The shipping code has the same shape for the same reason — free's
 * `<dialog>` and Pro's popover both CONTAIN the shadow host rather than being
 * it. `.wc-box` is that wrapper here.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PLUGIN = process.env.WCONVERT_PLUGIN ?? process.cwd();

/**
 * What each container is, and the exact strings that prove it is still true.
 *
 * `holds` is matched against the shipping source. They are the load-bearing
 * halves — the edge a thing is pinned to and the width it may take — rather
 * than every declaration, because asserting the whole table would fail on a
 * reordered object literal and teach everyone to delete this check.
 */
const CONTAINERS = {
  popup: {
    source: 'resources/renderer/src/mount.ts',
    holds: ["position: 'fixed'", "inset: '0'", "margin: 'auto'"],
    css: `
      .wc-container-popup { display: grid; place-items: center;
        background: var(--bench-backdrop, rgba(15, 23, 42, .55)); }
      .wc-container-popup > .wc-box { max-inline-size: 100%; }`,
  },
  inline: {
    source: 'resources/renderer/src/mount.ts',
    holds: ['anchor'],
    css: `
      /* In the flow, where the block was placed — so the card shows the page
         around it rather than a design floating in a void. */
      .wc-container-inline { padding: 2rem 1rem; }`,
  },
  floating_bar: {
    source: 'pro/modules/display-types/loader/popover.ts',
    holds: [
      "const bar = displayType === 'floating_bar';",
      "`inset-block-${top ? 'start' : 'end'}`",
      "bar ? '100%' : '100% - 2rem, 26rem'",
    ],
    css: `
      .wc-container-floating_bar > .wc-box { position: absolute;
        inset-block-start: auto; inset-block-end: max(0px, env(safe-area-inset-bottom));
        inset-inline-start: 0; inset-inline-end: 0; }
      .wc-container-floating_bar[data-placement="block_start"] > .wc-box {
        inset-block-start: max(0px, env(safe-area-inset-top)); inset-block-end: auto; }`,
  },
  slide_in: {
    source: 'pro/modules/display-types/loader/popover.ts',
    holds: [
      "/^block_(start|end)_inline_(start|end)$/.exec",
      "`inset-inline-${start ? 'start' : 'end'}`",
      "bar ? '0' : `max(1rem, var(--wcv-i${start ? 's' : 'e'}, 0px))`",
    ],
    css: `
      .wc-container-slide_in { --wcv-is: env(safe-area-inset-left);
        --wcv-ie: env(safe-area-inset-right); }
      .wc-container-slide_in:dir(rtl) { --wcv-is: env(safe-area-inset-right);
        --wcv-ie: env(safe-area-inset-left); }
      .wc-container-slide_in > .wc-box { position: absolute;
        inset-block-start: auto; inset-block-end: max(1rem, env(safe-area-inset-bottom));
        inset-inline-start: auto; inset-inline-end: max(1rem, var(--wcv-ie, 0px));
        inline-size: min(100% - 2rem, 26rem); }
      .wc-container-slide_in[data-placement^="block_start"] > .wc-box {
        inset-block-start: max(1rem, env(safe-area-inset-top)); inset-block-end: auto; }
      .wc-container-slide_in[data-placement$="inline_start"] > .wc-box {
        inset-inline-start: max(1rem, var(--wcv-is, 0px)); inset-inline-end: auto; }`,
  },
};

/**
 * Read every source once and hold this file to it.
 *
 * Throws rather than warns. A warning in a build that prints thirty other
 * lines is a warning nobody reads, and the failure it guards against — a
 * design judged in a container it is not actually served in — looks exactly
 * like a design that is simply wrong.
 */
export function containerCss() {
  const cache = new Map();
  const drifted = [];

  for (const [type, container] of Object.entries(CONTAINERS)) {
    if (!cache.has(container.source)) {
      cache.set(container.source, readFileSync(resolve(PLUGIN, container.source), 'utf8'));
    }

    const source = cache.get(container.source);

    for (const held of container.holds) {
      if (!source.includes(held)) {
        drifted.push(`  ${type}: ${container.source} no longer contains ${held}`);
      }
    }
  }

  if (drifted.length > 0) {
    throw new Error(
      `the shipping containers moved and tools/design-library/build/containers.mjs did not:\n${drifted.join('\n')}\n\n` +
        'Update the CSS here to match, then update `holds`. A design captured in the wrong container is a design judged against a lie.',
    );
  }

  return Object.values(CONTAINERS)
    .map((container) => container.css)
    .join('\n');
}

export const DISPLAY_TYPES = Object.keys(CONTAINERS);
