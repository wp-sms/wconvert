# Template PR 251 — integration review

Integrated main `f761d5d0` into the template branch as `3e5aaa60`. The single conflict was in the journey-editor test: preserve the improved **Before the assessment** screen name alongside main's **Lines / Add a screen on this line** controls. No template artwork or composition changed during this integration; the full library evidence remains in `../library-polish-2026-10-12/`.

## Review fixes

- Validate the pages, packs, previews and images of **every retained release** before any staging write. Keep all validated objects for rollback. A new regression removes each dependency of an older, unselected release, corrupts an older page and mismatches its manifest identity; all are refused. Complete releases remain selectable for rollback with identical bytes.
- Check unsuccessful capture HTTP status before parsing JSON, so a text/HTML error retains its status and response body.
- Wait for WordPress's observed username focus before typing in the Flow tests. WordPress 6.8.3 selects that field after 200ms; the first run passed 19 cases but one login race typed the password into the username. This changes only test synchronization, not plugin behavior.

## Combined-version verification

- PHP: **2,829 tests, 17,113 assertions passed**.
- JavaScript: **4,329 passed and one 5-second timeout** during the parallel full run. The complete affected builder-shell file then passed **67/67** separately, including the timed-out undo/redo case. The resolved journey-editor tests passed in the full run.
- Staging Worker/R2 tests: **10 passed**, including retained dependency validation. Type generation and TypeScript check passed. Local HTTP verification checked four Free packs, five previews, one image, 16 downloaded setups and refusal of premium access.
- Studio/export tests: **38 passed**. Plugin typecheck, lint and complete Free/Pro builds passed.
- Native WordPress: **eight older-template journeys and four branching/optional-SMS journeys passed** at 320px and 1280px, including local Lead capture. JSON reports are alongside this document. Actual merged-editor screenshots at both widths were visually inspected and saved here.
- Final native Flow run after the login synchronization fix: **20/20 passed**, covering six fixtures, LTR/RTL and widths from 320px to 1440px, layout, keyboard reading order and zoom behavior.

The optional legacy `bin/verify-picker.php` smoke runner completed preference/occasion and earlier prepared-design checks but stopped at `recommend-accessory`: its unconfigured sample has no merchant product IDs, so `CaptureContract` correctly reports `commerce_products`. It is **not counted as a complete picker pass**. Configured commerce verification is recorded in the preceding full-library review; no product-readiness gate was relaxed to make this generic script pass.

## Independent review and boundaries

**Standards:** no documented breaches or blocking judgement findings in the incremental fixes or conflict resolution.

**Spec:** no missing requirements, wrong behavior or scope blockers in the incremental fixes; retained files remain available for rollback and no remote deployment or licence substitute was introduced.

CI and real email/SMS delivery were skipped as instructed. Everything ran in disposable local WordPress or simulated local R2. User-site data was untouched. The earlier full-library review is visual/practical evidence, not a bulk renewal of revision-bound publishing approvals. Outstanding configured-campaign approvals, hosted R2 deployment and licence integration remain separate future work. Merging this code does not publish a template catalogue or release either plugin.
