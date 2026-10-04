# Cart and product intelligence for WConvert Pro

Date: 4 October 2026

Status: Core release is merged. The ADR 0118 follow-up implements explicit sample-basket simulation and configured WooCommerce cross-sells. Merchant research, shipping progress and order attribution remain outstanding.

## Product decision

Build this as WConvert Pro functionality requiring WooCommerce. Help merchants show campaigns that understand the current basket, recommend useful available products, and answer relevant shopping questions.

The first release delivers a complete accessory recommendation: a shopper adds a coffee machine; WConvert suggests compatible filters selected by the merchant; filters already in the basket are excluded; unavailable suggestions never appear as purchasable; the campaign reports appearances and product clicks accurately.

This is useful without automated catalog ranking or visitor profiles. Preserve WConvert's broader value to publishers and service businesses; commerce controls appear only where relevant.

## Packaging and availability

- Customer-facing name: WConvert Pro. Do not introduce another paid product or price in this work.
- Current `tiers.json` sells one Pro product but defines `basic`, `pro`, and `elite` build rungs. Cart recovery currently belongs to `elite`; question journeys belong to `basic` and above.
- Put new cart rules and cart-aware recommendations with the existing Elite cart module for the first implementation. Do not move existing product quizzes out of their current tier.
- Existing selected-product quiz results continue to work without opting into cart awareness. Cart-based exclusions added to a quiz require the cart capability and suspend that authored experience if it is missing.
- Free receives no commerce runtime, requests, or unusable authoring controls. Follow ADR 0116; existing saved commerce campaigns explain missing capabilities if Pro is removed.
- Without WooCommerce, hide commerce creation starting points. Existing authored campaigns are suspended with an actionable dependency explanation. Never drop a missing cart condition from an ANY group.
- Expired licenses retain installed functionality under the existing product contract.

## What exists and what changes

| Area | Existing implementation | Planned change |
| --- | --- | --- |
| Cart conditions | Nonempty cart; minimum cart total | Products, variations, categories, quantity comparisons and value ranges |
| Cart data | `wconvert_cart` cookie with count and total | Session-scoped, minimal live reads for richer campaigns; no cart catalog copied into cookies |
| Product results | Up to six ordered selected IDs; display up to three live available products | Reuse card behavior for recommendation campaigns and optionally exclude products already in the cart |
| Recommendation choice | Merchant selects quiz products by outcome | Selected accessories and configured WooCommerce cross-sells (ADR 0118) |
| Delivery guidance | Static message and cart link | Contextual guidance first; verified shipping progress later |
| Statistics | Appearances, conversion clicks, quiz completions and result clicks | Clear commerce labels first; optional order attribution later |

Source anchors: `pro/modules/cart-recovery/loader/cart.ts`, `pro/modules/cart-recovery/src/CartCookie.php`, `resources/rules/manifest.json`, `resources/loader/src/products.ts`, `resources/admin/src/builder/JourneySettings.tsx`, `src/Goal/Goal.php`.

## Merchant and shopper needs

The priority merchant is a WooCommerce operator with an understandable catalog and useful product pairings. Small shops need a setup they can maintain without writing conditions from scratch. Larger catalogs may need reusable product relationships, but that should follow validation of the first experience.

| Merchant task | Shopper experience | Example |
| --- | --- | --- |
| Sell an appropriate accessory | Relevant suggestion with current information | Filters compatible with the selected coffee machine |
| Avoid pointless recommendations | Products already in the basket are omitted | No second recommendation for the memory card just added |
| Explain a buying consideration | Help relevant to the product or basket | Delivery-access checklist for large furniture |
| Keep recommendations accurate | Available items and useful fallbacks | Second selected accessory appears when the first sells out |
| Understand effectiveness | Distinct, accurately named outcomes | Product clicks today; attributed orders in the later reporting phase |

These are product hypotheses grounded in current capabilities and market documentation. The repository's first-time merchant test remains marked as not run; do not present these as customer interview findings.

## First release scope

The core scope is implemented; explicit sample-basket simulation is completed by the ADR 0118 follow-up. See [verification](../testing/cart-intelligence.md) for tested behavior and boundaries; merchant recruitment remains outstanding and later increments below are not implemented.

Ship together:

