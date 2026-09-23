# Campaign Display workspace — Option A

Status: approved for implementation, 2026-09-23. The user selected Workspace A,
confirmed simple defaults with advanced rules on demand, and then authorized
implementation after reviewing subsequent Goal/capture changes. The user also
approved the measured 1 KiB increase in the existing paid-loader cap.

Implementation decisions and refinements are recorded in
[ADR 0104](../../adr/0104-display-workspace-uses-bounded-groups-and-fresh-gestures.md).
Catalog recipes compile to the canonical plan during Prefill; they are not a
saved-data compatibility path. Click selectors use the documented portable
subset with shared client/server validation. Verification results are recorded
in [implementation.md](implementation.md).

## Outcome

Redesign the Campaign editor's Display tab as a workspace in which a merchant
can answer four questions without learning a rule engine:

1. Where can this Campaign appear?
2. Who is it relevant to?
3. When should it appear?
4. When is it active, and how often may it appear?

Support both ordinary WordPress lead generation and WooCommerce offers. A
simple Campaign should take a starting point and a few edits. More experienced
users can express AND/OR combinations without duplicating Campaigns or losing
track of exclusions, schedules, and visitor limits.

The layout is a fresh design. Existing contracts are implementation inputs,
not reasons to keep confusing interactions. Keep the established admin shell,
native controls, and design tokens when implementing the chosen layout.

Companion specifications:

- [Rule and runtime contract](rule-contract.md): grouping, trigger semantics,
  publishing, availability, storage, and examples.
- [Implementation and verification](implementation.md): affected systems,
  ordered delivery slices, tests, and completion criteria.

Reference prototype: the conversation's **Display Settings Prototype**, A —
Workspace. It is throwaway code. B and C were comparison directions and are
not additional production modes. Do not copy the prototype's event handling,
hardcoded page choices, simulated data, or Save draft implementation.

## Scope

### Included

- Whole Display tab: section navigation, editor, live summary, starting points,
  validation, and the two testing routes.
- Preserve every existing page, visitor, trigger, scheduling, frequency,
  priority, placement, and eligibility-inspection capability.
- Select ALL or ANY opening requirements for automatic display.
- Alternative audience groups: OR between groups, ALL or ANY within each.
- Minimum elapsed time before an automatic opening gesture is eligible.
- Inactivity as a new automatic trigger.
- A precisely defined once-per-session automatic display limit.
- Correct authoring and explanations for inline placement, content locks,
  fullscreen presentation, A/B variants, and Reopen buttons.
- Save, reopen, publish, preview, and evaluate the same rules end to end.

### Separate follow-up work

- New/returning visitor identification, page-view counts, time across pages,
  and remembering an acquisition source through a session.
- Scroll-to-element, geolocation, product/category-in-cart targeting, arbitrary
  cookies, JavaScript predicates, or custom events.
- Cross-campaign conversion targeting and contact/subscription-state targeting.
- Different audience-and-opening scenarios inside one Campaign, such as
  `(mobile AND idle) OR (desktop AND exit)`. This proposal groups Audience and
  Opening independently; it does not offer a general Boolean expression tree.
- The B wizard as a second authoring mode. Its sequencing informs first-use
  guidance, but maintaining two editors would create avoidable inconsistency.
- Redesigning Design, capture journeys, Destinations, or shared site settings.

The prototype used a few illustrative options. Production must label the
existing UTM condition as a **URL parameter / UTM tag on this page**, not imply
session attribution. Once-per-session and inactivity are actual additions in
this scope, not assumptions about current support.

## Information architecture

Keep the existing Campaign masthead, draft/published distinction, save/publish
actions, and neighboring tabs. Rename the settings surface to **Display** if
the current tab uses a less direct label. Do not create another global save
button, navigation bar, or publish workflow inside it.

Desktop layout:

| Region | Content and behavior |
| --- | --- |
| Tab introduction | Short title and optional starting-point action; avoid a permanent explanatory paragraph once configured. |
| Left section navigation | Pages; Audience; Opening moment; Schedule & limits. Active state, short current value, and actionable error count. |
| Main editor | Only the selected section. It remains mounted logically in the draft; navigation never discards edits. |
| Right summary | Plain-language display plan, relevant warnings, Test a sample visit, and Check on a real page. |

At roughly 1,000px of available editor width, allow a compact navigation rail,
a flexible main column, and a 230–260px summary. Breakpoints follow the editor
container, not the physical screen: the WordPress/admin shell consumes space.
Below the three-column fit, move the summary beneath the editor. On narrow
screens use wrapping section controls and a collapsible summary; no sideways
scrolling or text hidden behind icon-only controls. Verify 320, 390, 768, 1024,
and 1440px available widths and 200% zoom.

Return to the last selected section while the draft is open. A validation link
or countdown-settings link selects the correct section and focuses the actual
field. Initial entry selects the first section needing attention; otherwise
Opening moment is the useful default for an already configured Campaign.

## Pages

First choice: **Entire site** or **Selected pages**.

- Selected pages supports current WordPress page/post pickers, content types,
  archives, terms, and URL path patterns. Use actual site objects, not the
  prototype's three sample choices.
- Multiple include entries mean **any of these pages**.
- A distinct **Never show on** list always overrides includes.
- Empty selected-page input is incomplete; it must not silently become Entire
  site. Choosing Entire site is explicit and reversible through draft Undo.
- Offer a WooCommerce checkout exclusion shortcut when WooCommerce is
  available, resolving the site's checkout instead of assuming `/checkout`.
- Do not add checkout exclusion to every existing Campaign behind the user's
  back. Offer it in relevant starting points and show it in their review.

For inline Campaigns, include **Placement** within Pages: manual embed/block
instructions or automatic placement controls. Explain the distinction between
being eligible on a page and actually having a placement there. Keep placement
priority separate from overlay competition priority.

## Audience

Start with **Everyone on these pages** and **Specific visitors**. Everyone
shows a short confirmation, not an empty rules canvas. Switching to Specific
visitors reveals one group and Add condition. Do not preselect a restrictive
audience, such as mobile, merely because the user opened advanced controls.

Each group reads **Match all / any of these conditions**. The default for a
new group is ALL. **Add alternative audience** reveals a second group with an
explicit OR separator. Keep conditions together visually; no draggable graph,
operator chips disconnected from rows, or arbitrary nesting.

Example:

```text
Audience 1 — match ALL
  Device is mobile
  URL parameter utm_source is google

OR

Audience 2 — match ALL
  Cart value is at least 75 [store currency]
```

Rules available here include device, daily time window, referrer, URL parameters,
current cart state/value, WordPress login status, and roles. Their existing
entitlements and site dependencies remain visible. Login/role conditions can
participate in a group; a hidden global login filter must not contradict the
audience the editor displays. See server compilation in the rule contract.

Controls and guardrails:

- Multi-value rules use readable selections: mobile or tablet is one device
  rule, and Google or Bing can be values of one source rule.
- Offer operators a rule can actually evaluate. No universal NOT toggle unless
  the vocabulary declares that operator; page exclusions already solve the
  common exclusion need.
- Show a subtle warning for redundant groups or duplicate thresholds. Block
  publish only for demonstrably impossible or incomplete combinations.
- A blank group is incomplete, never an implicit match-everyone branch.
- Removing the last group returns to an explicit Everyone choice, with Undo;
  it cannot happen as a side effect of removing the last row.
- Use stable row/group identities so changes and validation errors do not
  move to another row after deletion or reordering.
- Start with a limit of five groups, eight rows per group, and forty audience
  leaves total. These are proposed product limits, enforced in both runtimes.

