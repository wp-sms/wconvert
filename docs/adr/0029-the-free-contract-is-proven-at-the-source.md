# The free contract is proven at the source, not at the artifact

Four checks guard the free artifact, and the one that carries the guarantee needs
**no build at all**: no file in free's tree may import a `pro/` path or the Pro
namespace. It runs on every pull request. The artifact-level checks confirm at
release what it already proved at the source.

## WSMS's seven checks invert rather than transfer

`bin/verify-free-contract.sh` exists to catch a *failed strip*. Under
[ADR 0015](0015-enforcement-is-by-non-registration.md)'s add-on shape there is
nothing to strip, so checks 1–3 (no `/premium` dir, no premium bundle, no scoped
SDK) are trivially true — Pro is a different ZIP — and check 5 (no leftover strip
markers) has nothing to look for. Checks 4 and 6 are label-based: a premium
namespace, a premium text domain. Only check 7 — no free React source imports a
premium path — is drift-proof by construction, and it is the one both #7 and #14
singled out.

| # | Check | Needs | Runs |
|---|---|---|---|
| a | No file in free's tree imports a `pro/` path or the Pro namespace — TS **and** PHP | source only | every PR |
| b | Free's built **loader** carries no premium rule identifier | one Vite loader build | every PR |
| c | The free ZIP contains no path under Pro's plugin directory | full ZIP | release |
| d | The free ZIP contains its un-minified source tree | full ZIP | release |

**(a) is a cross product, and "free's tree" is a named set of paths.** Both
halves apply in both languages: a `pro/` path *or* the Pro namespace, in TS
*and* PHP. Scoping the path half to TypeScript would leave the likelier leak
unwatched, because PHP reaches into another tree by path far more often than
TypeScript does — `require_once WCONVERT_DIR . 'pro/…'` is the shape a
WordPress developer reaches for first.

"Free's tree" is `src/`, `resources/`, and the plugin files at the tree root.
`bin/` and the Vite configs are outside it: they are build tooling that never
ships, and Pro's own build config necessarily names Pro's entry, so including
them would mean an exception list — the one thing this check must never
acquire. Its own analysis bootstrap is *not* an exception, and proved the point
by failing on day one: `phpstan-bootstrap.php` named Pro's plugin file, so
Pro's constants moved to `pro/phpstan-bootstrap.php` rather than the check
learning to look away.

A Pro *URL* is not a Pro path. Free links to the Pro landing page to render a
`locked` Availability state ([ADR 0015](0015-enforcement-is-by-non-registration.md)),
and that string has a `pro/` segment in it, so the PHP check qualifies a path by
where it is used — inside a require/include, or ending in `.php` — rather than
by the segment alone.

Check (b) reads its identifier list from the rule manifest of
[ADR 0005](0005-the-rule-model-is-three-flat-closed-axes.md), so it cannot drift
from what the manifest calls premium.

