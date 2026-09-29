# Campaign JavaScript events and copying campaign IDs

Status: implemented, 29 September 2026. See the
[verification record](../reviews/2026-09-29-campaign-javascript-events.md).

The contract below is the accepted implementation scope. A small additional
cleanup shares the identical Free/paid capture-request function to keep every
loader inside its existing size limit; request behavior is unchanged.

## Purpose

Give site developers three dependable notifications so their existing page code
can respond when a campaign opens, closes, or captures a lead. Make the existing
campaign ID easy to copy when writing a listener for one campaign.

Examples: pause a playing video while a popup is open, restore a competing page
widget after it closes, or update a page message after a successful capture.
GA4 and other analytics integrations are separate future work.

## Agreed scope

- Three public events: `wconvert:open`, `wconvert:close`, `wconvert:capture`.
- Native listeners on `document`, available in Free and all paid builds for the
  campaign types each build already supports.
- A copy action for the existing ID in the existing campaign details dialog.
- Developer documentation and focused behavior tests, including real-browser QA.

No new IDs, readable slugs, database changes, REST endpoints, settings pages,
custom-code fields, dependencies, SDK, programmatic opening/closing, cancellable
hooks, event history, analytics events, or automatic forwarding to other tools.
No new visitor storage, identifiers, network requests, or telemetry.

## Public contract

### Event delivery and payload

Dispatch a native `CustomEvent` directly on `document`. Use the same detail shape
for all three events:

```ts
interface CampaignEventDetail {
  campaignId: string;
  optinId: string;
  displayType: string;
}
```

- `campaignId`: `entry.campaign ?? entry.id`, the existing campaign/family ID in
  the published payload. Use this to match a campaign across its active variants.
- `optinId`: `entry.id`, the exact design/variant involved in the event. For an
  ordinary campaign both IDs are equal.
- `displayType`: the normalized actual display type: `popup`, `inline`,
  `floating_bar`, `slide_in`, or `fullscreen`. Free code forwards the runtime
  value without importing or registering paid display implementations.

Create a fresh, frozen detail object for each dispatch. Include no campaign
name, DOM/form reference, email, phone, answers, Lead ID, capture grant, or
internal configuration. Names remain editable admin labels, not matching keys.

Events are notifications. `cancelable` is false; `preventDefault()` has no
effect on WConvert behavior. Dispatch after the relevant internal state is
committed. Do not inspect listeners' return values or await promises. Native
listener exceptions must not turn a saved capture into a failure or prevent
WConvert's normal processing. External code still runs on the page's main
thread; documentation should keep handlers short.

There is no replay, queue, ready event, or public registration helper. Listeners
can be installed before WConvert loads, using `document.addEventListener`.
They must be installed before the activity they need to observe; a listener
added after an immediate popup opens will not receive that earlier event.
Document script ordering for delayed/optimized scripts without adding another
script loader or dependency-order mechanism.

### `wconvert:open`

Emitted when an overlay has successfully become open: popup, floating bar,
slide-in, or fullscreen. It represents the overlay becoming available on the
page; it does not wait for an opening animation to finish.

- Once per closed-to-open transition, including a successful reopen.
- No event for eligibility checks, failed mounting, failed modal opening,
  repeated `show()` while already open, or changing the current journey screen.
- A popover fallback that successfully displays its fixed-position container
  is a successful opening.
- A reopen reminder button alone is not an open campaign. Restoring only the
  reminder on another page emits nothing until the full campaign opens.
- Inline forms do not emit open events, including content-locked inline forms.

### `wconvert:close`

Emitted when a previously open overlay has actually finished hiding/closing.
For animated popovers, this is completion of the closing transition or its
existing fallback timer. For dialogs, it is the actual closed lifecycle.

- Includes visitor dismissal, an explicit close action in a journey, and a
  runtime-driven hide/teardown of an open overlay.
- Once per open-to-closed transition. Repeated close calls, duplicate native
  events, or disposal of an already hidden mount emit nothing.
- Internal screen replacement, changing to acknowledgement/results, and
  inline content unlocking do not close an overlay.
- Showing, updating, or dismissing the small reopen reminder emits nothing.
- If a closing animation is interrupted by reopening before the overlay has
  fully hidden, it remains one open interval: no stale close event afterward
  and no second open event for that interrupted transition.
- Navigation/page unload is not a close notification and is not guaranteed to
  produce one. Do not add unload listeners to synthesize it.

Do not include a reason field in v1. All closes serve the same page-coordination
use case, and a close must not be described as an analytics dismissal.

### `wconvert:capture`

Emitted once when the browser receives and validates the successful response
for the first accepted lead submission in this mounted capture journey.

- Includes inline and overlay forms, enquiries, email-only/SMS-only forms,
  and a quiz's first accepted contact submission before or after its result.
- Does not fire for clicking Submit, passing client validation, starting a
  capture grant, an error, timeout, invalid response, anonymous quiz result,
  offer-link click, or resource download.
