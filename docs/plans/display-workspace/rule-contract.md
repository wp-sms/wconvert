# Display workspace — rule and runtime contract

Status: proposed implementation contract supporting the
[selected workspace](README.md). These examples describe the proposed format,
not JSON already accepted by the plugin.

## One decision with separate concerns

For automatic presentation:

```text
page included AND not excluded
AND Goal prerequisites
AND audience matches
AND schedule is active
AND Campaign and site automatic limits allow
AND opening requirements match
AND page is visible
AND presentation/placement permits it
```

An Audience match is:

```text
Everyone
OR, when Specific visitors is selected:
  group 1 OR group 2 OR ... group 5

Each group: ALL leaves, or ANY leaves. No groups within groups.
```

An automatic Opening match is Immediately, or:

```text
minimum elapsed time satisfied
AND (ALL opening requirements, or ANY opening requirement)
```

No audience group owns a schedule, page exemption, priority, or frequency cap.
No merchant-supplied expression language, scripts, evaluation strings, or
arbitrary recursion. Fixed-depth data remains mechanically validateable.

## Proposed authored shape

Keep existing Optin `config` / `published_config` JSON and existing published-set
storage. Introduce one `display_rules` object for Audience and Opening. Keep
page `targeting`, schedule, frequency, placement and priority at their existing
top-level ownership boundaries. Remove the old flat `rules` writer/reader when
cutting over; do not maintain two authoritative rule representations.

Example: a reader must have spent 20 seconds and reached 50% scroll.

```json
{
  "targeting": {
    "include": [{ "type": "singular", "value": "post" }],
    "exclude": []
  },
  "display_rules": {
    "audience": { "mode": "everyone" },
    "opening": {
      "mode": "automatic",
      "match": "all",
      "minimum_seconds": 0,
      "rules": [
        { "id": "time", "type": "time_on_page", "seconds": 20 },
        { "id": "scroll", "type": "scroll_depth", "percent": 50 }
      ]
    }
  },
  "frequency": {
    "maxPerSession": 1,
    "stopAfterDismiss": false,
    "stopAfterConversion": true
  }
}
```

Example audience: mobile visitors tagged Google, or visitors with a cart of
at least 75 in store currency. Both branches share all universal restrictions.

```json
{
  "mode": "groups",
  "groups": [
    {
      "id": "mobile-google",
      "match": "all",
      "rules": [
        { "id": "device", "type": "device", "in": ["mobile"] },
        { "id": "source", "type": "query_param", "key": "utm_source", "value": ["google"] }
      ]
    },
    {
      "id": "valuable-cart",
      "match": "all",
      "rules": [
        { "id": "cart", "type": "cart_value_min", "amount": 75 }
      ]
    }
  ]
}
```

Other opening modes are `{ "mode": "immediate" }` and
`{ "mode": "click", "rules": [{ "id": "download-button", "type":
"click_element", "selector": ".download-guide" }] }`. Click rules combine
with ANY and cannot be mixed with automatic requirements. Immediate mode has
no empty implicit trigger list and no hidden wait rules.

Stable authored group/row IDs support focus, Undo, errors and inspector paths.
They are configuration identifiers, not visitor identifiers. Assign IDs at
creation, preserve them during edits, regenerate them for duplicate rows, and
reject duplicates. Strip nonessential authoring metadata from the production
payload or map to compact indices while preserving inspector correspondence.

The examples show semantic defaults explicitly. The serializer may omit proven
defaults, following Frequency's existing convention, but absent-field meaning
must be identical in the authoring validator and runtime compiler.

### Validation

- Validate mode, match, IDs, leaf kinds and declared parameters before publish.
- Everyone is explicit. Groups mode requires 1–5 groups, 1–8 leaves each,
  maximum 40 leaves. No empty ANY group and no empty ALL group.
- Automatic opening requires 1–8 leaves. Click mode requires 1–8 nonblank valid
  selectors. Empty or malformed selectors must not become match-any-element.
- Time/inactivity/minimum seconds are finite, nonnegative as appropriate, with
  a proposed maximum of 3600 seconds; positive wait requirements start at 1.
  Scroll depth is an integer from 1–100. Cart amounts follow existing currency
  normalization. Validate on the server as well as in controls.
- A rule belongs to its declared audience or opening slot; changing kind by
  placing a scroll rule in Audience is not allowed.
- Login and roles move from global `targeting` predicates into Audience leaves.
  Page includes/excludes remain only page rules. There is no residual hidden
  account restriction to accidentally AND across all alternative groups.
- Known-but-incomplete draft rows may be saved with readiness errors. Unknown
  types, malformed nesting, unsupported operators, and executable input are
  rejected; do not normalize them away and widen eligibility.
- Detect direct contradictions within ALL (disjoint device sets, impossible
  numeric ranges, conflicting event requirements). Prefer useful warnings for
  redundancy rather than assuming every unusual audience is impossible.
- Source/UTM operators retain their current exact semantics; grouping is not
  permission to add regex, session attribution, or arbitrary comparison code.

