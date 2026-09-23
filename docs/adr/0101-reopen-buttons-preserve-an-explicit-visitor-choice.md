# Reopen buttons preserve an explicit visitor choice

**Current budget amendment — [ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md):** The page payload cap is 2,560 B gzip (per-design 1,280 B). Free loaders remain 14,012 B; paid loaders cap at 19,456 B. Earlier measurements below are historical. All remain hard checks.

Implements [#178](https://github.com/wp-sms/wconvert/issues/178), part of [#165](https://github.com/wp-sms/wconvert/issues/165). Amends ADRs [0011](0011-non-modal-overlays-use-the-popover-top-layer.md), [0017](0017-no-visitor-identifier.md), [0019](0019-analytics-stores-daily-counters-not-events.md), [0044](0044-there-is-no-visitor-facing-error-state.md), [0047](0047-site-wide-frequency-is-the-same-shape-at-a-second-scope.md), [0014](0014-pro-replaces-the-loader.md) and [0029](0029-the-free-contract-is-proven-at-the-source.md).

## Visitor choice

An optional Pro reopen button appears after a visitor deliberately closes a popup or slide-in. It is a presentation of the same Campaign, not a new Display Type, Template step, trigger, or automatic interruption. All paid tiers include it. Existing Campaigns remain unchanged until enabled.

The reminder has separate native reopen and dismiss buttons. Its close control is mandatory. Popup expansion retains native modal behavior; slide-in and reminder remain non-modal. Logical corner, safe-area spacing, inherited colors/font and mobile overrides keep it usable beside theme controls. Arbitrary third-party collision detection is out of scope.

Cross-page recovery restores only the reminder, never the full Campaign. A click revalidates conditions, consent, schedule and stop-after-conversion at Campaign/site scope. Automatic triggers, impression caps, cooldown and stop-after-dismiss do not veto that explicit request. No persistent dismissed flag is cleared. Expiry or observable eligibility loss hides the unconverted presentation without inventing a dismissal.

One eligible restored reminder claims the overlay slot before any new automatic overlay. Temporarily ineligible recovery reserves nothing; a successfully mounted new owner replaces the dormant record. Once claimed, hiding or dismissing a reminder never releases that document's slot. An exact arm is recovered; a changed selection or Basic downgrade cannot relabel the old reminder as a new offer. The generic `campaign` owner in the payload lets Basic respect session refusal without importing A/B assignment.

## Storage and capture

The versioned `wcv_teaser1:<capture endpoint>` sessionStorage key is scoped to the site's existing REST endpoint. It contains an active Campaign/arm pair and at most 64 stopped Campaign families. Exceeding that bound suppresses teaser-enabled Campaigns for the tab session; it does not suppress inline or non-teaser campaigns. It stores no contact values, cached template, visitor ID, or random identifier. Corrupt storage is ignored; blocked storage falls back to current-document memory. Browsers can copy sessionStorage when duplicating tabs or restore it with a session; this is browser page-session scope, not a promise that closing a physical tab erases everything.

This is functional state recording explicit dismissal/recovery choices, and an exception to ADR 0017's single **persistent** key. `wcv1` and its fallback ladder remain unchanged.

Hiding and reopening retain the mounted form and pending request on the same document. Navigation does not store or replay fields or a request. A late successful capture becomes a same-document “Submission received — View details” reminder without expanding or stealing focus. Explicit reminder dismissal prevents resurrection. It opens the existing success content and cannot submit again. Unconfirmed response behavior remains ADR 0073's existing contract.

## Counts and composition

No stat kind, database schema, visitor endpoint, or attributed recovery metric is added. Each document counts at most one full impression, one deliberate full dismissal, and one conversion for this presentation. Reminder-only display/closure counts nothing. A new document opening the full Campaign counts its own impression. Dismissal and conversion overlap; their subtraction from impressions is not an abandonment metric.

Pro composes recovery through a generic presentation-session seam. Free contains no recovery runtime or session-storage implementation. Only needed condition listeners survive the initial presentation; trigger listeners settle normally. Temporary hide/show resumes clocks and cancels stale slide-in closing transitions.

Settings live in `config.teaser`, outside the Template. The published HTML encodes them as a trailing-default-trimmed tuple `[label, cornerIndex, gap, background, foreground, mobile]`; mobile is `[visible, cornerIndex, gap]`, with corner order top-start, top-end, bottom-start, bottom-end. Pro decodes it at composition. This kept the five-divergent-campaign fixture within the unchanged payload budget (the descriptive wire object measured 2,072 B). A trimmed plain-text label of 1–80 Unicode characters is required; defaults are omitted. Popup/slide-in switches preserve settings, incompatible format changes clear them in the same undoable edit. Free preserves passive settings and explains that execution needs Pro. Pro controls and the visual preview load lazily; previews do not call visitor storage, capture or counting. The enable label uses the normal body size with on-demand help. When enabled, a Reopen button screen sits beside the form and success screen controls in the shared editor canvas, using its Desktop/Mobile and zoom controls. Closing a form in interactive preview reaches that screen; its button returns to the form. There is no second preview inside the settings panel. This extends the screen controls in [ADR 0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md).

## Budget decision

Clean baseline gzip: Free 10,524 B; Basic 12,535 B; Pro 13,506 B; Elite 13,694 B. The original shared cap was 14,012 B, leaving Elite 318 B. The recovery core reached 15,329 B before mobile controls; four safe minifier configurations saved at most 19 B. The user explicitly approved **18,432 B (18 KiB) for paid loaders**, keeping **Free at 14,012 B**. These remain hard build checks. The 2 KiB per-page payload budget is unchanged; no visitor cost moves to an unmeasured lazy request.
