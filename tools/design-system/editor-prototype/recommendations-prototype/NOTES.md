# Recommendation setup prototype

Question: can a merchant choose a main product, select useful extras, and place the recommendation inside WConvert without learning a separate tool?

Throwaway UI. Products, cart additions, publication review and report counts are in-memory simulations. It makes no WooCommerce requests, saves nothing and disappears from memory on reload. The separate disposable WooCommerce spike tests real transport behavior.

## Run

From the repository root: `npm run prototype:recommendations`.

Open <http://127.0.0.1:5188/?prototype=recommendations&variant=B>.

- A: guided main product → useful extras → placement, with a preview alongside each step.
- B: familiar editor canvas and compact three-decision inspector. Recommended starting direction.
- C: sentence-like campaign summary with settings expanded where needed.

Switch with the bottom bar or left/right arrows outside inputs. Draft/sample state stays in memory across variant changes; the URL preserves the layout. The switcher is development-only, and this entire tool remains outside the plugin runtime.

## Research revision, 5 October

The Shopify comparison supports a focused accessory workflow. [feey's published case](https://www.rebuyengine.com/case-studies/feey) motivates testing product-page placement early; [Shopify Search & Discovery](https://help.shopify.com/en/manual/online-store/storefront-search/search-and-discovery-recommendations) establishes complementary products and quick add as existing market capabilities. [Baymard research](https://baymard.com/research-articles/product-recommendations-cart) supports useful, compatible extras and hiding irrelevant offers. These are research inputs, not evidence of WConvert merchant demand or causal revenue uplift.

Changes from the first prototype:

- Product-page preview is the default, including with an empty basket. Basket placement requires the chosen main product in the sample basket.
- All layouts use main product → extras → placement. Source, action, heading and duplicate exclusion move under More options.
- Two sample main products show distinct example pairings. Changing the main product loads a fixture pairing, explicitly labeled in the editor. This is not automatic compatibility detection or a new production data source.
- A main-product button demonstrates shopping context but does not count as a recommendation result.
- Placement and eligibility explanations sit outside the storefront preview; an irrelevant or empty offer is absent from the simulated storefront.
- Unrelated product/basket, missing pairings, unavailable extras and already-added products have explicit sample states. Nothing falls back to unrelated bestsellers.
- Results distinguish extra additions, once-counted campaign results, and unmeasured orders/sales.

Product and basket placement remain simulated; selecting them has not installed a block or added a WooCommerce placement adapter. The existing production plan's implementation gates still apply. Proposed pilot scope: evaluate direct add and product-page placement together after their respective engineering gates pass.

## Try

1. Start on the product page with an empty basket. Extras should appear; switch to Basket page and they disappear.
2. Choose Everyday espresso machine and inspect its example pairing. The grinder requires options and opens a simulated product link.
3. Add the main product: the basket changes, recommendation results stay zero. Add two extras: two additions, one campaign result.
4. Change the sample visit to an already-present brush, an unrelated product/basket, unavailable products or missing pairings. For the latter, select My WooCommerce cross-sells under More options.
5. Select rejected or lost-response behavior. Neither counts success; the uncertain state prevents another blind attempt until the sample is reset.
6. Open Review setup and View sample results. Compare A/B/C and use the phone preview.

Review simulates configuration readiness only; it does not prove a block was placed on the store. Two main products and four extras are fixtures, not a searchable real catalog. Variable products still use links; bundles, discounts, post-purchase offers, AI selection and live analytics are outside this prototype.

## Verdict and cleanup

Current recommendation: B, with A's short setup guidance and C's concise summary. The user approved layout B on 5 October and authorized moving forward. Merchant feedback is not yet recorded. Capture the chosen layout and changes here after review. Rewrite the chosen behavior in production components with the actual contracts and tests; delete the throwaway variants and routing entry once they have answered the question. Do not promote this simulated cart code into production.
