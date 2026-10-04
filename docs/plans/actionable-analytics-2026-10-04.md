# Actionable analytics and revenue attribution plan

Date: 4 October 2026

Status: Proposed implementation plan. The user approved the direction of helping all users first, adding WooCommerce sales reporting next, and requiring the merchant to approve campaign changes. This document does not authorize implementation, new database schemas, a paid AI service, or changes to existing product contracts.

WConvert should help merchants understand results, choose a useful next step, and review the outcome. Build this into the existing Analytics screen. Establish reliable local insights first, add optional AI assistance over the same evidence, and connect campaigns to actual WooCommerce orders in the next release. Keep explanations short on screen and make the supporting evidence easy to inspect.

## Decisions and recommendations

| Topic | Direction | Status |
| --- | --- | --- |
| Audience | All WConvert users first; WooCommerce sales next | User selected |
| Autonomy | Recommend changes; merchant reviews and publishes | User selected |
| Experience | Extend Analytics and existing campaign editing | Recommended |
| Core insights | Local deterministic calculations, usable without AI or GA | Recommended |
| AI | Optional explanation, scoped questions, and draft suggestions | User requested consideration; scope recommended here |
| Revenue | Last qualifying interaction within a defined session; actual WooCommerce orders | Recommended, not yet implemented |
| Packaging | Core results and essential diagnostics in Free; advanced optimization, AI and revenue in Pro | Recommended; final entitlement mapping remains open |
| Storage | Reuse counters, configuration and order metadata; no new table or column in initial scope | Proposed constraint |
| Release sequence | Reporting foundations, actionable insights, optional AI, WooCommerce revenue | Recommended; AI must not block local insights or commerce work |

No automatic publication, automatic A/B winner selection, invented revenue, hidden external data transfer, or person-level tracking is introduced by this plan. This is a deliberate scope boundary, not a claim that those capabilities are technically impossible.

## Customer needs and evidence

The priority questions are “What worked?”, “What needs attention?”, and “What should I try next?” Outcomes differ by business; a publisher needs accepted signups, a service business needs enquiries, and a store also needs paid orders.

| Merchant | Job | Example | Success in the product |
| --- | --- | --- | --- |
| Publisher | Grow an audience | Newsletter signup or resource request | Understand accepted submissions and find a relevant improvement |
| Service business | Receive useful enquiries | Quote or consultation request | See requests and submitted interests without implying booked work |
| Store | Connect offers to sales | Accessory link or welcome offer | Inspect attributed paid orders and reconcile their value |
| Agency | Explain results to a client | Monthly campaign review | Export clearly scoped facts and review any AI summary before sharing |
| Low-traffic site | Know whether to act | Eight submissions this month | See results without misleading winner badges or noisy alerts |
| Advanced marketer | Investigate differences | Source, device, page and variation | Know which breakdowns are available and which require an external tool |

These needs are product hypotheses supported by the codebase and market documentation, not completed customer interviews. ADR 0046 summarizes older review research emphasizing tracking correctness; the underlying review archive was not independently reanalyzed for this plan. Do not treat feature marketing as proof of willingness to pay.

Validate with five representative merchants: publisher, service business, small store, agency and low-traffic site. Ask each to bring a real campaign, explain their last disappointing result, interpret a report, and choose a next action. Ask what they currently use to decide whether a lead is valuable. Do not lead with “Would you use AI?” Observe whether the proposed assistance solves their actual task.

## Current implementation and gaps

Repository baseline inspected: `25f4ef9`. Code observations describe that baseline, not a runtime verification.

| Area | Already present | Required work |
| --- | --- | --- |
| Core reports | Daily counters, compatible impact totals, campaign and Goal reports, complete-day comparisons, CSV | Add evidence-backed insights without changing existing metric meanings |
| History | Paused/deleted campaign history and family grouping | Keep insights scoped to exact contributing rows; exclude historical-only campaigns from edit suggestions |
| Journey activity | Screen/channel scopes and definitions per revision | Share Analytics date range, bounded queries, comprehensible screen report |
| Journey dates | `JourneyStatsController` uses the last 30 days including today, with no explicit upper bound | Resolve accepted dates through the reporting range contract before comparing with Analytics |
| Journey UI | Fixed 30-day totals in the editor | Preserve that editor use or explicitly label its independent window; Analytics receives selected complete dates |
| A/B comparison | Current/retired arms, manual promotion | Explain descriptive comparisons; no significance, stable test rounds or automatic winners |
| External analytics | Optional existing GA/GTM/Plausible event routes | Keep provider-owned acquisition reporting separate from native counters |
| Delivery health | Destination health and recent attempt evidence | Link actionable failures; never derive failed or pending Leads by subtracting totals |
| Revenue | ADR 0046 defines order metadata and read-time amounts | Implement attribution capture, checkout binding and bounded order reports |
| AI | No analytics AI implementation identified in inspected modules | Define provider seam, evidence contract, permissions, data controls and draft workflow |

