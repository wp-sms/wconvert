import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { SAMPLE_DEADLINE, SAMPLE_ERROR, SAMPLE_NOW, drawWithChrome } from './chrome.mjs';

/**
 * What a campaign LOOKS like, as a digest: every screen and result variant
 * rendered by the given renderer bundle, plus the stylesheet it mounts with
 * (ADR 0156, Phase 5).
 *
 * Approval used to be bound to the renderer's bytes, so any renderer change —
 * a refactor, a studio control, a comment — staled every approval in the
 * library. Bound to this instead, a change that draws the same markup and
 * styles leaves an approval current, and one that draws something different
 * stales exactly the campaigns it touched. `visual-diff.mjs` then compares
 * those pixel for pixel before anyone is asked to look again.
 *
 * **Version 2 draws what the loader adds too** — the close control, a refused
 * field and a painted countdown ({@link drawWithChrome}) — because a design
 * colours all three (ADR 0159), and a change to them must stale what it
 * touched. Version 1 is kept only so `visual-diff` can recognise a decision
 * recorded under it; nothing new is stamped with it.
 *
 * One window for the whole library: evaluating the bundle once per campaign
 * would be most of the cost.
 */
export function renderedIdentities(renderer, entries, { version = 2 } = {}) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  try {
    // A fixed clock, so a countdown paints the same digits on every run.
    dom.window.Date.now = () => SAMPLE_NOW;
    // jsdom has no CSSOM namespace; the refusal escapes a field name with it.
    dom.window.CSS ??= { escape: value => String(value).replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`) };
    dom.window.eval(renderer);
    const api = dom.window.WConvertRenderer;
    const css = createHash('sha256').update(api.SHADOW_CSS).digest('hex');
    const identities = new Map();
    for (const entry of entries) {
      const hash = createHash('sha256').update(version === 1 ? 'rendered-v1\n' : 'rendered-v2\n').update(css);
      for (const [index, step] of (entry.tree?.steps ?? []).entries()) {
        for (const variant of step.results?.length ? step.results : [null]) {
          let node;
          if (version === 1) {
            node = api.render(entry.tree, entry.tokens ?? {}, index);
            if (variant) api.previewResult?.(node, variant, step.products_required);
          } else node = drawWithChrome(api, entry, index, variant, SAMPLE_DEADLINE, SAMPLE_ERROR).root;
          hash.update(`\n${step.id}/${variant?.id ?? ''}\n`).update(node.outerHTML);
        }
      }
      identities.set(entry.id, hash.digest('hex'));
    }
    return identities;
  } finally { dom.window.close(); }
}
