# Runtime and product contract

Implemented contract; read with [the plan](README.md). The browser-extension
compatibility matrix remains release qualification work.

## 1. Audience rule

Proposed saved leaf:

```json
{
  "id": "stable-editor-row-id",
  "type": "ad_blocking",
  "value": "detected"
}
```

`value` is exactly `detected` or `not_detected`. It is stored inside existing
`config.display_rules.audience.groups[].rules`, never as a parallel setting.
Use a manifest-driven single-choice control with explicit allowed values and
matching PHP/TypeScript validation. Blank known rows remain repairable drafts;
publishing requires a valid value. Reject unknown values rather than coercing
them to a boolean.

Manifest: `kind: condition`, `tier: pro`, `requires: null`, no substitute,
`on_absence: suspend`. Use `consent_category: null` under the existing
no-persistent-storage contract, consistent with other document-only conditions.
That is a technical classification, not a claim about legal consent obligations.
Do not use device storage or silently cross an existing consent boundary.

Missing implementation is different from an inconclusive measurement: a build
without the authored module suspends the whole Campaign, even when the missing
leaf occurs in an OR branch, as ADR 0104 requires. Unknown measurement leaves
the module available and only fails that leaf to qualify.

| Measurement | `detected` rule | `not_detected` rule | Inspector wording |
| --- | --- | --- | --- |
| Pending | false | false | Checking ad-block status… |
| Detected | true | false | Ad blocking detected by this check |
| Not detected | false | true | Ad blocking not detected by this check |
| Unknown | false | false | Ad-block status could not be determined |

Unknown is not the matcher's existing `blocked` value: that value means consent
was withheld. Preserve that distinction in code, tests, and explanations.

The existing boolean `RuleEvaluator.holds()` can remain boolean. Store probe
status inside its evaluator, call `changed()` when it settles, and expose an
optional read-only diagnostic snapshot if needed. The generic snapshot contract
belongs in shared types; detector-specific code and identifiers stay in the paid
module. The inspector must not run a second classifier to explain the first.
Its independently instantiated evaluator can describe its own check, explicitly
as inspection-time evidence, not a historical observation of the visitor loader.

`detected` plus `not_detected` in the same ALL group is impossible and should
block publication. The same pair in ANY is redundant but valid: it still
excludes unknown. Duplicate rows may receive the existing redundancy treatment.

## 2. Detector v1: bounded cosmetic-interference check

