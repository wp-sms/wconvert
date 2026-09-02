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
to the script. **It did.** #32 added `exit_intent` and `scroll_up` beside the
`click_element` and `query_param` entries #29 brought, each in the same commit
as its Pro module, and the scan now reads four premium identifiers out of the
manifest and finds none of them in free's built loader. *Six as of
[#36](https://github.com/navidkashani/wconvert/issues/36) — the two cart
Conditions, again in the same commit as the Pro module that implements them, and
again with no change to the script, because the list is read from the manifest
rather than written here.* Note that #32's acceptance criteria say free's manifest **lacks**
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

*Completed by [#37](https://github.com/navidkashani/wconvert/issues/37): the third
program exists, and writing it surfaced a case this section did not anticipate.
**Both release runs invoke it** ([ADR 0030](0030-free-and-pro-release-on-independent-tags.md)),
so it has to apply free's contract to free's tree and Pro's to Pro's — and a
`--free` flag would be the same opt-out one layer down, since pointing it at a Pro
tree with `--free` runs the leak scan against the wrong tier and passes. **The tree
answers instead**: a plugin directory holds exactly one plugin main file, and which
one it is says which plugin this is. Zero is not a plugin, and BOTH is one artifact
carrying the other inside it — which is the leak, so it is a failure rather than an
ambiguity to resolve.*

*The same ticket found a leak this ADR's table does not describe, and it is the one
the source contract **structurally cannot see**. `vendor/` is generated: Composer
writes the autoload map at build time, so an entry pointing at `pro/src` is a Pro
path inside the free artifact that no source file ever contained.
`pro/src/autoload.php` already names that risk as its first reason for existing; (c)
is what makes the sentence enforceable, by scanning the staged tree's own PHP **and
`vendor/composer/`** with the same `bin/pro-php-scan.php` the source contract uses.
Scoped to `vendor/composer/` rather than to `vendor/` whole, because the generated
maps all live there and the rest is third-party code whose own use of a `pro/` path
would be a false positive — and the fix for a false positive is always an exception.*

*And **(d) has one direction**, which is worth saying because the table above does
not. Guideline 4 is a wp.org obligation and Pro is not distributed there, but the
stronger reason is that "its un-minified source tree" is not a property Pro's
DIRECTORY has: Pro's loader entry imports free's modules through `@loader/*`
([ADR 0028](0028-the-free-loader-source-carries-no-premium-code.md)), so Pro's
sources are free's plus its own and free's half lives in the other plugin.
Asserting (d) against `pro/resources/` would assert something untrue of it. The
script says so out loud on every Pro run rather than printing a tick — the same
rule `check-loader.mjs` follows when the manifest declares nothing premium.*

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
  ***Amended: the number is 12,288 B*** *— see
  [ADR 0014](0014-pro-replaces-the-loader.md) for the arithmetic and the
  competitor measurements. What this ADR asserts is untouched by that: the gate
  is still **hard and flagless**, still fails closed on a bundle it cannot read,
  and still has no warn band. A threshold moved once, deliberately, with the
  reasoning written down is not an opt-out — the failure this ADR names is a
  check that can be **turned off**, and no flag was added. The one thing the
  original justification lost is the "2× the prototype" framing: 12,288 B is
  set against what the design vocabulary costs and what the field ships, not
  against a 2019 measurement of a loader that had no renderer in it.*
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
  ***Six as of [#36](https://github.com/navidkashani/wconvert/issues/36)***, *which
  added **`requires`** — the [[SiteDependency]] a rule type needs
  ([ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md)). Same test, same
  reasoning, and worth saying out loud now the list has grown twice: **the count is
  not the invariant.** What is asserted is that no field arrives ahead of a reader,
  and this one landed with three of them in one pull request — the registration gate,
  the Availability arithmetic, and the sentence on the Optin list. A manifest that
  gained a field per ticket and a reader per release would satisfy every assertion
  here and none of its point.*
  *Five fields as of [#33](https://github.com/navidkashani/wconvert/issues/33), which
  added **`substitute`** — the rule that runs in place of a premium one
  ([ADR 0012](0012-degradation-substitutes-triggers-and-drops-conditions.md)). The
  count is what changed and the reasoning is not: the fifth field arrived with its
  reader, its two call sites and its screen in the same ticket, which is what "nothing
  is written before its subject" asks for, and it is asserted the same way — present on
  every entry including as null, because null is a claim.*
- **Plugin Check, pinned to an exact version**, blocking on `error` and reporting
  `warning`. Since 2025-10-27 it runs on every wp.org release, so an error is a
  release blocker whatever we decide — but a blocking gate whose owner controls when
  `main` breaks is not a gate we own. WSMS already argues this twice, pinning
  `dorny/paths-filter` to a commit and the wp.org deploy action to a SHA because
  *"`stable` is a tag someone else can repoint at will."* The drift the pin creates is
  closed separately: a weekly job runs the latest against `main` and opens an issue.
  *Built in [#37](https://github.com/navidkashani/wconvert/issues/37), and the pin
  could not be had the obvious way. **`WordPress/plugin-check-action` has no input
  for the Plugin Check version** — it runs `wp plugin install plugin-check
  --activate`, which is always the latest release on wp.org. Pinning the action's own
  SHA pins the wrapper and not the checker, so that gate would still change under us
  on somebody else's schedule: the action IS the repointable tag, one layer down. So
  `bin/plugin-check.sh` does the action's sequence itself with `--version=` and
  `--force`, takes the version as a required argument, and asserts afterwards that
  the version it asked for is the version it got. The number lives in
  `.github/plugin-check-version`, once, and `latest` is a legitimate value that the
  weekly drift job passes on purpose. That job compares the two runs **by finding
  CODE**, not by file and line — everything but the code moves when the source moves,
  and a weekly job that cries drift every week is a weekly job nobody opens.*

  *Amended by [#60](https://github.com/navidkashani/wconvert/issues/60), which is
  the first time this gate had to be argued with rather than obeyed. Blocking on
  `error` says nothing about **what to do when the checker is wrong**, and it can
  be: `WordPress.DB.PreparedSQL` matches the literal variable `$wpdb` and cannot
  follow `$this->wpdb`, so every query in `src/Database/WpdbConnection.php` — all
  of them prepared, the table bound as `%i` — reported five findings apiece, 21 in
  one file. WPCS publishes no property for naming a database wrapper, so there is
  no configuration that fixes it, and the restructurings that would satisfy the
  sniff each cost something real: `global $wpdb;` costs the injectable constructor
  the tests inject through, inlining `prepare()` costs four copies of the binding
  splat whose ordering bug once made a query select `FROM` an Optin id.*

  ***The sanctioned form is a per-line `phpcs:ignore` carrying its reason — never
  `--ignore-codes` on the runner.*** The two are not the same concession one layer
  apart. A checker-level list is exactly the **exception list** this ADR's own
  source contract refuses above: it lives away from the code, it applies to files
  nobody was thinking about when it was written, and it is one line of diff to
  grow. An in-file annotation is its opposite — scoped to the single line, unable
  to spread by accident, visible to the wp.org reviewer reading that line, and it
  disappears on its own when the code moves. Plugin Check honours them: its
  `Abstract_PHP_CodeSniffer_Check` sets no `ignoreAnnotations` and passes no
  `--ignore-annotations`, so what the annotation silences is silenced in the gate
  as well as locally, which is the whole point — a suppression the gate ignores is
  a comment, and a suppression only the gate sees is a lie to the reader.

  *The bar is the annotation's reason, and it is the same bar as an ADR's: say why
  the sniff cannot see what is true, and where the thing it is asking for is
  actually enforced. `bin/plugin-check.sh` is unchanged and takes no new flag —
  which is the test of whether this stayed a decision about code or became one
  about the gate.*

## Consequences

- **A stray premium import is caught by whoever wrote it.** WSMS finds one only when
  someone cuts a release, because its guard lives inside `build.sh`. That is the
  accident this exists not to inherit.
- **No ZIP is built on a pull request.** WSMS's frontend job runs `npm ci`, vitest and
  eslint with no build, deliberately; inverting that for an artifact contract the
  source already proves would be paying minutes per PR for a confirmation.
  *Still true after [#37](https://github.com/navidkashani/wconvert/issues/37), with
  one deliberate exception that is not a pull request: the weekly Plugin Check drift
  job stages a tree, because its subject IS the artifact and there is no cheaper way
  to ask wp.org's checker what it thinks of a plugin than to give it one. It runs on
  a schedule, blocks nothing, and `tests/unit/Contract/ArtifactContractTest.php`
  builds its trees file by file rather than calling `bin/build.sh`, so the suite the
  pull request runs still stages nothing.*
- **`npm run check:loader` is the one exception, and it earns it.** Both of its
  assertions — the byte budget and the premium-identifier scan — are about build
  output, which is the premise WSMS's "no build on a PR" lacks. Seconds, one small
  Vite config.
- **Each half lands with the thing it inspects.** The source contract exists on day
  one; the loader checks when there is a loader; the artifact contract, Plugin Check
  and the release guard when there is a release workflow. Nothing is written before
  its subject.
  ***All three now exist**, as of [#37](https://github.com/navidkashani/wconvert/issues/37),
  which brought the release workflows that are the artifact contract's subject.*
  *This cuts finer than "per program". The manifest's own four-field invariant is
  asserted where its subject is — a `tier: pro` entry cannot be checked for "resolves
  to an implementation" before either side has one — so #21 asserts only the parity
  its Targeting entries can carry, and #22 brings the free half of the two client
  axes. Read one step further than it was written, that same sentence is why a
  premium entry may not precede its Pro module: see the correction above.*