1. Rich cart conditions with precise unknown and negative-match behavior.
2. A merchant-selected product recommendation block for click-only offer campaigns.
3. Exclusion of recommended products already in the cart.
4. Live stock, visibility, purchasability and price handling, preserving useful product-quiz behavior.
5. An accessory campaign starting point and contextual shopping-guidance starting point.
6. Draft simulation, live diagnostics, publication checks and accurate click reporting. The ADR 0118 follow-up evaluates explicit sample baskets; non-cart conditions remain manual assumptions.
7. Classic WooCommerce and Cart/Checkout Blocks compatibility demonstrated on real WordPress.

The ADR 0118 follow-up implements WooCommerce cross-sell selection. Leave for later increments: direct add-to-cart buttons, dynamic shipping progress, attributed orders, and category/attribute-based quiz selection. Keep all six recommendations from the assessment in the roadmap below; this split limits the first release rather than quietly discarding them.

## Merchant setup

Use the existing creation flow and editor. Do not add a separate commerce dashboard.

### Recommend an accessory

1. Choose the starting point under **Promote an offer or content**. Its explanation says it recommends selected products to qualifying baskets and counts product-link clicks.
2. Choose the qualifying products or categories using searchable store selectors.
3. Choose up to six accessories in priority order. The merchant owns compatibility; matching categories alone never establishes it.
4. Leave **Hide products already in the cart** enabled by default. Explain that this checks the current basket, not purchase history.
5. Edit the heading, short explanation and card appearance. Up to three available suggestions appear. Product names, images, prices and links come from WooCommerce, not manually duplicated text.
6. Choose location and opening moment. Default this starting point to a quiet inline placement, with checkout and order confirmation excluded. Require the placement to be configured and previewed before publication. A popup or slide-in remains an explicit choice.
7. Run the sample cases and review the plain-language rule summary before publishing.

Example summary: “On these store pages, when the cart contains Espresso Machine A, show up to three selected accessories that are available and are not already in the cart.”

Use the site's existing campaign permissions; do not silently broaden editing access to every WooCommerce role. Merchant preview uses explicit sample cart facts and is clearly labeled as simulated.

Implementation note: ADR 0118 adds explicit sample-cart inputs and recommendation results using the live evaluator. Other visitor and page conditions still use manual assumptions.

### Help with a shopping question

Reuse the cart conditions and existing text/link designs. Example: a basket containing the Sofas category qualifies for a delivery-access guide. The merchant writes and verifies the guide; WConvert does not invent delivery dates, warranty coverage or return policies.

This setup counts a link click, and does not imply that the shopper read the guide or completed an order. A store-specific playbook can require WooCommerce even when its Goal is Promote an offer; update the old bundled-playbook assumption that cart rules only accompany the cart Goal.

## Cart condition contract

Keep existing Pages, Audience and Opening moment concepts. Cart rules are audience Conditions; adding an item is not implicitly a new Trigger.

| Condition | Merchant choices | Exact meaning |
| --- | --- | --- |
| Cart has items | Existing predicate | Positive item quantity in a known cart |
| Products in cart | Contains any / contains all / contains none; selected products or variations | Match stable WooCommerce IDs, never product-name substrings |
| Categories in cart | Contains any / contains all / contains none; selected categories | A product's assigned categories; include descendants with an explicit default-on control |
| Cart item quantity | At least / at most / between | Sum of item quantities, not number of distinct cart lines; label it “Total item quantity” |
| Cart amount | At least / at most / between; selected amount basis | Inclusive bounds in the authored currency |

For categories, “all” means every selected category is represented somewhere in the basket, not that one product belongs to every category. Resolve descendant membership server-side. A parent product selection matches any of its variations; selecting a variation matches only that variation. The recommendation exclusion default treats any variation of the selected parent as already present; variation-specific recommendation selection can be added later.

First-release amount basis is **Products after discounts, excluding tax and shipping**, computed from WooCommerce merchandise line totals. Preserve the existing `cart_value_min` rule's current final-total behavior and label it clearly; do not silently reinterpret saved campaigns. The existing rule includes WooCommerce's current calculated total, which is not necessarily the final cost before an address is known.

Store authored thresholds with the store currency and validate against its decimal precision. Compare minor units with currency metadata, not hardcoded two-decimal arithmetic. Currency changes require amount-rule review; do not compare 100 USD against 100 EUR. Until currency conversion is verified for an adapter, a mismatched currency makes that amount predicate unknown and nonmatching. Ordinary product rules can still work.