- Optional later SMS/email capture adds to the same Lead and does not emit a
  second event. Back, Next, Skip, reviewing submitted fields, repeated clicks,
  and reopening the same mount do not reset this guarantee.
- A pending submission accepted while its campaign is hidden still emits
  capture once. It does not reopen the campaign or produce another close.
- Commit the accepted-submission state before notifying. Emit independently
  of rendering the next screen, so an acknowledgement rendering failure cannot
  erase a successful capture notification. It is not an acknowledgement-visible
  event.
- A genuinely new journey on a later page can capture again. Do not introduce
  person-level, cross-tab, or persistent deduplication.
- If the server saves a lead but the browser never receives success, there is
  no event at that point. A later successful retry in the same mount emits at
  most once. This is a browser notification, not a guaranteed delivery channel.

Capture means local acceptance by WConvert. It does not promise provider
delivery, inbox receipt, or confirmed subscription. Conversion counting,
frequency rules, destination queuing, and existing consent checks remain owned
by their current implementations.

## Existing IDs and admin behavior

Campaigns already have a 26-character ULID and an editable name. Keep both.

Add a compact read-only ID field and **Copy campaign ID** button to the existing
campaign details dialog in `resources/admin/src/optins/OptinList.tsx`. Keep it
outside the asynchronously fetched details so copying still works if the
audience/destination summary fails to load. Do not add another settings pane or
put the long ID in every list row.

- Copy the full `selected.id`; never copy a shortened display value.
- Ordinary campaign: label `Campaign ID`, action `Copy campaign ID`.
- Variant details: label `Variant ID`, action `Copy variant ID`. Help explains
  that this value matches `detail.optinId`; the parent campaign's ID matches
  `detail.campaignId` across its active variants.
- Available for saved drafts, live campaigns, paused campaigns, and suspended
  campaigns. Copying neither saves nor publishes anything.
- Announce success accessibly. If the clipboard is unavailable or refuses,
  focus/select the read-only field and explain manual copying. Do not report
  success when the write failed.
- Reuse the accessible pattern in `builder/ManualPlacement.tsx`. If sharing
  implementation is worthwhile, extract only its small copy-field component
  with explicit labels; do not create a generic clipboard service.

Renaming or republishing a campaign leaves its row ID unchanged. Duplication
creates a new ID. There is one existing A/B limitation to state clearly:
declaring a child variant the winner promotes that row to campaign, so the
family ID changes to the winner's ID. A listener targeting the old family may
need updating. Existing cached pages can retain their previous published IDs.
Do not promise permanent family identity or change the A/B/storage model in
this feature.

## Implementation map

### 1. Shared event emitter

Add `resources/loader/src/events.ts` containing the small event-name/detail
contract, identity normalization, and dispatch function. No global mutable
registry or runtime framework. Paid loaders import this shared Free module.
Keep it outside the renderer's import graph so importing the renderer for admin
previews does not bring public event dispatch with it.

### 2. Real overlay transitions

Add narrowly scoped optional lifecycle callbacks to `MountOptions` in
`resources/renderer/src/mount.ts`, such as `onOpened` and `onClosed`. Containers
call them at successful transitions; the live presenters supply callbacks that
dispatch public events. Admin/gallery previews supply none.

Wire and verify these paths:

| Path | Implementation location |
| --- | --- |
| Free popup | `resources/renderer/src/mount.ts` and `resources/loader/src/present.ts` |
| Paid floating bar / slide-in | `pro/modules/display-types/loader/popover.ts` and `present.ts` |
| Paid fullscreen | `pro/modules/display-types/loader/fullscreen.ts`, using the shared modal lifecycle |
| Reopenable popup / slide-in | `pro/modules/display-types/loader/reopen.ts` |

Keep the minimal open/closed guard with the actual container lifecycle. All
paths including close button, Escape, backdrop, native dismissal and runtime
close must converge on it. Publish close after its DOM transition has completed;
preserve existing dismissal accounting, which may intentionally happen earlier.

Do not republish `wconvert:shown` / `wconvert:closed` from the shadow-root
renderer. Those internal events manage screen observers and teardown:
`parts.step()` currently emits `wconvert:closed` when replacing a screen.
Likewise, `onDismiss` and analytics impressions are not public open/close hooks.
Fullscreen's surface cleanup can run on more than one path, so it must not be
used as an unguarded close notification.

### 3. First accepted capture

Use the existing `accepted` set in both journey implementations:

- `resources/loader/src/journey.ts`, wired by `captureInto` in `present.ts`.
- `pro/modules/journeys/loader/journey.ts`, wired by `premiumCaptureInto` in
  `pro/modules/journeys/loader/index.ts`.

Introduce a dedicated optional first-lead-accepted callback, wired only by the
live capture presenters to the shared emitter. Call it on `accepted.size === 1`
after acceptance state is committed and before fallible next-screen rendering.
Do not create a second submission/request path or add a persistent dedup key.

The current paid `onCaptured` callback is tied to conversion and is suppressed
when a result screen exists (`resultAt < 0`). It cannot directly represent the
public capture contract. Keep its conversion behavior intact and notify the
new first-lead callback for quiz captures as well. `onCompleted` stays quiz
conversion behavior, not a lead capture notification.

