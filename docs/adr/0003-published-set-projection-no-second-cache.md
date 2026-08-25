# The published set is rebuilt on write, and there is no second cache

The front-end payload is derived from a **published set**: one non-autoloaded
option holding the projection of every published, non-deleted Optin, rebuilt by
`publish()`/unpublish/delete and never on read. An option rather than a
transient because a transient can be evicted, and eviction lands a cold DB query
on an uncached page load; `autoload=false` because it is payload-sized and has
no business in `alloptions` on every admin request.

*Completed by [ADR 0027](0027-a-load-bearing-condition-suspends-rather-than-drops.md):
a **suspended** Optin — one holding a Condition marked `on_absence: suspend`
that this install cannot evaluate — is excluded too, so it emits no impressions
and no conversions. Suspension is computed from `config` against the live
registry rather than stored, so like entitlement below it belongs to the
enqueue-time filter and not to the projection.*

At enqueue time PHP walks the projections, evaluates **only** the page/URL
targeting rule, and inlines the survivors — so a site with 40 Optins does not
ship 40 rule sets on every page. Everything else (time delay, scroll depth, exit
intent, device) is evaluated client-side.

**There is deliberately no per-URL cache underneath this.** The full-page cache
is the cache. A transient keyed by URL would cache something already cached and
add an invalidation surface that will eventually be wrong. Every WordPress
developer's instinct is to add one; don't.

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
