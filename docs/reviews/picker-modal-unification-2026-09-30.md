# Template modal refinement — September 30, 2026

The campaign setup inspector and featured collection browser now use the same
modal anatomy as the editor and pack browser. Shared `PickerDialogContent`,
`PickerDialogHeader`, `PickerDialogBody` and `PickerDialogFooter` components keep
the header and actions separate from the scrolling document. The editor's
comparison and content review, pack inspection, creation comparison, collection
browser and setup inspection all use those boundaries. A pack list without an
action does not draw an empty footer.

Cards no longer have a use-case selector. Matching campaign setups remain grouped
by canonical design and format; their count is visible on the card. Preview &
details opens screen controls and use-case choices together with practical setup
information. Selecting a use case retains the preview device/screen and determines
the exact setup/revisions used to create the draft. Search, collection membership
and Goal filters still constrain which choices are available.

A single result keeps the ordinary card size. The former special featured-card
layout and its CSS have been removed. Collection introductions are shorter, the
event date and opt-out share a row, and pagination/selection stay outside the
scrolling body. Setup inspection uses preview and guidance columns on desktop,
stacking on smaller windows. Journey, placement, measurement and checklist details
are optional; duplicate journey and publishing text has been removed.

Editor content review retains its existing keep/sample preparation, refusal,
content-lock acknowledgement and Undo behavior. Its actions stay in the shared
footer. Back names its actual destination: comparison when entered from comparison,
or designs otherwise. Pack details keep installation notices and setup inventory
in the scroll body, while Back and Install/Continue stay in the footer. Creation
and installation errors appear beside those actions, so failures remain visible
without scrolling.

Shared Dialog headers align to the start on all sizes. Close controls have a 32px
target, expanded to 44px for coarse pointers. Existing native chip keyboard behavior,
32px toolbar alignment, 44px touch floor, lazy preview loading and revision checks
remain in place.

## Actual WordPress checks

Checked the authenticated shipping admin at `http://wconvert.local`, using the
same-origin responsive review frame rather than the prototype.

- 1280 × 720 setup inspection: modal client/scroll height both 615px; body
  485px/546px; footer bottom 666.74px within modal bottom 667.74px. No horizontal
  overflow. Two-column sample, explicit use cases and every screen are visible.
- Switched shop news to reading preference and inspected Request received.
  Preview choices remain selected; the setup wording changes.
- 320px RTL setup inspection: modal client/scroll width both 284px; no measured
  descendant overflow. Search controls remain 32px with 16px input type.
- Black Friday Before/All stages: ordinary-sized cards, correct counts, disabled
  empty During stage, fixed pagination, comparison tray and footer. Inspect/Back
  restored the collection body to 205px and focused Preview & details.
- Creation comparison: two exact collection setups; screens remain independently
  inspectable; Back returns to the collection. No campaign is created.
- Editor comparison: guide and launch designs, equal 352px fitted stages, native
  screen/device controls, review without applying, retained comparison selection.
- Editor detail: prepared keep/sample content and persistent action footer at
  phone width. No design was applied or saved.
- Store pack: Fieldwork Mobile/Received inspection, Back restores the design
  control; installation was not performed. At 390px, modal height 615px with
  347px/728px body; footer stays within its bottom. At 320px RTL, modal width and
  scroll width are both 284px; no measured descendant overflow.

The measurements inspect modal contents and exclude the renderer's deliberately
unscaled paper. The editor's existing horizontally scrolling navigation is not a
modal overflow. These checks are not native zoom or assistive-technology certification.

## Local verification

TypeScript and ESLint pass. The final affected tests pass (664 tests), including
exact selected setup creation, canonical grouping without a card selector,
collection membership, screen/device retention, comparison return navigation,
refusals and independent preview preparation. Full JavaScript suite: 193 files,
3,492 tests passed. Free/Pro admin builds and Free/Basic/Pro/Elite artifact contracts
pass. CI and real email/SMS delivery remain excluded at the user's request.

Screenshots: [setup](picker-modal-setup-2026-09-30.png),
[comparison](picker-modal-comparison-2026-09-30.png),
[phone pack](picker-modal-pack-phone-2026-09-30.png).
