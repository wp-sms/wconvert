# Recommendation additions: implementation contract

Date: 5 October 2026. Status: implemented locally; see [ADR 0121](../adr/0121-recommendation-additions-count-server-accepted-cart-actions.md) and the [verification record](../testing/recommendation-additions-2026-10-05.md). The interactive prototype explores the interface separately. This supplements the [implementation plan](product-recommendations-2026-10-05.md) and does not retroactively change accepted runtime contracts.

## Decision

An addition campaign converts on its first **WooCommerce-confirmed product addition** in a mounted campaign. Clicking the button, sending a request, or finding the product in a later basket read does not by itself prove that the addition succeeded.

Use the proposed commerce-only **Increase basket value** Goal. Its measured outcome is **Basket additions**, with the explanation “Campaign appearances with at least one confirmed addition.” This is an intention and an observed shopping action, not a revenue claim.

| Action | Headline conversion | Other activity | Sales attribution |
| --- | --- | --- | --- |
| Recommendation displayed | No; existing impression behavior applies | Product views only when separately instrumented | None |
| Add button pressed / request pending | No | No confirmed addition | None |
| WooCommerce rejects request | No | Optional diagnostic, not a shopping result | None |
| Response lost / timeout | No browser-confirmed success | Unknown; do not infer from a changed total | Only if a separately verified server acceptance was recorded; never from the timeout itself |
| First confirmed addition | Once per mount | One successful quantity-one operation | Eligible only with current optional tracking/consent rules |
| Another confirmed addition in that mount | No second headline conversion | Another successful operation | A new verified interaction may replace prior attribution under the existing window |
| View product / Choose options in an addition campaign | No | Supporting link activity if instrumented | Does not masquerade as an addition; do not hook it to the old primary-click path |
| View basket after success | No | Navigation | No new credit |
| Existing product-link campaign clicked | Existing once-counted click behavior | Existing activity | Existing attribution contract |

For a lost response, the browser must show an unknown state. The implemented server-confirmed path records accepted operations even if the response is lost. The browser never counts the same addition again. The prototype conservatively counts no unknown outcome and does not pretend to settle server-side receipt delivery.

## History and compatibility

- Existing campaign action/Goal and historical counts do not change on upgrade.
- Drafts can select another action. After publication, switching between link and addition outcomes requires duplication into a new campaign, preserving the original's history.
- A/B variants must share the same converting act. Do not aggregate addition and click rates as one rate.
- Product links remain the option for variable-only campaigns. Addition campaigns need at least one eligible direct-add product; supporting variable-product links do not become a second converting act.
- A direct addition creates no Lead, contact, saved visitor profile or purchase event.
- Quiz completion remains its existing headline act. Adding cart buttons to quiz results is later work with separate secondary activity.

## Transport conclusion from the spike

The standard WooCommerce Store API is a viable starting point. In the tested WooCommerce 11.1.2 fixture, successful `POST /wc/store/v1/cart/add-item` returns **201**, not 200. Use the documented successful response contract rather than a hardcoded 200 assumption. Missing nonce returns 401; deliberately invalid nonce returns 403 before adding the requested product.

The same accepted request sent again adds another item. Native transport is **not idempotent**. Serialize WConvert operations, block repeat activation while pending and never blindly retry an ambiguous failure. Nonce rejection is different from a timeout: a verified pre-mutation rejection can refresh protection and require a fresh action; a timeout may already have changed the basket.

The spike's fresh same-session token bootstrap and test-only login are test harness code, not a reviewed production endpoint. The production bootstrap still needs same-origin enforcement, bounded requests, private/no-store caching and explicit guest/login handling. A shared page-cached nonce is not acceptable.

## Integration requirements (implemented contract in ADR 0121)

1. Derive product/action eligibility from the published campaign on the server. Do not accept arbitrary browser claims of a campaign success or amount.
2. Identify a supported WooCommerce acceptance seam for linking the validated campaign/operation to the actual mutation. Source inspection found request-data and validation seams; do not rely on WooCommerce's explicitly internal notification hook as a stable extension API.
3. Choose one authoritative count/receipt path. Browser acknowledgement must not increment a conversion already recorded by the server. If adding bounded receipts, specify atomic claim, expiry, session binding, retry and cleanup tests. Do not promise exactly-once delivery based on a JavaScript pending flag.
4. Extend the closed statistics vocabulary and Goal/outcome labels explicitly. Existing `StatKind` and aggregate rows can represent new bounded campaign activity through reviewed enum/query changes; product dimensions are now implemented in existing scoped daily counters with 90-day retention under ADR 0122. Update CSV and global totals without mixing incompatible outcomes.
5. Extend optional attribution after verified acceptance, using the current 30-minute model. No new attribution permission follows from functional cart consent. Reporting failure cannot undo or repeat the cart mutation.
6. Refresh the native cart through its supported path and invalidate recommendation context. The spike demonstrated classic fragment refresh, Blocks `receiveCart` after a Store API response, and the Blocks `addItemToCart` action. Production must select one mutation path, avoiding duplicated adds/analytics from multiple bridge events.
7. Prove unsupported-options detection: a simple product may still require extension-owned fields. Keep those products on their product page until an adapter supports them.

See the [spike verification](../testing/recommendations-spike-2026-10-05.md) for the distinction between completed checks and remaining integration gates. Amend domain ADRs and `CONTEXT.md` alongside the actual implementation, not as if this prototype had shipped.
