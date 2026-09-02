# Enforcement is by non-registration

There is **no runtime licence check anywhere in WConvert.** The only question ever
asked is "is [[Pro]] loaded", and it is answered by the registries themselves: a
premium capability is *absent* from a free install rather than present and guarded.

Possession gates features; the licence gates updates and support. Once premium code
is genuinely absent there is nothing left to guard, so not one premium feature needs
an `if`.

## The whole premium surface, and how each is absent

| Premium capability | How it is absent on free |
|---|---|
| `exit_intent`, `scroll_up` | `tier: pro` entries in the one manifest, implemented only in Pro's module tree, which free's source never imports ([ADR 0028](0028-the-free-loader-source-carries-no-premium-code.md), amending [ADR 0014](0014-pro-replaces-the-loader.md)), and registered into [`SuppliedRules`](../../src/Rules/SuppliedRules.php) by Pro's own provider — *corrected, see below* |
| Premium conditions (the advanced-targeting set) | same |
| `floating_bar`, `slide_in` | templates free does not ship, and the `[popover=manual]` renderer path ([ADR 0011](0011-non-modal-overlays-use-the-popover-top-layer.md)) — *made literal by [ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md): a design now declares **`tier`**, `resources/templates/locked.json` bundles the CARD for a premium design with no `tree` in it, and `bin/verify-artifact-contract.sh` check (e) refuses a `tier: pro` entry or a tree in `locked.json` inside the free ZIP. The row said "templates free does not ship" and nothing proved it* |
| A/B testing | REST routes free never registers — so there is no permission callback to write |
| The four ESPs and the generic Webhook | Destination types Pro binds into the shared container ([ADR 0007](0007-destinations-are-outbound-and-fallible.md)) — *and what puts them on this side of the line is that they call out over HTTP, never that they are somebody else's product: free registers the WSMS, lead-magnet and MailPoet types because all three are in-process ([ADR 0049](0049-the-mailpoet-push-adds-membership-without-touching-status.md))* |
| The *Bring shoppers back to their cart* Goal | a Goal registry entry marked `tier: pro`, and absent outright on a site with no WooCommerce, where `unavailable` beats `locked` ([ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md)) — *built in [#27](https://github.com/navidkashani/wconvert/issues/27): the tier flag is [`Goal::tier()`](../../src/Goal/Goal.php) and the site half is [`SiteDependency`](../../src/Support/SiteDependency.php), asked through a [`SitePresence`](../../src/Support/SitePresence.php) seam beside `ProPresence`* |

*Corrected by [#32](https://github.com/navidkashani/wconvert/issues/32) on the
first row. It read "manifest entries the free manifest LACKS", and **free's
manifest names both tiers**: free's own PHP is what strips an unentitled rule
at enqueue ([ADR 0012](0012-degradation-substitutes-triggers-and-drops-conditions.md)),
and it can only strip what its own manifest calls premium — a premium
Condition left in the payload fails shut in free's evaluator, so the Optin
never shows and nothing says why. The same manifest is what free's admin
renders the `locked` card from, and what `bin/check-loader.mjs` reads its
identifier list from. The absence that matters is the CODE's, and it is real:
free's built loader contains neither identifier, scanned on every pull request
([ADR 0029](0029-the-free-contract-is-proven-at-the-source.md), check b, live
since #32). Recorded here rather than only on the ticket, because the row is
what a reader reaches for.*

*Built in [#32](https://github.com/navidkashani/wconvert/issues/32), first row
only: `exit_intent` and `scroll_up` are two modules under
[`pro/resources/loader/src/modules/`](../../pro/resources/loader/src/modules/),
and they are **two types rather than one with two meanings** — a single type
meaning `mouseout` on a desktop and an upward scroll on a phone is
unreportable, because "why didn't my popup show" has no per-rule answer when
one row means two things, and unpairable, because a merchant could never ask
for one gesture without the other. Neither is device-guarded; a merchant
confines either with the `device` Condition, which is what the second client
axis is for.*

## Why no hard enforcement

**wp.org Guideline 9 fires on the word *locked*.** A free ZIP that ships exit-intent
code and refuses to run it is trialware; a free ZIP that simply does not contain it
makes the identical upsell honest marketing. Absence is the compliance position, and
once absence is real, enforcement is redundant.

**The remaining bypass is named and accepted:** someone copies the Pro loader onto a
free install and gains exit intent and the premium conditions. That is ~300 bytes of
value, and obtaining it requires possessing the Pro ZIP — which under
possession-gating already means they have everything. Adding checks would buy nothing
and would put a branch on the request path 0004 exists to protect.

## Consequences

- **Every registry must enumerate its premium members as data**, marked
  `tier: premium`, so a free install can render the `locked` state without containing
  the feature. Content, never capability — the same line the Playbook library holds.
- **That data is bundled, never fetched.** A free wp.org plugin phoning home for
  *upsell copy* is a different conversation with the review team than fetching a
  template library the user asked for.
  *Both halves acted on by
  [ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md), and the
  distinction this sentence draws is the one it splits on. The **locked
  metadata** — a premium design's name, its facets and a link to a live preview
  on wconvert.com — is `resources/templates/locked.json`, bundled and never
  fetched. The **library** may grow from a WConvert-hosted index over the
  `TemplateSource` seam, transient-cached, degrading to the bundled set on any
  failure; that is the template library the user asked for, and it ships with
  the `readme.txt` disclosure the review team expects rather than beside the
  upsell copy.*
- **No cross-cutting capability vocabulary.** Each registry declares `tier` locally on
  members it already enumerates, so the premium split adds **zero new lists** — the
  same drift argument that rejected a second rule list in 0005 and a standalone
  substitution table in 0012.
  *Held again by [ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md)
  for the design library, which is the registry most tempted to invent one: a
  design declares `tier` in its own JSON, the shared
  [`Tier`](../../src/Support/Tier.php) enum is the only spelling, and
  `Availability::of()` does the arithmetic. `TemplateController` never asks
  whether a design is premium — it asks whether the tier is supplied, and a
  locked stub is `locked` because it has **no tree**, which is what "this install
  did not get it" means rather than a flag somebody set.*
  *Held through [#33](https://github.com/navidkashani/wconvert/issues/33), which is
  where it was most at risk: the degradation resolver needs to know which rule types
  this install can EVALUATE, and the obvious spelling of that is a list. It is
  [`SuppliedRules`](../../src/Rules/SuppliedRules.php) instead — a registry free fills
  from the manifest's `tier: free` entries and Pro fills from its own `tier: pro` ones,
  **neither side naming a rule type**. The question it answers is set membership, so
  the enqueue-time strip
  ([ADR 0012](0012-degradation-substitutes-triggers-and-drops-conditions.md)) asks no
  tier question at all and the front-end contract test below still passes for a real
  reason rather than because the branch moved one file along. This is the same shape
  the Destination registry already had, and it makes "enforcement is by
  non-registration" literal for the rule vocabulary: what registered decides, and a Pro
  that refused its min-core guard never reaches its provider.*
- **One accessor for "is Pro loaded", from day one.** It exists as headroom for a
  future tier ladder, not as a gate.
  *Amended by [#27](https://github.com/navidkashani/wconvert/issues/27): it is now
  an **interface** with one production implementation
  ([`WpProPresence`](../../src/Support/WpProPresence.php)) rather than a concrete
  class, on the same pattern as `OptionStore` and `Connection`. The fact it
  reports is a `define()`, and a constant cannot be undefined again — so a suite
  that defined `WCONVERT_PRO_LOADED` would decide the answer for every test that
  ran after it, and `locked` is the one state a free install renders that a free
  install cannot itself reach. It is still ONE accessor: the interface is where
  the question is asked, and one file is where the answer is looked up.*
  *Asserted from [#32](https://github.com/navidkashani/wconvert/issues/32):
  [`tests/unit/Contract/NoLicenceOnTheFrontEndTest.php`](../../tests/unit/Contract/NoLicenceOnTheFrontEndTest.php)
  fails if a second file in either tree looks the constant up, if anything that
  ships reads a licence value, or if the front-end request path asks a tier
  question at all. It reads SOURCE rather than behaviour, because what it
  guards against is a line someone adds and no assertion about output can see a
  rule that is currently being kept.* WSMS's cautionary case: its shipped elite ZIP is
  missing the `tiers.json` its own `TierGate` reads, benign only because every lookup
  fails open — and a ladder that fails open is not a ladder.
- **The licence option is read by Pro's updater and admin screens only**, and never on
  a front-end request.
  *As of [#32](https://github.com/navidkashani/wconvert/issues/32) neither
  exists, so the assertion available is the total one — nothing that ships
  reads a licence value anywhere. The updater will be the first hit, and
  whoever adds it has to come to that test and narrow it to the two paths named
  here. That is the point: a licence read becomes a decision somebody takes on
  purpose rather than one that arrives inside a feature branch.*
