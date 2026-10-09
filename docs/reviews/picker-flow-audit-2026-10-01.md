# Template picker flow audit — 1 October 2026

Reviewed the approved picker A study and the actual authenticated
`http://wconvert.local/wp-admin/admin.php?page=wconvert` implementation. This
continues the 30 September modal unification; it does not approve the unfinished
remote API, entitlement, retention or library-expansion programme.

## Findings and repairs

- Creation cards had competing Preview and Use actions. Cards now lead to
  inspection; the exact setup is created only from the detail footer.
- Card metadata, Save and Compare were scattered. The shared card now has a
  name/Save row, metadata, and a Preview/Compare action row. Selected cards have
  a consistent accent. Creation and the editor share its dimensions and anatomy.
- Full inspection shrank long mobile forms to unreadable thumbnails. It now
  starts at width fit, with a keyboard-scrollable stage and an overflow hint.
  Fit entire design remains available. Comparison deliberately keeps equally
  sized fitted stages. Setup, editor and pack details use the same controls.
- Country preferences required comma-separated codes. The existing searchable
  country selector now displays names and removable selected countries. The
  vocabulary request is read-only and never changes the phone default.
- Failed previews could remain labeled Loading. Failure, retry and unavailable
  states are explicit. An uncertain create result now appears in the active
  modal, links to Campaigns and blocks another create attempt.
- The source filter was misleadingly labeled Collection. It now says Source,
  keeping delivery packs distinct from editorial collections.
- Collection intros repeated themselves and consumed short-window space.
  Description appears once in the header; stage/search controls share a row
  where they fit. Single-format collections omit a redundant filter. One-page
  results retain the count without unusable Previous/Next buttons.

## Actual WordPress checks

Used the shipping admin and REST endpoints, including the same-origin responsive
review frame; no prototype renderer substituted for the plugin.

- Creation: search → details → Back retains the search; collection → stage →
  exact setup detail; desktop/mobile, form/acknowledgement and both zoom modes.
- Country selection: searched United, confirmed named UAE/UK/US choices and
  a contained popup at 390px, then left without changing preferences.
- At 320px RTL with a 720px-high frame, detail controls wrap, actions remain
  reachable, and the dialog width equals its scroll width (284px). The layout
  checker reported no overflowing controls. This is an RTL layout check, not
  a translated-language or assistive-technology certification.
- At 1280px, editor selection → two-design comparison → Review this design
  prepares the existing draft's real content. Mobile and Fit entire design
  work, facts remain beside the preview, and Back to comparison stays in the
  footer. No candidate was applied.
- Editor → Template packs → Store collection → Fieldwork moves screen choices
  into detail. Mobile, Received and zoom controls work; at 390×720 the Back and
  Install actions remain reachable. No pack was installed.
- Short-window collection inspection uses the shared scrolling body and fixed
  pagination/action regions; cards retain their normal size.

No campaign was created, saved, published or replaced during these browser
checks. No preference was changed and no email/SMS was sent.

Screenshots: [setup detail](picker-flow-detail-2026-10-01.png) and
[editor comparison](picker-flow-comparison-2026-10-01.png). These include the
responsive harness around the actual WordPress frame.

## Local validation

- Full JavaScript suite: 193 files, 3,499 tests passed.
- After the final compact-collection/pagination refinements and added failure
  regression: all seven affected files, 679 tests passed. These overlap the
  full suite and are not an additional independent test count.
- Final TypeScript and ESLint checks passed.
- Free and Pro admin builds passed, including the final layout changes.
- Free, Basic, Pro and Elite artifact contracts passed during this audit.
- No CI run, merge or real-delivery testing, per the user's scope.

The automated checks cover failed preview retry, exact prepared setup identity,
uncertain creation recovery without duplicate POSTs, server-confirmed market
preferences after failed writes, page recovery and existing content preparation.
Browser evidence establishes the checked views above, not every possible
catalog, locale, native browser zoom or external service configuration.
