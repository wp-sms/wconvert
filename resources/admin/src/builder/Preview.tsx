import { useEffect, useRef } from 'react';
import { mount } from '@renderer/mount';
import type { Template } from '@renderer/types';

/**
 * A design, drawn by **the renderer the loader imports**.
 *
 * ============================================================================
 * THERE ARE NO STATIC THUMBNAILS, ANYWHERE IN THIS FLOW.
 * ============================================================================
 * The renderer is a pure function of (tree, tokens) and is dependency-free
 * precisely so two bundles can share it, and the admin is the second one
 * (ADR 0010). A gallery card and the settings preview are therefore the REAL
 * template rather than a picture of one — so there is nothing to produce when
 * a design is added and nothing to let go stale when one is changed, and what
 * the merchant approves is what a visitor sees.
 *
 * It mounts `inline`, because a card is a card: it wants the closed shadow
 * root that wins the CSS fight against wp-admin's own stylesheet, and none of
 * the top layer (ADR 0009, ADR 0011).
 *
 * Remounted whenever the design or the step changes, which is every keystroke
 * in the settings panel. That is affordable because the renderer builds DOM
 * and reads nothing — no network, no layout measurement, no ambient state —
 * and it is what keeps the preview a render of the current tree rather than a
 * patched copy of an older one.
 */
export function Preview({ template, step = 0 }: { template: Template; step?: number }) {
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mounted = mount({ displayType: 'inline', template, anchor: anchor.current });

    mounted.show();

    // Step 0 is what `show()` already rendered, so only a later step needs
    // swapping — and a step past the end is not asked for, because the caller
    // reads the count off the same tree.
    if (step > 0 && step < mounted.steps) {
      mounted.showStep(step);
    }

    return () => mounted.close();
  }, [template, step]);

  return <div ref={anchor} className="wconvert-preview" />;
}