Known empty cart: has-items false; contains-any/all false; contains-none true. Quantity is zero. New amount conditions require a nonempty cart so an empty basket is not an offer opportunity. The accessory setup has a mandatory nonempty-cart requirement outside audience alternatives.

Unknown, failed, pending or stale cart: both positive and negative predicates are nonmatching. Never treat a failed read as an empty cart. Preserve the existing group semantics: another independent ANY branch may pass, but a cart-dependent product block still needs its own known context and eligible products.

Bounds: retain five audience groups and eight leaves per group; allow up to 20 selected IDs per product/category condition. Reject empty selections, inverted ranges, negative amounts, invalid IDs and unsupported operators at publication. Quantity comparisons use WooCommerce quantities; the first release supports ordinary whole-item quantities. Stores using fractional-quantity extensions require separate compatibility verification.

Deleted product/category references block new publication with a repair link. If a referenced object disappears after publication, mark that predicate unresolved and nonmatching rather than letting a negative rule suddenly match everyone. Renaming an object keeps the rule valid.

## Product block and conversion contract

Add one explicit WooCommerce recommendation node through the existing design vocabulary. Implementation naming can follow the code's conventions; do not create arbitrary provider URLs or executable template callbacks.

The first source is **Products I choose**: up to six parent/simple product IDs, ordered by the merchant, up to three displayed. Exclude hidden, password-protected, nonpurchasable and out-of-stock items, and optionally products already represented in the basket. Do not substitute unrelated catalog items.

Keep quiz outcome selection separate from stock availability. Running out of products for one answer outcome never selects a different outcome. Existing quizzes retain their fallback link and completion behavior.

For an accessory campaign, all cards support the same converting act: following a product recommendation. The first qualifying card click counts one Conversion per mounted campaign using existing counted-once protections. A second card click must not become a second headline Conversion for that appearance. Exclude forms, quiz completion and an unrelated primary CTA from this click-only design. Extend Goal validation to accept the product block's validated links; it must not demand an unrelated static offer URL merely to pass publication.

First-release buttons open product pages. Variable products offer “Choose options” with correct price ranges or a clear “From” price when supported; do not present the parent price as a guaranteed selected-variation price. Direct cart mutation is deferred so variation selection, quantity limits, subscriptions and compatibility are not guessed.

An accessory campaign with no eligible cards is not shown and creates no Impression. A failed product request also suppresses that recommendation campaign. A quiz still displays its meaningful result and fallback as today. These are different product situations, not one universal empty state.

Product loads and eligibility must finish before a new recommendation appearance is counted. Request cancellation, response ordering, safe same-origin links, translated loading/fallback copy and keyboard operation are required.

## Live cart data architecture

### Recommended approach

Add a focused service within `pro/modules/cart-recovery`, registered through the existing Pro provider. It reads WooCommerce's current session on demand and returns a minimal projection for the requesting page's published campaigns.

Prefer a dedicated, same-origin, read-only WConvert endpoint backed by WooCommerce's cart/session APIs. The raw Store API cart response includes addresses, coupons and other data WConvert does not need. Avoid importing that full response into WConvert merely to evaluate a few predicates.

The request identifies published campaign IDs and their revision, bounded to 20 per batch. The server loads their actual published rules; it never accepts an arbitrary client-supplied rule expression, cart contents or another customer's session ID. Return matched/nonmatched/unresolved results keyed to stable rule IDs, known-empty status and the selected recommendation IDs remaining after cart exclusion. Product card information can continue through the existing public product read. Do not echo line-item custom data, addresses, coupon codes, customer IDs, cart tokens or a full basket.

The endpoint is unauthenticated for guest shopping but scoped to the same-origin request's actual WooCommerce session. Establish and test correct guest and logged-in session resolution; do not rely on a WordPress REST nonce embedded in a cached public page. No permissive CORS, arbitrary session override, cart write, or personalized response caching. Use `private, no-store` responses and document cache/CDN exclusions. Accessing draft configurations needs the separate authenticated preview path.

Reject invalid, unpublished, suspended or revision-mismatched campaign requests; a stale cached payload must not combine yesterday's content with today's changed rule definitions. Return no private draft data or internal exception details. Bound request bytes, campaign count and cart-processing work, and reuse the project's existing abuse-limiting approach without retaining basket contents. If a supported workload bound is exceeded, report context unavailable instead of evaluating a truncated cart: truncation would make negative conditions unsafe. Final limits follow measured small/large-cart fixtures in slice 1.

