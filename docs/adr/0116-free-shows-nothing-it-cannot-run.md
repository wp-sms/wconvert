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

Wherever Pro is installed, `locked` is still an upsell. A Basic site sees
Elite's members, because it has already bought into the ladder and the next
rung is information it can act on.

**2. Free's whole upsell is two things.** The header's *Explore Pro* link, and
one static *More with Pro* list in Settings. Both are bundled copy with no
remote fetch.

**3. Free names no product when it explains an absence.** A state a free site
only reaches after Pro was removed (a suspended rule, a saved destination of a
Pro type, saved email filters, a journey draft) says what is missing *on this
site* rather than what to buy. The journey message is *"This design uses
elements this site can't display."*

**4. Question journeys are a capability Pro registers.**
`JourneySupport::active()` reads the `wconvert_journeys` filter. Free never adds
to it. Pro's provider adds to it only when `modules/journeys/module.json` is on
disk. The publish refusal, the capture refusal, the suspension, the pack
validator and the builder all ask this one question, and none of them asks
about a tier. The builder offers no question element, result, screen condition
or flexible path unless `wconvertAdmin.journeys` is true.

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
