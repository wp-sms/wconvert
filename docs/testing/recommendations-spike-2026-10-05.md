# Product recommendation prototype and cart transport spike

5 October 2026. Scope: prototype, transport/outcome investigation and subsequent product-link implementation checks for [the plan](../plans/product-recommendations-2026-10-05.md). The later implemented direct-add slice is recorded separately in [addition verification](recommendation-additions-2026-10-05.md); the spike findings below remain historical evidence. The [current release checklist](../reviews/recommendations-2026-10-05/release-checklist.md) records the latest local verification and remaining gates.

## Reproduce the transport check

Use an extracted official WooCommerce 11.1.2 plugin directory. The current local copy used for this run was `/tmp/wconvert-commerce-test/woocommerce`; it is not included in the repository.

```sh
WCONVERT_WOO_DIR=/path/to/woocommerce node tools/visual-tests/recommendations-spike/server.mjs
```

The harness boots a fresh disposable in-memory WordPress 7.1.2 / PHP 8.3 at `http://127.0.0.1:9445`, mounts WooCommerce and the local Free/Pro code, and activates them. It does not mount the merchant site's database or reuse a saved WordPress root. Existing built WConvert assets are needed for any WConvert frontend checks.

In another terminal:

```sh
node tools/visual-tests/recommendations-spike/check-api.mjs
```

The fixture contains test-only authentication and catalog creation. It must never be mounted on a merchant or publicly hosted site. All code lives under `tools/`, outside plugin runtime directories.

## Observed results

Twelve HTTP checks passed, six each for a guest and authenticated session:

- Missing Store API nonce rejects with 401; requested product is not added.
- Deliberately invalid nonce rejects with 403; requested product is not added.
- Fresh protected addition returns 201 and remains present on a later same-session read.
- Out-of-stock addition rejects with 400 and does not create the item.
- Replaying the same valid addition produces quantity two: native POST is not idempotent.
- An independent guest context stays empty and does not inherit another session's basket.

The initial test incorrectly expected 200 for creation; it was corrected to WooCommerce's observed 201 response, and the entire twelve-check run then passed. No implementation defect was hidden by changing a product assertion.

Browser checks in the disposable site also confirmed:

- Store API addition followed by the Blocks cart update shows the filter and changes the total from $100 to $115.
- The native Blocks `addItemToCart` action adds the brush and changes the total to $123.
- A Store API addition followed by `wc_fragment_refresh` updates a classic mini-cart to include the filter and subtotal $115.

These browser checks used a guest session; the HTTP mutation checks covered both guest and authenticated sessions. They demonstrate integration seams, not universal theme/extension support.

## Prototype verification

### Approved B: first production slice, 2026-10-05

The main-product/context controls, live evaluator, sample visit, classic product placement and manual block-template support are implemented locally. Direct add-to-cart remains the next slice; the earlier mutation spike is not production code.

`node tools/visual-tests/recommendations-spike/check-products.mjs` passed 12 integration checks in a disposable WordPress 7.1.2 / PHP 8.3 / WooCommerce 11.1.2 site. Guest and authenticated checks cover real classic product-template output, signed page context, empty baskets, old/new basket requirements, forged/absent/private/wrong product context, selected and cross-sell sources, main-product exclusion, and extras already in the basket. Authenticated preview checks cover separate viewed-product context and rejection of private products. A saved block-theme product template renders the manual campaign anchor without an automatic duplicate. The tiny classic fixture theme and all fixture mutations are test-only; no merchant database is mounted.

Full PHP suite: 2,540 tests / 15,321 assertions passed. Full JavaScript suite: 209 files / 3,739 tests passed with two workers. The first unrestricted run exposed a missing manifest declaration for the new internal requirement; that contract was fixed and covered in PHP and JS. Four unrelated editor tests also timed out under parallel load; targeted and full two-worker reruns passed. Full Free/Pro production build, TypeScript, ESLint, PHPStan, source contract and loader/commerce size checks also passed. Elite loader: 27,003 bytes gzip against 27,008; commerce: 2,968 against 3,276. Budgets were not increased.

The initial disposable-site browser review was blocked on port 9445. Subsequent production UI verification used the actual local WooCommerce demo: editor controls, sample visits, desktop and 390/320-pixel storefronts, keyboard links, basket exclusion, empty results and recovery after Blocks mini-cart removal. The expanded disposable HTTP matrix now has 21 passing checks. See the [release review](../reviews/recommendations-2026-10-05/release-checklist.md) for evidence and limits. No universal theme compatibility, merchant usability or conversion uplift is claimed.

The standalone editor-prototype Vite build passed. Its existing large-chunk warning originates in the broader prototype bundle, including the pre-existing ELK graph dependency; this is not a production plugin build or a production byte-budget measurement.

The initial prototype browser checks exercised layout switching (A/B/C), pending and successful additions, two additions with one headline result, rejected and unknown responses with zero results, empty-basket suppression, and the review dialog. No browser console errors were reported in the prototype check. The [desktop screenshot](../reviews/recommendations-2026-10-05/editor.jpg) records the recommended B direction. No prototype unit tests were added. The repository ESLint configuration does not match this throwaway JSX file; the spike `.mjs` files passed their lint check. Compilation and browser behavior are the verification for the JSX. A complete mobile/RTL and assistive-technology audit remains production validation work.

## Research-driven prototype revision

The revised UI defaults to product-page recommendations and main product → extras → placement. Browser checks confirmed: extras appear on a matching product page with an empty basket; basket placement suppresses an empty/unrelated basket; unrelated product pages and unavailable extras show no offer; an existing brush is excluded; changing the main product loads its labeled example pairing; variable products show a simulated Choose options link; and missing pairings provide repair guidance. Main-product addition changes the sample basket without counting a recommendation outcome. Two extra additions produce two activity events and one campaign result. Rejected/unknown responses leave counters at zero, with further actions disabled after an unknown response.

All three layout variants were exercised, including guided progression and summary placement expansion. The narrow storefront preview was visually inspected; this is not a full responsive-admin, RTL or assistive-technology audit. The revised [product-page screenshot](../reviews/recommendations-2026-10-05/product-page-revision.png) supplements the initial basket screenshot. The standalone Vite build passed again with the existing broad-prototype large-chunk warning. No production commerce transport checks were rerun because this revision changes only the simulated UI and its documentation.

## Limits and next engineering work

- Invalid nonce tests model rejection of a stale/cached value; they do not simulate an actual reverse-proxy cache or wait for nonce expiry.
- The prototype's lost-response case is simulated. The real spike proves that replay is unsafe, not production timeout reconciliation or exactly-once delivery.
- The fresh-token fixture is not a production endpoint design. Its same-session behavior is proven only in the test environment.
- Server-confirmed campaign provenance, duplicate-proof metric delivery and addition-based attribution are not implemented by this spike.
- Required custom options, extension product types, multi-currency plugins, third-party drawers, low-stock races and production load remain unverified.
- Product-page placement markup and the local block-template storefront have been checked; broad theme compatibility and merchant usability interviews remain open.

Next: implement the [outcome contract](../plans/product-recommendations-outcomes-2026-10-05.md) and the production cart adapter after capturing interface feedback. Do not copy the prototype's timers or simulated counters into the plugin.
