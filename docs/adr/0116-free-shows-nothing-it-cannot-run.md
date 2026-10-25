# 0116 — Free shows nothing it cannot run

Date: 2026-10-03

Amends [ADR 0012](0012-degradation-substitutes-triggers-and-drops-conditions.md),
[ADR 0015](0015-enforcement-is-by-non-registration.md),
[ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md),
[ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md),
[ADR 0060](0060-a-screen-is-four-situations-and-they-are-answered-the-same-way.md) and
[ADR 0106](0106-question-journeys-extend-the-paid-loader.md).


**Extended by [ADR 0117](0117-cart-intelligence-uses-a-bounded-session-projection.md):** Product suggestions and commerce selectors require the supplying Pro module and WooCommerce. Free retains saved structure for repair but does not offer working controls or a commerce runtime.

## Context

The free plugin goes to WordPress.org. Its review team reads Guideline 5
(trialware) against what the admin *shows*, not only what the ZIP contains.
ADR 0015 made the code absent, which is still true. But free's admin still
drew every `locked` registry member as an upsell: padlocked goals, 31 locked
gallery cards, a *With WConvert Pro* group in the rule picker, locked
destination types, Pro format choices, an A/B menu note and Pro pack badges.
A screen full of padlocks reads as a crippled product, whatever the ZIP holds.

Question journeys had a second problem. Free asked "is a paid tier installed?"
and refused to publish with *"…require WConvert Pro"*, while still offering
question screens, results and paths in the builder.

## Decision

**1. On a free install, `locked` renders as `hide` on every surface.**
`renderingFor()` returns `hide` for `locked` when `installedTier` is `free`.
The server mirrors this where it can: `TemplateController::index()` sends no
locked design to a free install, so `locked.json` stays in the ZIP but never
reaches the payload. Surfaces that don't route through `renderingFor` (format
picker, starting points, rule notes, the A/B item, packs, analytics, reopen and
inline-placement fallbacks) filter on the same `isFreeInstall()`.
*(Starting points: see the [ADR 0171](0171-one-template-gallery.md) note below.)*

> _Amended by [ADR 0147](0147-free-names-what-pro-adds-where-it-is-wanted.md): a locked member is still never drawn, but the list where it would sit may end in one line of text naming it — "Also in WConvert Pro ↗: …" — under that ADR's eight rules. Text, never an item._

> _Superseded for designs only by [ADR 0156](0156-the-catalogue-is-one-design-per-object.md): in the design picker, where Pro hints are wanted, a free install sees a Pro design as a locked image card — thumbnail, plan name, a link to wconvert.io, no control. Every other surface keeps this rule, and `locked.json` no longer exists._
> _Amended by [ADR 0171](0171-one-template-gallery.md): creation's step 2 is the same gallery, so a Pro setup reaches it as the same locked card under the same hint gate; every other surface still keeps this rule._

> _Amended by [ADR 0129](0129-display-rules-plain-questions-and-quick-picks.md): "starting points" in this list were the rule panel's rule sets, which are gone. The Display rules Quick picks route through `renderingFor` and hide a locked pick the same way._

Wherever Pro is installed, `locked` is still an upsell. A Basic site sees
Elite's members, because it has already bought into the ladder and the next
rung is information it can act on. *Amended by [ADR 0146](0146-pro-is-one-tier.md): Pro is one tier and
supplies every member, so a Pro install meets no `locked` member and this
upsell is unreachable in practice.*

**2. Free's whole upsell is two things.** The header's *Explore Pro* link, and
one static *More with Pro* list in Settings. Both are bundled copy with no
remote fetch.

> _Amended by [ADR 0147](0147-free-names-what-pro-adds-where-it-is-wanted.md): three, with the contextual hints — one muted line at the end of the Add rule menu, the format picker, the Flow map, the destination providers and the campaign ⋯ menu, on a free install, for a user who can install plugins. The header link and the list now carry fixed UTMs, and both say "Activate it" when Pro is installed but inactive._

> _Amended by [ADR 0143](0143-license-page-and-updater.md): each now carries one
> more plain link for a customer who already paid — "Already bought? Download it"
> beside *Explore Pro*, and "Already bought Pro? Download it from your account"
> under the list — to the account's downloads page. Still bundled, still no
> remote call, and still nothing locked is shown._

**3. Free names no product when it explains an absence.** A state a free site
only reaches after Pro was removed (a suspended rule, a saved destination of a
Pro type, saved email filters, a journey draft) says what is missing *on this
site* rather than what to buy. The journey message is *"This design uses
elements this site can't display."* **Completed by
[ADR 0127](0127-free-keeps-product-seams-not-product-reads.md):** product
recommendations, quiz cart buttons, sample baskets and product checks say the
same on a free install.

**4. Question journeys are a capability Pro registers.**
`JourneySupport::active()` reads the `wconvert_journeys` filter. Free never adds
to it. Pro's provider adds to it only when `modules/journeys/module.json` is on
disk. The publish refusal, the capture refusal, the suspension, the pack
validator and the builder all ask this one question, and none of them asks
about a tier. The builder offers no question element, result, screen condition
or flexible path unless `wconvertAdmin.journeys` is true.

> _Corrected by [ADR 0147](0147-free-names-what-pro-adds-where-it-is-wanted.md): the flag only gated editors that still shipped in free's bundle, which is trialware under Guideline 5. Those editors now live in Pro's admin bundle behind `journeyAuthoring`; the flag stays the server's word._

It is a filter rather than a container registry because two readers are static:
`AdminMenu::settings()` and `PackValidator::shipping()`.

## Consequences

- `availability.ts` keeps its three states and four renderings. Only the
  `locked` arm became install-dependent.
- A free merchant learns about Pro from the header link and the Settings list,
  not from greyed-out items mid-task. That is the trade, and it is deliberate.
- **The bypass is named and accepted**, as ADR 0015 accepts copying the Pro
  loader. A third plugin returning `true` from `wconvert_journeys` makes free
  publish a journey its own loader cannot draw. That breaks only the site that
  did it.
- Tests that assert upsell rendering now declare a paid `installedTier`. Absent
  boot data reads as free, because the safe failure for a wp.org build is to
  hide an upsell, never to show one.
