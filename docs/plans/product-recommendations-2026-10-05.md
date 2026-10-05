# Product recommendations: simple setup, dependable shopping, useful results

Date: 5 October 2026

Latest extension: [ADR 0124](../adr/0124-quiz-products-share-protected-cart-actions.md)
adds quiz cart buttons and quiz product activity. The user confirmed there are no
real users available yet and authorized us to choose and exercise realistic
scenarios. Merchant recruitment is therefore not a development blocker. This is
engineering and design judgment, not evidence of merchant usability or sales
uplift. [Current checks](../testing/quiz-cart-2026-10-05.md) distinguish those claims.


Status: Layout B and the direct-add design are approved locally. Product-page context, simple-product Add to cart, confirmed-addition reporting and product-level activity reports are implemented locally. The release candidate passed the recorded compatibility checks and is ready for staging; no public release, merchant recruitment or external messages have occurred.

Current release evidence: [candidate checklist](../reviews/recommendations-rc-2026-10-05/release-checklist.md). The earlier [link-slice checklist](../reviews/recommendations-2026-10-05/release-checklist.md) remains historical evidence. The [setup guide](../guides/product-recommendations.md) covers the implemented recommendation experience.

Initial research/prototype stage, 5 October: the user authorized the first integration checks and outcome definitions, with an interactive prototype before committing to the interface. The [outcome contract](product-recommendations-outcomes-2026-10-05.md), [spike evidence](../testing/recommendations-spike-2026-10-05.md) and [prototype notes](../../tools/design-system/editor-prototype/recommendations-prototype/NOTES.md) record that work. At that stage Release A was unimplemented; the spike alone did not satisfy production integration gates. The subsequent Shopify research informed a revised prototype: main product → useful extras → placement, with product-page preview by default. The prototype proposes evaluating Releases A and B together in the first merchant pilot after both pass their engineering gates; it does not implement either release or establish merchant validation.

This is the next-stage plan after [cart and product intelligence](cart-product-intelligence-2026-10-04.md). It builds on ADRs [0117](../adr/0117-cart-intelligence-uses-a-bounded-session-projection.md), [0118](../adr/0118-sample-baskets-share-live-commerce-evaluation.md) and [0119](../adr/0119-actionable-reports-use-local-evidence-and-order-provenance.md). Those implemented contracts remain authoritative until explicitly amended during implementation.

## 1. Product decision

Implementation update, 2026-10-05: the user approved prototype B. The first production slice implements the main-product/extras/context setup in the existing editor, distinct product-page and basket evaluation, viewed-product sample visits, classic WooCommerce after-summary placement and manual block-theme placement. Old basket campaigns keep their behavior. See [ADR 0120](../adr/0120-recommendations-distinguish-product-pages-from-baskets.md). This is a local implementation, not a shipped release or completion of Releases A+B. The later direct-add slice implements confirmed simple-product additions under ADR 0121 while preserving existing product-link campaigns and history. Production editor and local storefront reviews have since passed. Merchant pilot validation remains separate from technical acceptance.

Help a WooCommerce merchant recommend a useful extra product, let the shopper add it with little effort, and explain what happened afterward. Keep this inside WConvert Pro's existing Campaigns, editor, preview and Analytics experience.

First priority: easier setup and direct add-to-cart. Next: recommendations on product pages before a basket exists, followed by richer product reporting and easier quiz matching. Do not start by building an AI engine or a separate recommendation application.

Initial research segment: owner-operated WooCommerce stores with approximately 50–500 products and understandable product pairings, such as coffee equipment, gardening supplies, stationery or hobby supplies. This is a recruitment hypothesis, not a catalog-size limit or a claim about existing customers. Include a variable-product store and a larger catalog in validation to expose boundaries.

Primary business objective: improve basket value through useful additions while preserving completed-order rate. Attributed revenue alone does not establish that objective; a controlled experiment is needed to estimate incremental benefit.

## 2. Initial baseline and planned work (before implementation)

