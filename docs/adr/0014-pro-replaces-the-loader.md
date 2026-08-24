# Pro replaces the loader rather than augmenting it

The [[Pro]] add-on ships a **complete replacement front-end loader** and dequeues
the free one. There is no registration seam, no second script, and never two
loaders on one page.

This overturns the recommendation carried into #14 by the premium-SDK research,
which favoured a free loader plus a small entitled add-on script registering
premium rule types through a `registerTrigger` hook.

## Why the recommendation was overturned

**The byte case is void.** The loader prototype measured 3.6KB gzipped honest and
**3.9KB with the entire v1 rule vocabulary** — so the whole premium rule set costs
roughly 300 bytes. An augment scheme spends an extra HTTP request on every premium
install to save 300 bytes on none of them.

**The deciding argument is [ADR 0004](0004-the-loader-survives-optimizers-not-just-caches.md).**
An augment scheme requires the second script to register *before* the first
evaluates. That is precisely the failure the loader prototype catalogued:
Autoptimize's force-in-head moved the loader above its payload, stripped `defer`,
and killed every popup **silently, with nothing in any log**. A registration
ordering contract is a promise the page is not ours to keep.

Under replacement the `wp_dequeue_script` happens in PHP before any HTML exists, so
**the optimizer never sees two scripts to reorder.** Replacement is therefore
strictly safer than augmentation under the exact hazard 0004 documents — the
inverse of the intuition that fewer bytes and fewer copies is the safer shape.

## Consequences

- **Two Vite builds writing to separate output directories.** WSMS's `main.js` trap
  — two configs sharing one output path with `emptyOutDir: true`, last build silently
  wins — is avoided by construction rather than by discipline, because the two
  artifacts are two plugins.
  *Amended by [ADR 0028](0028-the-free-loader-source-carries-no-premium-code.md): this
  originally read "one loader source, tree-shaken on a mode flag". It is **separate
  module trees** instead — premium rule modules live under Pro's, and Pro's entry
  imports free's plus its own. The flag would have put premium code in free's
  un-minified source, which wp.org Guideline 4 requires be published.*
- **The ≤8KB gzipped loader budget applies per build.** Pro's is the larger and
  still lands near 4.2KB.
- **No public `registerRule` seam**, therefore no partial-registration failure mode
  and no documented extension point that immediately becomes a compatibility
  surface.
- **A shared-engine bugfix needs two releases**, and the free one carries wp.org
  review latency while Pro's ships immediately. Booked, not solved.
  *Completed by [ADR 0030](0030-free-and-pro-release-on-independent-tags.md):
  `free-v*` and `pro-v*` are independent tags, which is the mechanism that keeps
  this a booked cost rather than a compounding one — a single tag would put every
  Pro hotfix behind the wp.org review its free counterpart is waiting on.*
- **Pro activation or deactivation changes the enqueued asset URL, so it must purge
  the page cache.** This replaces the loader prototype's vaguer "an entitlement
  change must purge the page cache" with a concrete, synchronous, plugin-lifecycle
  trigger — there is no licence webhook in this design to miss.