## Trigger semantics

The current evaluator's permanently latched gesture booleans cannot implement
the proposed minimum-time behavior correctly. Explicitly distinguish three
types of automatic requirement in manifest/module metadata:

| Category | Rules | Meaning |
| --- | --- | --- |
| Achieved threshold | Time on page, scroll depth | Once reached within the current document, remains satisfied. |
| Live state | Inactivity | Must currently hold; new activity makes it false. |
| Fresh gesture | Exit intent, scroll back up | Can open only on the relevant event, with the other restrictions satisfied then. |

Examples that define the contract:

- 50% scroll at 10s, time threshold 20s: ALL opens at 20s if still eligible.
- 20s elapsed but only 10% scroll: ALL waits; ANY may open.
- Exit at 5s with minimum 15s: do not show at 15s. Require another exit gesture.
- Exit while Audience fails: becoming eligible later does not replay that exit.
- An achieved time/scroll threshold may open when a live Audience restriction
  subsequently becomes true; that is an intentional threshold-based behavior.
- A gesture lost to another overlay is not replayed after it closes.
- Delay-JS still clocks time from navigation, not loader execution. Missed
  gestures cannot be reconstructed. Current scroll position can seed depth.

Use one shared event stream and module instance per needed rule type, with an
evaluation signal/event identity supplied to the pure decision path. No timer
or DOM listener per Campaign. Per-Campaign matching thresholds stay data.
Do not store a shared `lastEvent` that remains eligible on unrelated ticks.

ALL permits thresholds/live prerequisites and at most one fresh gesture.
Reject two gestures in ALL. Reject inactivity AND exit, because exit pointer
activity resets inactivity. ANY may offer alternative gestures. Click mode
remains explicit and separate from this automatic composition.

Page visibility is a universal automatic presentation gate. Elapsed page time
continues to mean elapsed time, not attention time. Returning to a visible tab
may satisfy a time-only opening, but must not replay exit or click. A short page
may already satisfy scroll depth; summarize this behavior in help/test output.

### Inactivity

Define inactivity as a visible-page interval with no observed keyboard, pointer,
touch, click, or scroll activity. Reset on relevant interaction. Hidden-tab
time does not count; restart on visibility return. Do not collect input values
or persist event history. Throttle high-volume events and schedule one next
deadline for the shared module. Hold all timers/listeners to the loader's
existing start/stop lifecycle.

No storage is needed for inactivity; declare no storage-consent category.
The label must not imply that a person stopped reading merely because no input
was observed. Presets should use it for optional help, with conservative delays.

### Explicit visitor activation

On-click opening and Reopen buttons share the policy specified in the UX plan.
They retain live eligibility and completion restrictions, and bypass automatic
pacing and minimum time. Do not wait for an unrelated automatic threshold after
a click. Do not steal the screen from a currently open overlay; ignore the
request without queuing a later surprise opening and explain the collision in
the inspector. A closed prior automatic overlay does not permanently forbid
an explicit request.

Keep rendering/counting ownership in the existing presenter and recovery code.
A click that cannot present does not count an Impression. Reusing an existing
mounted capture journey follows the established recovery contract; opening a
different Campaign must not carry form values or a continuation grant across.

## Server and browser boundary

WordPress still decides page targeting against the current request. Do not ship
all Campaigns to every page, fake a main query, or add a per-URL transient cache.

To allow account predicates inside grouped Audience:

1. Compile the authored plan when publishing; retain server leaves separately
   from browser leaves within their original groups.
2. On an actual uncached request, resolve login/role leaves from RequestContext.
3. Partially evaluate each group without changing its logic. ALL with a false
   server leaf is false; ALL with true server leaves retains remaining leaves.
   ANY with a true server leaf is true; ANY with false server leaves retains
   remaining leaves. A group with no browser leaves resolves to its actual
   Boolean result, not generic empty-list semantics.
4. OR surviving groups. Exclude a Campaign if the Audience is already false.
   Otherwise send only the reduced browser plan, with true represented
   explicitly and provenance available in authenticated inspection.

Never send user IDs, emails, role lists or other private account details to the
public payload. The already-rendered response can contain request-dependent
eligibility. Preserve WordPress/cache integration assumptions and verify logged-in
responses cannot seed an anonymous full-page cache. This does not make client
targeting an access-control mechanism; the server still owns protected content.

Cart-recovery prerequisites are derived from the Goal, outside merchant audience
OR groups. Publication and request/runtime checks enforce them. An informational
offer can deliberately address cart or non-cart audiences, but the Recover Cart
Goal cannot be made cart-independent by adding a broad alternative group.

## Missing capabilities and withheld consent

These cases must not collapse into a generic false:

**Unavailable implementation/dependency:** propose suspending an authored
Campaign if any configured rule cannot be supplied. Do not drop an ALL leaf,
turn a group into true, or swap exit intent for time on page at runtime.
Explain the missing feature and repair in Campaigns, Display, and the inspector.
The authored plan remains intact and resumes when the dependency returns.
This conservatively suspends the whole Campaign even if another OR branch
could run; that predictable policy must be stated to the merchant.

