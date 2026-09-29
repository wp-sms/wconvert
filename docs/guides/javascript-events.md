# JavaScript campaign events

WConvert dispatches three native `CustomEvent`s on `document`. They let your
site react to campaigns without changing how WConvert displays or saves them.
Available in Free and every paid tier for its supported formats.

| Event | When it fires |
| --- | --- |
| `wconvert:open` | An overlay successfully opens or reopens. Opening animations need not have finished. |
| `wconvert:close` | That overlay finishes closing or hiding, including its closing animation. |
| `wconvert:capture` | The successful server response confirms the first accepted Lead submission in the current journey. |

Overlays include popup, floating bar, slide-in, and fullscreen. Inline forms
emit capture only. Next, Back, Skip, acknowledgement/results screens, and content
unlocking do not open or close a campaign. The reopen reminder alone is not an
open campaign. A closing animation interrupted by reopening remains the same
open interval. Navigation/page unload does not guarantee a close event.

Capture fires once per journey, even when optional SMS follows email. It
includes quiz contact capture before or after results. Anonymous results,
offer clicks, validation errors, and failed requests do not fire capture. A
pending capture accepted while hidden still fires once. New journeys can
capture again; this is not person-level deduplication.

Capture acknowledges saving details in WConvert, not provider delivery or
subscription confirmation. It is emitted before the acknowledgement is drawn.
If the server saves a Lead but the browser never receives success, there is no
notification at that point. This API has no replay or guaranteed delivery and
does not replace a Destination.

## Event details and copying IDs

Every event has a frozen `detail` object with three fields:

```js
{
  campaignId: '01...', // Current campaign/family; matches its active variants.
  optinId: '01...',    // Exact design or variant involved.
  displayType: 'popup'
}
```

Both IDs are equal for ordinary campaigns. Display types are `popup`, `inline`,
`floating_bar`, `slide_in`, and `fullscreen`. No names, contact details, answers,
Lead IDs, DOM references, or credentials are included.

In **Campaigns**, click a campaign's name to open its details, then choose
**Copy campaign ID**. If automatic copying fails, the field is selected for
manual copying. **Copy variant ID** in a variant's details gives the ID to
match with `detail.optinId`. Copy the parent campaign's ID to match all its
active variants with `detail.campaignId`.

Renaming and republishing preserve the row ID; duplication creates a new ID.
When a child A/B variant wins, it becomes the campaign under its own ID. Update
listeners targeting the previous campaign ID. Cached pages can still carry the
previous published IDs until refreshed.

## Register before campaigns run

Install listeners before the loader runs, for example in your site's head
script. Native listeners work before WConvert is loaded. There is no ready
callback or replay: a listener added after an immediate popup opens misses that
earlier event. Ensure script optimizers do not delay your listener beyond the
activity you need to observe.

```js
const campaignId = 'PASTE_CAMPAIGN_ID_HERE';
function received({ detail }) {
  if (detail.campaignId !== campaignId) return;
  const message = document.querySelector('#signup-message');
  if (message) message.textContent = 'Your details were received.';
}
document.addEventListener('wconvert:capture', received);
// When your page component is removed:
// document.removeEventListener('wconvert:capture', received);
```

Events are informational and non-cancellable. `preventDefault()` and return
values cannot cancel capture or override display rules. Keep handlers short;
they execute on the page's main thread. WConvert does not await returned
promises. Admin previews and journey simulations emit no public events.

## Pause a video while a campaign is open

```js
const campaignId = 'PASTE_CAMPAIGN_ID_HERE';
let pausedVideo = null;

function opened({ detail }) {
  if (detail.campaignId !== campaignId) return;
  const video = document.querySelector('#article-video');
  if (video && !video.paused && !video.ended) {
    pausedVideo = video;
    video.pause();
  }
}
function closed({ detail }) {
  if (detail.campaignId !== campaignId) return;
  const video = pausedVideo;
  pausedVideo = null;
  if (video?.isConnected && video.paused && !video.ended) {
    video.play().catch(() => { /* The visitor can resume manually. */ });
  }
}
document.addEventListener('wconvert:open', opened);
document.addEventListener('wconvert:close', closed);
```

This resumes only a video the listener paused. Remove both listeners when
tearing down your page component. Sites with their own video controls should
also clear `pausedVideo` when the visitor explicitly chooses to stay paused.

WConvert does not send these events to GA4 or other external integrations.
