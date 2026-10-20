import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';

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
 * One window for the whole library: evaluating the bundle once per campaign
 * would be most of the cost.
 */
export function renderedIdentities(renderer, entries) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  try {
    dom.window.eval(renderer);
    const api = dom.window.WConvertRenderer;
    const css = createHash('sha256').update(api.SHADOW_CSS).digest('hex');
    const identities = new Map();
    for (const entry of entries) {
      const hash = createHash('sha256').update('rendered-v1\n').update(css);
      for (const [index, step] of (entry.tree?.steps ?? []).entries()) {
        for (const variant of step.results?.length ? step.results : [null]) {
          const node = api.render(entry.tree, entry.tokens ?? {}, index);
          if (variant) api.previewResult?.(node, variant, step.products_required);
          hash.update(`\n${step.id}/${variant?.id ?? ''}\n`).update(node.outerHTML);
        }
      }
      identities.set(entry.id, hash.digest('hex'));
    }
    return identities;
  } finally { dom.window.close(); }
}