Do not emit from `controls.convert()` or `beacon.ts`: anonymous results and
offer clicks convert without a Lead, and accepted captures can be counted on
the server without sending a browser conversion beacon. No new public methods
are needed on `OptinControls`.

### 4. Copy ID and documentation

Implement the small details-dialog control above. Add
`docs/guides/javascript-events.md`, link it from README, and document:

- The exact three events, timing, payload, and supported display types.
- Where to copy campaign and variant IDs, including the winner caveat.
- Installing a listener before the activity occurs and removing it with
  `removeEventListener` when a page component tears down.
- Capture acceptance versus provider confirmation and notification limits.
- Preview silence, non-cancellation, and no personal data in event details.

Use plain site-behavior examples, not GA4, GTM, or Meta snippets. Include one
campaign-filtered example:

```js
const campaignId = 'PASTE_CAMPAIGN_ID_HERE';

document.addEventListener('wconvert:capture', ({ detail }) => {
  if (detail.campaignId !== campaignId) return;
  const message = document.querySelector('#signup-message');
  if (message) message.textContent = 'Your details were received.';
});
```

For a video example, remember whether the video was playing before pausing it;
resume only that video if appropriate, and handle a rejected `play()` promise.
Do not start a video that the visitor had paused themselves.

Record the public contract in an ADR during implementation and link it from
the relevant Optin/Capture journey domain sections. Amend existing ADRs only
if their actual statements change. ADR 0110 records the implemented contract.

## Verification and acceptance

Test behavior at the runtime boundary; avoid tests that just mirror the event
helper's implementation. Extend existing suites where they already model the
behavior, adding a dedicated public-events suite for cross-path assertions.

| Scenario | Required result |
| --- | --- |
| Each supported overlay opens and closes | One open and one close, correct IDs/type |
| Mount fails / show fails / conditions reject | No public open or close |
| Next / Back / Skip / acknowledgement / result screen | No extra open or close |
| Animated close plus fallback timer | One close, after hiding |
| Interrupted animation then reopen | No stale close or duplicate open |
| Repeated show/close and delayed native close callbacks | Events match actual transitions |
| Reminder restored, dismissed, or updated | No overlay event from the reminder itself |
| Full hide then reopen same mount | New open, same capture state |
| First acknowledged capture | One capture after committed acceptance |
| Invalid form / rejected response / timeout / malformed success | No capture |
| Double click / retry / Back / optional other-channel capture | No duplicate first-capture notification |
| Pending capture succeeds while hidden | One capture, no forced opening |
| Quiz capture before or after result | One capture; existing conversion count unchanged |
| Anonymous quiz / offer click / resource click | No capture |
| Inline capture including content locking | Capture only; no open/close |
| A/B campaign and variant IDs | Family and exact-design filtering work |
| A listener throws or calls preventDefault | Capture and campaign behavior continue |
| Payload inspected / mutation attempted | Only allowed frozen primitive fields; internal state unaffected |
| Editor, gallery, preview, journey test tool | No public events |
| Clipboard succeeds or fails | Correct full ID; accessible success or manual fallback |

Relevant existing suites include `tests/js/renderer-mount.test.ts`,
`loader-present.test.ts`, `capture-journey.test.ts`, `optin-list.test.tsx`,
`builder-preview.test.tsx`, and paid `popover-container.test.ts`,
`fullscreen-container.test.ts`, `reopen.test.ts`, `premium-journey.test.ts`, and
`loader-boundary.test.ts`.

After focused tests pass, run the appropriate existing project checks:

```sh
npm run typecheck
npm run lint
npm test
bin/verify-source-contract.sh
npm run check:loader
npm run build:admin
npm run build:admin:pro
```

Run the existing real-browser popup/fullscreen/reopen harnesses for native
dialog events, transition timing, and reopening races; jsdom alone cannot prove
these. Verify on a real WordPress instance using the README Playground setup:
Free first, then paid builds for the supported types. Use local capture only;
external recipient sends are not needed. Attach a listener before loader startup
to record events, exercise one multi-step capture and one quiz capture, and
verify the details-dialog clipboard UI by keyboard.

Record before/after gzip sizes for every loader against the actual constants
in `bin/check-loader.mjs`; older README/TODO size descriptions can be stale.
Keep existing budgets. If they fail, inspect the measured addition and reduce
it before proposing any separate budget change. Do not silently raise limits.

## Delivery order and completion

One feature branch and one reviewable PR are sufficient, with these work chunks:

1. Shared contract/emitter and overlay lifecycle wiring, including reopening.
2. First accepted lead notifications in both journeys, without changing counts.
3. Copy ID control and accessible fallback.
4. Documentation, focused tests, required checks, and real-browser/WordPress QA.

Complete when all three events meet the contract in live Free/paid runtimes,
previews remain silent, IDs can be copied, tests and bundle checks pass, and
documentation accurately states timing and limitations. No analytics integration
or larger extension framework is required to finish this feature.
