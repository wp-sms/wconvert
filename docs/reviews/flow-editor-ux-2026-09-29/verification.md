# Flow editor UX implementation

29 September 2026. Implemented in the main checkout after a successful
`git pull --ff-only` (already up to date). This records the initial implementation checks. Follow-up fixes, larger-flow
coverage, and accessibility evidence are in the
[30 September review](../flow-editor-ux-2026-09-30/verification.md). No campaign
was published during testing.

## Delivered

- Readable cards throughout selection: removed whole-card dimming and use
  stronger connection strokes for related/tested paths.
- Compact branching summaries, unchanged full rules in the inspector, unclamped
  connection labels, and larger overview text below 80% zoom. Selected cards use
  the same overview treatment; zoom does not change their geometry.
- Compact follow-up groups with a separate Show questions disclosure and
  Edit individual connections action. Overview explicitly says to ask every
  match; walkthrough counts say visited and samples say predicted.
- One wrapping toolbar with zoom percentage, Fit journey, Show selected screen,
  View options and explicit connection editing. Removed a redundant hint row.
- Shared journey/publication issue projection, issue count/list, markers on cards
  and groups, exact repair navigation, focus restoration and Back to issues.
- Appearance, Visitor journey and Sample answers together in Preview & test.
  Samples disclose seeded future answers and assumed submission, offer Reset,
  and can show their predicted route on the map. Edits clear stale traces.
- Legacy sample/walkthrough transition IDs now match the map's connection IDs,
  including implicit next steps and hidden continuations. Graph IDs are retained.
- Fixed a delayed group-expansion focus action stealing focus from View options,
  and kept issue-badge geometry identical across overview/detail zoom.

No visitor runtime, stored routing schema, database, destination delivery, or
capture semantics changed. No new dependency was added. Design guidance is
updated in `tools/design-system/GUIDELINES.md` §22.

## Automated verification

- Broad journey/map/readiness/repair/sample/test/stylesheet regression run:
  **35 files, 787 tests passed**.
- After the final presentation changes: **610 tests passed**, followed by an
  **80-test** editor/grouping rerun after repair-return navigation cleanup.
  These overlap with the 787 tests; the counts are not additive.
- New regression cases cover issue → exact repair → return, grouped member
  issue targeting, sample assumptions/reset, showing/clearing predicted traces,
  and legacy/graph trace-to-map connection IDs.
- `npm run typecheck` passed. ESLint passed for touched TypeScript/TSX files.
- Free and Pro admin builds passed. Vite still reports the existing large-chunk
  advisory; no claim of a bundle-size improvement is made.
- `git diff --check` passed.

The broad command was:

```sh
npx vitest run tests/js/journey-*.test.ts tests/js/journey-*.test.tsx \
  tests/js/followup-groups.test.ts tests/js/readiness-dialog.test.tsx \
  tests/js/admin-stylesheet.test.ts
```

## Real WordPress checks

Chrome against `wconvert.local`, using the existing Demo 04 Home/Business
campaign. Temporary incomplete-question edits were undone. Save draft was
disabled again afterward; previews created no persisted campaign changes.

| Check | Observed result |
| --- | --- |
| Desktop whole-map and local selection | Compact overview, branch lanes, grouped follow-ups, one shared save and ending. Overview summary text fits the sampled cards. |
| 1280 × 800 laptop | Selected screen and inspector stay usable; group questions disclose separately from connections; toolbar has no internal overflow. |
| 390 × 844 phone | Inspector wraps without horizontal page/form overflow. |
| 320 × 844 | Toolbar wraps to 84px high in a 300px-wide area; page has no horizontal overflow. Sample dialog is 288px wide and scrolls vertically without horizontal overflow. |
| Incomplete question | Issues (1) and a card marker appear. Selecting the issue focuses the question textarea. Undo removes it; Back to issues shows the empty state. |
| Issue overview stability | After the badge geometry correction, Fit settles at 65%, all sampled summaries fit without internal overflow, and the overview badge opens the correct textarea. |
| Sample route | My home plus Garden landscaping and Balcony planting yields two predicted matching follow-ups. Draft stays unchanged. |
| Visitor walkthrough | My business plus Office planting reaches that follow-up. Map reports 1 of 4 visited for its group and does not mark future collection/ending as visited. |
| Keyboard | Enter opens View options, focus enters its menu, Escape closes it and returns focus to View options. Repair focuses the actual field. |

Computed-style spot checks: detailed title `#1d3428` on white is **13.34:1**;
secondary text `#546d5f` on white is **5.63:1**. Ordinary connection `#536f60`
against map `#f3f6f4` is **5.06:1**. The configured hidden connection `#65776c`
against that background is **4.38:1**. Sampled cards and edges retain opacity 1.
These are local measurements, not a complete accessibility audit.

Evidence: [desktop overview](desktop.jpg), [laptop disclosure/inspector](laptop.jpg),
[phone inspector](phone.jpg), [320px toolbar](map-320.jpg),
[sample dialog](sample-320.jpg), [issue overview](issue-overview.jpg), and
[visited path](visited-path.jpg). Browser viewport overrides were reset afterward.
The final refreshed editor reported no captured console errors.

## Remaining validation

The [scenario plan](../../plans/flow-editor-ux-2026-09-29.md) remains the release
acceptance checklist. This implementation does **not** claim full completion of
its human-validation phase:

- Merchant task sessions have not been run.
- Live VoiceOver, full RTL/mixed-direction coverage and actual 200% browser zoom
  remain unverified. The 320px viewport check is not a browser-zoom substitute.
- The broad automated suites cover many capture/result/legacy/branch cases;
  every scenario was not repeated manually against real WordPress.
- Dense 12/20-screen performance baselines and before/after timing comparisons
  remain pending. No performance or new supported-scale promise is made.

Screenshots from third-party infrastructure products informed visual density and
control grouping only. WConvert's routing, capture and testing contracts remain
the deciding constraints.