| Area | Current repository behavior | Work in this plan |
| --- | --- | --- |
| Product selection | Selected shortlist, or configured WooCommerce cross-sells; stable ordering | Make the choices and maintenance workflow clearer |
| Cards | Up to six selected IDs; up to three eligible cards; live catalog information | Confirmed add-to-cart for eligible simple products |
| Eligibility | Visibility, availability and purchasability checks; basket exclusions default on | Revalidate at mutation; explain exclusions in preview |
| Context | Basket-aware recommendations require a known nonempty basket | Add a distinct current-product context that works before a basket exists |
| Targeting | Product/category membership, quantities and merchandise amounts | Reuse existing rules; avoid another rules builder |
| Preview | Stateless sample baskets use the live evaluator | Add clear reasons, current-product samples and simulated button states |
| Quizzes | Conditional questions, hand-picked or category/attribute result products, fallback links | Implemented locally; merchant pilot and release review remain |
| Reporting | Campaign outcomes and optional campaign-attributed paid sales | Accurate addition outcomes first; product-level activity later |
| Placement | Manual block/shortcode; automatic post/page content insertion | Explicit WooCommerce product-page placement; existing insertion is not proof of product-template support |
| Validation | Automated and disposable-site evidence exists | Merchant usability and production-scale validation remain outstanding |

Evidence: [cart verification](../testing/cart-intelligence.md), [analytics verification](../reviews/actionable-analytics-2026-10-04.md), `pro/modules/cart-recovery/src/CommerceContext.php`, `pro/modules/cart-recovery/loader/products.ts`, `resources/loader/src/products.ts`, and `tiers.json`. The preceding assessment reran 28 focused tests successfully; this document change does not represent another runtime or production test.

The existing sales feature is off by default and uses **Last interaction · 30-minute window**, with consent and real WooCommerce order/refund evidence. Reuse it. Do not build the older cart plan's proposed 24-hour attribution model.

## 3. Research basis

Competitor documentation was reviewed during the 4 October assessment; WooCommerce mutation documentation was checked on 5 October. These are documented capabilities, not hands-on parity tests or independent uplift evidence.