Only request context when an eligible page includes a published campaign needing rich cart facts or cart-aware product selection and its required storage consent permits access. No commerce requests on Free, nonstore pages with no relevant campaign, or sites without the capability. Do not store this response in localStorage or a cookie.

Keep current lightweight cookie evaluation for existing two-condition campaigns initially. Rich campaigns use one coherent snapshot for all their cart predicates, including has-items and amount; never combine a fresh product result with an older cookie total inside one decision. This is an implementation transition, not a second permanent rule-authoring format.

### Read lifecycle and freshness

Use document-memory states: idle, pending, ready, stale and unavailable. An in-flight mutation or recognized cart-change event invalidates ready data immediately. Deduplicate parallel reads and ignore older responses. A refresh calls the existing module `changed()` callback; `holds()` remains synchronous over the latest valid state.

Refresh after verified classic add/remove/update events, Blocks cart changes, page restoration and return to a visible tab. Debounce duplicate classic/Blocks notifications into one request. Resolve exact quantity/coupon event coverage in the compatibility spike; add/remove DOM events alone are insufficient. Do not monkey-patch global `fetch` or continuously poll every page.

Proposed freshness ceiling: 30 seconds. Expiry invalidates the snapshot; a campaign about to become eligible can request a refresh, but must not open using expired data. Refresh an actively visible recommendation at expiry only while it remains visible. At most one shared request in flight; cap automatic error retries to one per invalidation and expose a useful inspector reason thereafter.

When a fresh gesture such as exit intent occurs while data is pending, it is missed. A later network response must never replay that gesture. Immediate or achieved time/scroll conditions can be reconsidered on readiness if all current conditions still hold. Extend the documented runtime contract explicitly: a snapshot can be up to 30 seconds old, so do not claim perfect instantaneous cart knowledge.

When another tab changes the basket, refresh on focus/visibility restoration; use a content-free invalidation signal between WConvert tabs where possible. Do not promise immediate cross-tab synchronization from third-party pages that emit no supported signal.

### Already visible recommendations

Known cart changes remove newly in-cart recommendations and refill from the remaining ordered shortlist. The update does not count another appearance or conversion. If all suggestions disappear, show a short neutral completion message within an open overlay until the shopper dismisses it; do not create a new impression or auto-reopen. An inline block may collapse, except while focus is inside it.

Preserve focused controls until a deliberate next action or move focus predictably to the block status before removal; announce meaningful changes politely. Never abandon a partially completed capture journey because cart state changes. Such journeys are outside this first click-only experience.

On a failed refresh, remove any unverified purchase suggestion and show a neutral unavailable state for an already-open block. Do not label it out of stock unless WooCommerce actually reported that fact. Failures before opening suppress the campaign entirely.

### Compatibility spike exit criteria

Before committing to the endpoint transport, prove guest/logged-in carts, empty carts, full-page caching, session isolation, classic and Blocks quantity/removal changes, multi-tab refresh, and denied/revoked consent on a disposable real WooCommerce site. WooCommerce is not installed beside this checkout at planning time, so no such result is claimed here.

If a minimal custom read cannot safely initialize WooCommerce's session in supported environments, document the reason and evaluate a Store API integration that immediately narrows data in memory. Do not add persistent identifiers or ship an unreliable cart reader to preserve the initial proposal.

## Storage and privacy

Use existing campaign draft/published JSON for selected products, rules and amount configuration. Use current daily counters for first-release appearances/conversions. No new table, column, visitor identifier, anonymous answer archive or basket history is proposed.

Keep current session facts in document memory only. Honor the project's consent categories and revoke access/clear memory when required consent is revoked. Update the Data Map, suggested policy text and authoring guidance to accurately describe new product/cart reads; the old assertion that count and total are WConvert's only WooCommerce coupling will no longer describe rich campaigns.

Do not send product IDs, basket contents, prices or answers to external analytics by default. Existing campaign observations retain their allowlisted fields. A cart context read neither creates a Lead nor contacts a Destination.

If implementation discovers a need for a table or column, stop that storage change and obtain the explicit sign-off required by `CLAUDE.md`, with alternatives. The first-release design does not require it.

## Reporting

First release:

