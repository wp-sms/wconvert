# 0138: One Preview, one review, one Details

Date: 2026-10-10. Status: accepted.
Amends [0134](0134-one-edit-tab-look-screen-element.md) (the Preview menu),
[0129](0129-display-rules-plain-questions-and-quick-picks.md) (Test a visit),
[0108](0108-explicit-journey-graph-and-legacy-migration.md) (the previewed
result), [0102](0102-content-lock-is-an-optional-inline-capture-journey.md) (where content lock is
simulated), [0088](0088-handoff-state-and-required-fixes-lead-the-review.md) (the measurement disclosure), [0137](0137-details-and-previews-read-at-a-glance.md) decision 2
(Details), [0131](0131-one-way-to-show-each-thing-in-the-admin.md) decision 1
and [0110](0110-integrations-share-setup-and-map-extra-answers-per-campaign.md)
(the stale "Preview & test"). GUIDELINES §"One modal layout" carries the rules.
The before/after mockups were the review gate.

After 0137 the editor was still hard to read in four places:

- **Preview was five ways to look at one campaign.** A menu of As a visitor,
  This screen, Try answers and Test a visit; a standalone single-screen preview
  behind three eye buttons (the screen panel, the map node, route settings),
  with an empty toolbar row, a "Result to preview" label touching the dialog
  edge and "Appearance only" in its subtitle. Try answers predicted the path
  that As a visitor already runs and explains; This screen and the standalone
  preview repeated the canvas, which already shows the selected screen and the
  result being edited.
- **Review & publish had seven sections** and folded what counts as success
  into "Measurement & setup details".
- **Two dialogs called Details showed different halves** of a campaign: the
  editor's had the Goal, the list's had How it runs.
- **A quiz or basket design read as unfinished** in Details: act `match` and
  `add_to_cart` fell into "Choose what a visitor does in the editor."

## Decisions

1. **One Preview button, no menu.** It opens one Large dialog titled with the
   campaign's name, meta "Preview · Nothing you enter is saved or sent.", and
   two tabs:
   - **Try the form** — the real form (`JourneyTest`), Desktop | Mobile, the
     screen on show named in the toolbar, and beside it **What happened**: the
     numbered screens visited, the result shown on its step, skipped and
     not-yet-reached screens as one muted line each (Edit condition stays on a
     skipped one), Why this path?, and Show this path on the map. Every
     simulation — a failed save, a failed delivery, products unavailable or
     not loading — is one closed **Simulate a problem**. The footer is Start
     over and Done; the per-session run counter went. Test this change opens
     this tab with a one-line banner naming the change.
   - **Who sees it** — what Test a visit was, now a tab body: the visitor
     grouped as Where, Who, When and Basket (a group the rules never ask about
     is not drawn), and one verdict with **Fix in Display rules** when it does
     not show.
2. **Removed:** Try answers (`JourneySample`), the This screen mode, the
   standalone screen preview (`JourneyScreenPreview`) and its three eye
   buttons, and the Try answers / Test journey buttons that only rendered
   without a canvas. **The canvas is the place to look at one screen**; a
   result screen's variant is chosen in the screen panel and drawn there. The
   content-lock states stay on the canvas's Locked content preview row.
3. **Review & publish answers "is it ready, and what goes live"**, top to
   bottom: one blocker callout ("N things to fix before publishing"), each
   problem a sentence with a fix button named for where it goes (Choose a
   service, Fix in Display rules, Choose a design…) and Keep in WConvert only
   or Try again where they apply; the thumbnail and **Counts as success** —
   the Goal's `headline_label` with its `measurement` sentence, never folded
   away; **How it runs**; then **N things to review**. Privacy is one fact line,
   **Consent**, and its problems are review items (the policy-page one links
   to its setting; a hidden consent checkbox opens on itself). The footer is
   Preview beside Publish.
4. **How it runs is one list** — `optins/campaignFacts.tsx`, read by Review
   and by both Details. Who, Where, Opens, How often, Runs from the rule
   summaries; then what the visitor does: **Leads go to** (with **Collects**
   in Review), **Visitors go to** with the links, or **Visitor action** —
   "Shows a matching result" for `match`, "Adds to the basket" for
   `add_to_cart`, each with "Counts {headline_label}". Only a design with no
   converting act reads "Choose what a visitor does". In Review each rule's
   answer is a link to its section, and Placement says the position, reopen
   button, inline placement or content lock.
5. **Details is one body** — `optins/CampaignSummary.tsx`: the notice, the
   thumbnail (the list's), the **Goal** (its label, "Counts as success:
   {headline_label}", the measurement, and Change goal in the editor), the
   results under the Goal's `rate_label` rather than "Conversion rate", How it
   runs, the product check, then the host's own sections, then For developers.
   The list reads How it runs from the saved campaign; the editor from the
   draft in hand. The editor keeps Analytics, Product activity, Journey report
   and Developer tools below the shared sections, and its footer is View
   report and Close; the list's stays ⋯, View report and the editor.

## Consequences

- `GET /wconvert/v1/goals` carries `rate_label` (the Goal's `rateLabel()`,
  which the dashboard already sent).
- `JourneyEditor` takes `previewTitle` and a `whoSeesIt(close)` render prop,
  and its `testRequestMode` is `'journey' | 'visit'`; `appearancePreview`,
  `JourneyMap`'s `onPreview` and `GraphRouteSettings`' `onPreview` are gone.
- `SampleVisit` renders a tab body and footer, not a dialog.
- `ReadinessDialog` loses `policyUrl`; campaign issues still take it.
- No storage, route or schema change.
