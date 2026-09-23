# Implementation and verification record

Updated 2026-09-23. This records the implemented scope for #184, including the
product decisions made after the original issue was written.

## Delivered

- JSON v2 linear journeys, with stable screen identities, explicit navigation,
  declared submissions and consent ownership. All 57 Free/Pro designs use the
  new contract. Packs require `template-tree:2` and `capture-journey:1`; collection
  releases advance to 1.4.0. No legacy Template reader or Lead-data backfill is introduced.
- Four Free Templates and translated Playbooks: email-only, offer first, enquiry
  across screens, and email followed by optional SMS. The planning JSON examples
  match those shipping files. Generated authoring vocabulary and guides updated.
- Free screen editing: add, duplicate, reorder, delete, name, submission boundary,
  and optional other-channel signup. Navigation labels have separate copy Roles;
  Playbook copy remains scoped to the appropriate screen/submission.
- Memory-only Next/Back, fixed accepted details, Skip, same-page reopen and a
  30-minute absolute grant. Only explicit accepted submissions persist data.
- One combined Lead and one server-counted Conversion. Each marketing signup
  retains separate exact consent wording/time and starts its own queue handoff.
  Jobs reference frozen accepted values and route IDs; later SMS cannot change
  what an earlier email job sends. No person matching or cross-page resume.
- Promised resources can be delivered with the primary signup or opened from
  the optional signup screen; neither waits for optional consent. Editor readiness
  checks follow declared submissions across screens.
- Existing Lead JSON, owned non-autoloaded options and Action Scheduler. The only
  schema change is the approved statistics scope column/primary key. Installer version 5 reconciles that key explicitly
  because dbDelta cannot replace a primary key. InnoDB is
  required for atomic capture and initial queue handoff; unsupported storage
  fails closed. No new application tables or Lead columns.
- Channel/screen totals beside existing Campaign reporting. Anonymous activity
  is approximate and separated by publication contract. All overall-statistics
  readers filter Campaign scope; browser events cannot assert a form Conversion.
- Lead details, CSV and WordPress privacy export expose both channels' evidence
  without internal grants/receipts. Search uses the new answer envelope. Erasure
  and pruning prevent both continuation and request replay from recreating data.

## Verification performed

- Full PHPUnit suite: 2,072 tests, 10,117 assertions passed.
- Full Vitest suite: 2,615 tests across 124 files passed. Focused editor tests also
  cover optional-screen creation/removal, reorder identities and duplication.
- TypeScript, ESLint, PHPStan, production builds, source contract and loader
  contract checked. `verify-templates.php` accepts all 57 shipping designs.
- Authoring vocabulary, renderer, all-screen previews and six contact sheets
  regenerated from the production sources.
- Real WordPress/MySQL, in separate disposable databases: existing statistics,
  Lead log/retention/privacy and literal-search verification scripts all pass.
  Applying the approved statistics key to an earlier empty-scope schema preserved
  its existing count and kept a new channel count separate.
- `bin/verify-capture-journeys.php` exercises acceptance, replay, independent
  channel payloads, consent, invalid phone, stale contract, expiry, erasure,
  immediate Action Scheduler handoff and one overall Conversion. Six concurrent
  PHP/WordPress connections return one Lead. An exception after queue insertion
  rolls back the job/marker while preserving the accepted signup; recovery
  subsequently hands it off. Recovery processes 120 pending Leads across batches.
  This verifier is also wired into the disposable MySQL CI job.
- Browser checks use the built loaders and real capture controller against the
  isolated WordPress/MySQL site: all four journeys at 390/1440px in LTR/RTL
  (44 screen captures), plus floating bar, slide-in and fullscreen at both widths.
  Back shows a fixed accepted email; SMS adds to the same Lead; Skip keeps email.
  No browser errors occurred. Secondary navigation styling was visually reviewed.
- Pro browser checks confirm that first acceptance unlocks content while optional
  SMS remains available, and same-page dismissal/reopen preserves answers and
  allows completion. Existing runtime suites cover container/focus behavior.

The browser verification intercepts `attachShadow` in the disposable test browser
so Playwright can address otherwise closed form controls; production code retains
closed roots. No real provider delivery or production-site database change was
performed. External provider delivery remains asynchronous and fallible; it is
not an exactly-once guarantee. SQLite capture is not claimed by these checks.

## Reproducing the database verification

Use an isolated WordPress/MySQL database, Composer development dependencies and
an activated WConvert plugin. Disable WP-Cron while inspecting queued actions.
The bootstrap must define `WCONVERT_VERIFY_JOURNEYS` as `true` before loading
WordPress. Then run:

```sh
WCONVERT_VERIFY_BOOTSTRAP=/absolute/path/to/isolated/wp-load.php \
  php bin/verify-capture-journeys.php
```

The verifier creates test Campaigns, Destinations, Leads and queue actions; never
point it at a merchant's database. The CI workflow shows the full disposable-site
setup. Its test Destination does not contact an external service.

## Visitor byte budgets

ADR 0103 records the explicit budget adjustment for flow metadata and the shared
journey runtime. The page cap is 2,560 B gzip and each design's cap is 1,280 B.
The Free loader remains capped at 14,012 B. Paid loaders cap at 19,456 B; nothing
is moved to an unmeasured lazy download. At the final measured build: Free
11,836 B, Basic 17,926 B, Pro 18,904 B and Elite 19,095 B gzip. Build checks remain
hard failures above those ceilings.

## Visual screen manager follow-up

The approved prototype A is implemented in the shared Free/Pro editor. A compact
screen selector and Manage screens button replace the inline management panel.
The dialog shows actual screen previews, order and save-point labels; supports
pointer dragging and accessible move buttons; and returns to the selected screen
on the full-height canvas. Acknowledgement stays last, and the primary submission
cannot move after the optional one. Actions retain campaign Undo and draft Save.
The exploratory journey prototype was removed after recording the choice in ADR
0103. Template JSON and storage are unchanged by this UI refinement.

Verification: the full frontend run passed all 123 behavior-test files; its
stylesheet failures were corrected and the stylesheet and journey suites rerun
successfully (352 tests). TypeScript, full ESLint and both admin builds pass.
Real local WordPress checks covered modal opening/closing, screen selection,
actual preview sizing, adding and dragging a screen, Undo back to the original
draft, and 1440px/1024px layouts. The modal scrolls at shorter heights without
reducing the canvas. The saved Campaign was not changed by these checks.