Starting-point selection is different: offer a visible substitute and review
its resulting plan before applying. This is a merchant choice, not hidden
runtime degradation. Keep licensing out of the frontend request path;
availability remains grounded in supplied modules/dependencies.

**Withheld storage consent:** use leaf states true, false, and blocked/not
evaluated. Never instantiate/read a withheld module to discover its value.
An ANY group with an independently true branch can pass without consulting a
blocked branch. ALL with a known false fails; ALL otherwise containing a blocked
leaf is blocked. ANY with no true leaf and a blocked leaf is blocked. Surface
short-circuited leaves as not evaluated rather than inventing results.

Campaign-required consent gates remain universal. Optional OR branches do not
permit bypassing Goal prerequisites. Consent changes re-evaluate thresholds
and live states but do not replay prior gestures. Inspector and simulation
must share this truth table and explain why a leaf was not evaluated.

## Scheduling, frequency, and storage

Keep authored dates in the site's wall time and compile them to absolute
instants using the existing Schedule boundary. Future windows remain in the
published set. Add a scheduler wake-up at the next relevant start/end boundary:
being before start is temporary, not a terminal reason to tear down listeners
forever. Time-of-day boundaries need the same live handling. Preserve the
current boundary rule for an already open Campaign unless an existing contract
requires closing it; an end time prevents new openings, not silent data loss.

The tab-session cap requires a new, versioned, site-scoped sessionStorage record
of presentation counts keyed by Campaign/family, with no random visitor ID,
contact fields, URLs, browsing history, or form data. Use the browser's storage
scope and the existing state-storage boundary; proposed name `wcv_display_session_v1`.
Write only if a configured session cap needs it, and only on a counted appearance.
Use in-memory fallback if sessionStorage is denied. In that case the cap lasts
only for the current document; do not silently introduce a persistent fallback
cookie or claim it is reliable across pages.

Bound session records with an explicit maximum (proposed 128 families) and a
documented eviction policy; write/eviction occurs on appearance, not every tick.
A/B variants share the Campaign family's cap so switching arms cannot double
the allowance. Reopen recovery remains its own record and behavior, not a
second trigger or another automatic appearance.

Existing persistent dismissal/conversion/max/count/day state stays under the
existing state contract. `maxPerSession` augments Frequency; it does not replace
cooldown or completion checks. Follow the current functional-storage policy for
display pacing, documenting the added key and fallback limits in the Data Map
and suggested privacy text. No server table, column, or new visitor identifier
is needed. If implementation discovers otherwise, the proposed scope must be
revisited; this plan does not authorize a database schema change.

## Simulation and explanations

Extract/share the pure matcher so runtime, inspector and draft simulator have
one interpretation of groups, restrictions, and event context. Modules supply
live facts; the simulator supplies sample facts. The simulator must not import
or start DOM listeners, site-state writers, impression beacons, or capture code.

Use leaf and group outcomes with paths back to editor IDs. The production
payload need not carry the full admin explanation vocabulary. Load the
simulator/inspector UI only on their own surfaces. Free loader sources must
not import premium evaluator implementations just because the editor can show
their settings or simulate a declared Boolean answer.

The simulator does not resolve real WordPress URLs or promise the current
visitor's eligibility. Page/login/role samples are explicit hypothetical facts.
Check on a real page continues to use the authenticated inspector and actual
request context. Draft simulation and published live inspection are labeled
separately and never implicitly mutate the live Campaign.

## Cutover and documentation

The project is pre-release. Change schema, bundled Playbooks, rule bundles,
fixtures, consumers and APIs together; do not add a permanent legacy interpreter
or compatibility migration. Unsupported old development data/packs must produce
a repairable incompatibility, never silently mean Everyone or Immediately.
Rebuilding/replacing development fixtures is deliberate; no blanket destructive
reset of a user's local Campaigns belongs in this change.

When these proposed decisions are adopted, record a new ADR and amend the
superseded claims inline in the same commit:

- ADR 0005: flat-only axes/permanent grouping prohibition; retain closed rule
  vocabulary and the server/browser boundary.
- ADR 0012 and 0027: replace silent authored runtime degradation with explicit
  suspension; distinguish visible prefill substitutions.
- ADR 0047 and CONTEXT Frequency: tab-session cap, new defaults, and explicit
  activation exceptions.
- ADR 0048: add honestly labeled simulation while preserving actual-request
  inspection and one decision implementation.
- ADR 0050: future schedule remains live, including a document already open.
- ADR 0101: align explicit click activation and Reopen behavior without changing
  capture continuation semantics.
- CONTEXT Trigger/Condition/Targeting/Storage Consent: grouped authoring,
  achieved/live/fresh-event semantics, and the new storage record.

Cross-reference both directions. Keep the current ADRs unchanged while this is
only a proposal, so a future reader is not told unimplemented rules already run.
