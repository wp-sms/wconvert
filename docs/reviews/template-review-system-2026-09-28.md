# Shared template review system — 2026-09-28

The internal library remains **48 prepared campaign setups / 36 referenced
designs**. This change makes reviews repeatable and shared through Git, adds three
business walkthroughs, and prepares 24 distinct briefs for the next batch. Planned
briefs are not created templates and do not increase either library count.

## Implemented

- Shared reviewer attribution, notes and evidence for visual, visitor-route and
  configured WordPress checks. All stages must pass for editorial approval.
- Campaign/renderer revisions and evidence-file hashes invalidate stale approvals.
  Imports validate the whole export before an atomic write, preserve history,
  reject conflicting bases, serialize local writers and accept identical imports
  without duplication. Evidence must remain within `docs/reviews/`, including
  after symlink resolution. This is editorial attribution, not signed identity.
- Studio shared-state filters, local draft export, explicit restore from shared
  records, and `templates:review` / `templates:gate` local commands. Browser edits
  do not silently become shared approvals.
- All 48 existing reviews reconciled from matching recorded versions: the latest
  coverage report supplies 24 complete records; earlier practical evidence for
  the first 24 matches their current campaign revisions, with native WordPress
  evidence supplied by the later coverage report. Importing old evidence is not
  described as a new visual inspection.
- Three local walkthroughs link to real store, service and publisher campaigns,
  with steps and explicit useful outcomes. The checklists do not mark themselves
  passed and are not real-merchant research.
- Next 24 planned briefs: 12 store, eight service, four publisher. Each names its
  type, need, meaningful difference, existing comparisons, proposed design reuse
  or addition, and acceptance checks. Gift/service finders and reading paths
  prioritize missing decision support over industry-only recolours.

## Verification performed on the final implementation

- 12 studio tests passed: duplicate comparison, complete prepared campaigns,
  planned-brief validation, stale/missing evidence, conflict and replay handling,
  invalid exports, path containment and corrupted records.
- All 70 designs survived registration; source-contract checks, ESLint and changed
  PHP syntax checks passed. Visitor bundles and shipping templates did not change.
- Local editorial gate: **48/48 current approvals**. No GitHub CI requirement was
  used for this work, per the user's instruction.
- Browser: shared filter, restored existing evidence, local draft edit/export,
  dry-run import of the actual downloaded file, and restoration of the shared
  decision. The workflow-only test draft was not committed as campaign evidence.
- Studio layout audit: **720 screen cases, zero findings**. Final new review UI
  and walkthrough hub inspected at desktop and a 320px iframe viewport. Both
  documents measured 320px with no horizontal page overflow; review dialog and
  evidence controls also fit. Corrected review selects to 16px text and 44px height
  after the first inspection. Native browser viewport override did not apply;
  the responsive check used actual iframe viewports, not a physical phone.
- Actual WordPress/MySQL: all **48 native campaign checks passed** with the local
  outbox deliberately at its 100-message cap. Unique fictional recipients fixed
  the previous offset-based repeat-run failure. Temporary capacity fixtures were
  removed afterwards. Verification also refuses missing seeded campaigns.
- Live service walkthrough: chose Planting and borders, entered fictional name
  and email, went Back and forward, observed preserved details, submitted, and
  reached “Garden enquiry received”. The database contained exactly one matching
  Lead with `interest=planting` and the submitted name. No booking was claimed.

Evidence is also recorded in the sibling JSON. Screenshots are generated under
`tools/design-library/out/`: `review-controls-320.png`,
`review-live-enquiry.png`, `business-walkthroughs.png`,
`shared-review-studio.png`.

## Scope

External email/SMS delivery was **skipped at the user's explicit request**.
Local mail handoff stays covered. Real-device behaviour, real-merchant conversion
performance, provider delivery and release approval are not asserted. Existing
store coupon/cart and publisher route browser evidence remains in the prior
coverage/practical reviews; this turn did not rerun every one of those routes.

Next work is authoring the 24 planned briefs in reviewed batches, including new
question/result compositions where reuse would produce a lookalike. The broader
100 then 300–500 rollout, asset distribution and conversion measurements remain
subsequent milestones.
