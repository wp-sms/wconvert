# The loader survives optimizers, not just caches

Full-page caching was the reason for the delivery model, and it is the easy
part. A prototype run behind a real reverse-proxy page cache (cache key = URL,
`Set-Cookie` stripped, PHP not running at all on a hit) served three visitors
byte-identical HTML and produced three different, correct behaviours, including
frequency capping across days.

**What actually threatens the model is the optimizer plugins sitting next to the
page cache.** Three rules come out of that, and none of them is optional.

## The loader does no work at module scope

Autoptimize's *Aggregate JS-files* + *Force JavaScript in `<head>`* moves the
loader above the payload it reads **and strips its `defer` attribute**. A loader
that reads the DOM at execution time then finds nothing and dies — every popup
on the site, silently, on every page.

So the loader must be able to start late: if the payload element is not in the
DOM, wait for `DOMContentLoaded` and try again; if it is genuinely absent, do
nothing and throw nothing. Never assume document position. Costs about ten lines.

## The payload travels as `<script type="application/json">`

Every JS optimizer tested (Autoptimize, LiteSpeed, Flying Scripts) selects on
`script[!type]` or `type="text/javascript"`, so a JSON script tag is invisible to
all of them, and HTML minifiers left it parseable.

The alternative — `wp_add_inline_script(..., 'before')` — is position-safe under
aggregation, but the per-URL payload then ends up *inside* the aggregated bundle,
which turns the one shared loader into a per-URL asset. Measured across seven
URLs: 9 bundles / 108 KB versus 3 bundles / 28 KB. Combined with the rule above,
the JSON tag gets position-safety **and** keeps the loader cacheable across pages.

## Time on page is measured with `performance.now()`

Delay-JS plugins execute the loader seconds after navigation. A loader that
clocks from its own execution silently doubles every time-based rule — under a
5-second delay, a "show after 5 seconds" Optin fires at ten. `performance.now()`
measures from navigation start regardless of when the script ran, and the same
rule fires at 5.1 s. One line; not a crash, a wrong number nobody notices.

## Consequences

- **Delay-JS with no fallback timeout disables every time-based rule outright** —
  a reader who never interacts never triggers the fetch, so the loader is never
  downloaded. Nothing in the loader can fix this. It needs an exclusion recipe
  per cache plugin, in the docs and the readme.
- **Exit intent survives delayed JS**, because `mousemove` is on every delay
  plugin's trigger list and the leaver's own gesture loads the loader. The race
  costs a tail: on a 150 ms-RTT connection, a visitor who moves and exits inside
  ~200 ms loses the popup.
- **An entitlement change must purge the page cache.** Filtering at enqueue time
  keeps entitlement out of the published set (ADR 0003) but bakes it into the
  cached HTML, where it stays until the cache turns over.
  *Amended by [ADR 0014](0014-pro-replaces-the-loader.md): "an entitlement
  change" is now a concrete, synchronous plugin-lifecycle trigger — **Pro
  activation or deactivation** changes the enqueued asset URL and must purge the
  cache. There is no licence webhook in this design to miss, and under
  [ADR 0015](0015-enforcement-is-by-non-registration.md) no licence event that
  could stand in for one.*
- The budget is **two numbers, not one**: the loader asset and the inlined
  payload are paid on completely different schedules.
