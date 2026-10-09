# Questions and results: the smallest useful system

Proposed direction, 2026-09-24. Complements the
[implementation plan](questions-and-conditional-screens.md). Production contracts and
ADRs remain unchanged until implementation. The runnable exploration is documented
in [prototype notes](../../tools/design-system/editor-prototype/journey-prototype/NOTES.md).

## Recommendation in plain terms

Use JSON to describe the experience, a few shared functions to decide what happens,
and small feature modules to do specialist work. Keep our current screen editor and
module packaging. A new workflow platform, generic integration framework, or global
question library would add complexity before we have evidence that it is needed.

For example: JSON says “ask how they brew coffee; show this follow-up for filter
coffee; show these selected products for this result.” Shared code reads those
instructions. WooCommerce code supplies the current product names, prices, and
availability. The template never contains executable functions or a saved copy of
the store's live catalog.

## What to share

Keep these as a small, cohesive question/rule module, rather than a general `utils`
folder. The following names describe responsibilities, not final public APIs:

| Small function or responsibility | Plain-language job | Reused by |
| --- | --- | --- |
| `matches(condition, answers)` | Does this earlier answer satisfy this rule? | Screen visibility and result selection |
| `resolvePath(screens, answers)` | Keep relevant answers and find the next applicable screens, in order | Visitor navigation, preview, validation |
| `chooseResult(variants, answers)` | Choose the first matching result, or Everyone else | Content and product quizzes |
| Definition/reference validation | Check stable IDs, earlier-question references, valid choices and required fallback | Editor feedback, publish, template installation |

Stable question IDs and choice values make renaming safe. Blank answers never match
negative rules. A single ordered pass can clear hidden answers and any later answers
that depend on them; forward-only references make this straightforward. There is no
need for a graph engine or nested expressions.

The browser and PHP cannot literally import the same function. Give them the same
bounded contract and shared example fixtures to verify matching behavior. Browser
checks make the experience fast; PHP validates the submitted answers against the
published campaign and recomputes the path before saving.

Keep the existing capture lifecycle responsible for submissions, accepted values,
consent, retries, and handoff. Question helpers return decisions; they do not save
leads, send messages, make product requests, or count conversions.

## What belongs in JSON

- Question labels, help, stable IDs, answer types, choices, and required flags.
- Screen visibility predicates and ordered result predicates.
- Result copy and visual settings, plus explicit selected product IDs in a saved
  campaign. Starter templates leave product selections empty and guide setup.
- Fallback copy/link for products that cannot be displayed.

Extend the existing closed manifest/type/validator vocabulary with explicit supported
data. For WooCommerce, prefer a clearly named product block such as
`woocommerce_products` over a generic `provider` + arbitrary endpoint + callback
scheme. The exact field name should follow the existing renderer vocabulary when
implemented. Template authors select supported capabilities; they do not write code.

Derive feature usage from known nodes and conditions where possible. Use the existing
Pro module and tier manifests to package code. Do not add a second integration
registry or duplicate capability flags inside every template. A missing required
capability must fail visibly; ignoring a condition would change the campaign's meaning.

Capture-first and result-first are useful product concepts. Avoid storing a second
journey-mode flag if the validated completion/submission structure already determines
it. The prototype's `capture` flag is a convenience, not a database proposal.

## WooCommerce: one focused adapter

Add a WooCommerce product module with two explicit entry points:

1. Admin search/selection, with the existing authenticated capability checks.
2. Visitor `loadProducts(selectedIds, requestContext)`, using the public same-origin
   Store API and returning a small normalized product-card payload.

The interface should make loading, ready, empty, and unavailable states explicit.
Keep request cancellation, ordering, visibility/stock filtering, price formatting,
and error handling here. A result renderer displays the returned data and fallback;
it does not know WooCommerce's full API response shape. Runtime reads happen when
results are reached, not for every answer change.

Result rules choose the recommendation. Product availability determines which cards
can be displayed. Do not quietly pick another quiz category because stock ran out.
Store no catalog copy, credentials, or arbitrary remote URLs in the template. Do not
build a cross-platform commerce adapter until a second real integration needs one.

