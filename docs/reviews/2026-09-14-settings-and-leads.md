# Settings A + Leads B implementation review

Approved direction: compact Leads table/detail dialog; Settings category rail
and focused forms; no introductory banner. ADR 0091 records scope and amends
the earlier layout/query decisions. No schema change or CRM lifecycle.

## Standards

Independent review initially found three items: overlapping destination
operations could release the navigation guard early; purpose chips needed
native radio semantics; the new generic saved notice contradicted the design
guidelines. All fixed in `20bdec1`. Targeted independent recheck: **no unresolved
findings**. Per-route pending IDs preserve unrelated route interactivity and
keep navigation blocked until every pending operation settles.

## Spec

Independent review found the same overlapping-operation guard gap and no other
missing, incorrect or unrequested behavior. An out-of-order two-save regression
now passes. Targeted recheck: **no unresolved findings**. The prototype's
fictional Mailchimp account is not a new shipping provider/credential workflow.

## Local verification

- `vendor/bin/phpunit`: **1,905 tests / 9,181 assertions passed**.
- `npm test -- --maxWorkers=2`: **2,359 tests / 100 files passed**.
- TypeScript, full ESLint, PHPStan and source contract: passed.
- Free and Pro admin builds: passed. Existing bundle-size warning remains;
  the lazy editor boundary is preserved and its graph tests pass.
- Free/all Pro loader builds, size budgets and boundary contract: passed.
- Real WordPress filtered `/leads` REST request: HTTP 200.
- `wp eval-file bin/verify-lead-search.php`: nine read-only SQL checks passed,
  including mixed case, Unicode, wildcard literals, newline and backslash.
- Positive-match read against existing retained data confirmed matching
  records and consistent count/group/export scope; no database error. No
  capture data was copied into this report.

An initial full JS run exposed a new directory collision with `settings.ts`
in the source-graph test. Renaming the directory to `settings-page` resolved
it. Two unrelated editor tests timed out under the initial high parallel load;
the complete suite passed with two workers, including both tests. Existing
React act/jsdom navigation warnings remain non-failing.

## Browser verification

Luna checked the real logged-in WordPress admin on desktop and at 390px:
three Settings categories, no intro banner, controls visible, draft cap 3 →
category navigation → Keep editing retained the draft, Cancel cleared it
without saving; destination setup and retention loaded. Leads chips, filters,
compact rows, captured-detail dialog, consent disclosure and Sending issues
loaded. No horizontal overflow or product blocker was observed.

Final follow-up confirmed native-radio ArrowRight navigation from All
submissions to Subscriber collection to Enquiries, with matching route values,
and the actual WordPress privacy-tool links. The browser was left on Visitor
experience. Console output was not exposed by the CUA surface; this is a
visible/render interaction check, not a claim of a clean console trace.

The initial ordinary URL served cached assets; a harmless review query loaded
the current production bundle. Final links use a fresh query. No settings were
saved, no providers contacted through test/re-push actions, no campaigns
changed, and no Leads created/deleted during browser verification.

The throwaway prototype was archived outside the plugin at
`/tmp/wconvert-settings-leads-prototype.Bd3zvO/settings-leads-prototype`, with its
verdict/notes retained. Port 5191's prototype server was stopped.

## Hosted CI

The user explicitly chose to proceed with local validation after GitHub's
account billing/spending limit prevented prior CI runs. No billing settings,
workflows or repository protection were altered. This report does not claim
hosted CI passed. Merge is a separate user decision.
