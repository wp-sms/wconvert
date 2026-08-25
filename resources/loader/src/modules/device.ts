import type { LoaderModule } from '../types';

/**
 * `device` — the one free Condition.
 *
 * It is free on an argued exception (issue #3): a free user who cannot say
 * "not on mobile" ships a popup into the one context where Google's intrusive-
 * interstitial penalty applies, and their recourse is to uninstall rather than
 * upgrade. It is also the cheapest signal in the vocabulary — no listener, no
 * table, no network.
 *
 * `viewport_min_width` was cut for it: same signal, bucketed and legible. So
 * this is three buckets read from `matchMedia`, not a pixel threshold in a
 * merchant's rule.
 *
 * The scalar is SET-VALUED — `{"type":"device","in":["mobile","tablet"]}` —
 * which is how ADR 0005 answers the real OR cases without any boolean
 * structure at all.
 *
 * No listener, deliberately: `holds()` reads `matchMedia` live, so a visitor
 * who rotates a tablet between a Trigger being armed and firing is answered at
 * the instant that matters rather than from a reading taken on load.
 */
const MOBILE = '(max-width: 767px)';
const TABLET = '(max-width: 1023px)';

function bucket(): string {
  if (window.matchMedia(MOBILE).matches) {
    return 'mobile';
  }

  return window.matchMedia(TABLET).matches ? 'tablet' : 'desktop';
}

export const device: LoaderModule = {
  id: 'device',
  kind: 'condition',
  consentCategory: null,
  create: () => ({
    holds: (rule) => Array.isArray(rule.in) && (rule.in as unknown[]).includes(bucket()),
  }),
};
