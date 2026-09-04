/**
 * The screens Pro adds to the admin.
 *
 * =============================================================================
 * IT IS EMPTY, AND THE EMPTY LIST IS REAL RATHER THAN A PLACEHOLDER.
 * =============================================================================
 * Pro supplies premium capabilities today through the LOADER (the premium
 * Triggers and Conditions), through the TEMPLATE library (bars and slide-ins)
 * and through the rule registry — none of which is an admin screen. Free's
 * admin already draws every one of them, because a `locked` card and a premium
 * design are DATA the free bundle renders (ADR 0015): the admin never asks "is
 * Pro loaded", it asks the server what this install supplies and draws the
 * answer.
 *
 * So Pro's admin bundle is free's screens, composed through Pro's entry, and
 * nothing else — yet. **The mechanism is what had to exist now**, not the
 * screens: two separately-installed plugins mean two script tags, and the only
 * shapes available are replacement (Pro's bundle, free's dequeued) or runtime
 * React injection into free's running app. The second needs the two scripts to
 * agree about load order, which is the failure ADR 0004 catalogues. Choosing
 * that after free 0.1.0 is on wp.org means changing free to grow an injection
 * seam, in a release every existing install downloads (ADR 0056).
 *
 * A/B testing was the first thing expected to land here, and **it did not.**
 * Starting a test and ending one are two ROW ACTIONS on free's existing Optins
 * list, and the arms nest inside the list free already draws — so the whole
 * surface is free's admin rendering a premium capability's `locked` state as
 * DATA, which is the arrangement ADR 0015 already describes and every other
 * premium capability already uses. `PRO_SCREENS` stayed empty, the tripwire in
 * `pro/tests/js/admin-entry.test.ts` did not fire, and no admin build was split
 * (ADR 0058).
 *
 * That is worth reading as evidence rather than as a near miss: the feature
 * that was expected to force a per-rung admin build turned out not to need one,
 * because the admin asks the server what this install supplies and draws the
 * answer. Whatever lands here first will be a screen that genuinely has nowhere
 * else to be — and it still lands as an entry in this list plus whatever it
 * renders, with no change to free, no registration hook, and no second React on
 * the page.
 *
 * **When the first one arrives it needs a Tailwind source too.** Tailwind v4
 * detects its sources from the directory of the CSS file it is asked to build,
 * which is free's `resources/admin/src/index.css` — so a class used only under
 * `pro/` is a class nothing emits. One `@source` line in a Pro stylesheet is
 * the fix; it is not written here because there is nothing yet to scan, and
 * nothing is written before its subject (ADR 0029).
 */
export const PRO_SCREENS: readonly never[] = [];
