# Display workspace uses bounded groups and fresh gestures

> **Amended by [ADR 0109](0109-ad-block-observation-is-a-bounded-condition.md):** Pro adds an optional bounded ad-block audience Condition. A pending or inconclusive measurement matches neither authored status, while an absent module still suspends the Campaign. The loader caps below are historical; ADR 0109 records current numbers.

Accepted 2026-09-23. Implements the approved [Option A plan](../plans/display-workspace/README.md), reviewed against the Goal setup and progressive capture changes in ADRs 0102–0103.

## Authoring and storage

Display is one workspace: Pages, Audience, Opening moment, Schedule & limits, with a live summary and design preview on demand. Advanced audience alternatives are disclosed only when requested. Save, Undo, Redo and publication still belong to the existing Campaign draft.

`config.display_rules` is the sole saved and published policy. Audience is explicit Everyone or up to five alternative groups; each group matches ALL or ANY of up to eight leaves. Groups combine with OR. Opening is explicit Immediate, Automatic (ALL/ANY and minimum elapsed seconds), or Click (alternative selectors). There is no recursive expression tree or second legacy runtime. Old pre-release drafts require an explicit replacement before save/publish.

Group and rule IDs are assigned once on creation and preserved through edits.
The admin generates them with `crypto.getRandomValues`, which is available on
HTTP WordPress installations as well as HTTPS. Do not depend on the
secure-context-only `crypto.randomUUID`: doing so aborts audience and rule
creation on HTTP sites. Regression coverage exercises both UI actions with
that API absent; localhost-only browser checks do not exercise this case.

Page selection remains separate: Selected pages with no inclusion is incomplete; exclusions veto every audience branch. Login and role leaves are evaluated inside their original audience groups on the server. Their identifiers and values are removed before the response is sent to visitors. Required Goal predicates, such as a nonempty cart, remain universal and cannot be weakened with OR.

Known incomplete rows may be saved for repair. Publication rejects invalid ranges, blank rows, impossible ALL device/login groups, combinations of fresh gestures, and inactivity required together with a leaving gesture. Click selectors use a portable, server-validated subset: tags, IDs, classes, attributes, descendant/combinator chains and comma-separated alternatives. Pseudo-classes/functions and escaped names are outside this contract; the editor says so before publication. Client/server selector cases are shared test fixtures.

The catalog's existing declarative recipes remain authoring input and are compiled at Prefill, where installation-specific starting suggestions are already resolved. They are never interpreted as old saved Campaign data. The chooser reports the compiled setup. Applying a rule set remains one reviewed, atomic draft edit.

The authoring controls expose explicit values: sign-in status has an unset
choice distinct from Yes/No, quick delays and scroll choices name their numbers,
and ALL/ANY explain whether every rule or just one must match. URL-presence
rules without values are valid and summarised as presence checks. Technical
selector guidance stays on demand; exit and inactivity explain what is observed.

The display-rule library can be filtered by the section it changes. Page-only
sets replace Pages and leave audience groups intact; repeat sets replace repeat
limits without changing scheduled dates. The before/after review remains the
source of truth, followed by “Apply to draft.” Sets cover inactivity, tab-session
limits, weekly spacing and alternative leaving/scroll-up gestures. Their copy
names browser-scoped limits and touch limitations without claiming to detect
reading, abandonment or a permanent person-level history.

## Runtime

The manifest names threshold, state and gesture semantics. Time and scroll-depth thresholds remain achieved after crossing. Inactivity is live visible-page elapsed time without input; hiding/returning resets it. Activity never reads input values, and pointer movement does not continually allocate new timers. Exit, scroll-back-up and click are synchronous fresh-event pulses. A gesture before the minimum time cannot be replayed when a timer or consent change later arrives.

The pure matcher reports true, false or consent-blocked per leaf. An independent ANY alternative may pass without reading a withheld rule. Missing implementations suspend the entire authored Campaign, including an unavailable leaf in an OR branch; no frontend substitution or dropping widens the policy. Restoring the dependency restores eligibility without editing saved data.

Future schedule starts remain waiting and receive a wake-up. Automatic opening requires a visible document. Explicit click and Reopen share eligibility, completion and collision checks but bypass automatic pacing. A campaign already open when its schedule ends remains usable; expiry prevents later openings. Progressive capture retains its mounted journey and counted-once recovery behavior.

## Session pacing

`frequency.maxPerSession` is a Campaign-only positive integer, 1–100. The key `wcv_display_session_v1:<capture endpoint path>` uses the existing REST endpoint to separate sites on the same origin. It stores only family IDs and appearance counts, with at most 128 families and least-recently-shown eviction. It writes only on a counted appearance when that cap exists. Denied storage falls back to the current document; copied/restored browser sessions may retain it. No database, cookie, visitor ID, form value or event history is added.

New interruptive drafts start at one automatic appearance per tab session, stop-after-dismiss off and stop-after-conversion on. The repeat selector labels this choice as recommended. Both scratch and bundled creation paths are checked after frequency normalization; inline starting points keep their existing embedded behavior. These are creation defaults, never an automatic rewrite of existing Campaign settings. Absent frequency fields retain their established meanings. Every A/B arm carries its family for pacing, whether or not Reopen or content locking is enabled. Site-wide allowance fields and storage are unchanged.

## Diagnostics and size

The lazy sample tester evaluates hypothetical draft facts with the same pure matcher. It cannot inspect a real URL, publish, submit or count a visit. Its events are deliberate simulations, not remembered Boolean eligibility. The authenticated live inspector remains a distinct published-page diagnostic, with grouped outcomes, per-leaf consent, request account eligibility, minimum dwell and initial session allowance.

The tester leads with a live verdict that stays visible while the inputs scroll.
Only relevant visitor activity and condition inputs are shown; page, schedule,
completion, pacing and Goal assumptions sit in a collapsed “Other conditions”
section. Its summary indicates changed assumptions, and a blocking assumption
still appears in the verdict when collapsed. The window explicitly explains
that values are pretend, results update automatically, and no real campaign
opens or visit is recorded.

The user explicitly approved a **1 KiB increase to the existing paid-loader cap**, from 19,456 to 20,480 bytes gzip, after measured safe minifier trials could not fit the added behavior. Free remains 14,012 bytes. CI remains a hard, flagless check per tier. Payload and per-design caps are unchanged. No simulation or admin UI code enters visitor bundles.

> **Amended by [ADR 0105](0105-phone-input-is-a-conditional-shared-asset.md):** Basic remains at 20,480 bytes; Pro caps at 20,608 and Elite at 20,784 after the full phone-field integration. Free remains at 14,012 bytes. The optional phone asset has its own 16 KiB cap.

> **Amended by [ADR 0106](0106-question-journeys-extend-the-paid-loader.md):** Paid caps now stand at 24,064 / 25,088 / 25,344 bytes for Basic / Pro / Elite. Free and the optional phone cap remain unchanged.

This amends ADRs 0005 (grouping), 0012/0027 (authored availability), 0047 (Campaign session cap), 0048 (draft simulation beside live inspection), 0050 (schedule wake/active capture), 0101 (explicit activation/collision/expiry) and 0103 (paid-loader cap). Their relevant passages are annotated inline.