Source anchors: `src/Stats/Dashboard.php`, `src/Stats/StatsRepository.php`, `src/Stats/StatKind.php`, `src/Rest/JourneyStatsController.php`, `resources/admin/src/stats/`, `resources/admin/src/builder/JourneyReport.tsx`, `pro/modules/analytics/`, and `pro/modules/ab-testing/`.

Keep these current contracts: [impact reporting](../adr/0089-analytics-starts-with-impact-and-keeps-history-inspectable.md), [daily counters](../adr/0019-analytics-stores-daily-counters-not-events.md), [manual A/B decisions](../adr/0058-a-test-ends-when-the-merchant-says-so.md), [money ownership](../adr/0046-wconvert-stores-no-money.md), and [external analytics boundaries](../adr/0114-analytics-exports-use-existing-site-tags.md). If implementation changes a contract, amend its ADR inline and add the new decision in the same PR. This plan does not silently supersede them.

## Market findings and product choices

The following are documented capabilities, reviewed on 4 October 2026. Competitor implementations were not exercised. The recommendation column is our interpretation.

| Reference | Documented behavior | Recommendation for WConvert |
| --- | --- | --- |
| [OptinMonster revenue](https://optinmonster.com/docs/revenue-attribution/) | Distinguishes click-through and view-through revenue, supports WooCommerce/EDD through its plugin, and divides a sale across credited campaigns | Expose attribution rules and avoid double-counted headline totals |
| [OptiMonk reporting](https://support.optimonk.com/en/articles/measuring-your-campaign-s-performance-in-optimonk) | Overview, campaign reports, comparisons, breakdowns, assisted orders and revenue | Keep a short overview with useful drill-down |
| [Wisepops attribution](https://support.wisepops.com/en/articles/9997489-attributing-revenue-to-campaign-displays-instead-of-clicks) | Requires a click by default; documents display-based attribution as an alternative | Require meaningful interaction in the first revenue model |
| [Klaviyo form revenue](https://help.klaviyo.com/hc/en-us/articles/27695838219675) | Configurable form lookback window with a two-hour default; form and message revenue may overlap | Make the window visible and distinguish forms from downstream email influence |
| [Popup Maker analytics](https://wppopupmaker.com/docs/popup-analytics/introduction-3/) | Opens, conversions, rates, timing and URL reports | Make basic results understandable before expanding dimensions |
| [Clarity insights](https://learn.microsoft.com/en-us/clarity/insights/insights-overview) | Surfaces behavior patterns through recommendations, recordings and heatmaps | Offer investigation paths; defer native replay and heatmaps |

The proposed distinction is evidence plus a relevant action within WordPress. Avoid claiming that competitors lack advice or that WConvert attribution is more accurate without comparative testing.

## Information architecture and visual design

Use the existing Harbor frame, top navigation, light title area, white regions on mist, teal primary actions, shared typography and logical spacing. Follow `tools/design-system/GUIDELINES.md` and current ADRs; its older `BRIEF.md` contains superseded visual choices. Add no permanent sidebar, separate AI dashboard or new brand treatment.

Analytics remains the entry point. The first viewport answers what happened and offers one useful next step. Do not let insight cards displace the results that explain them.

### Overview

Reading order:

1. **Analytics** title, selected period, comparison control and **Export**.
2. Compatible outcome totals: submissions, offer clicks, cart return clicks and appearances. Revenue appears only with a supported enabled commerce capability.
3. **Needs attention** region with at most three eligible insights. Omit the region when none qualify; do not fill it with generic tips.
4. Existing activity chart and campaign report, preserving Goal distinctions.
5. Optional monthly targets after actual performance.

Conceptual layout, using illustrative content:

```text
Analytics                          Last 30 days   Compare   Export

Submissions          Offer clicks          Cart return clicks
120                  84                    16
Previous 100         Previous 80           Previous 12

Needs attention
Newsletter appeared less often                  View evidence
Its submission rate stayed at 3%.               Check display

Activity                         [chosen metric] [View data]
Campaigns                        [goal] [status]  [search]
Monthly target                   only when configured
```

Use short rows within one region rather than a grid of large, equally urgent cards. Put a genuine operational failure before an optimization hypothesis. No red treatment for ordinary weak performance and no celebratory animation for random fluctuations. State whether a change is up or down in text, not just color.

### Campaign detail

Preserve breadcrumbs, accepted dates and back navigation. Show outcome-specific totals, trend, scoped insights, then journey or variation detail where available. Use descriptive labels such as **Submissions**, **Offer clicks**, **Completed results**, and **Cart return clicks**. A quiz's captured submissions remain separate from its completion metric.

Each insight shows a short title, one evidence sentence, an evidence category, one primary action, and **View evidence**. Evidence expands inline so the merchant can inspect dates, numerator, denominator, source and limits without leaving the report. It must be keyboard accessible and addressable from an AI answer.

Three evidence categories: **Observed** for arithmetic or known status, **Possible improvement** for a hypothesis, and **Limited data** for an interpretation withheld by the data gate. These are not confidence scores. Delivery health uses its actual timestamp and explicitly says it is current when displayed beside a historical report.

### Review a suggestion

The action sequence is report → evidence → suggested change → draft review → existing publish flow. For an A/B-capable campaign, **Create variation** proposes one isolated change. Otherwise **Review draft** opens an editable proposal; ordinary reports and troubleshooting remain useful in Free.

Show before/after text or configuration, the reason, and what needs human verification. Apply only selected changes to the draft. Preserve unsaved edits, provide Undo before save, and recheck the source revision before applying. A stale proposal says **Campaign changed. Review again.** Cancel has no campaign effect. Saving a draft never publishes it.

### Mobile and accessibility

At 1440px and 1024px, use the existing reading measure and table layout. At 768px, wrap controls without losing scope. At 390px and 320px, stack insight evidence and actions; retain critical metrics and use a labeled scroll region for genuinely tabular detail. Do not require horizontal scrolling for the entire page.

Target WCAG 2.2 AA for new surfaces, extending the existing accessibility baseline. Keep keyboard focus visible and unobscured, dialogs named with focus return, status updates politely announced, and exact chart values available in a table. Color cannot carry meaning alone. Respect reduced motion, 200% zoom, narrow reflow, RTL and long translations. Keep the shared 44px coarse-pointer floor; do not confuse it with WCAG's 24px minimum target criterion and exceptions. See [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [target sizing](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

## Short copy system

Aim for titles of 3–7 words, supporting sentences under about 25 words and verb-led actions of 1–3 words. These are writing targets, not hard truncation limits. Preserve meaning and allow translation expansion. Use progressive disclosure for definitions that do not change the immediate action.

| Situation | Primary copy | Supporting copy or action |
| --- | --- | --- |
| No campaigns | No campaigns yet | Create a campaign to start collecting results. / Create campaign |
| No activity in period | No activity in this period | Try a wider date range. / Change dates |
| Few observations | More data needed | We cannot suggest a reliable next step yet. / View results |
| Fewer appearances | Shown less often | Submissions fell while the submission rate stayed similar. / Check display |
| Lower observed rate | Submission rate fell | Review the comparison before changing your campaign. / View evidence |
| Historical-only campaign | Past results | This campaign is no longer published. / View history |
| Confirmed destination problem | Check your connection | Recent attempts failed. Open connection details for the reason. / View connection |
| First load failed | Could not load results | Try again. / Retry |
| Refresh failed | Could not refresh | Showing the previous results. / Retry |
| No prior denominator | No comparison available | The previous period has no recorded appearances. |
| AI entry | Explain these results | Optional control, clearly identified as AI |
| AI pending | Preparing explanation… | Cancel |
| AI unavailable | AI is unavailable | Your reports are still available. / Try again |
| Unsupported question | That data is not available | This report does not include traffic sources. |
| Suggestion ready | Review suggestion | Changes stay in your draft until you publish. |
| Revenue inactive | Track campaign sales | Link future orders to campaign interactions. / Set up tracking |
| Revenue metric | Attributed revenue | Products after discounts and refunds. Excludes tax and shipping. |
| Revenue qualification | Linked to campaign interactions | This does not measure extra sales caused by the campaign. |
| Tracking limit | Some orders may be unlinked | Tracking can be unavailable or the purchase may happen in another session. |

Avoid “Optimize now”, “AI knows why”, “Recovered revenue” for return clicks, “Lost customers” for screen arithmetic, “Confirmed subscribers” for captures, and “Winner” for the larger observed rate. Errors explain a problem and offer a relevant recovery step; preserve entered values. This follows [GOV.UK error guidance](https://design-system.service.gov.uk/components/error-message/).

## Measurement and insight contracts

### Shared report context

Every report, insight, export and AI answer carries the same server-resolved context: campaign/family/Goal scope, exact current and previous date boundaries, complete-day flag, metric definitions, data source, evidence limitations and generation time. The site calendar resolves boundaries. Default to 30 complete days with the existing 7/30/90 choices. Preserve custom accepted ranges and the existing 366-day cap.

Expose an internal report fingerprint derived from this context and source facts. It identifies a calculation, not a visitor. Cancel or ignore stale requests when dates change. On a failed refresh, retain accepted dates with accepted values; never label old numbers with newly requested dates. AI output is tied to the accepted fingerprint and marked stale or removed after a successful report change.

No global rate across incompatible outcomes. Rate = the declared result count divided by appearances for the same scope and period. A zero denominator is unavailable, not 0%. Show percentage-point changes explicitly when comparing rates: 3% to 2% is down 1 percentage point. A zero previous total gets absolute change, not infinite growth. Numbers, IDs and dates come from the server; generated prose cannot redefine them.

Keep daily totals independent of retained Lead rows. Privacy deletion must not silently change historical capture counters. Interest-answer summaries are a separate view of retained submitted answers, can change after erasure/retention, and must disclose that scope.

### Initial insight rules

Candidate generation and ranking run locally. First fix observed operational problems, then show material descriptive changes, then supported improvement hypotheses. Within a category rank by affected observed results and recency; never invent expected revenue or a universal optimization score. Deduplicate related cards and show at most three.

| Rule | Required evidence | Safe interpretation | Next action |
| --- | --- | --- | --- |
| No appearances | Selected period counters plus current publication/schedule/dependency facts | No appearances were recorded; current configuration may explain eligibility | Open inspector with the campaign selected |
| Lower exposure | Equal complete windows, appearances and results | Fewer recorded appearances accompany fewer results | Inspect rules or consult site traffic reporting |
| Lower result rate | Comparable outcome and nonzero denominators in both windows | Observed rate declined; cause is unknown | Inspect evidence and prepare one test |
| Journey screen review | Same campaign, revision and period; recorded screen activity | Review this screen's progression; totals are approximate | Open that screen in the editor |
| Delivery failure | Explicit recent failed attempt or known invalid setup | A named destination needs investigation | Open existing diagnostics |
| Variation comparison | Compatible arms and dates | A descriptive comparison is available | Open current comparison; merchant decides |
| Interest distribution | Retained accepted choice answers and question snapshot | Respondents selected these interests | Review messages or targeting as a hypothesis |

Initial noise filters are tunable product defaults, not statistical tests: optimization cards require two complete seven-day-or-longer windows, at least 200 appearances in each, at least 20 results across both, an absolute result difference of at least 10, and a relative rate change of at least 20% for a rate-decline card. Suppress percentage-change interpretation when the prior rate is zero. Operational failures bypass traffic gates. All raw results remain visible when a card is withheld. Test these defaults against low- and high-volume fixtures and merchant feedback before release.

For an exposure card, describe rates as similar only when they differ by at most 0.2 percentage points AND at most 10% relative to a nonzero prior rate. Otherwise show both changes independently. This wording threshold is not equivalence testing.

Counts cannot establish that traffic quality, copy, form length or opening time caused a change. Current configuration is not proof of historical configuration. Current campaign history lacks immutable experiment rounds; do not claim significance, confidence intervals or causality from these reports. Aggregate data can support statistics in a suitable experimental design, but the current units, repeated appearances and mutable histories do not meet that contract.

### Journey and visitor interests

Use a screen activity report rather than a funnel graphic implying linked unique visitors. Show Shown, Completed, Skipped and Dismissed by revision and screen. Do not subtract these overlapping counts to create exact abandonment. A screen may be revisited, a branch skipped, or activity cross a day boundary. Show explanatory text near any descriptive progression ratio and withhold it where the denominator is invalid or the semantics are incompatible.

Email and SMS signups can overlap within one Lead. Optional signup after a quiz does not create another quiz completion. Anonymous answers are not retained today, so an all-visitor answer distribution would need new collection scope. Start with summaries of retained submitted choices. Reuse capture-time labels, separate changed question definitions, and identify respondents rather than the site's audience. Do not send free-text Lead messages to AI in this plan.

### Evidence object

Proposed internal fields: `rule_id`, `rule_version`, `report_fingerprint`, `scope`, `periods`, `facts`, `evidence_type`, `limitations`, `observed_at`, `eligible_actions` and `config_revision`. Facts have stable keys, units and source references. Eligible actions come from server-checked capabilities. Evidence categories are a closed set; the model cannot create a new one or upgrade a hypothesis to an observation.

Compute cards on read. Per-user dismissal can use bounded WordPress user metadata keyed by rule, scope and fingerprint, expiring after seven days or reappearing when material evidence changes. This is proposed new metadata, not an existing feature. Avoid unlimited dismissal or insight histories. A full audit/experiment ledger is deferred and requires its own storage decision.

## AI features and boundaries

AI should help interpret and write; the local report service owns facts and arithmetic. Follow the broader principles of capability transparency and human control described in [Microsoft's agent design guidance](https://learn.microsoft.com/en-us/agents/design-guidelines/responsible-ai). These sources inform the design, not a claim of compliance or model reliability.

| Feature | Input | Output | Release |
| --- | --- | --- | --- |
| Explain results | Selected aggregate report and eligible evidence | Brief explanation with links to facts | Optional AI first release |
| Ask about this report | Scoped question plus allowlisted evidence | Supported answer, useful follow-up, or explicit unavailable answer | Optional AI first release, constrained topics |
| Suggest a test | Evidence and explicitly selected campaign content | One hypothesis, one editable change, test goal | After explanation quality is verified |
| Draft campaign copy | Merchant brief, selected current text and verified offer details | Short copy alternatives and before/after review | Shared future AI capability |
| Draft client summary | Selected report facts | Editable summary with dates and limitations | Later; never automatically sent |

Example answer: “Submissions fell from 60 to 30. Appearances also halved, while the rate stayed at 3%. Check where the campaign can appear.” Evidence links open the exact comparison. If asked why Google traffic fell, respond that the local report lacks source data and offer the existing external analytics setup/report guidance. Do not pretend an outbound GA integration reads GA reports back.

### Interaction design

Offer **Explain results** near the report, not as a floating assistant that covers it. Open a contextual drawer on wide screens and a full-screen dialog on narrow screens. This is temporary detail, not a new app navigation sidebar. Show the selected campaign and period at the top. Suggested questions include “What changed?”, “What should I check?” and “What can I test?”

The first response has at most a short paragraph and three actions. **View evidence** and **Review suggestion** remain available without asking the model again. Announce completion once; do not read streamed tokens individually to assistive technology. A loading, timeout or quota state must not block charts, exports or local recommendations.

### Data flow and configuration

Use a provider-neutral server adapter shared with future WConvert AI features. Model/provider selection, billing, hosting, retention and customer account requirements remain product decisions. Do not add a second permanent AI account screen inside Analytics. Reuse a shared settings home when that feature exists.

AI stays off until an authorized site administrator configures it and sees a clear description of the selected provider and transmitted data. No background request occurs just because Analytics opens. Aggregate reports use opaque campaign aliases where possible. Include campaign text only when the user explicitly asks for copy help and can review the selected content. Exclude contact identifiers, Lead IDs, free-text submissions, payment details, full URL query strings, secrets and raw browsing history.

For public release, document actual provider retention/training terms, account deletion implications and cost before activation. These terms cannot be promised before a provider is selected. Native analytics continues to work when AI is disabled or its service is unavailable.

### Server contract and failure handling

1. Authenticate, check report access, resolve scope and enforce request/token limits server-side.
2. Build an allowlisted evidence payload; never expose arbitrary SQL, unrestricted site browsing or Lead search as model tools.
3. Treat campaign content and user questions as untrusted data. Instructions embedded in campaign copy cannot change permissions or tools.
4. Request structured output with evidence keys and known action IDs. Validate shape, limits and references. Prefer server-rendered numeric fact slots; reject unsupported numerical or causal claims.
5. An answer can propose a draft patch, but cannot apply it or publish. At review, check edit permission, schema validity, affected revision and current entitlements again.
6. Deduplicate identical in-flight requests. Default proposed timeout: 20 seconds, with explicit retry and no silent paid retry loop. Allow cancellation; disclose that an already dispatched provider request may still incur usage.
7. If validation fails, show the deterministic explanation or “AI could not explain this report.” Never display partial unsafe actions.

No durable chat history in the initial release. A short-lived result cache, if needed, uses a non-autoloaded transient scoped by site, user/access scope, locale, report fingerprint and provider configuration; proposed TTL 15 minutes, invalidated by relevant configuration changes. Keep health logs to timings, status codes and request identifiers; omit prompts, responses and secrets by default. Authentication, capability enforcement and output validation are application code, not prompt instructions.

### AI quality gate

Maintain fixtures for empty reports, zero denominators, sparse counts, mixed outcomes, overlapping signups, old revisions, missing external dimensions, stale reports, refunds and hostile campaign text. All numerical claims must match supplied evidence. Zero unsupported publish actions, invented metrics, leaked identifiers or false causal claims are acceptable in the release corpus. Test qualitative usefulness with merchants separately; valid JSON alone is insufficient.

## WooCommerce revenue release

### Proposed attribution model

Display the model as **Last interaction · Same session**, with a short explanation. An interaction qualifies when a capture is server-accepted, a primary offer/cart-return link is clicked, or a quiz result's product/offer link is clicked. Merely showing a popup, completing an anonymous quiz, closing it or copying a coupon does not qualify in this first model. Result-link eligibility is new attribution behavior and does not change its existing headline Conversion meaning.

Define a dedicated attribution session as ending after 30 minutes of inactivity, with an absolute 24-hour cap. This is a proposed WConvert rule, not an assumption about WooCommerce cart-session lifetime. The implementation must specify permitted activity signals and expiry consistently; avoid a new sitewide heartbeat. A navigation/activity integration spike must prove this rule before release. If it cannot do so reliably, ship a clearly labeled fixed 30-minute lookback instead and update the plan/ADR rather than silently changing semantics.

The last eligible interaction before order creation receives the order's credit. Resolve concurrent interactions with server acceptance order and a stable tie-breaker. One order gets one credited arm; family rollups derive from campaign relationships without adding another credited order. Store immutable origin arm, family-at-order reference, model version and eligibility timestamps as provenance. Do not reassign old orders to a later interaction or a renamed/reparented campaign.

### Capture and order lifecycle

Maintain only the minimal campaign reference and timing necessary for attribution under the appropriate existing consent API integration. Choose and document the consent category for this new purpose; functional display state is not automatically permission for analytics attribution. Denied or unknown permission means no optional attribution state. Withdrawal clears unbound state; treatment of already-created order metadata follows the documented order retention/erasure integration.

Use a server-validated interaction record bound to the relevant checkout session. Browser click signals are observations, not proof of purchase; reject arbitrary campaign IDs, replayed/expired tokens and client-supplied amounts. Capture attribution only after local submission acceptance. Do not create WooCommerce sessions for unrelated visitors merely loading a campaign. Prove how guest shoppers who interact before a cart exists get a consented minimal token that can be bound later.

Attach provenance during classic checkout and Checkout Blocks order creation through supported WooCommerce APIs. Count eligible orders when payment is confirmed, including delayed confirmation. An order created while the interaction is eligible can become paid later without extending the browser attribution window. Thank-you page visits are not the source of truth. Refreshes and repeated webhooks must be idempotent.

Use WooCommerce CRUD/query APIs and demonstrate both HPOS and legacy order storage. Do not write directly to `wp_posts` or `wp_postmeta`. This follows the [HPOS recipe book](https://developer.woocommerce.com/docs/features/orders/high-performance-order-storage/recipe-book/). WooCommerce's own [order attribution](https://woocommerce.com/document/order-attribution-tracking/) provides acquisition context; it does not already supply WConvert campaign provenance.

### Revenue semantics

Count distinct paid attributed orders by paid date in the site calendar. Exclude unpaid, failed, canceled and explicitly marked test orders. Handle gateway-specific statuses through verified payment state, not a hardcoded assumption that every completed checkout is paid. No automatic credit for manual/admin orders, renewals, imported orders or external checkout flows without a tested adapter.

Recommended amount: merchandise line totals after discounts, minus merchandise refunds, excluding tax, shipping and fees. Read values from WooCommerce and honor its currency precision. Keep each currency separate; no invented conversion rate. These are revenue amounts, not profit or ROI. AOV uses that same amount basis divided by the count of included paid orders.

Later refunds reduce the original paid-period amount when reread. Fully refunded orders remain visible as originally paid attributed orders with zero retained merchandise revenue; show their refund status. Deletion removes the order's contribution. Explain that past amounts can change with refunds or order corrections. A refund without usable line allocation needs an explicit reconciliation rule before release; mark the affected amount unavailable rather than guessing a merchandise share. No duplicated money column in WConvert counters or options.

Show attribution coverage as **Orders linked: X of Y paid orders** within the same scope, supported store flows, dates and currency. This is link coverage, not measured tracking accuracy. Unlinked does not mean uninfluenced; consent, expiry, other devices and unsupported purchase paths may prevent a link. Orders before enablement are not retrospectively attributed.

Do not divide orders paid in a date range by appearances in that range and call it a purchase conversion rate: the cohorts differ. Revenue-per-appearance and return-on-investment metrics are deferred until a defensible denominator/cost contract exists.

### Revenue UI and setup

When Pro and WooCommerce are available, offer a compact setup region with the model, amount basis, consent behavior, and **Enable tracking**. Make a test-order walkthrough available without placing a real order automatically. Show **Tracking since [date]** and a diagnostic status. Saving a setting is not proof that checkout attribution works.

After enablement, show attributed revenue, paid orders and AOV, grouped by currency. Detail shows campaign, order reference, paid date, amount, refund status and model. Order details require the current user's WooCommerce order permissions as well as WConvert report access; unauthorized users receive only permitted aggregates. Preserve campaign history when the originating arm is retired or deleted.

Without WooCommerce, omit sales setup. If the dependency disappears after enablement, show retained setup status and **WooCommerce is unavailable**; do not fabricate a zero-revenue result. Preserve optional external source reporting as a separate concern.

## Scenario coverage

| Scenario | Required behavior |
| --- | --- |
| First install, no publication | Useful creation empty state; no AI-generated performance advice |
| Published but no appearances | Explain absence of observations; current inspector may help, but no claim that configuration caused historical absence |
| Paused, scheduled or suspended campaign | Label current state, preserve history, offer only valid actions |
| Low volume | Show actual results; suppress optimization ranking and winner claims |
| Zero denominator or previous total | Dash/unavailable rate or absolute change; no infinity, NaN or invented 0% |
| Different Goal/outcome types | Separate metrics; no cross-goal conversion-rate leaderboard |
| Optional email then SMS | One capture journey and potentially overlapping channel totals |
| Branching quiz or revised screens | Separate revision activity; no exact drop-off or anonymous answer reconstruction |
| Edited or reused A/B variant | Explain selected-date history; no immutable-round or significance claim |
| High close count and later conversion | Do not treat dismissal and conversion as mutually exclusive groups |
| Delivery retry or duplicate send | Use explicit attempt evidence; never subtract sends from Leads to estimate failures |
| Retention/erasure changes answers | Retained-answer summaries change; historical capture counters retain their defined meaning |
| Consent withheld or ad blocker | Show available evidence and limits; do not silently recover identity or bypass preferences |
| GA totals differ from local totals | Explain different collection/consent/definitions and periods; do not declare either universally correct |
| Dates change during AI request | Cancel/ignore stale output and preserve exact report context |
| Provider quota, timeout or outage | Native reports work; clear retry state and no unintended repeated charge |
| Malicious instructions in campaign text | Treat as content; no expanded permissions, tools or external requests |
| Concurrent campaign edits | Reject stale draft application and preserve both user's work and suggested text |
| Multiple campaign interactions | Last eligible one gets order credit; no duplicate family/arm credit |
| Delayed payment | Preserve eligible checkout provenance; count on confirmed paid date |
| Refund, cancellation or order deletion | Reconcile current source orders and stated report semantics |
| Partial refund without line allocation | Explicitly unavailable affected amount until supported; never silently estimate |
| Multiple currencies | Separate totals with clear currency labels |
| Cross-device or later-session purchase | Unlinked unless a separately approved future model supports it |
| Coupon shared outside the campaign | Coupon use alone does not prove a qualifying campaign interaction |
| Offline sale or booked appointment | Remains an enquiry until an authorized integration provides outcome evidence |
| Admin/test traffic | Use existing explicit preview/dry-run exclusions; do not assume all logged-in traffic is testing |
| Free, Pro, expired license, dependency removed | Preserve installed-capability and licensing contracts; no runtime license-based loss of installed features |
| Narrow viewport, keyboard, RTL | Equivalent tasks, visible focus and readable numbers/copy |
| Large history, slow host | Bounded/paginated requests and graceful loading; no unbounded order scan in a page request |

## Engineering and storage plan

### Reporting and UI

Extend the shared server reporting layer with an evidence builder and pure rule evaluators. Keep native facts separate from optional provider adapters. Add focused components for insight rows, evidence disclosure and proposal review using existing Region, loading, error, dialog, button and InfoTip primitives. Do not build a parallel state-management framework.

Align the journey endpoint with `StatRange`/site-calendar semantics and validate bounded dates and campaign access. Return exact accepted dates and revisions. Bound revision-definition reads and avoid per-screen database queries. Reuse the same facts in UI, CSV and AI payloads. Native device, page and source dimensions are absent from the core counter grain; do not manufacture them from current display rules. Keep those in existing external analytics until a separate bounded collection design is approved.

### Proposed storage inventory

| Need | Preferred mechanism | Lifecycle and alternatives |
| --- | --- | --- |
| Local insight facts | Compute from existing counters/configuration | No persisted insight ledger or raw event stream |
| Dismiss an insight | Bounded user metadata | Seven-day expiry/fingerprint invalidation; skip persistence if it proves unnecessary |
| AI configuration | Existing shared settings architecture or one bounded non-autoloaded option | Server-only secrets; do not place credentials in public REST responses |
| AI cached explanation | Optional short-lived transient | 15-minute proposal; no durable transcript |
| Pending attribution | Minimal consented browser/session state | Expiry, withdrawal and checkout consumption; exact transport requires spike |
| Order provenance | WooCommerce order metadata | Follows order lifecycle, includes no copied order amount |
| Revenue report cache | None initially; bounded query and pagination | A derived cache would require a separate ADR 0046 amendment and complete invalidation design |
| Experiment rounds or independent visitor units | Deferred | Cannot be reconstructed from daily counts; separate proposal and explicit schema approval if needed |

No table/column/index change is assumed. If representative order queries cannot meet the release budget using supported queries and metadata, stop that implementation slice and prepare a concrete storage proposal comparing existing metadata, options, transients, read-time calculation and a dedicated index/table. Repository policy requires explicit sign-off for schema changes. Do not hide an unbounded ledger in an option to evade it.

Native insight computation must add no visitor requests and no frontend AI code. Proposed performance acceptance: at 100 campaigns and 90 reporting days, incremental local insight work adds no more than 100ms p95 to the existing report on the documented test fixture, with no per-campaign query loop. For revenue, target under two seconds p95 on a documented representative 100,000-order fixture; use pagination and independent loading. These are proposed budgets to measure, not current performance claims.

## Delivery sequence and acceptance

Each slice should be reviewable independently on a branch and PR. Amend relevant ADRs alongside implementation. Do not open implementation tickets or change live campaigns as part of this planning document.

| Slice | Deliverable | Dependency | Done when |
| --- | --- | --- | --- |
| 1. Report contract | Shared accepted dates, metric glossary, journey range alignment, evidence schema | None | Date/denominator/revision fixtures pass and no existing headline changes meaning |
| 2. UX prototype | Overview, campaign evidence, proposal review; populated/empty/loading/failed states | 1 | Five merchant sessions completed or clearly recorded outstanding; keyboard/mobile/RTL review complete |
| 3. Local insights | Operational/exposure/rate rules, ranking, scoped evidence, inspector links | 1–2 | Every recommendation maps to observed facts and valid actions; sparse data stays useful |
| 4. Journey and interests | Revision-specific screen report and retained-choice summaries | 1–3 | No exact-abandonment or whole-audience claims; deletion/retention scopes explained |
| 5. Optional AI explanations | Provider seam, opt-in, constrained questions, validation and fallback | 3 plus provider/data/cost decision | Adversarial and factual evaluation gates pass; AI outage cannot break reports |
| 6. AI draft suggestions | Structured proposals, before/after, revision check, Undo, existing publish flow | 5 | No mutation before approval and no publication from AI; merchant can explain each change |
| 7. Commerce feasibility | Session/token, checkout hooks, consent, HPOS query/refund investigation | 1; can proceed independently of AI | Classic/Blocks guest flows, delayed payment and performance approach proven |
| 8. Revenue reporting | Provenance, order reads, model/coverage/setup UI, currency/refund handling | 7 | Report reconciles against known orders across the supported matrix |
| 9. Later optimization | New dimensions, experiment-round design, holdouts, external lead outcomes | Validated demand and separate data design | New measurement claims are supported by the collection design |

Release the first complete customer increment after slices 1–3. Do not bundle it behind provider selection. Slice 4 can follow when semantics and usability are verified. Commerce remains the next major business-outcome release, even if optional AI ships incrementally alongside it. No calendar estimate until the checkout and provider spikes establish the unknowns.

Packaging recommendation: Free retains reports, exports and essential health/measurement explanations. Pro supplies advanced test suggestions, AI adapters and commerce reporting through the existing build/module mechanism. No new price or plan is decided. Final internal tier placement must respect installed capabilities, ADR 0116 and existing license behavior; avoid locked feature clutter on Free reports.

## Verification and launch criteria

For implementation, use meaningful contract and integration tests rather than snapshots of incidental wording. Unit tests cover date boundaries, zero denominators, rule arithmetic, action eligibility, evidence fingerprints and source revisions. Integration tests cover permissions, real REST failures, retained accepted data after failed refresh, progressive capture, family history and stale draft application.

Revenue tests include classic checkout and Blocks, HPOS and legacy storage, guest and logged-in shoppers, direct and delayed payment, repeat webhooks, token replay/expiry, consent changes, multiple interactions, refunds, canceled/test orders, deleted campaigns, mixed currencies and order deletion. Verify guest interactions before cart creation without silently creating sessions for every visitor.

Run the relevant existing PHP and JS tests, typecheck/lint and analytics visual suite. Run loader/artifact checks when commerce visitor code or module packaging changes. Validate in actual WordPress with Free and Pro, not only a standalone React preview. Measure query counts and latency with representative data; document hardware/runtime/fixture and p95 results.

Visual review captures 1440/1024/768/390/320 widths, LTR/RTL, long translated labels, populated/empty/loading/failed/stale states, evidence expanded, AI unavailable, no WooCommerce and multiple currencies. Check keyboard traversal, zoom, screen-reader names, chart data access and contrast. Do not claim accessibility conformance solely from lint or screenshots.

Proposed usability bar: at least four of five pilot merchants identify what changed and find the relevant next action without moderator help within two minutes. Each can distinguish a submission from a purchase and attribution from extra sales. Record failures and revise the UI; this small study is usability evidence, not a market-demand estimate.

Launch with the model and metric definitions documented, an AI data-flow description when applicable, and explicit supported commerce paths. Measure time to decision and useful reviewed changes during opt-in pilots. Do not introduce silent product telemetry; anonymized aggregate usage collection would require a separate user-facing data decision. An accepted recommendation or a before/after lift is not proof of causal improvement.

## Decisions needed before their implementation slices

These do not block the plan or local report work. Use the recommended defaults for prototyping and revisit with concrete evidence.

| Decision | Recommended default | When it must be settled |
| --- | --- | --- |
| AI service ownership | Shared optional server adapter for all WConvert AI features | Before provider integration |
| AI hosting, billing and retention | Decide transparently after comparing supported providers and costs; no vendor assumed here | Before any customer data is sent |
| AI content scope | Aggregates for explanation; selected campaign text only for explicit copy tasks | Before AI UI implementation |
| Attribution session mechanics | Explicit 30-minute inactivity rule with 24-hour cap; verify signals first | Commerce feasibility slice |
| Amount and refund basis | Net merchandise, no tax/shipping; unavailable if refund allocation is ambiguous | Before revenue aggregation |
| Tracking consent integration | Purpose-specific optional attribution state using the site's consent integration | Before visitor attribution code |
| Entitlements | Free fundamentals; Pro advanced assistance and revenue | Before module packaging |
| Persistent insight feedback | Bounded per-user dismissal; no full action ledger | Before adding metadata |
| New tracking dimensions | External analytics first | Only after user evidence justifies native collection |

The immediate implementation starting point is the shared report contract and a reviewable Analytics prototype. AI and revenue should reuse that foundation so every explanation and next action points back to the same understandable facts.