- Accessory campaign: appearances and **Product recommendation clicks**, with the once-per-appearance conversion definition above.
- Guidance campaign: appearances and guide-link clicks.
- Existing cart reminder: Cart return clicks, unchanged.
- Existing quiz: completed results and result-link clicks, unchanged; product availability does not create a second completion.
- No purchases, recovered revenue, item-added counts, per-product funnels or unique shoppers are inferred from these counters.

The new label must be derived from the published design contract without relabeling earlier reporting history incorrectly. Resolve that historical-label behavior with Goal/outcome reporting before shipping; a generic “Link clicks” label is preferable to a false product-specific label for mixed historical designs.

External event adapters must use the existing observation seam, respect consent, deduplicate counted acts and stay silent in previews. No public event named purchase or add_to_cart should be emitted for a product-link click.

## Later increments

### Configured cross-sells and stronger product finders

Implemented by ADR 0118: **Use WooCommerce cross-sells** is a second recommendation source. Read relationships configured by the merchant; do not infer accessory compatibility from names or categories. Union candidates in a documented stable order, deduplicate, exclude items in the basket, filter availability and display up to three. Bound the candidate workload and expose an explanation when no relationship is configured. No fallback shortlist is applied in this increment; a future fallback must be an explicit choice.

Validate a shop with many products before adding category/attribute-based quiz candidates. Preserve fixed results for small catalogs. Automatic scoring, purchase-history personalization and AI ranking remain outside this plan.

### Direct add to cart

Optional later action after product-link campaigns are validated. Begin with eligible simple products using WooCommerce's authenticated mutation requirements and actual response. Show pending, success and failure states; refresh cart context after success. Variable, grouped, external and subscription products keep appropriate product-page actions until their contracts are supported. Add-to-cart acceptance is not a purchase. Define its conversion and event semantics separately before changing the button behavior.

### Verified free shipping progress

Start with WooCommerce's built-in free-shipping method for a resolved destination and one supported shipping package. Read the applicable zone/method and minimum-order requirements, including coupon requirements and whether discounts are considered before or after the threshold.

Show “Add 15 more for free shipping” only if the supported rule can be evaluated. If already eligible, show that confirmed state. If the destination is unknown, show “Enter your delivery address to check shipping.” Multi-package, conditional third-party methods and unresolved currency/tax behavior receive guidance rather than a guessed number.

Refresh after address, coupon, quantity, shipping-method and currency changes. Never change shipping prices or issue coupons. Validate boundary totals and changes on a real checkout before enabling this template. Shipping is a distinct capability; it does not follow from subtracting today's `get_total()` from a manually typed target.

### Optional order attribution

Propose a separate opt-in WooCommerce adapter following ADR 0046: record campaign provenance on real orders through WooCommerce CRUD/HPOS-compatible APIs and read actual order amounts/statuses when reporting. Do not copy revenue into WConvert counters.

Recommended initial model: last eligible WConvert campaign click within the current WooCommerce session, capped at 24 hours; no view-through attribution. Store only bounded campaign/family/variant provenance and click time in that existing session, not contact details or a new visitor ID. This is a new behavioral storage purpose requiring explicit consent-contract review; permission for functional cart reads does not imply permission for attribution.

Record provenance once at order creation for classic and Blocks checkout and count an attributed order only once when it reaches the defined paid state. Retries, payment failures and status changes must not duplicate it. Report refunds and currency groups separately and define tax/shipping inclusion. No cross-device joining or invented currency conversion.

Before implementation, settle session expiry, consent revocation, multi-campaign selection, A/B family mapping, deleted/paused campaigns, order deletion/erasure, refunds, permission checks, large-store query performance and export labels. Explain that order totals follow retained WooCommerce records and may change with refunds or deletion. Label the result “Attributed orders/revenue,” never proven incremental or recovered sales. A holdout study is needed for causal lift.

## Implementation sequence

Each slice should be reviewable on its own; the first release requires slices 1 through 7 together. Implementation is recorded in ADR 0117 and docs/testing/cart-intelligence.md. Merchant recruitment remains separate and has not been performed.

