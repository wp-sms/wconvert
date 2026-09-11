# Setup choices state their effect and scope

A merchant adapting a ready-made Optin needs to understand what a choice changes,
what remains to configure, and when it writes. The former creation flow repeated
the same preview before opening the editor. Display-rule headings mixed the
moment a popup appears with its campaign dates, while Undo and Goal correction
implied a broader or narrower effect than their actual writes.

This decision refines those flows using the existing Goal, Playbook, rule,
Frequency and Schedule models. It adds no rule engine, stored taxonomy, database
table, index or visitor state.

## Two choices, then the editor

Creation asks for a **Goal**, then a **starting point**. Here a starting point is
the merchant-facing name for a Playbook: design, copy, rules and destination
hints copied into a new Optin. **Customize this starting point** explicitly
creates a draft and opens the editor. The adjacent text says that it creates a
draft and that publishing happens later. A blank draft keeps the selected Goal
and leaves design selection to the editor. The former third preview/confirmation
step is removed; the editor owns customization, review and publication.

Cards show the real composed design and compact setup facts. The Playbook REST
response exposes a `setup` subset of the existing Prefill result: display type,
rules, targeting, frequency and destination hints. Summaries therefore describe
settings after this install's normalizers and availability rules have resolved
them, rather than a second interpretation of the authored Playbook. This is
response metadata, not a new stored config shape. Longer notes are optional.
Inline placement and an outstanding destination are explained when relevant.
If setup metadata or its vocabulary cannot be read, the card says to review the
rules in the editor; it does not invent an immediate or site-wide default.

When the selected Goal has exactly one available Playbook, its card uses the full
region: a larger readable preview sits beside the compact setup facts and action
on wide containers, and stacks above them on mobile. It reuses the same real
preview and explicit draft-creation action. Multiple starting points retain the
comparison gallery.

Browsing and choosing a Goal only read. Prefill and draft creation run after an
explicit customization action, with a synchronous in-flight guard against double
activation. Responses belong to their current choice and mounted flow; late
reads cannot replace a later choice, and an abandoned prefill cannot initiate a
create request. Pending creation also warns before a browser reload or navigation
out of WordPress. Failed reads can be retried in place. An uncertain create response
asks the merchant to check Optins before trying again, because a failed response
does not establish that the server wrote nothing. There is no automatic create
retry or new idempotency protocol.

Sources: [GoalScreen](../../resources/admin/src/goals/GoalScreen.tsx),
[StartingPointFacts](../../resources/admin/src/goals/StartingPointFacts.tsx),
[PlaybookController](../../src/Rest/PlaybookController.php).

## Display rules explain four decisions

The sections are **Pages**, **Audience**, **When it appears**, and **Schedule &
frequency**. Labels sit above full-width summaries, keeping long explanations
readable. These are presentation groups over the existing model. Page
includes are ORed, exclusions veto, and an empty include set means everywhere.
Logged-in status and selected roles remain separate visitor predicates. All
Conditions must hold when any Trigger fires. A missing Trigger is not an implied
immediate trigger, and adding a second Condition does not create an OR group.

Schedule and repeat-visit controls have separate headings. Dates name the actual
WordPress site timezone, including a fixed offset when that is the site setting.
Empty boundaries mean no boundary; the start hint also says other rules must
allow display. An end at or before the start receives an adjacent error, with the
existing server refusal retained. Daily opening hours remain a recurring
Condition, distinct from the campaign's start/end dates.

Repeat limits describe one browser, not an identified person or a per-day quota.
The stop-after-conversion label follows the design's act: submit the form or click
the main button. A cooldown does not override dismissal/conversion stops. The
underlying cooldown still counts whole epoch days; it has not become a rolling
24-hour timer. Saved site-wide limits are read beside this draft's limits, with
loading, failure and retry states. Their shared summary reports the actual saved
values, including no site-wide limits, and explains that an Optin cannot override
them. The management link uses the existing guarded navigation.

Overlay priority is under an advanced disclosure and absent for inline Optins.
It selects among overlays eligible at the same decision: highest priority, then
ID. It cannot reserve the page against a lower-priority overlay that becomes
ready earlier. Once an overlay shows, closing it does not admit a runner-up on
that page view. No arbitration behavior changes.