Use a small owned implementation, informed by the established
[bait-element technique](https://github.com/sitexw/BlockAdBlock), rather than
shipping an unbounded third-party detector. Validate the actual bait classes
against the baseline's current filter lists before choosing them.

Proposed algorithm:

1. Instantiate only when an actual served Campaign references this rule.
   Multiple Campaigns share the module's evaluator within one loader instance.
2. Wait for an available body and an active, visible document. Prerendered or
   background pages do not consume the measurement window.
3. Add a tiny, offscreen, noninteractive wrapper containing an ad-like bait
   element and a neutral control. Give both identical measurable geometry and
   positioning. Put them in the ordinary DOM, outside WConvert's shadow root,
   so cosmetic filtering can act. Do not apply `display:none`, `hidden`, or
   size-forcing `!important` rules that defeat the measurement.
4. Sample at approximately 50, 250, and 750 ms after insertion. A neutral control
   with expected measurable geometry is necessary for a valid sample. Inspect
   bait connectivity, computed visibility/display, and geometry. Detachment of
   the entire wrapper/control is inconclusive, not detected blocking.
5. At the end of the window, classify as detected only with at least two valid
   samples showing bait interference and no contradictory valid sample.
   Classify as not detected only when all three valid samples are unaffected.
   Otherwise use unknown. A 1-second visible-page deadline bounds the attempt;
   these timings are initial implementation targets to validate in real browsers.
6. If visibility changes during the attempt, settle unknown and clean up. Do not
   let a throttled callback produce a late popup when the visitor returns.
7. Remove test elements, timers and listeners, retain only the small result in
   document memory, and notify the rule engine once. `stop()` must cancel work
   without notifying a disposed engine. Defer the first sample so `changed()`
   cannot run before the shell has registered its evaluator.

An inspector independently creates its own probe, matching its existing
independent-evaluator architecture. Use collision-free DOM nodes and no fixed
global detector singleton; test both instances running together. A normal
visitor page runs at most one probe per loader lifecycle.

No network bait, advertisement download, extension enumeration, external
tracker, vendor-domain request, continuous polling, or MutationObserver loop is
part of v1. Page CSS can resemble cosmetic blocking; the neutral control reduces
some false positives but cannot establish who hid the bait. DNS-only blockers
may be completely invisible to this technique. “Not detected” means this check
observed no interference, never “blocker disabled.” The comparison matrix must
record those limits before release.

The result is a snapshot for this document. Reload after changing blocker
settings; do not promise instant detection of extension changes. On a bfcache
restore keep the completed document result without inserting another probe.

If the whole loader is blocked, this detector cannot run. No fallback detector
inside that same loader can repair that failure.

## 3. Rule timing and visitor experience

- An Immediate Campaign can open after the asynchronous check settles if its
  audience then qualifies; it does not flash before eligibility is known.
- A previously achieved time/scroll threshold may qualify when detection ends.
- An exit, click, or scroll-up gesture before detection settles is not replayed.
  A later fresh gesture can qualify. Detection completion never fabricates one.
- Independent matching ANY/OR branches do not wait for this check.
- No automatic rerun or repeated visitor notice follows an unknown result.
- Ordinary Campaigns without the rule retain their current timing and behavior.
- A/B assignment, inline placement, schedule expiry, automatic caps and explicit
  Reopen continue through the existing engine and presenter contracts.

Authoring help: “Checks for signs of ad blocking on this page. Some blockers
cannot be detected. If the check is inconclusive, this condition will not match.”

The sample-visit tester gets one shared hypothetical ad-block status for all
matching leaves: Detected / Not detected / Unknown, plus Pending when testing
timing. It must not allow logically inconsistent independent values for opposite
ad-block rules. It performs no real DOM probe, request, storage write or count.

## 4. Free delivery diagnostics

Extend **Check on a real page**; do not introduce a permanent global warning.
Keep the existing capability check and cache-bypass behavior. Inspect the
published Campaign on that page, with its actual browser configuration.

Report separate facts:

| Check | Honest interpretation |
| --- | --- |
| Server supplied eligible payload | The server emitted Campaign data; not proof of display. |
| Loader tag found | Delivery markup exists; optimizers may replace the tag. |
| Loader boot entered/completed | Code reached the respective milestone; not proof any Campaign opened. |
| Analytics endpoint responded | This diagnostic request received a response; not proof a prior beacon arrived. |
| Capture endpoint | Not tested automatically; verify using an intentional test submission. |

Proposed minimal runtime seam: set document-local boot milestone flags at entry
to `boot()` and after starting a valid payload. Use a retained marker readable
even if the inspector starts later. It carries no Campaign IDs, evaluator state,
visitor identifiers, form values, errors or network URLs. Nothing is sent to a
server. A missing marker means “execution not observed,” never conclusively
“blocked.” Markers are diagnostic evidence, not trusted authorization inputs.

This narrowly changes ADR 0048's loader-unaware-of-inspection rule and its
byte-identical-loader expectation. Record and amend that ADR inline when the
seam is implemented. Keep `decide()` pure and do not add a public debug registry.
Measure the small cost against the existing Free and paid caps.

“Check analytics connection” is an explicit action in the authenticated panel:
POST `{"events":[]}` to the actual configured beacon URL, using a bounded fetch
and the normal content type. The current route accepts an empty batch without
counting an event; pin this behavior in a regression test before relying on it.
It still consumes the route's normal rate-limit allowance. Do not bypass limits
or add a visitor-wide ping. Check status: expected 204, distinct 429, and other
HTTP/network/timeout failures. Never send a fake impression or conversion.

Only send the probe to the endpoint emitted by WordPress; do not accept an
arbitrary URL from a query parameter. Do not create an unauthenticated health
route or post synthetic contact data to `/capture`.

Network exceptions cannot reliably identify a blocker, as the
[Fetch API documents](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch).
Use “Request failed; a blocker, connection problem, or site policy may be
responsible.” Give a short comparison procedure: reload with this site's blocker
setting changed, compare, then check site/network configuration if unchanged.
No automatic diagnosis from a missing script tag or denied storage.

These checks themselves create no Lead or analytics event. The live inspector
still runs beside real Campaigns, whose actual appearances/actions can count;
do not present the entire live inspection session as a no-count simulation.
If both loader and inspector are blocked, document DevTools/manual checks as the
fallback. An in-page diagnostic cannot promise to report its own absence.

## 5. Analytics transport hardening

Keep the current endpoint and anonymous event schema. Add a bounded fallback
when `sendBeacon` returns false or throws synchronously; use the existing fetch
keepalive path once and swallow its rejection. A true return means queued, not
delivered, so never send a duplicate fetch after true. Do not retry ambiguous
network outcomes: aggregate counters have no event identity for deduplication.
See the [sendBeacon contract](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon).

Add flushing on transition to `visibilityState === 'hidden'`, retaining
`pagehide` as an additional opportunity. Drain once, preserve prerender holding,
and remove the listener on stop. This addresses mobile lifecycle loss; it does
not defeat a blocker. Keep capture independent, and never make successful
submission/display depend on analytics delivery.

## 6. Data, performance and compatibility boundaries

- No detector result in Leads, beacons, cookies, localStorage or sessionStorage.
- No remote telemetry or global “blocked visitor percentage.”
- No added detector bytes in Free or Basic visitor loaders. Generic diagnostics
  may add measured bytes to all loaders; inspector UI stays in inspector builds.
- No probe work on pages without the audience rule; no probe network traffic.
- Existing caps from `bin/check-loader.mjs` at planning time: Free 14,012 B,
  Basic 24,576 B, Pro 25,600 B, Elite 25,856 B gzip. Measure all affected bundles;
  never raise the caps silently or rely on stale ADR figures.
- Match the actual enqueued asset URL after CDN/optimizer rewriting. “Locally
  served by default” is not a guarantee of same-origin delivery on every site.
- Keep route aliases out of v1. A future alias must preserve capture identity,
  session-storage site scoping, rate limits, authorization, cache invalidation,
  and all Free/Pro asset replacement behavior.
