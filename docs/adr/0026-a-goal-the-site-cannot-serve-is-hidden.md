# A Goal the site cannot serve is hidden

**"Bring shoppers back to their cart"** is absent from the goal screen on a site with
no WooCommerce. Not greyed out, not explained — absent.

It is also `tier: pro`, so on a free install with a store it renders as a **locked**
upsell card.

> **Amended by [ADR 0116](0116-free-shows-nothing-it-cannot-run.md): on a free
> install a `locked` member is hidden on every surface, this Goal included.** It
> is an upsell only where Pro is installed and a higher rung is what is missing.
> The precedence below is unchanged, and so is the rule that `unavailable` is
> never an upsell. When both reasons apply at once, **`unavailable` wins**: a merchant with
no store is never sold [[Pro]] for a feature Pro would not give them.

> _Amended by [ADR 0129](0129-display-rules-plain-questions-and-quick-picks.md): one exception, on a free install only, for the Display rules Quick picks. A pick whose rule type is paid there reads as `locked` even when a plugin is also missing, so it is hidden rather than drawn as "Needs WooCommerce". Explaining the plugin would offer a free merchant a pick that vanishes the moment they install it. Rule rows and every other surface keep this precedence._

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

> **Amended by [ADR 0054](0054-every-control-has-the-shape-of-its-value.md): on
> the display-rules panel, the explanation moved *into the Add menu*.** The rule
> above is unchanged and this is not an exception to it — a list somebody hunts
> through still explains its gaps rather than hiding them. What the rules panel
> got wrong is **which thing the list is.** It rendered the absent rule types as
> a permanent block on the tab, beside the rules the merchant actually has, so
> every visit paid for an explanation of what could not be added by anyone who
> had not yet tried to add anything. The list a merchant hunts through is the
> **Add menu**; the tab is not. As refined by [ADR 0078](0078-editor-choices-stay-compact-and-scrollable.md), this is now a searchable popover; absent types are noninteractive text
> groups inside it — *With WConvert Pro*, *Needs WooCommerce* — which is the
> same `explain` rendering, moved to the moment it changes what they do next
> ([ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md)
> rule 2). The precedence this ADR settles is what puts a cart rule under
> *Needs WooCommerce* and never under *With WConvert Pro*, so the grouping reads
> `availability` and not `tier`.

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
  *Relied on by [#36](https://github.com/navidkashani/wconvert/issues/36): two of
  the three cart [[Playbook]]s prefill a premium [[Trigger]] alongside a premium
  Condition, which no other bundled entry may do. The rule that replaced "free's
  bundled library names only free's own rules" is exactly this bullet made
  checkable — **a Playbook may name what its Goal already guarantees, on both
  axes**, so a `tier: pro` rule needs a `tier: pro` Goal over it and a rule
  declaring a [[SiteDependency]] needs a Goal declaring the same one
  (`tests/unit/Playbook/BundledPlaybooksTest.php`).*
- **`CONTEXT.md`'s [[Availability]] entry is amended** — the rendering line becomes a
  per-surface rule, and the `unavailable`-beats-`locked` precedence is added.
- **A Goal is a registry member subject to Availability**, like a Trigger type or a
  Destination type. There is still no separate list of premium capabilities.

  ***And so is a [[Template]], as of
  [ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md)** — with
  one state it cannot reach. A design is `ready` or `locked` and **never
  `unavailable`**: no site capability makes a *design* absent, because there is
  no WooCommerce a `split` layout needs. `renderingFor(availability, surface)` is
  reused rather than a second rule being invented, so a locked design is an
  upsell on both surfaces and the precedence this ADR settles has nothing to
  decide.
  *Amended by [ADR 0116](0116-free-shows-nothing-it-cannot-run.md): an upsell
  on both surfaces **of a paid install**. On a free install `renderingFor()`
  answers `hide` for `locked`, and the server sends it no locked design.*

  The **upsell metadata stays bundled**, which is the half worth restating here:
  `resources/templates/locked.json` carries a premium design's name, its facets
  and a link to a live preview on wconvert.io, and free ships it rather than
  fetching it. What free does **not** ship is the design — shipping the tree and
  refusing the save is trialware
  ([#7](https://github.com/navidkashani/wconvert/issues/7)) and rendering a real
  control `disabled` is what Guideline 9 fires on, so a locked card is a link and
  never a greyed-out button.

  And a **Pro install sees no locked cards at all**, which falls out of
  availability resolving server-side exactly as this ADR requires — Pro
  registers the real design through the same source seam, the stub's id
  collides, and the advertisement is never composed. A paying customer is never
  shown an advertisement for what they bought, and no surface had to remember
  that.*

  ***And so is a rule type, on both halves, as of
  [#36](https://github.com/navidkashani/wconvert/issues/36).*** *Until then
  [`RuleCatalogue::availabilityOf()`](../../src/Rules/RuleCatalogue.php) passed a
  literal `true` for "the site can serve it", because no rule type declared a
  dependency; the two cart Conditions are the first that do, and they declare it as
  `requires` on the rule manifest — beside `tier`, on a registry that already
  enumerates them, so the count of lists is still zero. The arithmetic did not
  change: it was already `Availability::of()`, which is why `unavailable` beating
  `locked` arrived for rule types with nothing to re-derive.*

  ***There was a live hole underneath this, and closing it is what #36 was for.***
  *Registration is the entitlement ([ADR 0015](0015-enforcement-is-by-non-registration.md)),
  and Pro's provider registered every `tier: pro` rule type unconditionally at boot.
  So on a Pro install with WooCommerce **deactivated**, `cart_has_items` was
  *supplied* — therefore not suspended, therefore shown, and the Optin said "you
  left 3 items in your cart" to somebody who had never added anything. That is
  precisely ADR 0027's failure arriving from the WooCommerce side rather than the
  Pro side, and `on_absence: suspend` alone does not close it: the field only fires
  when the type is UNSUPPLIED. The fix keeps the shape rather than adding a branch —
  [`RuleVocabulary::typesAt()`](../../src/Rules/RuleVocabulary.php) now takes the
  site as well as the tier, and **both** providers ask it, because a gate only one
  caller applies is a gate the other re-opens. A rule needing a store on a site with
  no store genuinely cannot be evaluated: nothing writes the cart cookie, so its
  module would answer false forever — the silent, total loss ADR 0012 names, where
  suspension is the same outcome with a cause the merchant can read.*
  *Built by [#27](https://github.com/navidkashani/wconvert/issues/27) as an **enum
  plus data**: [`Goal`](../../src/Goal/Goal.php) declares its metric, its `tier`
  and what the site must have, and
  [`GoalRegistry`](../../src/Goal/GoalRegistry.php) resolves those against the
  install. The precedence is one function,
  [`Availability::of()`](../../src/Support/Availability.php), so no surface
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

  ***And the same route now checks the other half of the pairing***, *added by
  [#36](https://github.com/navidkashani/wconvert/issues/36): whether the DESIGN
  produces the outcome the Goal counts. The argument is this bullet's, one step
  further — a Playbook is checked at registration and a Template when it is
  registered, but `POST /wconvert/v1/optins` takes a whole design in `config`, so
  `{goal: 'recover_cart', template_id: 'stacked-signup'}` was accepted until then:
  a cart Optin with a form on it, which
  [ADR 0025](0025-cart-recovery-captures-nothing.md) says is forbidden rather than
  merely unnecessary. Asked against the Goal the Optin will HAVE, so correcting a
  Goal is still allowed and is still checked.*

  ***That check is deleted and this bullet gains a sharper case***, *by
  [ADR 0059](0059-the-converting-act-belongs-to-the-design.md). A Goal declares
  no act, so `{goal: 'recover_cart', template_id: 'stacked-signup'}` is now
  accepted and honestly counted. What the route still refuses is a design that
  captures nothing under a Goal read from deliveries, or on an Optin holding a
  [[Destination]] — and it found the hole this bullet's own argument predicts:
  both refusals were guarded on an incoming `config`, so* `PATCH {"goal": …}`
  *with none wrote any settable Goal onto any design, unchecked. Unreachable
  from the admin, and this route is scriptable by anyone holding
  `manage_options` — which is this bullet, exactly, applied to the goal-only
  PATCH. It matters more now that the builder HAS a control that changes a
  Goal.*
- Merchants who deactivate WooCommerce temporarily see their goal screen change shape
  with no explanation on that screen. Accepted: it is rare, and ADR 0027 tells them
  what happened on the screen where they would actually notice — the Optin list.
  *Delivered by [#36](https://github.com/navidkashani/wconvert/issues/36), and the
  sentence NAMES the plugin: [`Suspension`](../../src/Optin/Suspension.php)'s
  `unavailable` branch was written in #33 and unreachable until a rule type declared
  a dependency, and it read "not available on this site" — which leaves a merchant
  who deactivated WooCommerce to guess which of their plugins did it. It now reads
  "the “Has something in their cart” rule needs WooCommerce, which is not active on
  this site", resolved from the manifest through
  [`SiteDependency::label()`](../../src/Support/SiteDependency.php) rather than
  written out, and it says nothing about Pro — which is this ADR's load-bearing half
  at the one moment it could have been broken.*
- Existing Optins are untouched. The [[Goal]] is read at report time and never frozen
  ([ADR 0020](0020-conversions-are-interpreted-at-read.md)), so an install that loses
  WooCommerce keeps every number it already counted and they stay correct.
