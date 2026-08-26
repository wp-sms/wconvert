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

*Built in [#32](https://github.com/navidkashani/wconvert/issues/32):
[`ProLoaderEnqueue`](../../pro/src/Frontend/ProLoaderEnqueue.php), on
`wp_enqueue_scripts` at `LoaderEnqueue::PRIORITY + 10`. Three things this ADR
did not say, each of which is what the dequeue actually has to survive:*

- ***"Later" is DERIVED from free's own constant, not written as a number.***
  *WordPress loads active plugins in the order its own option lists them, so a
  swap that worked because `wconvert-pro` happened to be read after `wconvert`
  would work by accident.*
- ***The handle is DEREGISTERED as well as dequeued.*** *A dequeued script is
  out of the queue but still registered, and WordPress prints the registered
  dependencies of anything queued — so one third-party script declaring
  `wconvert-loader` as a dependency would put free's loader back on a page that
  already has Pro's, which is the state this ADR says can never occur.*
- ***A broken Pro degrades to free, never to nothing.*** *The dequeue is
  conditional on Pro's own bundle existing. Dequeuing free's while pointing at
  a bundle a bad unpack left out would 404 on every page and leave every Optin
  dead — the same silent, total loss of function 0004 exists to prevent,
  arriving through a missing file instead of through an optimizer.*

*Free decides WHETHER a page carries a loader — it reads the published set and
enqueues nothing on a page no Optin matched — and Pro decides WHICH. Asserted
in [`tests/unit/Pro/Frontend/LoaderReplacementTest.php`](../../tests/unit/Pro/Frontend/LoaderReplacementTest.php)
at the script queue, which is the seam the immunity lives at: an optimizer only
ever sees that queue's output.*

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
  *Measured in [#32](https://github.com/navidkashani/wconvert/issues/32) with
  the whole client vocabulary shipped bar the premium Conditions still to come:
  free 5,968 B, Pro 6,318 B, gzip -9, both under the 8,192 B gate. The
  prototype's 4.2KB predates the renderer and the beacon riding in the same
  bundle, so the gap is work rather than drift — but the headroom is smaller
  than this line implies, and the next premium rule should be weighed against
  1,874 B rather than against 4KB.*
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
  *Built in [#32](https://github.com/navidkashani/wconvert/issues/32):
  [`PageCache`](../../pro/src/Boot/PageCache.php), on both lifecycle hooks, and
  registered OUTSIDE the min-core guard — a Pro that refused to boot changes
  nothing about what the already-cached pages should say, and a merchant
  deactivating one is exactly the person whose cache should not be left holding
  a decision nobody made. It calls the purges it knows about and fires
  `wconvert_purge_page_cache` for everything it does not. **The design does not
  rest on the purge landing**, which is what makes an incomplete list
  affordable: deactivating a plugin does not delete its files, so free's loader
  is still on disk after Pro activates and Pro's is still there after it
  deactivates. A stale page therefore serves the previous tier's behaviour for
  a few minutes rather than a 404 and a dead popup. The purge makes the change
  take effect promptly; it is not what keeps the site working.*
