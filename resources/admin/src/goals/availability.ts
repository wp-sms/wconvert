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
  if (availability === 'locked') {
    return 'upsell';
  }

  return surface === 'creation_flow' ? 'hide' : 'explain';
}