| Reference | Relevant capability or finding | Planning implication |
| --- | --- | --- |
| [WooCommerce Product Recommendations](https://woocommerce.com/document/product-recommendations/store-owners-guide/) | Catalog filters, weighted ordering, deployment controls and sales analytics | Offer maintainable selection and useful reporting; avoid exposing all possible controls initially |
| [OptinMonster WooCommerce integration](https://optinmonster.com/docs/how-to-integrate-optinmonster-with-woocommerce/) | Product/page targeting and cart predicates | Reuse our existing targeting, expressed in merchant language |
| [OptiMonk recommendations](https://support.optimonk.com/en/articles/product-recommendations) | Manual and dynamic sources, including most viewed, last visited and cart modes | Make the source obvious; its newer help and older marketing pages differ on platform coverage, so do not claim exact WooCommerce parity |
| [RevenueHunt](https://revenuehunt.com/how-it-works/) | Product quizzes, recommendation rationale and cart actions | Reduce the distance between a useful result and purchase |
| [Baymard cart research](https://baymard.com/research-articles/product-recommendations-cart) | Irrelevant suggestions undermine confidence; compatibility, context and clear labels matter | Show fewer useful products rather than filling every slot; keep alternatives out of accessory recommendations |

Merchant needs are hypotheses until tested: short setup, low maintenance, predictable display, trustworthy product information and understandable results. No interviews or customer-demand counts are claimed.

## 4. Merchant experience

### One workflow in the existing editor

Use the existing store starting points and Goal-led creation. Keep the product controls in Design, placement and audience in Display rules, testing in Sample Visit, and results in Analytics. No new sidebar destination or independent commerce dashboard.

1. **Choose the task.** Start with “Recommend an accessory.” Later add “Recommend on a product page.” Keep product-finder quizzes in their current creation flow.
2. **Choose the products.** Two source options: “Products I choose” and “My WooCommerce cross-sells.” Explain the latter as product pairings already saved in the store. Preserve selected products as the existing default; suggest cross-sells when appropriate without switching the merchant's choice.
3. **Choose the action.** “View product” or “Add to cart.” New drafts can recommend Add to cart when supported products are available. Existing campaigns keep their action and reporting history.
4. **Choose where it appears.** Prefer an inline block near shopping content or the basket. Require a concrete supported location or manual placement instructions; never promise that a block has been installed when it has not. Popup and slide-in remain deliberate choices.
5. **Test and publish.** Show a plain-language summary, a representative preview and repair links for missing configuration. Reuse the existing publish review rather than adding a second checklist screen.

Example summary: “When the basket contains Espresso Machine A, recommend up to three available accessories, excluding products already in the basket. Shoppers can add supported products here.”

### Sensible defaults and progressive disclosure

- Show up to three eligible products; do not force three if only one is useful. Keep the six-product selected shortlist initially.
- Hide products already in the basket by default. Availability checks are mandatory, not merchant toggles.
- Use live WooCommerce names, prices, images and links. Do not copy editable catalog data into campaigns.
- Keep checkout and order-confirmation exclusions for accessory starting points. Resolve actual site pages, not hardcoded slugs.
- Reuse campaign frequency, scheduling and display competition. No extra popup or automatic cart-drawer opening after an addition.
- Keep ordering, category descendants and advanced audience combinations in their existing secondary controls.
- Add optional merchant-written explanatory copy such as “Filters for this brewer.” Never infer or advertise compatibility from category membership alone.
- If cross-sells are absent, explain how to configure them and offer switching to selected products. Do not silently substitute unrelated bestsellers.

### Readiness and diagnostics

Distinguish missing configuration, an empty eligible result and a failed check. Examples: “Choose products,” “No cross-sells configured for this sample,” “Already in the basket,” “Unavailable in your store,” and “Could not check the basket.” Each message should offer a relevant next action.

Missing required selections or placement prevents publication. Cross-sell campaigns can publish without a relationship for every possible basket; no match suppresses that appearance. Preview warnings must not become unnecessary blanket publication blockers. An unknown check must not be shown as a verified pass.

Preview is read-only: button states are simulated and clearly identified; testing never mutates a shopper basket, sends a beacon or changes sales attribution. A real-store test is a separate explicit merchant action.

## 5. Release A: easier setup and direct add-to-cart

### Shopper behavior

Support eligible simple products with quantity one. Variable products retain “Choose options” links. Products requiring custom inputs, bundles, subscriptions, grouped/external products or unsupported extension behavior do not gain a generic add button. A nominally simple product can still require options; support must be verified rather than inferred from its type alone.

| State | Shopper experience | Counting |
| --- | --- | --- |
| Ready | Product, current price and Add to cart | No addition |
| Pending | “Adding…”; prevent repeated activation of that action | No addition |
| Confirmed | “Added to your basket”; optional View basket link | One acknowledged addition event |
| Rejected | Clear WooCommerce-compatible error and appropriate product link | No addition |
| Outcome unknown | “We couldn't confirm the update. Check your basket.” | No fabricated success; no automatic retry |

After success, refresh the native cart UI and recommendation context. With basket exclusion on, remove or replace the added card after confirmation. Keep the success announcement and keyboard focus stable; do not remove a focused element without a sensible destination. An already-open campaign may show a neutral empty state; a newly eligible campaign with no useful cards stays hidden.

### Mutation and integration contract

- Use WooCommerce's validated cart mutation path and extension validation hooks. The browser must not set price, stock, discounts, totals or arbitrary cart metadata.
- Preferred spike: the supported Store API cart operation, with a fresh session-appropriate nonce/token. [Cart API](https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/cart/) and [nonce documentation](https://developer.woocommerce.com/docs/apis/store-api/nonce-tokens/) require protection for POST operations. Never disable nonce checks or ship a shared cached token.
- Prove guest and authenticated sessions, cached pages, token expiry, classic cart fragments and the Blocks cart store on a disposable site before selecting the adapter. If the supported path cannot satisfy these requirements, document and test a WooCommerce-native adapter before implementation proceeds.
- Keep the read-only context endpoint read-only. Do not turn its existing published-campaign read into an unprotected write endpoint.
- Only a deliberate shopper action initiates a mutation. Serialize WConvert cart operations in the document; prevent double-click submissions. A failed acknowledgement is not permission to repeat a potentially completed mutation.
- Recover an expired token only when WooCommerce definitively rejected the write before applying it. A timeout or lost response requires reconciliation or a product/cart link, not a blind retry. Do not claim exactly-once behavior across tabs or network failures without an explicit server receipt contract.
- Server validation is final when stock, price, purchasability or quantity restrictions changed after rendering. If a price change can be detected before submission, refresh the card and ask for a fresh click; the basket always displays WooCommerce's accepted current price.
- Cart responses can contain more information than recommendation reads. Consume them only within the WooCommerce integration; never copy addresses, cart tokens, customer fields or full responses into WConvert reports, logs or persistent storage.
- Retain the existing functional-consent contract for cart context; optional statistics consent is independent. A statistics denial must not prevent an otherwise permitted shopper cart action.
- Analytics failure must not undo, retry or report failure of a successful cart addition. Do not dispatch both classic and Blocks updates in ways that repeat the mutation or double-count its result.

### Outcome and history decision

Direct addition is a new converting act, not a product-link click. Before Release A implementation, record an ADR extending the Goal/design contract.

Recommended design: introduce a commerce-only Goal **Increase basket value**, with the measured outcome **Basket additions** explained as “campaign appearances with at least one confirmed addition.” Keep existing Promote an offer campaigns and their link-click counts unchanged. The new starting point still lives in the existing campaign creation experience.

- Count its first confirmed addition once per mounted campaign, using the existing counted-once lifecycle. It does not create a Lead or prove an order.
- Additional successful additions can contribute to separately labeled activity totals, never a second headline Conversion for that mount. Quantity-one makes each successful operation one item addition in the first release.
- View product, Choose options and View basket are supporting links in an addition campaign, not alternative converting acts. Readiness and reporting explain this. Suppress an addition campaign when no eligible direct-add product remains; merchants needing variable-only recommendations use the existing link campaign.
- Drafts may change action/Goal. A previously published campaign or A/B family must be duplicated to change between click and addition outcomes. Do not relabel, reset or merge old counts. All variants must share the same outcome.
- Carry the new outcome through publication validation, imports, templates, dashboard/Goal totals, rate labels, exports and analytics adapters. Keep incompatible totals separate.
- New successful additions may qualify for the existing optional 30-minute campaign attribution only after server-verified acceptance and the current consent checks. Document the additive interaction type and model compatibility; appearances, attempts and failures never acquire order credit.
- Extend semantic analytics callbacks for confirmed addition; do not mislabel a click as `add_to_cart` or add product/customer fields to existing public event payloads casually. External analytics adapters must avoid duplicating WooCommerce's own commerce events.

Release A includes the headline addition metric and correct campaign-sales integration. It must not ship an unmeasured or mislabeled button while waiting for the later product report.

## 6. Release B: recommendations on product pages

Separate **what supplies recommendations** from **when the campaign is eligible**:

- Existing basket context keeps its nonempty-basket requirement.
- New current-product context reads the actual public product being viewed; it works with a known empty basket. Unknown basket state remains unknown when exclusion or cart predicates require it.
- Sources initially remain selected products or configured cross-sells of that product. Exclude the current product, duplicates, unavailable items and, when enabled, basket contents. Do not silently use WooCommerce upsells as accessory pairings.
- Current-product context uses the parent product initially. Do not imply that a selected color/size variation changes compatibility. Variation-specific recommendation rules remain later work.
- Bind supplied product IDs to valid public catalog context and published campaign rules. Never expose private products or allow arbitrary private catalog reads through the recommendation endpoint.

Placement must be explicit. Existing automatic insertion serves singular posts/pages and is not a general WooCommerce product placement engine. Implement a supported classic product hook, conservatively after the main product summary, and a verified block-theme placement path using the existing dynamic campaign block. Do not silently edit a merchant's templates or scrape arbitrary CSS selectors. If automatic placement is unavailable, show block/shortcode instructions and verify the real location.

Reuse first-manual-anchor precedence, A/B family selection, viewport impressions and automatic-slot competition. A missing slot, ineligible campaign or absent product context counts no appearance. Do not create a second copy beside the same manual campaign block.

Extend Sample Visit with an explicit viewed-product selector alongside the basket. Show the recommendation reason and the difference between page context, basket context and manually assumed non-commerce conditions.

## 7. Release C: useful product reporting

Implementation update, 2026-10-05: slice 5 now records and reports product-card
views, product-page link activity and confirmed additions in campaign Analytics
and editor details. See [ADR 0122](../adr/0122-product-activity-uses-retained-anonymous-dimensions.md).
Product scopes use existing storage with 90-day retention; current names,
tracking start and incomplete coverage are explicit. Quiz cards now share this
report under [ADR 0124](../adr/0124-quiz-products-share-protected-cart-actions.md).
Candidate ZIPs have been rebuilt and checked on both recorded WooCommerce
environments; see [verification](../testing/quiz-cart-2026-10-05.md). Product-level
sales remain deferred, and the manual staging storefront pass remains before release.


Keep reporting inside the existing campaign detail and Analytics. Show the campaign's main outcome first, then product activity and the existing attributed-sales section. Explain unconfigured tracking rather than displaying missing attribution as zero sales.

| Metric | Definition and boundary |
| --- | --- |
| Recommendation appearances | Existing campaign viewport/display definition |
| Campaign result rate | Once-counted outcome divided by campaign appearances; label click and addition outcomes differently |
| Product-card views | The specific card enters the visible recommendation area, once per product per mount; never infer it for every shortlisted product |
| Product-page clicks | Explicit product links, separately from direct additions; disclose event counting |
| Confirmed additions | Successful quantity-one operations, deduplicated by operation evidence; not attempts or purchases |
| Attributed orders and sales | Existing campaign-level consented 30-minute model, refunds and currency handling |

Use a compact product table: product, card views, product-page clicks and confirmed additions. Its counts can exceed headline campaign conversions. Deleted products keep their historical ID with an unavailable label; current names must not be represented as historical snapshots. Never treat missing past product instrumentation as zero.

Product dimensions are new instrumentation. Design bounded daily aggregate storage, retention, indexing, deletion/uninstall behavior and request validation explicitly; do not assert that today's campaign counters already contain this information. Prefer aggregates without visitor/contact identifiers. Establish date/product query limits and suppress incomplete totals rather than quietly truncating. A schema change, if necessary, requires a migration and its own reviewed contract.

First release of this report keeps sales at campaign level. Do not allocate an entire attributed order to each clicked product. Product-level sales requires a separate line-item provenance/refund design and is deferred. Existing order links remain subject to WooCommerce permissions.

Campaign A/B comparisons can compare designs with the same outcome. A no-recommendation holdout is separate work: define random assignment, consent, exposure, order measurement, minimum sample and stopping rules before a pilot. Do not infer causal uplift from attributed sales, before/after screenshots, or existing variant reports.

## 8. Release D: easier product-finder maintenance

Implemented locally on 5 October after the user explicitly selected this development step. Merchant validation of the maintenance benefit remains part of the pilot; no uplift is claimed. Current quizzes, result order, fallback links and anonymous completion behavior are preserved. See [verification](../testing/result-product-filters-2026-10-05.md).

Add an optional product source per result: selected products, or a category constrained by explicit attribute values. The chosen result remains determined by the existing question/branch rules; catalog filters only choose its cards. Start with a documented deterministic order, bounded queries and live eligibility. No automatic scoring, recommendation of exact variations or inferred compatibility.

Preview representative answers and unavailable/empty matches before publication. Explain conflicting filters and show the result's meaningful fallback if no products qualify. Keep quiz completion separate from subsequent product activity; a cart addition must not become a second quiz Conversion. Direct addition inside quiz results now uses Release A's protected adapter, with result-bound operations and separate product activity; see [ADR 0124](../adr/0124-quiz-products-share-protected-cart-actions.md) and its verification record.

Defer “best sellers” and recently viewed modes until merchants demonstrate a need. If later added, specify data windows, fallback behavior, storage/consent and clear labels; never call configured pairings “frequently bought together.”

## 9. Shared reliability, packaging and compatibility

- **Availability:** recommendations and new cart actions remain in the existing cart commerce capability/build rung, currently Elite internally and Pro to customers. Keep existing quizzes in their present tiers. Category/attribute quiz selection stays in the journeys module at all paid tiers (ADR 0123); existing functionality does not move upward.
- **Dependencies:** hide irrelevant creation controls without WooCommerce. Suspend saved campaigns whose required module is absent, preserving the authored constraints. Follow the existing license-expiry contract.
- **Backwards compatibility:** missing new fields mean the old basket context and View product action. Existing published campaigns, historical reports and templates must render/count unchanged.
- **Portability:** strip site-local product/category/attribute references on export where applicable, require remapping, preserve supported source/action intent, and refuse unsupported capabilities on import. Do not accidentally resolve matching numeric IDs on another store.
- **Context lifecycle:** preserve deduplicated reads, immediate invalidation on known mutations, the current freshness ceiling, generation-based stale-response rejection and no hidden-tab polling. A click/exit gesture while checks are pending must not be replayed later.
- **Performance:** zero new commerce requests/assets on unrelated pages; load mutation code only for relevant campaigns; bound candidate reads and aggregate queries. Read byte limits from current build scripts and measure combined feature cost. No silent budget increase.
- **Accessibility:** real buttons for mutations, descriptive links, nonintrusive status announcements, pending-state clarity and stable focus. Verify 320px, desktop, RTL, long names, missing images and price ranges.
- **Supported initially:** verified WooCommerce core classic and Blocks paths, guest/logged-in sessions, and supported simple/variable-parent catalog reads. Third-party cart drawers, currency switchers, custom product-option plugins and unusual themes require explicit matrix entries, not blanket compatibility claims.
- **Rollback:** new campaigns opt in explicitly. Pausing a campaign stops its recommendations without touching WooCommerce cart contents or old reports. Do not silently change a published addition campaign into a click campaign; rollback disables the affected action/campaign with an actionable admin explanation.

## 10. Delivery slices and gates

| Slice | Deliverable | Dependency / completion evidence |
| --- | --- | --- |
| 0. Baseline and contracts | Current status, interaction/Goal ADR, supported product/placement matrix and mutation spike | Real cached-page, guest/login and classic/Blocks evidence; settle new outcome before shipping changes |
| 1. Setup improvement | Source/action controls, readiness, preview reasons and plain-language summary | Reuses existing editor; old campaigns unchanged; ready for merchant walkthrough |
| 2. Complete addition experience | Protected mutation, pending/error/success, cart synchronization, first-add outcome and attribution integration | Slice 0; duplicate activation, ambiguous outcomes and stale data tests pass |
| 3. Release A validation | Packaging, regression, responsive/accessibility and merchant walkthrough | Slices 1–2; all release blockers resolved; no claimed uplift |
| 4. Product-page experience | Current-product context, verified placements and preview | Release A adapter stable; works with empty basket and no duplicate placement |
| 5. Product activity report | Bounded aggregates and per-product report | Storage/retention contract reviewed; source event instrumentation verified |
| 6. Product-finder extension | Category/attribute result sources, optional cart buttons and product activity | Implemented and technically checked, including installed packages; manual staging storefront pass remains. Merchant usability is unvalidated while no users are available. |
| 7. Outcome study | Predefined controlled pilot | Sufficient traffic, valid assignment/consent and agreed measurement; report uncertainty |

Release A comprises slices 0–3. Slice 4 is Release B; slice 5 is Release C; slice 6 is Release D. Product reporting can be designed alongside the product-page work, but each release remains independently reviewable. Do not bundle shipping progress, discounts, AI or off-site marketing into this sequence.

There is no requested deadline. Estimate implementation effort after slice 0 proves the transport and placement constraints. The first scope to reduce under time pressure is later product dimensions or quiz expansion, never mutation correctness, outcome integrity or core compatibility.

## 11. Validation and release acceptance

### Merchant research

Prepare a five-merchant qualitative round. Ask merchants to use their own products to create an accessory campaign, explain when it appears, test a product already in the basket, handle an unavailable product, and interpret its results. Record unassisted/assisted completion, errors, setup time and maintenance concerns.

Proposed usability target: at least four of five merchants finish the core setup unassisted within ten minutes after opening WConvert, with all five able to distinguish an addition from a purchase after reading the report. This is a design target, not an existing result or statistical market proof. Recruitment/invitations need a separate explicit instruction; this plan sends none. If access is unavailable, label usability unvalidated and keep broader rollout provisional while technical work proceeds.

### Essential scenarios

| Scenario | Required result |
| --- | --- |
| Compatible accessory available | Correct card and supported action appear |
| Accessory already present | Excluded by default, including parent/variation relationship |
| No saved cross-sells | No unrelated substitute; preview explains missing relationships |
| Product becomes unavailable | Mutation refused cleanly; no success or addition count |
| Double-click / keyboard repeat | One WConvert mutation for that pending action |
| Response lost after possible success | No automatic repeated addition; explicit unknown state |
| Native cart changes during a request | Late response cannot restore obsolete recommendation state |
| Successful addition | Native cart updates, visible confirmation, correct focus and once-counted conversion |
| Variable or required-options product | Appropriate product-page action; never a guessed configuration |
| Cached page, two shoppers | Correct independent sessions and mutation protection |
| Statistics consent absent | Permitted shopping works; optional attribution stays off |
| Preview, admin or diagnostic session | No cart writes or analytics side effects |
| Product page, empty basket | Current-product campaign can appear; basket-only campaign cannot |
| Unsupported/missing placement | Actionable setup explanation, no invented appearance |
| Added card leaves viewport/replaced | Accurate card exposure, no duplicate campaign appearance |
| Refund or multicurrency order | Existing attributed-sales definitions preserved |
| Previously published click campaign | Same action and report meaning after upgrade |
| Pro/module removed or design imported | Suspension/remapping, never weakened rules |

Run focused PHP/JS contract tests, real disposable WordPress classic/Blocks checks, affected full suites/static checks, build/artifact boundaries and performance gates. Verify actual browser layout and keyboard behavior. Do not substitute mocked tests for cart mutations or a production-scale claim. Test read paths with the target catalog range and at least one materially larger fixture, recording data volume and latency.

Release blockers: incorrect cart mutation, duplicated additions from one pending action, incorrect compatibility claims, false success, misleading metrics, session leakage, broken host-cart behavior, inaccessible primary actions or repeated failure of core merchant setup. Record tested versions and unsupported integrations in the release notes.

## 12. Implementation touchpoints and decisions

Review these existing areas; keep the product flow free of implementation terminology:

- Commerce: `pro/modules/cart-recovery/src/CommerceContext.php`, `CartRules.php`, and `pro/modules/cart-recovery/loader/`.
- Authoring/preview: `resources/admin/src/builder/BlockInspector.tsx`, `resources/admin/src/builder/CommerceControls.tsx`, `resources/admin/src/builder/rules/SampleBasket.tsx`, `resources/admin/src/builder/rules/SampleVisit.tsx` and existing readiness controls.
- Templates/Goals: `resources/renderer/src/types.ts`, `src/Template/CaptureJourney.php`, `src/Goal/Goal.php`, product playbooks, template validation and design transfer.
- Placement: `pro/modules/inline-placement/` and the existing manual anchor/block contract.
- Analytics: `src/Stats/`, `pro/modules/analytics/src/RevenueHooks.php`, `RevenueReport.php`, the revenue loader and shared reporting components.
- Quiz cards: `resources/loader/src/products.ts`, `pro/modules/journeys/`, `JourneySettings.tsx` and existing result fallback tests.
- Packaging: `tiers.json`, Pro service registration, source/artifact checks and current loader-budget scripts.

Record proposed outcome/cart-write decisions before implementation, then amend affected domain documentation: [Goal history](../adr/0085-goals-have-publish-contracts-and-stable-history.md), [cart intelligence](../adr/0117-cart-intelligence-uses-a-bounded-session-projection.md), [sample baskets](../adr/0118-sample-baskets-share-live-commerce-evaluation.md), [sales attribution](../adr/0119-actionable-reports-use-local-evidence-and-order-provenance.md), [automatic placement](../adr/0099-automatic-inline-placement-uses-rendered-content.md), [manual placement](../adr/0100-manual-inline-placement-uses-wordpress-layout-surfaces.md), public observation contracts and `CONTEXT.md`. This plan does not mark those changes implemented or accepted retroactively.

The initial engineering gates were transport/token lifecycle, supported product-option detection, cart UI synchronization and block-theme placement. The implementation and release-candidate evidence below resolve them within the documented supported scope. The proposed product defaults above are sufficient to start that work without another broad questionnaire.

## 2026-10-05 addition implementation update

The direct-add slice now has its own Goal, start, action, server-protected Woo
adapter, replay claims, separate reports/CSV, supported-product fallbacks and
native cart refresh. [ADR 0121](../adr/0121-recommendation-additions-count-server-accepted-cart-actions.md)
records the transport decision and stable success-card refinement.
[Verification](../testing/recommendation-additions-2026-10-05.md) distinguishes
local checks from broader compatibility and merchant validation still to do.
