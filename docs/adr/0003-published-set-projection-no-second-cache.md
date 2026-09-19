# The published set is rebuilt on write, and there is no second cache

The front-end payload is derived from a **published set**: one non-autoloaded
option holding the projection of every published, non-deleted Optin, rebuilt by
`publish()`/unpublish/delete and never on read. An option rather than a
transient because a transient can be evicted, and eviction lands a cold DB query
on an uncached page load; `autoload=false` because it is payload-sized and has
no business in `alloptions` on every admin request.

*Bounded by [ADR 0050](0050-a-scheduled-optin-stays-in-the-published-set.md), which
is the exclusion this ADR must NOT gain. A **scheduled** Optin is in the set
before its window opens and stays in it after the window closes — precisely
because the set is rebuilt on write and never on a timer, so nothing runs at
the moment a window opens and an Optin left out here is left out of every
cached page until somebody republishes. Its window travels in the payload and
the browser compares it. The far end is the same argument reversed: a page
cached while the window was open can only work out that it has shut from a fact
it was given. Read that against the suspension note directly below, because the
two look alike and differ on exactly one thing — whether the payload can carry
the answer.*

*Completed by [ADR 0027](0027-a-load-bearing-condition-suspends-rather-than-drops.md):
a **suspended** Optin — one holding a Condition marked `on_absence: suspend`
that this install cannot evaluate — is excluded too, so it emits no impressions
and no conversions. Suspension is computed from `config` against the live
registry rather than stored, so like entitlement below it belongs to the
enqueue-time filter and not to the projection.*

*Extended by [ADR 0058](0058-a-test-ends-when-the-merchant-says-so.md) to the
first payload key that is a fact about the SET rather than about one row. An
A/B arm carries `["<experiment>", <this arm>, <how many arms>]`, and the count
cannot be read off the row it sits on — so it is computed across the whole set
in `PublishedProjection::build()`, once per rebuild, which is this ADR's rule
rather than an exception to it. It is written only where a group has more than
one published arm, so an install running no test ships byte-for-byte the
payload it shipped before; and it stops being written the moment a test ends,
on the rebuild that same write performs.*

At enqueue time PHP walks the projections, evaluates **only** the page/URL
targeting rule, and inlines the survivors — so a site with 40 Optins does not
ship 40 rule sets on every page. Everything else (time delay, scroll depth, exit
intent, device) is evaluated client-side.

*Extended by [ADR 0099](0099-automatic-inline-placement-uses-rendered-content.md):
automatic inline placement reuses this targeting/degradation result to emit
hidden content candidates. PHP must not pick the winner: browser eligibility
and A/B assignment still decide, including on cached pages. No new cache exists.*

**There is deliberately no per-URL cache underneath this.** The full-page cache
is the cache. A transient keyed by URL would cache something already cached and
add an invalidation surface that will eventually be wrong. Every WordPress
developer's instinct is to add one; don't.

*Named as the shape NOT to ride on by
[ADR 0057](0057-a-milestone-is-a-date-recorded-once-about-the-site.md). A
milestone is a site-wide fact and `wconvert_published_set` is a site-wide
option, which makes it look like a home; it is not, precisely because of the
sentence above. The set is rebuilt WHOLE on every publish, so anything else
stored inside it is destroyed by the next write — and the bug would first
appear on the second publish, which is the worst possible day to find it. #94
took a ninth option of its own instead.*

## Consequences

- **Entitlement is not baked into the published set.** The set is built
  entitlement-blind at publish time and the premium filter is applied at
  *enqueue* time — otherwise a lapsed licence leaves a stale option full of
  premium rules. This is exactly the boundary the premium-SDK research moved
  gating to, and it falls out of this structure for free.
  *Amended by [ADR 0015](0015-enforcement-is-by-non-registration.md): the
  structure stands, the framing does not. There is no runtime licence check
  anywhere in WConvert — possession of Pro gates features — so "a lapsed licence"
  names an event that does not occur. Read it as **Pro deactivated, deleted, or
  restored away**, which is a fact rather than a business decision we were free
  to reverse. Same correction 0015 made to
  [ADR 0012](0012-degradation-substitutes-triggers-and-drops-conditions.md).*
- Page-targeting rules must stay **separably addressable** within the
  projection, because the server evaluates them alone. This is a structural
  requirement on the rule engine, not a claim on its vocabulary.
  *Implemented by [#21](https://github.com/navidkashani/wconvert/issues/21) as a
  three-key projection entry — `{id, targeting, payload}` — where `payload` is
  the published config with its `targeting` key already removed. The split is
  done once at publish time rather than per request: the enqueue path then does
  no array surgery on an uncached page load, and "separably addressable" is
  literal rather than a convention someone has to keep.*
  *Extended by [#22](https://github.com/navidkashani/wconvert/issues/22): the
  same publish-time pass now also consumes the config's flat `rules` list and
  replaces it with `triggers` and `conditions`, per
  [ADR 0005](0005-the-rule-model-is-three-flat-closed-axes.md)'s "partitioned at
  publish time, not at evaluation time". So `payload` is the published config
  minus `targeting` **and** minus `rules`, plus those two keys — always both,
  including empty, because the loader reads "no triggers" as "never fires". It
  is the same argument this bullet already makes, applied to the second axis
  split: the work happens once, where the manifest is already being read.*
