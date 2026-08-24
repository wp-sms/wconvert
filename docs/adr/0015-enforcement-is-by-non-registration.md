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
| `exit_intent`, `scroll_up` | manifest entries the free manifest lacks; code that lives only in Pro's module tree and free's source never imports ([ADR 0028](0028-the-free-loader-source-carries-no-premium-code.md), amending [ADR 0014](0014-pro-replaces-the-loader.md)) |
| Premium conditions (the advanced-targeting set) | same |
| `floating_bar`, `slide_in` | templates free does not ship, and the `[popover=manual]` renderer path ([ADR 0011](0011-non-modal-overlays-use-the-popover-top-layer.md)) |
| A/B testing | REST routes free never registers — so there is no permission callback to write |
| The four ESPs and the generic Webhook | Destination types Pro binds into the shared container ([ADR 0007](0007-destinations-are-outbound-and-fallible.md)) |
| The *Bring shoppers back to their cart* Goal | a Goal registry entry marked `tier: pro`, and absent outright on a site with no WooCommerce, where `unavailable` beats `locked` ([ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md)) |

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
- **No cross-cutting capability vocabulary.** Each registry declares `tier` locally on
  members it already enumerates, so the premium split adds **zero new lists** — the
  same drift argument that rejected a second rule list in 0005 and a standalone
  substitution table in 0012.
- **One accessor for "is Pro loaded", from day one.** It exists as headroom for a
  future tier ladder, not as a gate. WSMS's cautionary case: its shipped elite ZIP is
  missing the `tiers.json` its own `TierGate` reads, benign only because every lookup
  fails open — and a ladder that fails open is not a ladder.
- **The licence option is read by Pro's updater and admin screens only**, and never on
  a front-end request.