| Slice | Deliverable | Dependency and acceptance |
| --- | --- | --- |
| 1. Runtime spike and contracts | Prove minimal session read and update events; finalize amount/variation/snapshot semantics | Real classic and Blocks fixtures; no cross-session leak; documented unsupported cases |
| 2. Rich cart conditions | Server read, rule vocabulary, validation, selectors and summaries | Slice 1; positive, negative, empty and unknown examples agree in PHP/JS |
| 3. Product campaign | Node, card reuse, selected IDs, cart exclusion and Goal compatibility | Slice 2; no unavailable or already-present suggestions; no form/conversion ambiguity |
| 4. Live lifecycle | Refresh, expiration, consent, focus behavior and visible updates | Slices 2–3; stale responses ignored; no replayed gestures or duplicate impressions |
| 5. Merchant starting points | Accessory and relevant-guidance setups, placement, preview and publish review | Prior slices; merchant can configure products without editing raw rules |
| 6. Diagnostics and reporting | Simulation, live explanations, correct click labels and external observations | Same matching contract; no preview counts or implied purchases |
| 7. Packaging and real-site validation | Free/Pro builds, imports, performance, classic/Blocks checks and documentation | All acceptance gates below pass; merchant walkthrough evidence recorded |
| 8. Cross-sell source | Existing WooCommerce relationships with bounded selection | First release validated against real catalogs |
| 9. Shipping progress | Supported core free-shipping rules and honest unknown states | Separate shipping compatibility matrix |
| 10. Attribution | Opt-in provenance and order-based reports | Separate consent/reporting contract and performance validation |

Direct add to cart and catalog-derived quiz candidates are optional follow-ups after merchant evidence, not prerequisites for slices 8–10. Estimate calendar time after slice 1 exposes actual WooCommerce integration work; avoid a fixed-date promise before that evidence.

## Code areas to review during implementation

- Registration and packaging: `pro/src/Container/ProServiceProvider.php`, `pro/src/Frontend/ProLoaderEnqueue.php`, `tiers.json`, `pro/modules/cart-recovery/` and paid loader entries.
- Display rules: `resources/rules/manifest.json`, `src/Rules/`, `resources/loader/src/display-rules.ts`, `resources/loader/src/types.ts`, `resources/admin/src/builder/rules/` and controls.
- Product rendering and authoring: `resources/loader/src/products.ts`, journey product selection, template vocabulary/manifests, renderer node types, capture/graph contracts and Goal validation. Generic helpers may remain shared; new commerce implementations must be supplied by Pro and absent from the Free loader graph.
- Setup availability: playbook library, site dependencies, catalog facets and publication readiness. Starting points ship no real product IDs or store-currency amounts.
- Portability: design export/import and pack validation must strip site-local product/category references from every new commerce node, flag required reconfiguration and prevent accidental matches where IDs coincide across sites. Design transfer does not become full campaign/rule export.
- Inspection, analytics and privacy: sample visit, live inspector, published outcome labels, event observation adapters, Data Map and policy text.

## Verification and acceptance

Use focused tests for behavior, then the required repository checks. This plan itself needs document/link review only.

### Representative scenarios

| Scenario | Expected result |
| --- | --- |
| Coffee machine present, filters absent | Compatible selected filters shown |
| Filters added through classic AJAX or Blocks | Matching card removed after verified refresh; no repeated impression |
| Another variation of a selected parent is present | Parent recommendation excluded under the documented default |
| All selected accessories unavailable | New campaign suppressed; existing quiz retains result/fallback |
| Missing, denied, stale or failed cart context | Positive and negative cart predicates do not match |
| Cart empty | No accessory campaign; generic contains-none semantics remain explicit |
| Exit occurs during pending read | No delayed exit popup when the response arrives |
| Two responses arrive in reverse order | Older result cannot replace newer cart facts |
| Consent revoked while visible | Cart reads stop and context is cleared; no stale recommendations |
| Currency differs from threshold currency | Amount predicate unresolved; no silent conversion |
| Product/category deleted after publication | Affected predicate unresolved; admin repair explanation |
| Merchant renames product/category | ID-based match remains valid |
| Shared page cache serves two shoppers | Each sees only their own session-derived eligibility |
| Pro/WooCommerce removed | Existing campaign suspended without weakened rules |
| Design imported on another store | Local product references cleared and setup required |

### Required checks

