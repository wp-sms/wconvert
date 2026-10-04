# Sample baskets share live commerce evaluation

Accepted 2026-10-04. Implements the requested sample-basket preview and configured
WooCommerce cross-sell source, amending [ADR 0117](0117-cart-intelligence-uses-a-bounded-session-projection.md).

## Recommendation sources

A products block accepts `source: selected | cross_sells`; absence means selected.
Selected mode keeps the six-ID shortlist and three-card limit. Cross-sells use
relationships explicitly saved in WooCommerce, never inferred compatibility.
The editor clears the old shortlist when switching source. There is no implicit
selected-product fallback. Exclusion of products already in the basket remains
an explicit block preference, on by default.

Cross-sells are read in basket-product order, with parent before exact variation,
then each product's saved cross-sell order. The first occurrence wins. Read at
most 100 distinct basket product references and the first 60 relationships per
reference; stop at 60 unique candidates. Both modes apply the same live simple/
variable-parent, visibility, stock, purchasability and password checks, returning
at most three cards. No relationships or eligible candidates means no appearance.
This ordering is WConvert's stable selection over saved relationships, not a
claim to reproduce a theme's randomized cross-sell widget or extension filters.

Cross-sell designs can publish without selected IDs. Export preserves the source,
clears any local IDs, and explains that the receiving site's relationships apply.
No Free controls or runtime are introduced; the existing commerce capability
still governs authoring, import and campaign suspension.

## Test basket

The existing Test a sample visit dialog receives the current unsaved template and
rules. Commerce campaigns can select up to 20 catalog products/variations, edit
quantities, supply a merchandise amount after discounts excluding tax/shipping,
and, when testing the legacy total condition, a separate inclusive total. Totals
are explicitly entered sample amounts, not an automatic checkout calculation.
Categories and ancestor membership come from the selected catalog products.
Unknown and consent-blocked sample states remain distinct from a known empty cart.

An authenticated capability-checked POST `/commerce/preview` evaluates up to 40
cart rules and one recommendation block from a body capped at 32 KiB. It reuses
live cart projection, cart predicates and recommendation resolution. Other page,
schedule, pacing and non-cart facts remain the dialog's explicit assumptions.
Product results are labeled as an availability preview; the overall appearance
verdict also requires the composed display rules and product eligibility. Cart
recovery's nonempty-basket requirement is included in the sample.

The endpoint never reads or writes a shopper session, saves a draft, records a
click/impression, or sends an external message. Responses are private/no-store.
Sample facts and results live only in component memory and reset on closing.
Debounced requests are aborted on replacement, time out after eight seconds, and
are tied to an individual input revision. Late replies and historical identical
inputs cannot make a newer test pass. Pending or failed checks fail closed; a
pending check cannot save a gesture to replay after its response arrives.

No new storage or runtime asset is needed. Customer-facing shipping progress,
direct add-to-cart and purchase attribution remain separate future work.