Sources: [DisplayRules](../../resources/admin/src/builder/rules/DisplayRules.tsx),
[HowOften](../../resources/admin/src/builder/rules/HowOften.tsx),
[SiteLimitsNote](../../resources/admin/src/builder/rules/SiteLimitsNote.tsx),
[decision engine](../../resources/loader/src/decide.ts).

## A rule replacement is reviewed before it applies

The rule panel's Starting points are rule bundles, not creation Playbooks. The
replacement review compares current and proposed values for the sections the
bundle supplies. The review remains the explicit apply boundary. Under [ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md),
the complete replacement now has one draft Undo entry. Cancel writes nothing. Applying changes the current draft;
it does not save or publish it.

The replacement keeps the existing patch boundary: supplied triggers,
conditions, targeting or frequency replace those sections; omitted sections
remain. In particular, campaign start/end dates and overlay priority remain,
even when the bundle replaces repeat frequency. Design, copy and destination
bindings remain outside this action. The review uses the existing summary and
patch logic, rather than a separate rule interpreter.

Page/post and category/tag lookup also distinguishes a failed request from no
matches. A saved identifier survives name lookup failure or an unavailable item;
the UI states that the rule still uses that identifier. Searching, retrying,
closing the picker or abandoning typed text does not silently replace it.
Only choosing a result commits a different identifier; removing the rule remains
an explicit rule action. Obsolete results cannot be selected while the new query is pending. Status and Retry sit
outside the listbox's options, with keyboard focus kept on the combobox.

Sources: [StartingPoints](../../resources/admin/src/builder/rules/StartingPoints.tsx),
[ObjectPicker](../../resources/admin/src/builder/rules/ObjectPicker.tsx).

## Scope remains visible in the editor

Header actions now say **Undo draft edit** and **Redo draft edit** under [ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md).
History contains the name and complete draft configuration, including the design,
template id, rules and selected destination ids. Mobile editing keeps a visible
reminder that appearance can vary while text and blocks are shared across sizes,
including when no node is selected. Narrow-token inheritance remains unchanged.

Goal correction explicitly says **Save draft and change goal**. It saves the
current name and all draft configuration, restates reporting under the new Goal,
and starts a new local Undo history only after success. It does not publish the
draft. Undo never silently performs a Goal save or reverses shared settings.

Schedule labels preserve authored components even if that hour does not exist
in the admin browser's own timezone. The ended-status advisory uses the site's
explicit zone; an unknown zone stays neutral. PHP remains authoritative for the
published instant. Around a skipped or repeated local hour, the advisory waits
for the latest plausible instant, so it can remain neutral briefly after PHP's
chosen end but does not prematurely claim the campaign ended. The loader's
half-open window, `starts_at <= now < ends_at`, is unchanged.

Sources: [OptinBuilder](../../resources/admin/src/builder/OptinBuilder.tsx),
[Goal correction](../../resources/admin/src/builder/ChangeGoalDialog.tsx),
[wall-time labels and status](../../resources/admin/src/builder/wallTime.ts),
[Schedule](../../src/Optin/Schedule.php).

## Product boundary and verification

**Completed by [0076](0076-an-enquiry-captures-one-optional-choice-before-handoff.md):**
Collect enquiries, its quote starting point and the stable interest choice now
implement the capture/handoff slice identified below; they add no inbox or CRM.
The original Phase 4 boundary was: existing Goals remain unchanged. A service business's enquiry is a suitable
next capture use case for WConvert's outbound position, but newsletter
subscription must not silently become a request for a reply. A neutral enquiry
Goal, qualification field and named downstream destination belong to the next
deliberate capture/handoff slice. That slice should retain WConvert's outbound
capture position; this phase introduces no inbox, CRM, delivery ledger or new
storage model.

Completed local checks and live WordPress creation, rule editing, saved reload
and responsive evidence are recorded in the
[flow review](../reviews/2026-09-10-flow-by-flow-ux.md). Final checks pass and
the disposable draft was removed; the original Optins retain their publication
states. No live submission, provider delivery or publication was exercised.
