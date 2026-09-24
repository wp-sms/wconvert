# Pro replaces the loader rather than augmenting it

**Current budget amendment — [ADR 0106](0106-question-journeys-extend-the-paid-loader.md):** The page payload cap is 2,560 B gzip (per-design 1,280 B). Free loaders remain 14,012 B; Basic caps at 24,064 B, Pro at 25,088 B, Elite at 25,344 B. The optional phone asset caps at 16 KiB. Earlier measurements below are historical. All remain hard checks.

**Budget amendment — [ADR 0101](0101-reopen-buttons-preserve-an-explicit-visitor-choice.md):** Free remains capped at 14,012 B gzip; paid loaders have an explicitly approved 18,432 B cap for complete recovery behavior. The 2 KiB per-page payload limit and hard fail-closed checks remain.

The [[Pro]] add-on ships a **complete replacement front-end loader** and dequeues
the free one. There is no registration seam, no second main loader script, and never two
loaders on one page.

***Extended by [ADR 0056](0056-the-tier-ladder-is-a-manifest.md) to the ADMIN
BUNDLE, which this ADR only ever spoke about by implication.** The argument
below is about two scripts on one page, and the admin has the same two scripts:
free's bundle and Pro's. It had no answer, so it gets this one — Pro's entry
imports free's `App` through the `@` alias, adds its own screens, and
[`ProAdminEnqueue`](../../pro/src/Admin/ProAdminEnqueue.php) dequeues **and
deregisters** free's handle at a priority derived from `AdminMenu::PRIORITY`. The
rejected alternative there is runtime React injection into free's running app,
and it fails exactly the way this ADR's rejected alternative fails: it needs the
second script to run after the first has mounted, which is a load-order contract
across two tags on a page an optimiser may reorder. Neither reference product
faces the question — WP Statistics and WSMS both ship premium as one bigger
plugin rather than a companion — so there was no precedent to borrow, only the
failure mode. Two costs are booked there rather than solved: a second copy of the
admin app in Pro's ZIP, and the fact that free's inline `window.wconvertAdmin`
travels with free's handle, so Pro re-attaches the same values from
`AdminMenu::settings()`.*

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
  already has Pro's, which is the state this ADR says can never occur. **The
  cost is real and is now measured rather than assumed:** a dependent whose
  dependency is deregistered is not printed either, because
  `WP_Dependencies::all_deps()` returns false for it. Accepted — free's loader
  handle is not a documented extension point, this ADR having refused to create
  one, and the alternative is two loaders. `bin/verify-loader-replacement.php`
  asserts both halves against real `WP_Dependencies`, which is the one thing a
  recording stub cannot do: a stub that re-implemented `all_deps()` would make
  itself the authority on what WordPress does.*
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
  *Amended by [ADR 0056](0056-the-tier-ladder-is-a-manifest.md): there are
  **eight**, not two. The admin is a second pair on the rule above, and Pro's
  loader and inspector are built once per TIER — one entry per rung, in source,
  with no build flag anywhere. The separate-directory property is unchanged and
  is what the per-tier outputs rest on: `public/tiers/<rung>/` exists only in the
  repository, and a staged tree that still carries one fails the artifact
  contract.*
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
  ***Amended: the ceiling is 12,288 B, and the budget is still per build.***
  *After [#34](https://github.com/navidkashani/wconvert/issues/34) added the
  popover container, Pro was 7,027 B — 1,165 B of headroom, which is less than
  the design vocabulary needed to stop being eight slots in different colours.
  The whole widening — style tokens (~150–300 B), a wrapping `grid` (~50–100 B),
  four small leaves (~150–300 B), a background image and overlay (~100 B), an
  icon set of six glyphs (~500–900 B), entry motion (~200–400 B) and a
  deadline countdown (~400–800 B) — comes to roughly 1.6–2.9 KB, which does not
  fit and was never going to.*

  *The number moved rather than the gate softening, and the evidence is what
  the field actually ships: Icegram Lite 13,672 B is the **smallest** shipped
  runtime measured, then OptinMonster 16,074 B, Popup Maker 21,970 B and Privy
  910,585 B. At 12,288 B the ceiling still sits under the smallest of them, so
  "smaller than anything in the market" stays literally sayable — the claim
  weakens from 2.3× to about 1.4×, which is the honest cost of the gallery.*

  *And **the bundle does not split.** Raising the ceiling is precisely what
  makes a second lazy-loaded chunk unnecessary, which is the outcome to want: a
  second script is the failure
  [ADR 0004](0004-the-loader-survives-optimizers-not-just-caches.md) catalogued,
  where an optimiser reordered scripts and killed every popup silently with
  nothing in any log.*

  ***Amended again by [ADR 0095](0095-overlay-placement-is-logical-container-configuration.md):
  the ceiling is 12,800 B.*** *The complete logical-placement matrix, exact RTL
  safe-area mapping, and reversible top-bar flow reservation put the largest
  tier at 12,567 B. Removing the 279 B above the former ceiling meant weakening
  that behavior or unrelated Elite cart validation, so the hard gate moved by
  512 B instead. It remains 872 B below Icegram Lite, the smallest measured
  competitor runtime above; the gate is still per build, hard and flagless.*
  ***Amended by [ADR 0098](0098-fullscreen-is-a-pro-modal-surface.md): the ceiling
  is 13,500 B.*** The largest build is 13,344 B with fullscreen's accessible
  modal surface. Historical competitor figures are not a current market claim.
  ***Amended by [ADR 0099](0099-automatic-inline-placement-uses-rendered-content.md):
  the ceiling became 14,012 B. ADR 0101 retains that for Free and explicitly raises paid loaders to 18,432 B.*** Automatic inline selection and DOM/manual
  precedence add about 311 B at Elite; the gate remains hard and flagless.
- **No public `registerRule` seam**, therefore no partial-registration failure mode
  and no documented extension point that immediately becomes a compatibility
  surface.
  *Read against a second composition parameter by
  [ADR 0058](0058-a-test-ends-when-the-merchant-says-so.md), and it passes.
  `boot(loader, presenter, narrow?)` gained a third argument — a pure filter
  over the payload entries, which is how Pro shows one arm of an A/B test
  before the engine is asked anything. It is not what this bullet refuses: it
  is decided in SOURCE, in the entry file, on the same call that already hands
  `boot` a presenter it did not choose, so there is one script and nothing on
  the page to reorder. What ADR 0004 catalogues is a second script that must
  register before the first evaluates, and there is no second script.*
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
