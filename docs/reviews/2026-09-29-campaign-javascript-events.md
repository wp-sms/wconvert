# Campaign JavaScript events — verification

29 September 2026. Implementation follows the
[plan](../plans/campaign-javascript-events.md) and
[ADR 0110](../adr/0110-public-browser-events-describe-campaign-outcomes.md).

## Changes

- Three non-cancellable document notifications with frozen identifier-only
  payloads: open, close, first accepted capture.
- Container callbacks report actual overlay transitions. Internal screen
  teardown stays internal; delayed native dialog events cannot hide a reopened
  campaign. Closing animations notify only when finished, unless interrupted.
- Free/paid first-lead callbacks are independent of conversion accounting.
  Quiz captures notify before or after results; optional SMS does not notify
  again. Admin renderers receive no public notification callbacks.
- Existing campaign/variant IDs are copyable from the details dialog, including
  clipboard refusal fallback. No extra requests or persistence were added.
- Identical capture-request code extracted unchanged into one shared module to
  keep all loaders under their existing limits.
- Public guide, developer examples, focused integration tests, and a disposable
  WordPress browser suite registered in frontend CI.

## Automated checks

- Full Vitest run with four workers: **183 files, 3,427 tests passed**. A variant
  ID-copy test added afterward also passed (3,428 distinct tests in the final
  suite). The earlier unrestricted run had one unrelated editor-style timeout;
  its complete suite passed separately and in the full four-worker run.
- TypeScript, ESLint, Free/Pro source contract, and loader/phone budget checks
  passed. Free and paid admin builds passed.
- The disposable PHP fixture passed PHP syntax checking.
- Focused cases include failed/malformed/unconfirmed requests and retry,
  hidden accepted capture, acknowledgement rendering failure, quiz captures on
  either side of results, screen navigation, duplicate/stale lifecycle signals,
  interrupted animations, restored reminders, listener exceptions, preview
  silence, family/variant IDs, and clipboard failure.

## Real WordPress / Chromium

`npm run test:visual:events` uses the existing disposable Playground harness,
with local captures and mail suppressed. Five initial browser cases passed:

1. Free loader: accepted email then SMS produces one capture, no screen-change
   close, and a native Escape close.
2. Paid loader: anonymous quiz result produces no capture; optional contact
   submission produces one capture with the documented fields.
3. Native popup: full close/reopen cycles notify individually; next-page
   reminder restoration stays silent.
4. Slide-in: rapid reopen cancels the pending close notification; a subsequent
   completed close notifies once.
5. Real admin: keyboard copying yields the exact ID; gallery/details previews
   emit no public events.

A sixth fullscreen case passed separately: opening and native close notify,
and the page scroll lock is restored. The admin case additionally checks a
320px viewport so the ID remains readable and inside the viewport.

The browser fixture explicitly configures phone country and quiz result links,
and unpublishes disposable campaigns between independent cases so they cannot
compete. Its initial failures were fixture setup/isolation issues, corrected
without weakening product validation or changing campaign arbitration.

Screenshots are generated under `tools/visual-tests/out/events/` (ignored).

## Loader sizes

Measured with the repository's gzip -9 contract. No limits changed.

| Loader | Before | After | Limit |
| --- | ---: | ---: | ---: |
| Free | 14,107 B | 14,277 B | 14,336 B |
| Basic | 24,611 B | 24,795 B | 24,832 B |
| Pro | 26,146 B | 26,355 B | 26,368 B |
| Elite | 26,426 B | 26,607 B | 26,624 B |

## Boundaries

No external provider sends, GA4 integration, new slug, new database storage,
programmatic campaign API, or analytics changes. Events are browser-side
notifications, not guaranteed delivery. Renaming preserves IDs; promoting a
child A/B winner can require updating a listener's family ID, as documented.