1. Unit/contract tests for rule comparisons, variations/categories, unknown states, currency precision, publication bounds and product selection.
2. Browser/runtime tests for request races, event deduplication, gesture timing, consent transitions, visible-card updates, focus and counted-once conversion.
3. Meaningful integration checks on real WordPress with classic WooCommerce and Blocks: guest and logged-in shoppers, product variations, taxes/coupons, cart mutation, page caching and endpoint failures. Include unsupported third-party cart behavior in the support notes.
4. Free-source and artifact contracts; all affected Pro build variants; current loader and payload budgets. Read caps from the current check scripts, not old ADR numbers. Measure any lazy asset separately and include it in the total feature cost. No silent budget increase.
5. PHP/static checks, TypeScript, lint and relevant existing tests. Do not interpret a passing unit suite as proof the plugin boots or cart updates work.
6. Responsive and keyboard checks for cards, RTL, long titles, price ranges, missing images and screen-reader status updates.
7. Request budget: zero new requests without relevant commerce campaigns; one deduplicated context request per batch/invalidation, bounded product reads, no background hidden-tab polling, no per-condition requests. Confirm with a network trace.

### Merchant validation

Recruit five WooCommerce merchants for an initial qualitative round, including one variable-product catalog and one larger catalog. Recruitment and external messages require a separate explicit instruction; none have been sent.

Ask each merchant to create a compatible-accessory campaign using their products, explain when it appears, test an already-present accessory, handle an unavailable product, and explain what its reported clicks do and do not prove. Record independent/assisted completion, wrong selections, misunderstanding of availability and reporting, and maintenance effort. Seek examples before adding another condition or recommendation mode.

Release blockers include incorrect basket targeting, wrong product compatibility implied by our UI, showing stale unavailable suggestions, broken host cart behavior, misleading metrics, and repeat unassisted failures in the core setup. Do not claim conversion uplift from five usability sessions.

## Documentation decisions to amend at implementation

Record a new ADR for richer commerce context and reference this plan. Amend existing decisions inline where they become false, rather than leaving contradictory headlines:

- ADR 0025: cookie-only coupling, no fetch, and assumptions around non-cart Goals.
- ADRs 0005/0104: new predicates, unknown/freshness semantics and synchronous gesture evaluation over prepared state.
- ADRs 0017/0094: document-memory cart context and updated data-flow statements; keep no visitor identifier.
- ADRs 0059/0085: product-block click conversion and publish contracts.
- ADR 0106: optional cart-aware quiz exclusions without altering completion semantics.
- ADRs 0113/0116: design portability and capability visibility where affected.
- ADR 0046 and analytics/privacy decisions only when order attribution is actually designed and implemented.
- `CONTEXT.md`, guides and runtime comments that currently describe the entire WooCommerce connection as count/total-only.

Do not amend these accepted runtime contracts merely because this proposal was written. The implementing change and its verified behavior must travel with the amendments.

## Evidence and source limits

Reviewed on 4 October 2026. Competitor documentation is evidence of advertised/documented capability, not hands-on verification or proof of WConvert customer demand.

- [OptinMonster WooCommerce integration](https://optinmonster.com/docs/how-to-integrate-optinmonster-with-woocommerce/): product-in-cart conditions and total/subtotal targeting support prioritizing richer cart rules.
- [OptiMonk cart rules](https://support.optimonk.com/en/articles/cart-rules): value/quantity comparisons and WooCommerce name-based product matching. Our proposed native ID selectors are a design inference, not a tested usability advantage.
- [RevenueHunt recommendations](https://docs.revenuehunt.com/how-to-guides/recommend-products/): deeper recommendation choices illustrate the needs of complex catalogs; platform-specific capabilities vary.
- [WooCommerce Product Recommendations](https://woocommerce.com/document/product-recommendations/store-owners-guide/): contextual selection, filters and performance reporting establish adjacent category expectations.
- [WooCommerce Cart API](https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/cart/): session cart response includes more information than this feature needs; mutation calls require nonce/cart-token handling. This plan proposes a narrower read projection and defers mutations.
- [WooCommerce Blocks DOM events](https://developer.woocommerce.com/docs/block-development/extensible-blocks/cart-and-checkout-blocks/dom-events/): documented add/remove signals are useful; complete quantity/coupon update coverage still needs a spike.
- [WooCommerce free shipping](https://woocommerce.com/document/free-shipping/): minimum spend, coupons and discount calculation affect eligibility; a generic subtraction is insufficient.
- [Baymard abandonment research](https://baymard.com/lists/cart-abandonment-rate): costs, delivery and checkout concerns support testing contextual assistance. This does not establish that a WConvert message will fix those problems.
- Repository evidence: current code listed above, `CONTEXT.md`, `tiers.json`, `docs/plans/questions-and-conditional-screens.md`, and `docs/reviews/first-time-user-test.md`.
