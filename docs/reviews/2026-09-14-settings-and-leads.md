# Settings A + Leads B implementation review

The review below records the initial 14 September implementation, not final
visual fidelity. The merchant's subsequent comparison exposed missing prototype
details; the 15 September alignment follow-up is recorded at the end.

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

## 15 September: prototype alignment follow-up

The initial pass preserved the broad information architecture but missed the
approved prototype's search, form hierarchy, compact filters, row/context
details and counts. The merchant requested those discrepancies be corrected.

- Settings A: searchable category rail, contextual back/help links, separated
  fields, readable scope explanations, stable Save/Cancel footer and a review
  of site-wide display values before Apply. No setup banner.
- Connections distinguishes stored accounts from destinations and does not
  claim a stored credential is verified. Local integrations need no remote
  account; the illustrative Mailchimp reconnection remains out of scope.
- Leads B: compact filter disclosure, optional inclusive site-day presets,
  oldest-first keyset paging, server-scoped purpose counts, captured initials,
  available Goal labels, localized wall-time labels and compact Open actions.
  Details prioritize an actual message and offer Campaign/identifier links;
  identifier search clearly leaves current filters without merging contacts.
- Sending issues badge counts distinct affected destination IDs, not failed
  submissions. The existing total is reused for the selected purpose and no
  schema/index/capture behavior changes were introduced.

Verification: full PHP **1,907 tests / 9,205 assertions**, full JS **2,366 tests /
102 files** passed. Lint, TypeScript, PHPStan (512 MB) and source contract passed.
Targeted checks were repeated after the final small filter adjustments. Free
and Pro admin builds passed; existing admin bundle warning remains. The lazy
editor graph remains protected: shared wall-clock formatting moved to `lib`
instead of making Leads import editor code.

Real WordPress `/leads?include_counts=1&order=oldest` returned HTTP 200; all-count
matched the headline and purpose counts fit within it. This read printed no
capture identifiers or personal data. Luna's fresh-build QA confirmed Settings
categories/search/fields and Leads filters/presets/order/counts/rows/details at
desktop and 390 px, with no horizontal overflow. The retained QA capture has
no message; message-first rendering is covered by an interaction test. No
clean-console claim is made.

QA incident: the first browser pass loaded the old Pro bundle (only Free had
been rebuilt). While expecting a review modal, the agent clicked Save and
accidentally persisted a cap of 3; the prior cap was blank. Work stopped, the
root read the current value, restored only that cap to null through the REST
API, and read it back. The other three frequency values were unchanged. Both
builds were then rebuilt and the new DOM verified before a strictly read-only
second browser pass. No leads were created/deleted and no provider test/replay
actions were taken. The incident was disclosed to the merchant immediately.

## 15 September: destination setup and quieter page chrome

- Add a destination now opens a two-step dialog in place: explicit service
  selection, then the existing named-route form. No destination is created by
  opening or selecting a service. Provider prerequisites and tier availability
  remain distinct. Focus moves to Name and returns to the stable Add trigger
  on close; failed saves retain the draft.
- Removed the global Back to Leads Settings action; task-specific export and
  sending-issue links remain.
- Replaced the persistent Leads scope/explanation row with an accessible info
  popover beside the total. Escape closes it and restores focus. Its scope
  follows the last successful read, not a failed replacement query.

Verification: all **2,367 JavaScript tests / 102 files** pass, including chooser
focus/no-write and hidden-help/stale-scope regressions. Lint, TypeScript, source
contract and both Free/Pro admin builds pass. Existing build-size and unrelated
React test act warnings remain. No PHP or storage behavior changed.

Luna verified the fresh WordPress build: centered chooser, provider-specific
actions and prerequisites, MailPoet setup then Cancel, chooser focus return,
no Back to Leads in Settings, and count/export help opening and dismissing
with Escape. Desktop and 390px chooser/Settings layouts had no horizontal
overflow. No save, send, replay, deletion or lead-detail action was taken.

## 15 September: more room for the Leads table

Moved Submissions/Sending issues navigation into the existing page header,
replacing the Leads subtitle. Slim underlined links retain the active route,
issue count and Sending setup shortcut. The separate body navigation band and
its gap are gone; other sections retain their existing subtitles.

All **2,368 JavaScript tests / 103 files** pass, including a header-placement
and view-switching regression. Lint, TypeScript, source contract and both admin
builds pass. Existing bundle-size/test act warnings remain.

Luna verified the fresh build at desktop and 390px: compact header navigation,
no duplicate subtitle, active-view switching in both directions, and the setup
shortcut. Mobile client/scroll widths both measured 390px. No data mutations
or lead-detail actions were taken. No before/after pixel-saving claim is made
because a matching old-build measurement was not retained.