WooCommerce product reads are also different from Destinations that receive Leads.
Keep those responsibilities separate; neither needs to masquerade as the other.

## Wheels and scratch cards later

They can reuse layout, screen navigation, result presentation, explicit capture,
consent, and reporting infrastructure. A wheel and scratch card may eventually share
a reward allocator because both reveal a prize. That does not make reward allocation
the same operation as loading products or choosing a quiz result.

When rewards are actually commissioned, add a focused server-side operation such as
`allocateReward(campaign, participationReceipt)`. It owns eligibility, limits, weighted
selection, claim evidence, and retry safety. The browser animates/reveals the server's
decision. JSON can describe segments, prize references, and appearance, but must not
expose secret redeemable codes or let visitors choose their own prizes.

Do not build that allocator now, invent wheel database tables, or generalize today's
question module around hypothetical prizes. No new storage is proposed for this phase.

## UX decisions from the exploration

**Layout B is selected by the user:** a compact vertical screen rail beside a
settings pane. A and C have been retired. Keep selected-screen context and actions
visible while settings scroll; on narrow widths use a screen selector above
full-width settings. Ship this one editing model, with the existing design inspector
for visual/question edits. The detailed UX contract and scenario matrix live in the
[implementation plan](questions-and-conditional-screens.md#selected-layout-b-screens-beside-settings).

- Question text and choices belong in the canvas inspector. Visibility belongs in
  Manage screens. Both use the same stable question definitions.
- Start with Always. Reveal condition inputs only when requested; reveal All/Any
  only for multiple clauses. Keep ordinary email/SMS journeys unchanged.
- Keep clickable question dependencies and preview-to-condition navigation. Use
  stable screen IDs for selection through reorder/undo.
- Use an explicit Continue button, useful Back behavior, and native choice controls.
- Show all matching normal screens in order, but one result. Make result priority
  editable, keep Everyone else last, and explain which result wins.
- Add Test journey with answers and skipped-screen explanations. This is more useful
  initially than a graph builder. Production preview must not send beacons or captures.
- Default to immediate results with optional signup. Changing to required email is
  one undoable draft action that updates capture placement, result access, and the
  goal/metric explanation. Existing published reporting must retain its original meaning.
- Explain an email gate before the first question. Email collection is not automatic
  marketing permission. Accepted capture details remain fixed when reviewing earlier screens.

For overlap checking, begin with duplicate rules and straightforward contradictions.
Do not add a general satisfiability solver. First-match ordering, an explicit fallback,
and path preview make the remaining behavior inspectable. Add smarter analysis only
when real campaigns demonstrate a need.

## Scenarios that define the system

| Scenario | Decision |
| --- | --- |
| Garden vs balcony enquiry | Only garden visitors answer garden size; both reach contact capture |
| Visitor changes garden to balcony | Remove unsaved size and dependent answers immediately |
| Two selected interests | Show both relevant follow-ups; select one explicitly prioritized result |
| Optional choice left blank | Continue; it matches no condition, including “is not” |
| Quiz completed without signup | Keep answers in page memory; aggregate completion/clicks only |
| Optional signup submitted | Save one Lead with active answers; do not count a second goal conversion |
| Required-email quiz | Explain the gate first; accepted capture is the primary conversion |
| Selected product disappears | Keep the result; show remaining eligible products or its useful fallback |
| WooCommerce becomes unavailable | Existing product results show fallback; new product publication is blocked |
| Referenced question removed | Identify dependencies and require repair; never silently change rules |
| Old email + optional SMS journey | Remains usable without any question/condition configuration |

## Build order

Implement one complete service enquiry first: question → condition → capture → Lead
answer display/export. This validates the shared contract and actual storage readers.
Then add anonymous results and optional capture, followed by the WooCommerce adapter
and editable starters. These are delivery slices within the agreed first release;
live WooCommerce remains in scope. Validate them on real WordPress/WooCommerce before
shipping. Keep reward allocation and generic provider field mapping out of this work.
