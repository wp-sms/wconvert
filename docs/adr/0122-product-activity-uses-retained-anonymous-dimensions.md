# Product activity uses retained anonymous dimensions

Accepted 2026-10-05. Implements slice 5 of the recommendations plan, following
[ADR 0121](0121-recommendation-additions-count-server-accepted-cart-actions.md).

## Meaning and interface

Product activity lives in the existing campaign report and editor's Campaign
details. The campaign outcome stays first. The product table shows **Shown**,
**Clicked** and **Added**, ordered by additions, then clicks and views. Shown means
that specific card intersects the viewport in a visible, activated document.
Shown and Clicked each count once per product per mounted recommendation area;
repaints, refreshed card data and repeated product-link clicks do not count again.
Absent IntersectionObserver support does not invent views. Hidden, closed,
disconnected, prerendered and preview cards do not report observations.

Added counts server-accepted quantity-one operations, using the same replay
receipt as the campaign addition. It is not a browser assertion, another campaign
Conversion, a purchase, or evidence of sales uplift. Product-page links remain
supporting activity in an addition campaign. Existing link campaigns keep their
headline conversion contract. **Extended by [ADR 0124](0124-quiz-products-share-protected-cart-actions.md):**
quiz-result products now share this report when commerce is active, with
observations deduplicated across the whole quiz mount. Quiz completion remains
the headline conversion.
Sales and refunds remain campaign-level; no order is allocated to product rows.

Names are resolved from the current catalog, not historical snapshots. Deleted
products retain their IDs and an unavailable label. Paused and deleted campaigns
retain reports; Core can read retained rows after a tier downgrade, with product
names unavailable if the commerce adapter is absent. No sales or visitor profiles
are created.

## Storage and retention

The existing statistics primary key already includes `scope`. Two closed kinds,
`product_shown` and `product_click`, and the server-only `cart_addition` use
`product:<id>`. Empty-scope campaign counters and screen/channel scopes retain
their meaning. There are **no new tables, columns or indexes**. WP options were
rejected for counters because read/modify/write loses concurrent increments;
transients cannot guarantee retention; computation from existing campaign totals
cannot recover product dimensions. The existing atomic upsert supplies the write.

Only product dimensions are retained for 90 site-calendar days including today.
The indexed campaign/date read clips to retention before aggregating; it returns
at most 101 products, with 101 an overflow sentinel. An overflow suppresses the
whole table and requests a shorter period, rather than presenting a partial
ranking. The supported report range remains at most 366 days; missing earlier
coverage is explicit. Product dimensions grow with actual served catalog IDs,
campaigns and retained days; they are not covered by ADR 0019's original 29k-row
estimate. No revision, arbitrary client product ID or visitor ID becomes a new
storage dimension. Catalog-scale/load validation remains a release check.

A first-served date is saved once in a non-autoloaded
`wconvert_product_tracking_<campaign>` option. This records instrumentation start,
not a view. A first-day window may be partial; inactive/blocked/older clients may
miss counts. Earlier dates are never backfilled or displayed as measured zeroes.
Rows show recorded counts only. Empty periods say no activity was recorded.

Core registers cleanup independently of Pro and Woo. A single daily WP-Cron job
deletes up to 5,000 expired product rows per run, retrying hourly while full.
Delayed cron delays physical deletion; reports still exclude expired rows.
Campaign totals and milestone dates are never pruned. Campaign soft deletion
keeps history; Core uninstall removes its stats table, exact tracking options
and the cron job. Pro uninstall leaves historical aggregate rows to Core cleanup.
Data Map and suggested policy text disclose product activity and its retention.
**Amended by [ADR 0127](0127-free-keeps-product-seams-not-product-reads.md):**
only where a product module is active or a campaign ever started tracking, and
activation re-schedules the pruner that deactivation clears.

## Observation validation

The existing uncached live commerce read signs each of its at most three returned
cards with campaign ID, published revision, product ID and a 30-minute expiry.
The signature contains no visitor/cart identity and is never added to stateless
sample previews. It proves the card was served, not that a person actually saw it.

A separate same-origin POST endpoint accepts only `product_shown` or
`product_click`, one count per request, at most 1,024 bytes. It verifies signature,
expiry, current publication and degradation state. Prefetch, prerender and named
bot traffic are dropped; a separate hashed-IP, 60-second rate bucket limits
abuse. The generic beacon accepts neither kind. Anonymous aggregates use the same
consent-free counter policy as the existing beacon; issuance still depends on the
functional-consent commerce read. No new browser storage is introduced.

Stateless observations can be replayed within the rate limit, as with the existing
anonymous beacon. They are not unique visitors or fraud-proof counts. Browser
sends do not retry ambiguous delivery failures. Addition receipts remain the
separate server-authoritative, session-bound contract from ADR 0121.

The optional commerce budget rises from 4,800 to 5,400 gzip bytes (measured 5,292
at implementation) for visibility and product-link instrumentation. Free/Basic
and the primary loader budgets do not change. No collector is added to ordinary
pages, the editor preview, or editions without the commerce module.