Campaign requirements derived from the Goal remain separate and mandatory.
For cart recovery, the visitor must still have items in the cart even if an
alternative audience group matches. Show **Requires a nonempty cart** in the
summary so this restriction is visible and explainable.

## Opening moment

Three explicit modes:

1. **Immediately** — once universal gates and Audience allow it.
2. **Wait for activity** — default for interruptive Campaigns; one or more
   requirements, with **Open when all / any of these happen**.
3. **When a visitor clicks** — one or more explicit element selectors; any
   selected element can request opening. Selector help and an authored value
   are required. It is not mixed into an automatic ALL group.

Automatic requirements include elapsed time on page, scroll depth, inactivity,
desktop exit intent, and scroll back up. Rows show units and editable values
where meaningful. Retain separate, honest names for pointer exit and scrolling
up; do not label mobile scrolling as proof of exit.

Common examples:

- Engaged reader: 20 seconds **AND** 50% scroll.
- Gentle invitation: 30 seconds **OR** 70% scroll.
- Cart reminder: wait at least 15 seconds, then a new exit gesture.
- Mobile help: mobile audience, then 30 seconds of inactivity.

Use inline **Minimum time before automatic opening** only where useful,
especially exit/scroll-up. Do not show a second time field for an ALL group
already containing an equal or stronger elapsed-time requirement. Duplicate
equivalent time gates are normalized or explained, not silently divergent.

Changing to Immediately replaces the active opening mode as one undoable edit.
Inactive rules must not continue affecting the published result. Draft Undo
restores the prior configuration; no hidden second configuration is saved.

Event combinations have explicit restrictions: ALL may combine thresholds
with one gesture, but not require an exit and a scroll-up gesture at the same
instant. Inactivity AND exit is rejected. The message explains the conflict
and offers ANY, without changing the choice automatically.

For ordinary inline forms, offer only meaningful appearance behavior and
explain that placement supplies the location. Preserve any supported existing
inline delays. For content locks, keep required immediate readiness and disable
incompatible opening choices with a reason; do not leave article content
locked behind a timer, exit intent, or an impossible group.

## Schedule & limits

This section has three compact blocks, with advanced controls collapsed:

| Block | Primary choices | Advanced choices |
| --- | --- | --- |
| Schedule | Runs until paused; or start/end dates | Existing daily time-of-day restriction remains under Audience, clearly using the site clock. |
| Repeat appearances | Once per session; days between appearances; every eligible page | Lifetime maximum appearances, stop after closing, stop after completion. |
| Competing Campaigns | Site-wide protection summary | Existing overlay priority and link to shared Visitor experience settings. |

Preserve the distinction between permanent suppression after closing and a
temporary repeat delay. Turning on Stop after closing makes another showing
in a later session impossible; explain that next to the conflicting repeat
choice. A starting point that promises a later repeat must explicitly turn
permanent dismissal suppression off in its review.

Proposed new-Campaign default for interruptive formats: once per session and
stop after completion, with **closing ends automatic appearances for this
session**. This revises the existing default of stopping indefinitely after
dismissal. Do not reset or reinterpret browser records accidentally; the new
setting must state the desired behavior. Existing authored configurations are
not mechanically changed as part of choosing a new starting point.

Session means the current browser-tab session, matching sessionStorage and the
existing recovery behavior. Explain it as **Once per tab session** in control
help. A newly opened/duplicated tab can behave differently depending on browser
sessionStorage copying; do not promise cross-tab or cross-device deduplication.
If cross-tab sessions become a product requirement, revisit this explicitly.

Site-wide automatic limits remain vetoes. The Campaign cannot override them.
The summary names an applicable stronger site limit and links to its setting.
No site-wide setting is mutated by a Campaign starting point.

Explicit opening through an authored click or Reopen button is governed by
one explicit-action policy: retain page/audience/Goal requirements, consent,
schedule, stop-after-completion, and active-overlay collision protection;
bypass automatic timers, display-count pacing, and dismissal suppression.
Label frequency controls **Automatic appearances** and explain the exception
only when an explicit opener is configured. This deliberately revises current
click-trigger behavior, rather than accidentally inheriting two interpretations.

