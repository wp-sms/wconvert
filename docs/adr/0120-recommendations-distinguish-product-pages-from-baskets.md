# 0120 — Recommendations distinguish product pages from baskets


**Amended by [ADR 0121](0121-recommendation-additions-count-server-accepted-cart-actions.md):** the separate Increase basket value Goal counts server-accepted quantity-one recommendation additions. Existing product-link and cart-return outcomes retain their meaning. The guarded cart adapter is the sole permitted product mutation; supporting links do not count as additions.

Date: 2026-10-05. Status: accepted for the first implementation slice. Layout B was approved by the user. Amends recommendation context in ADRs 0117 and 0118; direct add-to-cart and addition outcomes remain unimplemented.

## Context and selection

The products block has `context: cart | product` and an optional `main_product_id`. Old blocks without these fields retain their known, nonempty-basket behavior. A configured main product narrows basket recommendations to baskets containing that parent product. Product context requires the visitor to be on the chosen public product page and permits a known empty basket. Unknown or consent-blocked baskets still fail closed so exclusions never rely on missing facts. Other campaign rules remain independent requirements.

An explicitly empty main product is incomplete, not the legacy any-basket setting. Publication and the editor require a public main product when product context or a main-product field is present. Design export clears local main-product IDs to zero; import therefore cannot silently broaden a configured campaign. Public means published, visible, non-password-protected simple or variable parent; recommended extras additionally pass stock and purchasability checks.

The editor follows main product → useful extras → shopping context, with a shortcut to the existing placement controls. The selected shortlist now survives source changes, superseding ADR 0118's clearing behavior. Only the active source is used; there is no fallback. Cross-sells use the selected main product when configured, otherwise the existing bounded basket-product sequence. Both sources exclude the main/viewed product and retain existing limits and basket-exclusion preferences.

## Runtime and preview

The server emits a signed public product ID in the campaign payload attributes on eligible product pages. This cache-compatible marker establishes a public catalog context, not shopper identity or an authorization secret. The existing same-origin batched commerce request includes it; the endpoint validates its signature and current public visibility. Missing, invalid or nonmatching context cannot satisfy product-page recommendations. Existing expiry, consent and invalidation behavior is retained.

`products_ready` is a required runtime condition derived from the block, replacing the misleading implicit `cart_has_items` spelling. It uses the existing prepared commerce evaluator. The manifest's `requirements` collection describes internal conditions for module, tier and consent parity. These are omitted from the merchant's rule catalogue and stripped from authored rule normalization; they are supplied at runtime with their context keys.

The sample visit has an independent viewed-product selector and sample basket. It uses the same recommendation evaluator, works with an empty sample basket, explains context mismatches and never mutates a real cart or records outcomes.

## Placement

`after_product_summary` inserts a hidden automatic candidate at the classic WooCommerce `woocommerce_after_single_product_summary` boundary. It does not reuse article-content insertion. Existing family selection, manual-anchor precedence and loader rendering still apply. Admin, preview, feed, REST, password-protected, block-theme and recognized custom-builder contexts are excluded from automatic insertion.

Block themes use the existing manual campaign block in their product template. Publication rejects automatic product-summary placement on a block theme. New accessory drafts target product pages and default to automatic product-summary placement only on classic themes; existing campaigns are not migrated.

## Scope and evidence

Cards still link to products and report clicks. This slice does not add a new Goal, change historical reports, mutate carts, or establish sales uplift. Confirmed additions and their reporting contract are the next slice. See the plan and testing record for release gates and current evidence.
