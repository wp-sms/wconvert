# The admin holds different floors to the loader

The loader fails a build at **8,192 bytes**, gzipped, per build
(`bin/check-loader.mjs`, [ADR 0004](0004-the-loader-survives-optimizers-not-just-caches.md)).
The admin bundle has **no gate at all** — its size is printed on every build and
blocks nothing. The two are not inconsistent, and this ADR is why.

Alongside it, the other floors the admin holds: **WCAG 2.1 AA**, enforced by
lint; **360px on the reading screens and 782px on the builder**; and **no dark
mode in 0.1.0**.

## The budget answers to who pays it

The loader's 8KB is paid by **every visitor on every page view of every install**,
on connections and devices WConvert does not choose. It is on the critical path of
someone else's site, and a byte added there is a byte multiplied by all of that.
A hard gate is proportionate because the cost is unbounded and invisible to the
person adding it.

The admin bundle is paid by **one authenticated person, on one screen, on the
machine they chose to administer a website from**, after WordPress has already
loaded its own admin payload. It is 74KB gzipped today and will roughly double
with Tailwind, Radix and lucide.

A hard gate there has a predictable life: it blocks a feature somebody needs, the
number gets raised to unblock it, and after the second raise it is a formality
nobody reads. **A gate that will be raised on demand is worse than no gate**,
because it launders the decision — the first version of this argument is already
in `bin/plugin-check.sh`: *"a gate that blocks on everything is a gate somebody
turns off."*

What survives is measurement without enforcement, which this repo's culture
supports elsewhere: `bin/plugin-check.sh` prints every warning and blocks on none.
The number is printed every build so a doubling is visible in the diff that caused
it, and a person decides.

## Splitting the builder is what makes the number stay honest

The reading screens — Optins, Analytics, Leads, Destinations — need none of the
gallery, none of the settings panel and none of the renderer. The builder needs
all three, and the renderer is imported into the admin precisely because there
are no static thumbnails
([ADR 0010](0010-templates-are-configuration-not-documents.md)).

Lazy-loading the builder keeps the common case — a merchant checking yesterday's
leads — near what it costs today, and puts the weight on the screen that
justifies it. This is worth more than any budget number would have been, because
it changes what is loaded rather than arguing about what may be.

## The responsive floor is split because the honesty is in the split

- **Reading screens work to 360px.** Checking a conversion count or yesterday's
  leads from a phone is a real thing people do, and those screens are lists and
  numbers — the things that reflow.
- **The builder is desktop-only, and says so below 782px.** It is a sticky live
  preview beside a settings panel; there is no arrangement of those two that
  works on a 375px viewport, and pretending otherwise means real work producing
  something nobody can use.

782px is where wp-admin's own menu collapses, so it is the line WordPress already
draws and the honest place to draw this one. **Saying so on screen is the load-
bearing half** — a builder that silently degrades on a narrow viewport is a bug
report; one that says what it needs is a product decision the merchant can act on.

## Accessibility gets a lint gate because intentions do not survive a deadline

[ADR 0035](0035-the-admin-owns-its-page.md) gave up what wp-admin was providing
free. **WCAG 2.1 AA** is the replacement bar, and it is held three ways:

- **Radix** covers keyboard interaction, focus management and ARIA — the part
  that is genuinely hard and the reason the primitives are worth a dependency.
- **`eslint-plugin-jsx-a11y`, blocking**, covers the mechanical failures —
  unlabelled controls, bad roles, click handlers on `<div>`s. Near-zero cost, and
  it fires on the pull request rather than in a review.
- **Contrast is measured at the token**, once, rather than per component
  ([ADR 0037](0037-the-admin-inherits-token-structure-and-owns-its-values.md)
  records the 5.95:1 for `--primary`).

AAA is explicitly not the bar. It would rule out the palette on
[ADR 0037](0037-the-admin-inherits-token-structure-and-owns-its-values.md)'s own
numbers, and it is not what a WordPress admin screen is held to anywhere else.

## The testing line from #29 holds, and the existing tests become the net

[#29](https://github.com/navidkashani/wconvert/issues/29) says *"Not a TDD seam:
React component structure, panel layout, gallery chrome. Test the translation,
not the widgets."* Redesigning every screen is the moment that line gets tested,
and it holds — a test asserting a class name or a DOM shape is exactly the churn
it was written to avoid, and this change would break all of them for no signal.

What changes is what the **ten existing component tests** are for. They assert
behaviour — that a row shows its [[Goal]]'s label and not its id, that a
[[Suspended]] Optin reads as suspended, that the capture route registers the args
it must. None of that is markup, so **all ten should survive a total restyle
untouched**, and one breaking mid-redesign is the signal that behaviour moved
rather than that a test went stale.

That makes them the cheapest available guard on the widest change this codebase
has taken, and it costs nothing to adopt: it is a rule about how to read a
failure, not a line of new code.

## Consequences

- **`bin/check-loader.mjs` is untouched.** Its 8,192 bytes and the premium-import
  scan are unaffected by anything in the admin, and
  [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md) already proves at
  every pull request that the loader's source imports nothing from
  `resources/admin/`.
- **A build prints the admin bundle's gzipped size**, so growth is visible where
  it is caused.
- **The builder is a lazy boundary**, which means it is also the natural place for
  anything else heavy to land later without a conversation about the budget.
  *Not built as of [#63](https://github.com/navidkashani/wconvert/issues/63),
  which stood the reporting up; the split is
  [#73](https://github.com/navidkashani/wconvert/issues/73). Until it lands the
  printed number is the UNSPLIT bundle, so a reader comparing it against the
  argument above should know it is the pessimistic figure and not the one a
  merchant checking yesterday's leads actually pays. The split needs the admin
  build to stop being an IIFE, which cannot code-split — that is the work #73
  carries and the reason it is a ticket rather than a line.*
- **A 782px message is a shipped string** and therefore translatable, and it needs
  to say what the merchant should do rather than that something is unsupported.
- **If someone later shows the admin bundle actually hurting**, the escalation is
  a number in CI and a conversation — the same posture
  [ADR 0034](0034-the-dashboard-joins-in-php.md) takes on the index it did not
  add. It should be taken on evidence, not on principle.
