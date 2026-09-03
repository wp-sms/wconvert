import { adminSettings } from '../settings';

/**
 * How a surface renders a registry member's [[Availability]].
 *
 * ============================================================================
 * THE THREE STATES NAME WHY. THE SURFACE DECIDES HOW.
 * ============================================================================
 * `ready`, `locked` and `unavailable` say why a member is absent — present and
 * usable, absent because the install has no Pro, absent because something the
 * *site* would need is missing. **How** that absence renders is a property of
 * the surface, and the two surfaces render `unavailable` OPPOSITELY
 * (ADR 0026):
 *
 * - A **settings list** the merchant went hunting through *explains* the gap,
 *   because silence there is baffling — they opened the page expecting a list.
 * - The **goal screen**, being the front door of a creation flow, *hides* it.
 *   A food blogger with no store reading "Recover abandoned carts — requires
 *   WooCommerce" learns nothing they can act on.
 *
 * **And no surface ever renders `unavailable` as an upsell.** That is the
 * load-bearing half, and it is why this is one function rather than a
 * condition written out per screen: a paying customer must never be shown an
 * advertisement for Pro, and we must never offer to sell a merchant a
 * WooCommerce licence we do not have.
 *
 * The precedence that produces `unavailable` in the first place — it beats
 * `locked` where both reasons apply — is PHP's, in
 * `WConvert\Support\Availability::of()`. It is resolved once, on the server, so
 * this side never recombines two booleans in an order of its own.
 *
 * ============================================================================
 * A [[Template]] IS A REGISTRY MEMBER TOO, WITH ONE STATE IT CANNOT REACH.
 * ============================================================================
 * The design picker renders through this function rather than through a rule of
 * its own (ADR 0043), and a design is `ready` or `locked` and **never
 * `unavailable`**: no site capability makes a *design* absent — there is no
 * WooCommerce a `split` layout needs — so the branch this file spends its last
 * line on has nothing to decide there.
 *
 * The `locked` arm below is the whole of it: free bundles the CARD for a premium
 * design — a name, its facets, a link to a live preview on wconvert.com — and
 * never the design, because shipping the tree and refusing the save is
 * trialware (issue #7). The comment under `locked` about bundled copy is
 * therefore literal for templates as well: `resources/templates/locked.json` is
 * in the ZIP.
 */

/**
 * Spelled here as well as in `src/Goal/Availability.php`.
 *
 * There is no manifest between the two to be the single source, because there
 * is nothing else about a state to declare — the same arrangement the beacon's
 * kinds have. `tests/unit/Goal/GoalParityTest.php` is what stops them
 * drifting; two spellings with nothing asserting they agree is how a fourth
 * state gets added to the enum and every surface silently keeps handling
 * three.
 */
export type Availability = 'ready' | 'locked' | 'unavailable';

/** The two surfaces that render an absence, and they disagree on purpose. */
export type Surface = 'creation_flow' | 'settings_list';

/** What a surface actually puts on screen. */
export type Rendering = 'offer' | 'upsell' | 'explain' | 'hide';

export function renderingFor(availability: Availability, surface: Surface): Rendering {
  if (availability === 'ready') {
    return 'offer';
  }

  // Buyable from us, so both surfaces say so. The upsell copy is bundled,
  // never fetched — a free wp.org plugin phoning home for advertising copy is
  // a different conversation with the review team (ADR 0015).
  //
  // **WHICH tier to name is a separate question**, answered by `tierName()`
  // below rather than folded in here: this function answers "what does this
  // surface DO", and there is exactly one `upsell` however many rungs the
  // ladder has (ADR 0056).
  if (availability === 'locked') {
    return 'upsell';
  }

  return surface === 'creation_flow' ? 'hide' : 'explain';
}

/**
 * ============================================================================
 * WHAT TO CALL THE TIER A LOCKED MEMBER NEEDS.
 * ============================================================================
 * Every registry member declares the rung that supplies it — `basic`, `pro`,
 * `elite` — and the words for those rungs are `tiers.json`'s, delivered to the
 * screen in `window.wconvertAdmin.tiers` (ADR 0056). They were the literal
 * `__('Pro')`, written out in five components.
 *
 * **At launch every rung answers "Pro", so nothing on screen changes.** What
 * changes is what a second tier costs: a manifest edit rather than five strings
 * and a release, and no migration of the `tier` values already saved on live
 * Optins.
 *
 * **Falls back to the word the product has always used**, and the fallback is
 * load-bearing rather than defensive: `adminSettings()` is legitimately absent
 * — a test rendering a component on its own, or a screen that changed and left
 * the localised object behind — and a badge rendering an empty string is worse
 * than one naming the tier nobody has renamed yet. It is also what a member
 * declaring a rung this build has never heard of gets, which is the state a
 * saved Optin reaches when an install is moved BACKWARDS onto an older free.
 */
const A_TIER_WE_CANNOT_NAME = 'Pro';

const A_PRODUCT_WE_CANNOT_NAME = 'WConvert Pro';

/** The badge on a locked card — short, and it sits in a chip. */
export function tierName(tier: string | undefined): string {
  return adminSettings()?.tiers?.[tier ?? '']?.name || A_TIER_WE_CANNOT_NAME;
}

/**
 * The thing on the invoice, for the sentence under the badge.
 *
 * Separate from {@link tierName} rather than derived from it, because the two
 * are read in different sentences: a badge reading "WConvert Pro" no longer
 * fits in a chip, and a sentence reading *"Available with Pro."* names nothing.
 */
export function tierProductName(tier: string | undefined): string {
  return adminSettings()?.tiers?.[tier ?? '']?.product_name || A_PRODUCT_WE_CANNOT_NAME;
}
