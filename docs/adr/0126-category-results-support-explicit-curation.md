# Category results support explicit curation

Accepted 2026-10-05; implemented locally, release review remains.
Amends [0123](0123-quiz-results-select-products-by-category-and-attributes.md)
and [0125](0125-product-warnings-are-current-catalog-advice.md).

Category quiz results can set `order` to `oldest`, `newest`, `price_low` or
`price_high`. Omitted ordering preserves product-ID ascending behavior. Newest
uses WooCommerce creation-date descending; price uses WooCommerce's public Store
API ordering. These are explicit merchant choices, not personalized ranking.

Optional `pinned_ids` contains up to three unique positive product IDs in priority
order; `excluded_ids` contains up to twelve. Exclusions always win. Pins must
still match the category and every attribute, be publicly visible, in stock,
purchasable and unprotected. Invalid or unavailable pins never widen a query.

Read pins separately with an include query of at most three, preserving authored
order. Fill remaining places from at most twelve ordinary candidates, excluding
all pins and exclusions in the WooCommerce query, with sorting applied before
that limit. Return at most three unique cards. Read failure remains an explicit
error; this bounded window does not promise an exhaustive catalog scan.

Preview, published quiz links, commerce cards and protected additions share the
same resolver. Current product warnings flag missing eligible pins (excluding
intentionally excluded ones); they do not change publication or Suspension.
Existing fallback links remain available when no products match.

The editor exposes Product order alongside category filters and keeps pins and
exclusions in an expandable section. Picker reads occur only when opened.
Selected rows wrap names and actions for narrow panels. Existing hand-picked
sources retain their priority order and behavior.

Existing template JSON stores these options; no schema, session, statistics,
tracking or visitor-loader behavior changes. Draft validation rejects malformed,
duplicate and oversized rules. Export removes all site-local category, attribute,
pin and exclusion references, preserves ordering and explains remapping.
Portable packs containing ordering require `result-product-filters:2`; legacy
placeholders continue to accept capability 1. Unsupported readers refuse newer
capabilities or unknown filter fields rather than silently losing intent.

Verification is recorded in
[category curation checks](../testing/result-curation-2026-10-05.md).