*Completed by [#22](https://github.com/navidkashani/wconvert/issues/22): the check
is only meaningful because **free's loader does not import the manifest**. If it
did, every `tier: pro` identifier would be inlined into free's bundle by the
import itself, and (b) would fail on a build that leaked nothing — or, worse, be
"fixed" by narrowing what it scans for. Free's modules declare their own manifest
fields and the parity tests assert the two agree; this is recorded against the
sentence it corrects in ADR 0005.*

*Amended by [#21](https://github.com/navidkashani/wconvert/issues/21): the
manifest lands in halves, so for a while that identifier list is **empty**.
#21 writes the `targeting` section, which is the axis it implements and is
entirely free; the `triggers` and `conditions` sections arrive with the loader
that evaluates them, in
[#22](https://github.com/navidkashani/wconvert/issues/22). Until then
`bin/check-loader.mjs` says so out loud rather than printing a tick: an empty
list scans for nothing, and a check that reports "clean" while asserting nothing
is the failure this ADR is about. It is **not** a fail-closed case — the
manifest is readable and truthfully declares nothing premium.*

*Corrected by [#22](https://github.com/navidkashani/wconvert/issues/22) on which
ticket brings `exit_intent`, `scroll_up` and the advanced Conditions. The
sentence above named #22, and **#22 cannot write them**: this ADR's own invariant
is that every entry resolves to an implementation on the side its `tier` names,
and a `tier: pro` entry whose Pro module does not exist yet fails that invariant
on the pull request that adds it. So #22 writes the FREE half of the two client
axes — `page_load`, `time_on_page`, `scroll_depth` and `device`, which is the
whole of what issue #3's free/premium line gives free — and each premium entry
lands in the same commit as the Pro module implementing it. That is
`exit_intent` and `scroll_up` in
[#32](https://github.com/navidkashani/wconvert/issues/32), and `click_element`
plus the remaining twelve Conditions with the Pro tickets that implement them;
**no premium entry is orphaned, because none may exist without its module.** The identifier list
therefore stays empty through #22 and the scan goes live in #32, with no change
to the script. Note that #32's acceptance criteria say free's manifest **lacks**
those entries; that is the one reading this ADR rules out, because free's PHP is
what strips an unentitled rule at enqueue and it can only strip what its own
manifest calls premium. There is one manifest, in free, and it names both tiers.*

**(b) is scoped to the loader, and that scoping is load-bearing.** Free's *admin*
bundle contains premium identifiers on purpose — 0015's data-only catalogue of
premium Destination types, and every `locked` Availability card. Free's loader never
renders an upsell, so it has no such excuse. WSMS's own script warns against exactly
the unscoped version: it *deliberately does not* grep its core bundle for premium
module slugs, because core owns the slot↔module map by design. Same rule, two
bundles, opposite verdicts.

## The gate is three programs, and none takes a flag

`bin/verify-source-contract.sh` (no build, every PR), `npm run check:loader` (the
loader build, every PR), `bin/verify-artifact-contract.sh <staged-tree>` (called from
the release build, WSMS's exact slot). Each is **fail-closed**: a check that cannot
inspect what it was asked to inspect *fails*, because "couldn't look" reading as
"clean" is how a leak ships the one time a build is incomplete.

A single script with a `--source-only` flag would be the same mistake
[ADR 0028](0028-the-free-loader-source-carries-no-premium-code.md) refused one layer
down — letting a flag decide how much of a compliance contract runs. The moment a
check has an opt-out, the opt-out is what runs on the day it matters.

## What else the gate asserts

- **The loader byte budget, hard.** Free's and Pro's shipped loader, gzip -9, fail at
  8192 bytes, per build. The prototype measured 3.6KB honest and 3.9KB with the whole
  v1 rule vocabulary, so a hard threshold at 2× headroom can only fire on a real
  regression — which is why it blocks rather than warns, and why there is no second
  warn band nobody would read.
- **The payload budget is not a build gate.** It is generated per URL at runtime, so
  it has no artifact to weigh. It becomes a PHPUnit test that renders a worst-case
  published set and asserts the 2KB bound — *and* asserts the scaling property the
  loader prototype actually proved: payload size tracks **matching** Optins, not
  total published ones. The bound alone is unreachable and therefore inert; the
  scaling property is what catches a refactor that drops the URL filter and turns 100
  published Optins into 100 payload entries on every page.
- **The manifest's own invariant.** Every entry resolves to an implementation on the
  side its `tier` names, and carries all four fields three decisions now hang on it —
  `tier`, `consent_category`, `on_absence`, and its kind. This map has refused a
  fourth hand-maintained list three times, and the manifest survived each time
  *because both runtimes read it*; that only holds if something asserts it. Otherwise
  an entry with no implementation suspends Optins at runtime for a reason that is a
  bug rather than a missing dependency.
- **Plugin Check, pinned to an exact version**, blocking on `error` and reporting
  `warning`. Since 2025-10-27 it runs on every wp.org release, so an error is a
  release blocker whatever we decide — but a blocking gate whose owner controls when
  `main` breaks is not a gate we own. WSMS already argues this twice, pinning
  `dorny/paths-filter` to a commit and the wp.org deploy action to a SHA because
  *"`stable` is a tag someone else can repoint at will."* The drift the pin creates is
  closed separately: a weekly job runs the latest against `main` and opens an issue.

## Consequences

- **A stray premium import is caught by whoever wrote it.** WSMS finds one only when
  someone cuts a release, because its guard lives inside `build.sh`. That is the
  accident this exists not to inherit.
- **No ZIP is built on a pull request.** WSMS's frontend job runs `npm ci`, vitest and
  eslint with no build, deliberately; inverting that for an artifact contract the
  source already proves would be paying minutes per PR for a confirmation.
- **`npm run check:loader` is the one exception, and it earns it.** Both of its
  assertions — the byte budget and the premium-identifier scan — are about build
  output, which is the premise WSMS's "no build on a PR" lacks. Seconds, one small
  Vite config.
- **Each half lands with the thing it inspects.** The source contract exists on day
  one; the loader checks when there is a loader; the artifact contract, Plugin Check
  and the release guard when there is a release workflow. Nothing is written before
  its subject.
  *This cuts finer than "per program". The manifest's own four-field invariant is
  asserted where its subject is — a `tier: pro` entry cannot be checked for "resolves
  to an implementation" before either side has one — so #21 asserts only the parity
  its Targeting entries can carry, and #22 brings the free half of the two client
  axes. Read one step further than it was written, that same sentence is why a
  premium entry may not precede its Pro module: see the correction above.*
