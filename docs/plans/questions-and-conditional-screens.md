# Shared questions, conditional screens, and product quizzes

Implementation plan · 2026-09-24 · Implemented on the `codex/plan-questions-conditional-screens` branch.

The [system design recommendation](questions-system-design.md) explains the minimal
shared helpers, JSON boundary, WooCommerce adapter, and future reward boundary.
The [runnable Manage screens prototype](../../tools/design-system/editor-prototype/journey-prototype/NOTES.md)
uses the user-selected layout B with four editable examples, including both coffee
result-access modes. B places screen previews on the left and selected-screen
settings on the right; A and C have been retired from the prototype.

## Direction

Extend the existing Campaign editor with questions, answer-based screen visibility,
and a Results screen. Keep the ordered screen manager and existing display formats.
Merchants should be able to build a relevant enquiry form or a short product finder
without learning a flowchart tool.

Confirmed by the user in this planning conversation:

- Layout B is the chosen Manage screens direction: screens beside settings.
- Visitors can complete quizzes without email or phone.
- The first release includes live WooCommerce product results.
- All new capabilities are Pro-only. Recommended interpretation: all paid tiers,
  currently displayed as Pro; preserve existing Free linear journeys and interest field.
- Support both required capture before results and immediate results with optional
  signup; immediate results are the product-finder default.
- Forget individual answers when a visitor leaves without submitting contact details;
  keep aggregate completion and result-click counts.

The remaining details below record the implementation direction and release
checks. No new table or column was added. The active contracts and ADRs were
amended alongside the code.

## The needs to serve

| User | Job | First-release experience |
| --- | --- | --- |
| Service business | Receive an enquiry with relevant details | Ask service type, show a relevant follow-up, then capture contact details once |
| Store owner | Help a shopper choose | Ask a few preferences, select a result, display current WooCommerce products |
| Publisher | Offer relevant content and optional updates | Ask interests, show a recommended guide, offer a separate signup |
| Merchant editing a journey | Understand what each visitor sees | Read conditions on screen cards and test answers in preview |
| Visitor | Avoid irrelevant questions and unexpected signup gates | Clear opening explanation, relevant questions, Back, and clearly optional steps |

These are product hypotheses grounded in existing WConvert use cases and competitor
capabilities, not findings from WConvert customer interviews. Validate with five
merchant walkthroughs spanning stores, service businesses, and publishers before
polishing the full editor.

## Evidence and what to borrow

Primary documentation checked on 2026-09-24:

- [Klaviyo fields](https://help.klaviyo.com/hc/en-us/articles/4413550187035)
  distinguishes single choice, multiple choice, and dropdowns, and separates visible
  labels from stored values. Borrow predictable question controls and stable values;
  WConvert still records captures rather than maintaining Contact profiles.
- [Typeform question display logic](https://help.typeform.com/hc/en-us/articles/52729314845332-Use-logic-to-hide-questions-based-on-previous-answers-or-URL-parameters)
  skips irrelevant questions and recommends previewing the rules. Borrow the next
  relevant screen behavior and path testing.
- [Typeform Logic Map](https://help.typeform.com/hc/en-us/articles/360057591531-Logic-Map)
  visualizes paths and identifies errors. Borrow visible dependencies and actionable
  errors; a graph editor is unnecessary for our bounded first release.
- [Tally conditional logic](https://tally.so/help/conditional-form-logic)
  supports all/any conditions, page jumps, visibility, and conditional endings.
  Borrow sentence-shaped conditions and explicit Next navigation. Start with one
  flat condition group per screen rather than nested groups and arbitrary jumps.
- [RevenueHunt recommendation setup](https://docs.revenuehunt.com/how-to-guides/set-up-recommendations/)
  documents both product voting and merchant-selected outcomes. Start with explicit
  result rules and selected products: easier to explain for a short quiz. Voting and
  scoring become candidates if merchants cannot express real use cases within this model.
- [W3C multi-page forms](https://www.w3.org/WAI/tutorials/forms/multi-page/)
  recommends logical stages, recognizable optional steps, and understandable progress.
  Apply this within the campaign without changing the host page title.
- [GOV.UK radios](https://design-system.service.gov.uk/components/radios/)
  recommends clear selection instructions, no preselected answers, and fieldset/legend
  semantics. Use native controls even when choices look like selectable cards.
- [WooCommerce Products API](https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/products)
  exposes public product information, supports fetching selected IDs, and supplies
  stock, prices, and visibility information. Use its public read path for current
  product cards instead of putting credentials or a full catalog into the campaign.

Competitor availability establishes relevance, not a guaranteed conversion increase.

## Recommended release boundary

Ship together:

1. Questions: single choice, multiple choice, short text. Yes/No is a single-choice preset.
2. Conditional question/offer screens based on earlier choice answers.
3. A Results screen with merchant-written variants and one required fallback.
4. Anonymous quiz completion, with no Lead unless contact details are explicitly submitted.
5. WooCommerce product cards selected per result variant.
6. Existing capture journeys with questions; optional signup for result-first quizzes.
7. Path preview, validation, answer inspection/export, and honest reporting.

Defer numerical scoring, personality scoring, AI recommendations, catalog-wide ranking,
arbitrary jumps/loops, conditions on individual blocks, anonymous response archives,
file uploads, matrix questions, payment collection, and cross-visit answer memory.
Do not promise emailed results until a Destination actually implements that delivery.

Proposed initial bounds, to verify with representative designs and payload measurements:

- Keep the existing seven-screen ceiling, including result/capture/acknowledgement screens.
- Up to ten questions per Campaign and twelve choices per choice question.
- Up to five clauses in one all/any group per conditional screen or result variant.
- Up to five conditional result variants plus one fallback; show one variant per completion.
- Up to three displayed products per variant, chosen from an ordered shortlist of at most six.
- Plain short text up to 500 characters; question labels up to 200 and option labels up to 120.

These are usability and performance starting points, not researched universal limits.
If the three starter journeys cannot fit comfortably, revisit the bounds with measurements.

## Merchant experience

### Selected layout B: screens beside settings

The user selected B after reviewing the runnable alternatives. Treat this as the
chosen product direction, not a claim that merchant usability has been validated.
Keep one manager layout; do not ship an A/B/C appearance preference.

Desktop layout:

- Left: compact real screen previews, authored order, names, and condition/completion
  summaries. Show the number of screens against the seven-screen limit. The list
  scrolls independently and brings the selected card into view.
- Right: the selected screen's name, type, and position remain visible above its
  scrolling settings. Keep **Screen actions** and **Edit design** available below
  those settings. Hide the visual editor behind one purposeful **Edit design** action.
- Keep Test journey in the manager header, and Undo/Done in its footer. Done closes
  the manager; changes belong to the existing campaign draft. It never publishes.
- Insert new questions after the selected screen when valid, or immediately before
  the capture/result boundary. Select the inserted screen and explain any constrained
  placement; show the screen limit before it becomes a surprise.
- Put duplicate, move earlier/later, and delete in a labeled Screen actions menu.
  Dragging remains an enhancement; all ordering changes have a keyboard alternative.
- Show clickable **Used by** links for questions that control later screens/results.
  Allow preview's **Edit condition** link to select that screen in the manager.
  Keep source definitions shared; these are navigation links, not copied questions.
- Ordinary email/SMS journeys show their capture behavior without empty condition
  controls. Optional question, conditional screen, and optional signup are separate
  concepts and must have distinct labels.

On narrow screens and at browser zoom, replace the rail with a labeled screen
selector and give settings the full width. Preserve the same actions and selection;
avoid squeezing two columns or introducing a second editing workflow. Test at
320/390 px, tablet widths, and 200% zoom. Product/result lists wrap; names and condition
summaries may wrap and remain readable without relying on hover tooltips.

Keep selection by stable screen ID, not array position. Moving, undoing, duplicating,
or changing result access must leave the right screen selected. Return from design
editing to that screen. Production preview should retain answers when returning to
unchanged settings; a material question/rule/order edit resets the test with a clear
notice. The throwaway runner currently restarts when preview is reopened.

Validation should guide repair: mark affected cards, show a concise problem summary,
and link each problem to its screen/field. Permit unfinished drafts; block publication
and explain why. For the initial prototype, invalid definitions disable Test journey;
production should pair this with an actionable error link, not a disabled button alone.
Do not interrupt routine text edits with confirmation dialogs. Group a field edit as
one undo action and structural changes as one action each. Renaming should never
require repairing a rule.

Use the existing dialog primitives. Initial focus belongs on the manager heading,
Tab stays within the dialog, Escape closes it, and closing restores focus to its
invoking control or the design inspector when that is the next task. Ensure new
content and actionable errors are announced without announcing every keystroke.
These requirements follow the [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
Clickable issue-to-editor navigation also borrows the useful repair behavior from
[Typeform's Logic Map](https://help.typeform.com/hc/en-us/articles/360057591531-Logic-Map),
without adding a graph editor.

### Adding a question

Use the existing canvas and element inspector. Add **Question** beside existing contact
fields; distinguish it from Email, Phone, and Name. Questions default to optional;
starter designs can require a question when it is essential to a useful result.

The inspector shows, in order:

1. Question text and optional help text.
2. Answer type: Choose one / Choose several / Short answer.
3. Choices, when relevant: label-first rows with add, remove, and reorder.
4. Required answer; for multiple choice, optional maximum selections.
5. Appearance: list or cards; dropdown for single choice where space matters.
6. Collapsed **Data and integrations**: stable answer key and actual sending support.

Generate stable question and choice identities. Editing text never changes identities.
Do not make merchants invent machine keys before they can ask a question. Duplicate
creates a new question identity; it does not secretly share answers with the original.
No global question library in v1: shared means one model across features, not shared
mutable questions across Campaigns.

### Showing a screen conditionally

Use the selected **B** layout in **Manage screens**: a vertical list of visual screen
cards beside one settings pane. On selecting a question or offer screen,
add **Show this screen** with **Always** (default) or **When answers match**.

Example:

```text
Screen: Running experience

Show this screen: When answers match
Match: All conditions

[Main activity] [is] [Running]

+ Add condition

Shown when Main activity is Running.
Otherwise visitors continue to the next relevant screen.
```

The picker lists eligible earlier choice questions using their text and screen names.
Offer only operators appropriate to the type. Reveal all/any only after a second
clause is added. Show a short condition summary on the screen card and a **Used by**
list on questions referenced elsewhere. Keep display targeting under Display; answer
conditions belong under Design / Manage screens.

Deleting a referenced question or option names the affected screens/results and
requires an explicit repair or removal choice. Never silently turn a conditional
screen into Always. Reordering across a dependency is blocked with an explanation
and a link to the affected screen. Renaming, duplication, deletion, and repairs are
single undoable draft actions. Drafts may be incomplete; publication may not.

### Results and WooCommerce products

Add one **Results** screen to a quiz. In its settings show ordered result variants,
each with **Show when**, editable content, and optional **Products**. The first
matching variant wins; a final **Everyone else** fallback is always present.
Warn about detected duplicate/overlapping rules and explain the ordering; v1 does
not promise exhaustive shadowing detection. Do not present
several matching variants as multiple consecutive thank-you screens.

The product picker searches the local WooCommerce catalog and shows image, name,
price, and availability. Merchants select and order a shortlist. The visitor sees
up to three currently eligible products and **View product** links. Product data
is owned by WooCommerce, so the campaign edits the selection and card style, not
the product's price or title. Start with simple products and variable parent products;
variation selection happens on the product page. No add-to-cart or checkout mutation.

The result settings also provide a required fallback message/link for no available
products and for product-loading failure. Result selection and stock filtering are
separate: unavailable stock must not silently change a shopper's quiz category.

### Testing a path

Add **Test journey** beside the existing preview controls. Preview uses the same
question rendering and condition evaluator as the visitor runtime.

- Answer naturally and move Next/Back; preview never captures or counts.
- Show a compact path summary: included screens and skipped screens with reasons.
- Link a skipped screen back to its condition editor.
- Test the fallback result and WooCommerce empty/error states explicitly.
- Reset preview answers separately from changing the draft.

Ship three editable setups: service enquiry, product finder, and content guide.
The product finder can be completed without contact details. Do not bundle store
product IDs; require merchants to select their own products before publication.

## Visitor behavior and accessibility

Use one main question per screen in starters; allow related short questions together.
Choices are never preselected. Use real radio/checkbox controls with visible labels,
keyboard operation, group legends, error associations, and adequate touch targets.
Default to an explicit **Continue** button; selecting an answer must not unexpectedly
change the screen. Optional questions have a clear way to continue without an answer.

Back returns to the previous relevant visited screen. Preserve unsaved answers while
they remain relevant. If an earlier edit hides a later screen, clear its unsaved
answers and dependent answers transitively; they must not be sent or affect results.
If the visitor returns to that branch later, it starts unanswered. Already accepted
capture values remain fixed, following the existing journey contract.

Use named stages such as **Your needs → Contact details → Result**, with contact
omitted where absent. Do not promise an exact remaining question count before the
branch is known. Focus each new screen heading; focus an invalid answer on validation.
Announce product loading and failure politely. Test keyboard, screen readers, 200%
zoom, RTL, reduced motion, and narrow/mobile layouts in every supported container.

If a result requires contact details, disclose that before the first question. An
optional signup must not withhold an already-earned result. Capturing a request and
joining a marketing list remain different purposes with their existing consent rules.
A required-email result with no marketing permission must not enter a marketing
Destination; capture it locally or hand it only to a Destination explicitly authorized
for that purpose. The gate does not promise an emailed result.

## Journey contract: two experiences, one question engine

Current code only permits a multi-screen journey when it has submissions. Therefore,
anonymous quizzes are a real contract expansion, not a hidden variation of a Lead.

Recommended journey experiences (derive these from the validated structure where
possible, rather than adding a redundant persisted mode flag):

- **Capture journey:** existing primary capture, optional other-channel signup, and
  acknowledgement. Conditional questions collect answers for their owning submission.
  Required contact and consent screens cannot be conditionally skipped. A quiz-style
  result can replace the generic final acknowledgement content after capture.
- **Result journey:** questions lead to a result without requiring a submission. It
  may end there or offer one optional signup after results. That optional signup
  creates the first Lead only if submitted; a following acknowledgement confirms it
  and keeps the result accessible. No second-channel signup in this mode in v1.

A Results screen is an explicit completion boundary, distinct from capture. Add a
bounded completion action such as **See my result**; completion occurs only after
validating all relevant answers and displaying the resolved result. Merely opening
a preview/result design or navigating Back does not complete again.

For result-first signup, questions become fixed when the visitor chooses to submit
them with contact details. Before submission they can go Back and revise the quiz.
Any changed result replaces the unsaved result; old branch answers do not survive.
Optional signup can be skipped or closed without creating a Lead.

Make the goal consequence explicit in creation and editing: a capture-first setup
uses the appropriate existing capture Goal; a result-first setup uses the proposed
match Goal. Changing between them previews the Goal and headline metric change in
one reviewable draft action. Preserve existing published-history rules; do not
relabel old results because a merchant changes the gate.

## Question and condition model

Keep canonical contact fields intact. Add a separate typed Question node with a
stable ID, label, help text, answer type, required flag, and stable choice values.
This avoids pretending ten unrelated questions are ten copies of `interest`.
The existing Free interest field remains supported; Pro can reference it through
an adapter to the same choice evaluator.

Conditions reference stable question IDs and option values, never labels or screen
positions. A condition can only depend on a choice question on an earlier screen.
Use the same small predicate format for screen visibility and result selection:

```json
{
  "match": "all",
  "clauses": [
    { "question": "main_activity", "operator": "is", "values": ["running"] }
  ]
}
```

- Single choice: is / is not, with one option.
- Multiple choice: includes any / includes none, with a bounded option list.
- Missing, skipped, and unanswered source questions make every clause false,
  including negative comparisons. Blank must not accidentally mean “No.”
- Short text is collectable but not a condition source in v1.
- All matching normal screens appear in authored order. Results are exclusive and
  use first match plus fallback. No jumps to screen IDs and no loops.
- First screen, required submission screens, and completion boundary remain reachable.
  Keep identity and consent on unconditional submission screens initially; ordinary
  conditional questions must precede the submission that owns them.

Validate references, order, option identities, limits, submission ownership, and
fallbacks on publish and pack installation. Start with straightforward contradiction
and duplicate-rule checks; do not build a general satisfiability solver or enumerate
every multi-select combination. Detected impossible conditions block; detected
overlaps warn. Explain that multiple results can match, the first wins, and preview
is how merchants inspect priority. More advanced analysis needs demonstrated demand.

Both browser and PHP need the same semantics, with shared conformance fixtures.
The server recomputes the active path from published definitions and validated
answers. It never trusts a browser list of “visible screens,” result IDs, labels,
or a skipped-required-field claim. Drop out-of-path answers before persistence.
For optional follow-up captures, accepted earlier answers come from stored evidence,
not resubmitted editable browser values. Reuse current fingerprint/retry behavior.

## Storage, handoff, and reporting

### Anonymous completion — confirmed behavior

Answers live only in page memory until explicit capture. No anonymous response row, visitor identity,
answer cookie, localStorage history, or per-person profile. Existing campaign
frequency state can still remember completion according to existing consent rules.
Completion/result-click beacons contain bounded campaign/event metadata, not answers.
Product-ID reads can expose which products were requested to normal server logs;
describe visit-only answers precisely, without claiming that no inferred information
ever reaches the store. Do not put answers or contact details into URLs.

An anonymous response archive is outside the agreed scope. Any future proposal for
one must define retention, deletion, authorization, and storage explicitly; anonymous
records must not be disguised as Leads.

### Explicit capture

Use the existing `wconvert_leads.fields` JSON envelope, adding a typed
`question_answers` collection alongside existing canonical `answers` and internal
capture metadata. Snapshot question ID/text/type, selected values and labels, and
submission ownership from the published form at acceptance. No table/column change.
Keep multi-select answers as lists; do not flatten them into ambiguous comma strings.

Current `Lead::fromRow()` deliberately drops non-string canonical fields. Introduce
a typed question-answer property and update readers; simply writing arrays into
`answers` would silently lose them. Update frozen submission snapshots and handoff
payloads together. Question answers never imply marketing consent.

Show a readable **Answers** section in Lead details. Preserve the existing streamed
Lead CSV shape and append a readable answer-summary column. Add a separate streamed
**Question answers CSV** with fixed columns (Lead, Campaign, submission, question ID,
question text, choice value, choice label, text answer), one selected choice per row.
This avoids scanning all retained leads to discover dynamic columns. Apply formula
escaping, privacy export, erasure, and retention to every answer representation.

### Integrations

Local capture/export and provider field support are separate release promises.
Current `CanonicalFields` supports email, phone, name, and interest; this checkout
does not contain a general-purpose outbound question mapping implementation.

V1 must show exactly which answers stay in WConvert and which a configured Destination
can receive. Keep existing canonical handoff working. Do not silently serialize new
answers into unrelated provider fields. Add a typed answer collection to the internal
handoff contract; a Destination must explicitly declare support before receiving it.
Generic ESP custom-field mapping is a separately estimated follow-up, not assumed
available. Do not market downstream preference segmentation until that mapping ships.

### Counting

Recommend a new Pro Goal, **Help visitors find a match**, whose single converting act
is quiz completion. Existing capture Goals still convert on the first accepted capture.
An optional signup on a result journey creates a Lead and a capture count but not a
second Campaign Conversion. This explicitly extends the earlier “every Lead is a
Conversion” wording; analytics must distinguish captures from the Campaign's goal act.

Reuse the existing statistics table with bounded new kinds/scopes if its current
schema supports them. No database column is proposed. Report quiz completions,
captured submissions, and result-link clicks separately. Reuse screen progress but
never label a conditionally skipped screen as abandonment. Count completion once per
mounted journey; Back/review must not inflate it. Aggregate beacons are best-effort,
not verified people, orders, revenue, or exact path funnels. No per-answer statistics
or product-ID dimensions in v1. Update dashboard totals, monthly targets, Goal reports,
and A/B labels so quiz conversions are never mislabeled as leads or offer clicks.

Recording quiz completion must not close the mounted result or suppress its optional
signup. Frequency/conversion suppression governs subsequent appearances; it must not
cut off the current visitor's remaining actions. Use the same first-completion flag
for result review and re-entry within that mounted journey.

## Live WooCommerce product behavior

The merchant picker uses an authenticated, capability-checked admin read via WooCommerce
APIs. Store only chosen product IDs and presentation settings in the Campaign.
Published quiz markup remains cacheable; resolve current public product cards after
the visitor completes the relevant path, using the same-origin Store Products API.
Do not fetch on every answer change. A request sends product IDs, not raw answers.

WooCommerce supports include filtering and provides price/stock data. Explicitly
exclude hidden, password-protected, unavailable, and non-purchasable products; do
not assume published means suitable to recommend. Preserve merchant shortlist order,
deduplicate, and show fewer cards if fewer qualify. Render structured data safely.

Request once per result entry and refresh on a deliberate re-entry, with cancellation
of obsolete requests. Respect locale/currency/tax context; avoid cross-visitor response
caching in WConvert. Require sensible host REST cache behavior and test stale-cache
cases. “Live” means retrieved when displayed, not inventory reservation. Checkout
remains authoritative. Support a price-hidden configuration for incompatible pricing
extensions; document the tested WooCommerce version range.

Show a contained loading state, then products or a useful fallback with Retry and the
merchant's shop/category link. Never show a blank result or claim unavailable products
are in stock. If WooCommerce disappears after publication, show the authored fallback;
block newly publishing product setups until the dependency is restored.

## How this fits the repository

| Existing area | Planned change |
| --- | --- |
| `resources/templates/manifest.json`, renderer types/vocabulary | Declare bounded question, condition, result, and product data contracts |
| `CaptureJourney`, `TemplateForm`, `ConvertingAct`, Goal contracts | Support result journeys and path-aware capture without inventing Leads |
| `JourneyEditor`, screen cards, question inspector | Add visibility, dependencies, result variants, and path preview |
| `resources/loader/src/journey.ts`, Pro loader composition | Reuse navigation/capture lifecycle through explicit extension seams |
| `CaptureForm`, `JourneyCapture`, Lead readers | Validate active answers; persist typed snapshots only on explicit capture |
| Lead details/CSV/privacy/Destinations | Surface answers safely and state actual provider support |
| Stats/Beacon/Goals/reporting | Distinguish completion, capture, and result clicks |
| Pro modules/tier manifest | Register question/condition/result capability and WooCommerce product capability in paid builds |
| Template packs/design transfer | Validate premium capability, preserve stable references, preview lost questions/conditions before replacement |

This is not configuration-only work. Free can retain passive data/structural knowledge
needed to preserve drafts, but executable premium rendering, condition evaluation,
quiz authoring, and product fetching belong in Pro module trees. Free must never run
a degraded quiz with conditions silently ignored. On Pro deactivation, suppress
dependent campaigns, retain drafts/history, and explain the missing capability.
An active page whose capture becomes unavailable must show an honest retry/unavailable
state; it must not claim a save succeeded. Existing Free journeys continue to work.

Measure base and premium loader changes and conditional assets explicitly. At planning
time the documented caps were Free 14,012 B, Basic 20,480 B, Pro 20,608 B, Elite
20,784 B gzip. [ADR 0106](../adr/0106-question-journeys-extend-the-paid-loader.md)
records the measured paid-budget amendment; Free remains 14,012 B. Phone keeps its
separate 16 KiB cap, and design/page caps remain 1,280/2,560 B gzip. Validate
with divergent question-heavy fixtures and the CI Node version. Any asset split
needs failure behavior and combined page-cost reporting.

## Scenario decisions and release checks

| Need or edge case | Planned behavior | Evidence before release |
| --- | --- | --- |
| Merchant revisits a long result editor | Screen identity and Edit design remain visible while settings scroll | Desktop and narrow-layout walkthroughs, long names, seven screens |
| Merchant changes an answer's wording | Conditions still reference the same choice; accepted Lead snapshots keep the old wording | Rename, capture, rename again, inspect old and new Leads |
| Merchant duplicates a conditional question | Create new question/choice identities and preserve valid earlier-source conditions; do not retarget existing dependants | Duplicate, undo, move and delete with referenced results |
| Merchant removes a referenced choice or changes question type | Explain affected screens/results and require explicit repair; do not silently drop conditions | Repair from a Used by link, then publish validation |
| Several interests match | Show all relevant follow-ups in order, then exactly one prioritized result | Two matching paths and result-order change; fallback remains last |
| Visitor edits earlier answers | Clear newly hidden answers and their dependants; Back visits the relevant path | Change a choice, revisit the original branch, submit and inspect stored answers |
| Visitor declines contact collection | Results remain usable; no Lead or individual answer record | Result-first completion, skip optional signup, close, revisit |
| Store requires email before results | Gate is disclosed before questions; accepted capture is a request and the result converts once; marketing remains a separate purpose | Submit without marketing permission and verify Destination behavior |
| Results contain no configured products | Allow saving the draft; block publishing a product setup until selection and fallback are configured | Empty starter, removed selection, unavailable catalog picker |
| Some selected products are unavailable | Preserve shortlist order; show remaining eligible items; use fallback only if none can render | Partial stock loss, all unavailable, price change, API error, retry |
| Editing requires changing result access | Update structure and goal in one undoable draft operation; keep compatible design/content edits | Toggle both directions, undo, verify retained copy and historical reporting |
| Lead accepted but provider fails | Acknowledge capture honestly, use existing sending diagnostics/retry; no duplicate capture or quiz conversion | Provider failure, repeated submit, expired continuation |
| WooCommerce or Pro disappears | Use product fallback for missing Woo; suppress campaigns requiring unavailable Pro capabilities | Published page and open-journey dependency removal |
| Keyboard, touch, zoom, long copy or RTL | Every action remains reachable; selection/focus is visible; order meaning is unchanged | Keyboard-only and screen-reader walkthroughs, 200% zoom, RTL, narrow layouts |

Keep these distinctions in reporting copy: a Lead is an accepted capture record;
a quiz completion is the result journey's goal act; product clicks are clicks, not
orders or revenue. Anonymous aggregation does not promise exact unique visitors.

## Delivery slices and acceptance

| Slice | Deliverable | Acceptance evidence |
| --- | --- | --- |
| 1. Contract and UX | Validate three starter journeys and question/result editor against confirmed scope | Merchant walkthroughs; executable PHP/TS rule fixtures; measured technical spike |
| 2. Questions end to end | Pro questions in ordinary capture journeys, Lead display/export/privacy | Single/multi/text captures survive retry and publication changes; no answer lost by scalar readers |
| 3. Conditional screens | Editor rules, path navigation, dependency repair, server checks, preview | Back/answer changes clear excluded answers; skipped required questions do not block; forged hidden answers never save |
| 4. Result journeys | Anonymous completion, result variants/fallback, optional capture, Goal/reporting | No-contact completion creates no Lead; optional signup creates exactly one; conversion is counted once |
| 5. WooCommerce results | Merchant picker, public product reads, product cards/fallbacks | Price/stock changes, variable parents, empty catalog, password protection, API failure, and WooCommerce removal |
| 6. Release readiness | Starters, packs, tier behavior, live-page QA, docs, budgets | Free/paid artifact checks; real WordPress and WooCommerce; keyboard/mobile/RTL/screen-reader verification |

Required failure scenarios include unresolved conditions, missing/deleted options,
cyclic references, overlapping results, optional blanks, all questions skipped,
changing an upstream answer after Back, removing a screen with dependants, optional
signup skipped, repeated POSTs, expired continuation, cached old contracts, provider
failure after accepted capture, Pro removal, and inaccessible product APIs.

Performance checks include time to usable first question, result loading, layout
shift, and total bytes on pages with/without quizzes, products, and phone fields.
Keep questions usable on slow mobile connections. Run existing linear journey,
content-lock, and reopen regressions; do not enable anonymous completion as a way
to unlock content intended to require capture.

Success measures: merchants can build and explain a two-branch journey without help;
visitors can revise an answer without stale data; results always provide a next step;
captures retain useful answers; analytics use honest labels. Compare starter variants
with existing forms through ordinary A/B tests rather than promising a universal lift.

## Decisions recorded during implementation

The accepted product direction required new contracts. Implementation updated
`CONTEXT.md`, added an amending ADR, and placed inline amendment links beside
superseded statements in the affected ADRs:

- ADR 0076: one canonical interest choice expands to typed Campaign questions.
- ADR 0103: linear capture-only journeys gain conditional screens and result journeys;
  optional result-first capture differs from the existing required-primary contract.
- ADRs 0059/0085 and Conversion/Lead glossary: quiz completion is a new converting act;
  an optional capture after that act must not count another Campaign Conversion.
- ADRs 0010/0061/0082: new bounded vocabulary, references, and pack/transfer validation.
- ADRs 0015/0028: preserve premium code ownership through explicit shared seams.
- ADR 0019 and reporting decisions: bounded quiz/capture/link counters and distinct totals.
- ADR 0003/0004: published Campaign delivery stays cached, while product cards add an
  explicit runtime data read. State the cache/failure tradeoff rather than claiming
  prices in cached HTML are current.
- ADR 0094: Data Map describes visit-only answers, optional captured answers, and
  product reads. Anonymous response storage, if requested, requires a separate design.

The implementation extends the existing Lead JSON and Stats table, keeps the Free
loader within its original byte cap, and puts visitor logic in a paid module.
Layout B is the only shipped screen manager. The three starters cover a service
enquiry, a content guide with optional signup, and an anonymous product finder;
the Results screen can move behind a required contact step. Publishing a product
finder requires WooCommerce, selected products, and a fallback link. The remaining
merchant usability and WooCommerce store walkthroughs are release validation,
not unresolved design or architecture decisions.
