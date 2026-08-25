# A Goal the site cannot serve is hidden

**"Bring shoppers back to their cart"** is absent from the goal screen on a site with
no WooCommerce. Not greyed out, not explained — absent.

It is also `tier: pro`, so on a free install with a store it renders as a **locked**
upsell card. When both reasons apply at once, **`unavailable` wins**: a merchant with
no store is never sold [[Pro]] for a feature Pro would not give them.

## Availability names the reason, not the rendering

`CONTEXT.md`'s [[Availability]] entry read *"`unavailable` … renders as an explanation
and never as an upsell."* That is right for a **settings list** — a merchant who opened
the Destinations page went looking for a list of destinations, and a silent gap in it
would be baffling. It is wrong for the **goal screen**, which is the front door of the
creation flow rather than a list someone went hunting through. A food blogger with no
store reading *"Recover abandoned carts — requires WooCommerce"* learns nothing they can
act on.

So the three states describe **why** something is absent; **how** it renders is a
property of the surface. The load-bearing half survives intact and is strengthened: no
surface ever renders `unavailable` as an upsell, and the precedence rule extends that
guarantee to the case where both reasons apply.

`CONTEXT.md` had already picked this side one layer down — a cart-abandonment
[[Playbook]] on a store-less site is *hidden*, with the reason given as **"You can buy a
licence from us; you cannot buy WooCommerce from us."** The prefill ticket said that
propagation reaches the Goal registry. This takes it literally.

Substitution was refused outright: there is no weaker cart Goal, and inventing one
hands the merchant an analytics screen reporting cart-recovery clicks on a site with no
carts — precisely the countability failure `CONTEXT.md`'s [[Goal]] test exists to
prevent.

## Why the Goal is Pro, and why that is a correctness fix

Both cart [[Condition]]s are Pro. The degradation rule
([ADR 0012](0012-degradation-substitutes-triggers-and-drops-conditions.md)) **drops** a
premium Condition, argued on the grounds that *"dropping only widens the audience."*

That holds for `device`. It fails here, because the Goal's copy **asserts the fact the
Condition guaranteed**. Dropped, *"You left 3 items in your cart"* shows to every
visitor on the site, including ones who have never added anything. The free tier would
ship a popup that lies.

Making the Goal itself `tier: pro` is the only option under which that is **impossible**
rather than merely avoided, and it needs no new mechanism — it is the `tier` flag on a
registry member, exactly the gating primitive
[ADR 0015](0015-enforcement-is-by-non-registration.md) already chose. The alternatives
were worse: moving `cart_has_items` to free re-opens a consent argument for one
Condition; marking every cart Playbook `requires` leaves a reachable Goal under which
*"start from scratch"* cannot add the Condition that defines it; and accepting the
widened audience trades a missing feature for a factually false one.

## Consequences

- **This Goal never degrades.** Pro is present by definition whenever the Goal is
  reachable, so every Pro [[Trigger]] (`exit_intent`, `scroll_up`) and both cart
  Conditions are always available to it. ADR 0012's table has no work to do inside it.
  The only remaining case is a dependency the merchant *removes* later, which
  [ADR 0027](0027-a-load-bearing-condition-suspends-rather-than-drops.md) covers.
- **`CONTEXT.md`'s [[Availability]] entry is amended** — the rendering line becomes a
  per-surface rule, and the `unavailable`-beats-`locked` precedence is added.
- **A Goal is a registry member subject to Availability**, like a Trigger type or a
  Destination type. There is still no separate list of premium capabilities.
  *Built by [#27](https://github.com/navidkashani/wconvert/issues/27) as an **enum
  plus data**: [`Goal`](../../src/Goal/Goal.php) declares its metric, its `tier`
  and what the site must have, and
  [`GoalRegistry`](../../src/Goal/GoalRegistry.php) resolves those against the
  install. The precedence is one function,
  [`Availability::of()`](../../src/Goal/Availability.php), so no surface
  recombines two booleans in an order of its own. The registry **filters
  nothing** — the three states name why a member is absent and how it renders is
  the surface's, which is what lets the goal screen hide where a settings list
  explains: one rule, two renderings, in
  [`resources/admin/src/goals/availability.ts`](../../resources/admin/src/goals/availability.ts).*
- **The rule is enforced at the write, not only on the screen.** *Added by
  [#27](https://github.com/navidkashani/wconvert/issues/27): a screen is not an
  enforcement mechanism, and `POST /wconvert/v1/optins` is scriptable by anyone
  holding `manage_options` — so the question the goal screen asks is asked again
  in [`OptinController`](../../src/Rest/OptinController.php), where it can refuse.
  What is checked is the Goal being SET and never the one already held: an Optin
  whose Goal became `unavailable` keeps it, and keeps every number it already
  counted.*
- Merchants who deactivate WooCommerce temporarily see their goal screen change shape
  with no explanation on that screen. Accepted: it is rare, and ADR 0027 tells them
  what happened on the screen where they would actually notice — the Optin list.
- Existing Optins are untouched. The [[Goal]] is read at report time and never frozen
  ([ADR 0020](0020-conversions-are-interpreted-at-read.md)), so an install that loses
  WooCommerce keeps every number it already counted and they stay correct.
