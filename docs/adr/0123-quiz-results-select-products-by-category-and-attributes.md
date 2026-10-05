# 0123: Quiz results select products by category and explicit attributes

Date: 2026-10-05. Status: implemented locally; release review remains.
Amends [0106](0106-question-journeys-extend-the-paid-loader.md) and the paid
loader caps last amended by [0121](0121-recommendation-additions-count-server-accepted-cart-actions.md).

Maintaining a list for every quiz result is repetitive as a catalog changes.
Each result now optionally carries `product_filter: {category_id, attributes}`.
The existing `product_ids` list remains the default and is retained when the
merchant switches sources. A filter contains one category, including descendants,
and up to three distinct global attribute taxonomies, each with one term ID.
All filters must match. These are product attributes, not proof of a purchasable
combination of variations; visitors choose variations on the product page.

The existing answer rules still choose the result. No scoring, inferred
compatibility, customer profiling, direct cart action, or additional conversion
is introduced. This remains available through `JourneySupport` at every paid
rung, without a cart-recovery dependency. No table, column or answer archive is added.

The public `/product-matches` GET route accepts only that bounded filter,
checks WooCommerce, the journeys capability, taxonomy membership and live term
existence, then internally dispatches WooCommerce's public Store Products route.
It reads at most 12 candidates, ordered by product ID ascending (oldest-added
first), with visible catalog and in-stock constraints. Up to three purchasable,
unprotected products are returned, uncached. This is a bounded candidate window,
not an exhaustive scan or ranking. Manual selections retain their original
Store API request and priority order. Both paths validate same-origin links.

Malformed, deleted or cross-taxonomy values never disappear from a query in a
way that broadens its results. Incomplete drafts remain editable; publication
requires complete, existing filters and the result's fallback link. Stock can
change after publishing, so an empty set leaves the result and fallback intact.
Network failure supports Retry without counting a second completion.

Admin pickers search at most 40 choices plus the saved selection. Search fields
appear for longer lists. Preview matches reads the same endpoint without
statistics. Interactive journey tests use live matches for normal availability
and simulated empty/error states. Export strips IDs and taxonomy references,
retains the category-source placeholder, and requires remapping. Packs declare
`result-product-filters:1`; unsupported readers refuse that capability.

Measured paid loader sizes after this change: Basic 25,132 B, Pro 26,709 B,
Elite 27,109 B gzip. Raise each paid hard cap by 128 B to 25,216 / 26,784 /
27,168 B respectively, including combined analytics/commerce checks. Free's
14,592 B cap and runtime remain unchanged. This explicitly funds the small
endpoint/query branch; no new request or asset is loaded on unrelated pages.

**Extended by [ADR 0124](0124-quiz-products-share-protected-cart-actions.md):**
results can opt into protected cart buttons and share product activity reporting
when the commerce module is active. Ordinary result links retain every paid tier.
The later ADR records the explicit budget changes for this extension.