## Starting points and the summary

Offer up to three relevant starting points above the editor, plus Browse all.
Examples are Engaged reader, Cart reminder, and Click to open. Filter by Goal,
format, installed dependencies, and available features. Do not offer a cart
setup for a non-store site as though purchase alone would enable it.

Applying a starting point is not a one-click destructive replacement. Show a
compact review of exactly the sections it changes, then apply one draft patch
with Undo. Existing dates, placement, priority, and unrelated settings remain
unchanged unless explicitly listed in the review. The prototype's immediate
preset replacement is not the production behavior.

The right-hand summary follows Pages → Audience → Opening → Schedule → Limits.
Use ordinary sentences and make alternative groups unambiguous. Long summaries
can collapse details, but never truncate away an OR branch or exception.
Each summary section navigates to its editor. The same summary model supplies
the editor, readiness review, Campaign details, and starting-point comparison.

Missing values show **Needs a value**, not guessed defaults. Readiness uses
the existing save/publish distinction: incomplete drafts remain repairable;
publication requires a valid display contract. Saving a structurally invalid
payload or unknown executable rule is never permitted.

## Testing the settings

Provide two distinct actions:

**Test a sample visit** opens a local drawer with only inputs relevant to the
current rules. It evaluates the unsaved draft using sample facts. Allow time,
scroll, activity, device, source, cart, login/roles, previous appearances,
completion, and schedule time as applicable. It must display **Simulation**.
It creates no Lead, Impression, Conversion, visitor cookie, or analytics event.
It does not claim a real URL is resolved by WordPress from typed text.

Show one result, such as Waiting for scroll, Excluded on this page, or Would
open, with expandable per-group reasons. A matching ANY branch can pass while
another is not evaluated; withheld consent is not rendered as false. Support
reset and deliberate event buttons for exit/click; sliders must not invent
historical exit events.

**Check on a real page** uses the existing authenticated eligibility inspector
with the actual served page/request and the published Campaign. It verifies
placement, selectors, caching, other Campaigns, and actual availability. Show
when the draft differs from the published version. Never publish a draft
implicitly just to test it.

## Interaction quality

- Native labeled controls; keyboard-operable navigation and group actions.
- Preserve focus and caret during edits. Deleting a row moves focus to a
  predictable neighboring action. Adding a row focuses its first missing input.
- Accessible live announcements for group additions, errors, and explicit
  tester results; do not announce the full summary on every keystroke.
- No information conveyed only by color or hover. Support long translations,
  RTL, reduced motion, touch targets, and 200% zoom.
- Keep normal editing fast: summary is derived state, not a second draft;
  section changes do not refetch the Campaign; simulation loads on demand.
- Production uses the real design system and current admin shell. The mock's
  purple accent, decorative copy, and panel dimensions are reference choices,
  not a new independent component library.

## Recommendations requiring product ratification before coding

The layout direction and simple/advanced approach are confirmed. These are
proposed defaults for implementation planning:

1. Grouping and the new workspace are Free core; individual premium rules keep
   their current entitlements. Inactivity and tab-session caps are Free.
2. Audience has bounded groups; Opening has one ALL/ANY group. Arbitrary
   cross-axis scenarios remain out of scope.
3. Authored rules never disappear or substitute automatically when a module is
   missing; suspend the Campaign and explain the repair. Starting-point
   fallbacks may be offered explicitly before application.
4. New interruptive setups repeat at most once per tab session and stop after
   completion; dismissal suppression and explicit click behavior follow the
   policies above.

These are concrete recommendations, not blockers to writing the plan. If any
changes, update the contract and acceptance cases before beginning its dependent
implementation slice. No database table or column change is proposed.
