# Journey workspace B: production gap and completion plan

September 25, 2026. This is a source and interface audit of the current PR #190
against the [B prototype behavior](../../tools/design-system/editor-prototype/flow-prototype/BEHAVIOR.md)
and its [scenario checks](../../tools/design-system/editor-prototype/flow-prototype/SCENARIOS.md).
It is a plan, not a claim that prototype simulations work in WordPress. The user
chose to hold PR #190 until the full journey behavior is implemented. Earlier
seven-screen and ordered-flow plans describe the current implementation, not a
constraint on the next design. The existing [ADR 0107](../adr/0107-forward-journey-paths-and-flow-editor.md)
must be amended alongside a changed production contract.

## Product test to optimize for

An occasional merchant should be able to answer four questions without learning
graph terminology: What does the visitor see first? Which questions appear for a
given answer? At which screen are details actually saved? What happens after a
successful save? The map is an overview and navigation aid. The selected-screen
inspector, a searchable Screens inventory, and a real visitor test must each make
the same answers clear without requiring line dragging.

The three authoring intentions must remain distinct:

| Intent | Merchant language | Visitor semantics |
| --- | --- | --- |
| Continue | Continue this path | Go to the next connected screen. |
| Conditional follow-up | Show this screen when… | Independently test visibility; several follow-ups may run. |
| Exclusive branch | Take a different path if… | First matching path wins; Everyone else is the explicit fallback. |

The user has already decided that multi-interest enquiries ask **every relevant
follow-up**, then make **one combined submission**; exclusive paths have visible
first-match priority; Back retains answers that remain relevant; and capture
requirements depend on the Campaign Goal. A quiz/content journey can finish
anonymously, while an enquiry must reach its combined submission. Do not ask
again or turn conditional follow-ups into mutually exclusive branches.

## Progress after this audit

For current completion status and the next release checks, use the
[September 26 completion checklist](2026-09-26-journey-completion-checklist.md).
The sections below retain historical findings; their older “remaining work”
sentences are not a second current backlog.

### Product API recovery and keyboard continuity, September 26

The actual product loader removed its Retry button on activation, losing
keyboard focus both while waiting and on another failure. It also limited the
candidate list before rejecting off-site links; a malformed URL could fail the
whole response, and an entirely unusable list could leave an empty result area.
Five regression cases reproduced four failures before the fix. Retry now keeps
the same control, guards repeat activation while pending, and restores focus to
the first usable product or the unavailable explanation when the control is
removed. It does not take focus back if the visitor moved elsewhere. Link
validation precedes the display limit; one unusable catalog record no longer
hides valid recommendations. Leaving the result still aborts pending work.

The disposable WordPress 7.1.2 / WooCommerce 11.1.2 popup was exercised using
keyboard controls against an actual Store API 503, another failed retry, a
delayed successful retry and a response containing only an off-site product
link. Focus stayed visibly on Retry during loading/failure, then reached the
$29 product link on success. Back retained Mostly sunny. The unusable-list
case showed the explanation, and its browse fallback opened the actual shop.
The campaign retained zero Leads. Its publication, pages and products were
returned to draft; the temporary API filter, option, browser tab and server
were removed/stopped.

All 27 focused JS tests and 23 PHP loader-contract tests / 38 assertions passed,
along with TypeScript, ESLint, all three paid loader builds, source boundaries,
and Node 22 loader/phone checks. ADR 0108 records the measured 256-byte paid-cap
amendment for this behavior. Free, phone, payload and design caps are unchanged.
This closes the basic real-browser API failure/retry gap, not the complete
prototype product-combination matrix or native zoom/assistive-technology gate.

### Visible keyboard focus and secondary-action defaults, September 26

The actual browser exposed an invisible focus ring: No thanks matched
`:focus-visible`, but its computed outline was `rgba(0, 0, 0, 0)`. The shared
renderer had reused the button's locally transparent accent for its outline.
Buttons now use the surrounding foreground token for keyboard outlines. This
fix also applies to already-saved transparent buttons, without changing their
stored styles.

New Back/skip controls in ordered and graph generators, and all shipped journey
template Back/skip defaults, now use transparent backgrounds and the foreground
color reference. This replaces both primary-looking Back controls and fixed dark
secondary text. Foreground references have the same fallback as the renderer's
root when a template omits that optional token. Existing custom button fill/text
styles are not rewritten.

Browser evidence:

- The existing optional-SMS QA draft changed from invisible focus to a visible
  `rgb(15, 23, 42)` outline on white. No campaign edit was needed for that fix.
- The new **QA — Journey keyboard focus (dark draft)**
  (`01M3EFW0D77N1X5KSADVR880TT`) uses the shipped content-guide structure. No thanks
  and Back to guide have `rgb(248, 250, 252)` text and focus outlines on the dark
  surface. The main signup retains its filled styling.
- Keyboard Tab reaches both secondary controls; Enter on Back returns to the
  result, with focus settling on its heading. At 320 × 568, the focused outline
  remains visible inside the scrollable preview. The viewport was reset afterward.
- Temporarily removing all palette tokens from that QA draft still rendered
  No thanks as `rgb(17, 24, 39)` text with a visible dark outline on white. The
  original dark configuration was restored; it remains unpublished with a null
  PHP capture-contract issue. These preview checks created no Leads.

Validation: 345 focused renderer/journey tests, typecheck, lint, all admin/block/
loader/phone/inspector builds, source-boundary checks and loader/phone size budgets
pass. All 60 registered designs survive template validation intact. The previous
content-guide Back-button default hierarchy gap is resolved for new templates;
this is not a full native-zoom or assistive-technology audit. Those broader checks,
product/API-failure coverage, merchant feedback and green CI remain open.


### Actual capture, queued outage and delivery recovery, September 26

A published local-only graph campaign exercised email signup followed by optional
SMS through the actual visitor popup, not Test journey. A temporary destination
adapter sent real HTTP requests only to `127.0.0.1`; the receiver rejected delivery
with 503 until both submissions had been accepted. The visitor reached **Details
received** during the outage. The database contained one Lead with two immutable
accepted snapshots, separate consent/purpose/route records, and completed handoff.

Action Scheduler recorded retry jobs carrying only Lead/destination/submission
IDs and attempt numbers. Email attempts contained only the email identifier;
SMS attempts contained only the phone identifier. Later SMS acceptance did not
expand the earlier email payload. Both destination cards visibly showed Failing.
After receiver recovery, automatic retry and the actual admin **Queue re-push**
action delivered the original snapshots. Repeated recovery upserted the same
receiver contact; the database still contained one unchanged Lead. Seven observed
HTTP requests (three 503s, four 200s) left exactly two receiver contacts, one per
channel. Both admin cards changed to **Success recorded** and cleared their
failure counters. The structured [delivery evidence](2026-09-26-journey-delivery-evidence.json)
records the queue arguments, HTTP payloads, final health and cleanup checks.

This walkthrough exposed two admin wording errors. The recovery count was labelled
Leads although its API counts individual submissions, and its stated start time
omitted the existing overlap for later journey steps. Recovery buttons, counts and
explanations now consistently refer to stored submissions. The confirmation names
the last success and explains the overlap; the success report explicitly says
queueing is not completed delivery and does not create new Leads. Browser checks
verified the rebuilt count/report and final confirmation, then cancelled without
creating another job.

The temporary campaign is unpublished, its page is draft, its destinations and
MU-plugin adapter are removed, and the receiver process has stopped. No QA jobs
remain pending. All contact values were synthetic; no real provider credentials,
accounts, email recipients or SMS recipients were used. The saved QA campaign is
`01M3EF4MDZ3537BEP7X978TR0H` and is retained as a local-only draft.

Validation: destination UI suite 48 tests; PHP destination suite 82 tests / 259
assertions; typecheck, lint, and free/Pro admin builds pass. This closes the
controlled local delivery/retry evidence gap for the actual capture/queue/worker
path. The temporary receiver follows the destination idempotency contract; this
is not a claim about every vendor adapter or external subscription state. Existing
provider unit tests passed. Broader accessibility, product/API-failure scenarios,
merchant task feedback and the unavailable CI runners remain separate gates.


### Result timing with downstream branches and actionable repair, September 26

The result timing control now moves an adjacent result/signup pair while keeping
all downstream answer branches, edge IDs, rule priority, destinations and shared
ending content. It no longer requires a unique linear acknowledgement after the
pair. Switching back restores the original connections and explicit capture
ownership. Generated result navigation says **Continue** when more content can
follow, and **Finish** only when its outgoing paths end at acknowledgements.

Configurations needing preparation now name the actual issue: an intervening
branch, another entrance into the pair, conditional signup visibility, missing
required email on the signup, or a result using a question/reward that must remain
after capture. A **Review [screen]** action selects the relevant content or path
settings and focuses its heading. This replaces the generic “other connections”
message. The control does not guess how a merchant wants intervening branches
rearranged, and arbitrary nonadjacent gate rearrangement is not claimed complete.

Actual local WordPress evidence in **QA — Result access with shared ending
(draft)** (`01M3EEJ0NAY4SFT2BH7Q6H56K5`):

- Required mode saved with the original answer branch and two routes into the
  same ending. Full PHP `CaptureContract::issue` returned null; capture purpose
  was `request` with no generated marketing consent.
- Test journey selected Growing, accepted contact, showed the matching result,
  then followed the extra Growing tips screen into the shared ending. The final
  build visibly labels result navigation Continue.
- Result-first mode saved with the original edge structure restored. PHP again
  returned null, with optional email-marketing ownership/consent restored.
  Everyday care showed the fallback result before contact; No thanks reached the
  ending, labelled Growing tips bypassed, and recorded Skipped with no acceptance.
- Adding a temporary answer branch on the result disabled the timing change,
  explained the precise preparation, and opened Next paths through Review Your
  guide. DOM inspection confirmed keyboard focus on the Your guide heading.
  Undo removed that temporary branch; the draft remains unpublished and clean.

Validation: all 2,943 JS tests / 158 files passed with two workers after a run
concurrent with builds encountered unrelated test timeouts. The final focused
57-test run, typecheck, lint, and free/Pro admin builds pass. The browser preview
created no real Leads or provider requests. The screenshot also shows the older
content-guide template still styles its existing Back buttons as primary; this
is a remaining default-template hierarchy detail, not changed merchant styling.
Broader accessibility, product/API failure, controlled delivery and merchant
feedback gates remain, as does green CI when runners are available.


### Optional second signup creation and phone-draft parity, September 26

Email/SMS campaigns with one required primary capture can now add an optional
second channel in a flexible graph. A named connection chooser offers only paths
reached after primary acceptance, including checks for hidden exits and merges
that can be reached without a save. The chosen edge keeps its identity, rule and
priority; unchosen edges (including a shared hidden continuation) stay unchanged.
The new capture owns its own required channel field, consent and submit/skip
buttons. Both submitting and No thanks continue to the former destination, while
Back returns to the prior path. Earned reward elements on a following ending are
also displayed before the optional ask without deleting the ending’s originals.
No thanks and Back use secondary styling.

The chooser explains separate acceptance, skip behavior and destination review.
Cancel restores Add screen focus; insertion selects the new save by submission
identity. Existing-channel duplicates and unsupported capture configurations
receive explanations. Local-only Destinations copy no longer claims that the
primary signup was sent. Test journey’s skip notice now explicitly preserves
earlier accepted saves.

A real browser retry exposed another parity gap: Test journey stored a phone’s
national display text and directly assigned the input value on remount, resetting
its country. It now saves canonical E.164 and the selected country, restores via
the enhancement API and clears the country draft on Reset. The enhancement’s
optional country restore parameter is backward compatible with live loader
callers. A real-widget regression covers Canada’s shared +1 code, failed capture,
retry, accepted read-only Back and Reset to the site country.

Local unpublished QA campaign `01M3EDDQ4V7565YEYX6DWWEX7F` was created with a primary
email save. The WordPress UI added optional SMS, saved it and displayed separate
SMS settings. The PHP capture contract returned null; purposes were
email_marketing and sms_marketing with separate field/consent IDs and no external
destinations. At 320×568 the chooser kept its actions visible and its full location
readable in the summary; Cancel restored focus. Test journey verified email
accepted/SMS skipped, then SMS failure retaining country/number/consent. After the
fix, a US number survived failure and retry without re-entry; the accepted
snapshot showed +12025550123, with email still accepted. Test was reset and closed;
the saved QA draft remains unpublished and uses local-only storage.

Validation: 2,940 JS tests pass, as do TypeScript, ESLint, Free/Pro admin builds,
phone build, source-boundary verification and phone budgets (14,599 B gzip against
16,384 B; all combined edition budgets pass). PHP source is unchanged. This is
browser evidence for the admin test and saved contract, not an external-provider
delivery test. Result topology, the remaining accessibility/merchant gates and
required CI remain open.


### Coordinated optional capture removal, September 26

The graph editor now offers **Remove optional signup** on screens that own an
optional submission’s fields/consent or its save action. The review lists every
screen to be removed, states that its questions/content also go, distinguishes
previously saved Leads from draft changes, and names the incoming reconnections.
Split capture screens are removed together while intervening independent offers
stay. Boundary connections retain their IDs, conditions and priority. Multiple
possible exits require a deliberate selection; no capture branch is silently
chosen. Skip buttons elsewhere that refer to the removed submission are cleaned
up, and a replaced entry loses its Back buttons. One Undo restores the entire
edit, including the builder’s existing submission-destination cleanup; history
labels identify the optional signup operation.

Required captures, a campaign’s sole non-result capture, capture shared with
another submission/result/ending, and externally referenced questions remain
protected with explanations. These guards do not assert that all capture-model
editing is finished. They prevent this removal action from silently dropping
another save’s data or leaving an ordinary signup campaign without capture.

An anonymous result with an existing ending can add optional capture again.
The existing ending and result connection identity are retained, the new signup
is selected by submission identity rather than storage position, and generated
result navigation changes between Finish and Optional email updates.

WordPress verification used the existing unpublished graph-quiz draft: required
capture was changed to optional, removal was reviewed at 320×568, Cancel restored
focus, removal was saved, and Test journey reached Balcony picks then All set
without contact fields or capture checkpoints. Re-adding optional signup restored
one capture and kept exactly one ending. The saved anonymous and re-added graphs
both returned `GraphCaptureContract::issue: null`. The broader contract still
reported the pre-existing `products` blocker because this local site lacks
WooCommerce; this is not claimed as a publish-ready product campaign. Undo and
Save restored the original required-capture QA draft, also graph-valid.

Validation: 2,934 JavaScript tests pass. Final capture/editor/history coverage
passes 50 tests after generated navigation and history-label adjustments.
TypeScript, ESLint, both admin builds and source-boundary checks pass. PHP source
is unchanged; the actual saved drafts were validated by the local PHP graph
contract. Broader graph capture creation, result topology, merchant task feedback,
accessibility and the outstanding release gates remain open.


### Screen removal and disconnected drafts, September 26

Graph deletion now offers an explicit continuation instead of silently assuming
one outgoing destination. Screens with different exits require a selection;
multiple incoming paths retain their identities, conditions and priority. The
review names the affected incoming paths, discarded outgoing rules, newly
unreachable screens and required saves that the chosen continuation bypasses.
Detached work stays in the draft. An orphan with no incoming path can be removed
without choosing an irrelevant destination. An unreferenced first offer/question
can be removed by choosing an unconditional new first screen; its Back buttons
are removed in the same edit. Cycle-producing targets are excluded.

Deletion still protects result/ending screens, capture fields/consent/submit
screens, and questions referenced by rules on other screens. The focusable Delete
action now states the reason, including dependent screen names. Uses exclusively
on the deleted screen or its outgoing edges no longer block its removal. Removal
is one history entry, with focus returning to the destination heading after
confirmation and the Delete trigger after cancellation.

Unreachable screens are explicitly identified in grouped and expanded maps,
Screens inventory and the inspector. The map hint no longer says every matching
follow-up is shown when disconnected work exists. Groups remain selectable and
expandable; their dashed border supplements the text explanation.

Local WordPress checks used the six-screen multi-interest QA draft: different
visible/hidden exits required an explicit deletion destination; choosing the
ending warned about bypassing contact capture; choosing contact warned about two
disconnected follow-ups; the resulting orphan could be removed. Undo restored
both edits and returned Save draft to disabled. A separate valid deletion was
saved through the admin and verified through the repository/CaptureContract
(`issue: null`), then undone and saved back to the original six-screen graph.
At 320×568 the dialog stayed within the viewport (288px wide, 286px scroll width),
kept Cancel/Delete visible and scrolled its body; Cancel restored Delete focus.
All checks stayed in unpublished QA drafts.

Validation: 2,928 JavaScript tests pass; final editor/map/stylesheet checks pass
505 tests after the last copy changes. TypeScript, ESLint, Free/Pro admin builds
and the source-boundary check pass. PHP implementation was unchanged. Broader
capture/result deletion workflows, native zoom/assistive-technology checks,
merchant task feedback and the other release gates remain open.


### September 26: preserve imported references and refuse malformed test saves

Node normalization now remembers the first claimant of each supplied identity.
After every leaf has been assigned a canonical ID, normalization updates owned
field/consent references and question references in screen visibility, ordered
paths, graph answer edges and result rules. Screen/edge/result/submission IDs and
answer values remain in their separate namespaces, even when their text matches
a node alias. Missing references remain unresolved; referenced canonical IDs
are reserved before minting so a missing source cannot accidentally attach to a
new node. A second normalization is stable, and duplicate-ID references retain
the existing first-claimant behavior.

Test journey now requires the correct submit button on the current screen,
unique owned fields/consents on the visited prefix, completed required fields
and consent, a required contact identifier and required question answers. A
malformed capture stays on its screen with an explanation and retains typed
answers/details; it no longer accepts an empty snapshot. Capture checkpoints
also name the current save point instead of calling it Not reached.

WordPress verification used the unpublished split-capture QA draft. A deliberately
unresolved field reference stayed on Send enquiry, showed the refusal and never
reached the download. An imported field named `imported_email` was then edited
through Design and saved. Both its node identity and submission reference became
`n4`, the server capture-contract issue was null, and the visitor test accepted
the earlier Email value into the snapshot before showing the download. The draft
remains unpublished and no real capture or destination request was made.

Verification: 2,919 JavaScript tests; 2,132 PHP tests / 11,006 assertions; PHPStan,
typecheck, lint, source-contract checks and Free/Pro admin builds pass. Focused
coverage includes imported fields/consent, all rule locations, namespace
collisions, duplicate IDs, missing canonical references, second-save stability,
malformed test saves and preserved draft input. This closes the imported-ID and
empty-snapshot findings recorded in the preceding capture-readiness audit.


### September 26: graph-aware capture checks and required-contact repair

Design readiness still compared field/resource storage indices with submission
indices. A valid graph stored as Download, Send enquiry, Your details was falsely
flagged although its connections correctly run Your details → Send enquiry →
Download. Readiness now verifies that every path to a save includes the owned
field's unconditional input screen, and that every path to a resource includes
the primary save. Legacy ordered journeys retain their positional checks. The
same graph traversal rejects a field or resource available on only one of the
incoming paths, rather than accepting mere reachability.

A separate server-only `identifier` error now has an editor blocker naming the
save screen when none of its email/phone fields is required. Its repair link
opens the actual field in Design. The WordPress walkthrough verified disabled
publication, the selected Email field, the Required field checkbox, removal of
the blocker, Save draft, and a null server capture-contract issue after saving.
Test journey then collected Email on the first screen, accepted it on the second,
and showed the download and Email in the accepted snapshot on the third. This
QA campaign remains unpublished; the test made no real submission.

The shared split-capture fixture is tested in JavaScript and PHP, including
normalization on save. Focused PHP coverage passes 11 tests / 59 assertions;
The full JavaScript suite passes 2,916 tests with two workers; a prior default-concurrency
run timed out in a builder-shell test and failed the following save-status check.
Both pass in the reduced-concurrency full rerun. Typecheck, lint and Free/Pro
admin builds pass. JavaScript coverage adds valid reversed order, exact required-field repair,
a bypassable field, a conditional owned field, and a bypassable resource.

**Import gap found here (resolved in the reference-preservation section above):** an initial hand-written fixture used `email` as a
node ID. CaptureContract accepted it, but save normalization reminted it to an
`n…` ID without updating the submission reference. Publication then returned
`references`, and the visitor test misleadingly accepted an empty snapshot. The
fixture now uses canonical IDs and its saved round trip is verified, but foreign
ID/reference normalization and rejecting malformed test captures required the
separate fix documented above.


### September 26: visitor-test progress without premature route decisions

The actual 13-screen WordPress test marked Home as bypassed and Business as
included before the visitor answered the required project question. Why this
path also explained future hidden follow-ups using blank answers. The test now
shows Current screen, Visited and Not reached yet, and confirms hidden or
bypassed screens only behind the visitor's current position. Pending screens use
structural reachability through all branches, not the fallback trace for missing
answers. Why this path contains only completed transitions. Back reopens later
route decisions while preserving relevant answers; Reset removes explanations.
Bypassed screens offer Review screen instead of falsely offering Edit condition
for a visibility rule that did not cause the bypass. Try answers remains the
separate tool for exploring predicted routes from sample answers.

Browser verification: blank entry showed twelve pending screens and no route
explanation; Business confirmed Home's bypass; Office plus Ongoing care showed
both follow-ups in sequence, confirming Hotel/Retail skips only when traversed.
The explanation ended at Ongoing care rather than predicting the combined save.
Back retained the typed Office answer and returned all later screens to pending
at the project choice. Switching to Home reversed the branch statuses. Reset and
Close left the draft unchanged and created no real submission.

Validation: 2,912 JavaScript tests pass, including reordered graph storage,
exclusive branches, independent follow-ups, retained answers on Back and legacy
ordered journeys. Typecheck, lint and Free/Pro admin builds also pass.


### September 26: large-map overview, readable focus and drag evidence

A local unpublished enquiry with 53 screens and 101 graph edges (ten exclusive
service branches, each with four independent follow-ups, then one combined save)
passed the server capture contract. It exposed the map's 25% minimum zoom cropping
the top and bottom branches even after Fit journey. The map now permits a 2%
overview floor. Selecting a screen includes its next screen only if both remain
readable; a distant branch or merge no longer shrinks the selected card into a
thumbnail. Closing settings retains the last inspected screen instead of jumping
to entry. This also applies to subsequent regrouping and layout resets.

Browser checks against the rebuilt local Pro admin at 1280×720 verified all 23
grouped cards and all 53 expanded cards inside Fit journey (about 10.8% and 10.5%
zoom respectively). Search opened Home garden with its nearby follow-up group at
readable size. Searching its seasonal-care screen, whose continuation merges far
away, focused that screen at 100%; closing settings retained it. Layout was
restored with Tidy up and no campaign edits were saved or published.

Temporary DOM-only requestAnimationFrame instrumentation recorded a grouped drag
(17 frames, 31/31 paths throughout, median 8.3 ms, max 9.4 ms) and an expanded drag
(44 frames, 61/61 rendered paths throughout, median 8.3 ms, max 17.1 ms). Neither
sample contained empty paths or smart-edge placeholders. Shared visible/hidden
connections explain the difference between graph and rendered edge counts. These
short local samples establish continuity for this scenario, not a general browser
performance guarantee. The temporary instrumentation was removed afterward.

Validation: 2,907 JavaScript tests pass, including nearby/distant camera targets,
tall questions, narrow displays and retained focus after closing settings. Large
map accessibility at native 200% zoom and broader browser coverage remain open.


### September 26: explicit Add screen locations and skip-path scope

Flexible journeys no longer disable the Add screen menu when an ending is
selected. Choosing an offer, question or relevant follow-up opens a location
dialog that names the source, path type/priority and destination. It includes
Before first screen and distinguishes Continue from Everyone else. A suitable
current connection can be preselected; when none fits, the merchant must choose
a location rather than silently changing the entry. The summary shows the
existing answer condition. Confirmation preserves edge identity, priority and
condition. Before-first insertion changes the explicit graph entry and adds Back
to the former entry without making storage order determine navigation.

Enquiry questions require a reachable later save. Post-save messages remain
available, and anonymous/quiz journeys retain their existing capture semantics.
Both the toolbar and direct path-insertion action use the same eligibility rule;
a post-save intermediate message can no longer be used to bypass that rule.
Relevant follow-ups require an explicit answer selection. A hidden-source path
does not offer the skipped source's own question as a condition source.

The location walkthrough also exposed an old ambiguity: splitting a normal
connection automatically split a shared hidden connection. Ordinary named-path
insertion now changes only the chosen path. The dialog explicitly offers to
include visitors who skip the source screen when both routes share a destination.
That choice starts checked for an independent relevant follow-up and unchecked
for an ordinary screen; the merchant can change it. The selected follow-up still
tests its own answer condition and rejoins the original destination when skipped.

Browser evidence on the 13-screen WordPress draft: starting with the ending
selected, all screen types were available; Add question required a location. A
Home answer-path insertion preserved its condition, left Business unchanged,
continued to Home interests and focused the new Questions inspector. Cancel
restored Add screen focus without an edit. At 320px, the follow-up dialog kept
its footer visible and scrolled its fields/summary. A Balcony-conditioned
follow-up inserted after Garden with the shared hidden path included appeared
in Test journey for Home + Balcony while Garden was skipped, with the existing
Balcony screen still included afterward. Each addition was undone; Save draft
was disabled and no campaign was saved/published.

Validation: 2,901 JavaScript tests, TypeScript, ESLint, Free/Pro admin builds and
the source contract pass. Focused regressions exercise graph entry/Back behavior,
exclusive priority preservation, both shared-hidden choices, unanswered/invalid
follow-up conditions, post-save insertion, ending selection, Cancel/Escape and
focus after insertion. PHP and visitor runtime are unchanged. This closes the
Add screen dead end recorded below; large-map dragging, native 200% zoom and
the other release gates remain open.

### September 26: real RTL card and inspector walkthrough

An actual WordPress Persian admin request (`lang=fa-IR`, `dir=rtl`) showed that
React Flow correctly reversed the graph but imposed LTR direction on all card
content. Screen and grouped-follow-up cards now set their content direction
explicitly while leaving React Flow's coordinate system alone. Inline path and
hidden-continuation arrows reverse with the graph. Screen names, question labels,
preview headings and the inspector heading isolate merchant text with `bdi`, so
an English question mark stays with its English name inside an RTL workspace.

Browser checks verified right-to-left graph order and content alignment, twenty
consecutive keyboard controls remaining inside the canvas, the selected inspector
on the left, and the mirrored hidden-path button opening/focusing Continue at.
The 320px visitor-test modal fit the viewport and navigated Business + Office +
Ongoing care to the Office question; the remaining Ongoing care follow-up was
Included. The 390px Next screen inspector exposed its rule controls and footer.
Undo restored the temporary hidden route and Save draft was disabled. The locale
override was scoped to the QA request, then removed; no language preference or
campaign was saved. Plugin UI copy remains English in this installation, so this
checks direction and mixed-language content, not translation completeness.

Native browser 200% zoom remains unverified: the in-app browser did not change
page zoom, and the Chrome attempt did not establish a verified zoom state. Do not
treat earlier reduced-viewport checks as equivalent evidence. Large-map browser
drag frame times and assistive-technology testing also remain open.

The same walkthrough found a separate authoring gap: with an ending selected,
Add screen labels its location “On Everyone else after [ending]” and disables
all three standard screen actions. Replace this dead end with an explicit,
accessible insertion-location choice that names the connection and preserves
its condition/priority. Distinguish a normal continuation from Everyone else;
keep questions before their capture and explain ineligible locations. This is
remaining work, not resolved by the RTL fix.

Validation passed: all 2,888 JavaScript tests, TypeScript, ESLint and Free/Pro
admin builds. The two new map regressions verify LTR/RTL card direction, inline
arrows and first-to-ending layout order. No PHP or visitor contract changed.

### September 26: connections route around cards

The 13-screen enquiry exposed a long Garden hidden continuation passing behind
the remaining Home follow-ups. Map connections now use the MIT-licensed
`@tisoap/react-flow-smart-edge` 5.0.0 smooth-step router, with card clearance and
rounded corners. Its provider batches work in a worker when available and falls
back to main-thread routing when workers are unavailable. Routing remains active
during movement instead of switching all connections to animated fallbacks.
Controlled measurements, card positions, graph semantics, and the inspector
remain owned by the existing editor. The dependency is confined to the lazy
admin map; its chunk increased from 83.44 to 101.12 kB gzip (17.68 kB).

Browser evidence: the separated hidden continuation routes above the Home group.
Moving that group upward into its previous route produces a new clear path.
After movement all nine connections are present with zero routing placeholders.
Clicking the routed dashed segment opens Next screen and focuses Continue at.
Dragging its arrowhead to Business interests updates that hidden destination and
focuses the same control. Two Undo actions restore the saved Balcony continuation;
Save draft is disabled. Tidy up restores the layout. Nothing was saved/published.

Real-engine regressions check every segment against unrelated card bounds for
four obstacle positions in both LTR and mirrored RTL geometry. A separate local
Node benchmark of 40 cards and 55 connections completed five full synchronous
batches in 5.2, 2.3, 1.5, 1.6, and 1.1 ms with no routing failures. This is engine
evidence, not an end-to-end browser frame-time measurement. Overlapping cards
can still cover their own handles; routing cannot make an endpoint inside a
different card clear. Browser RTL, large-map drag frame continuity, and 200% zoom
remain release checks. The new router does not establish a higher product limit.

Validation: all 2,886 JavaScript tests, TypeScript, ESLint, Free/Pro admin builds,
source contract, and existing loader-artifact budget checks pass. PHP and visitor
runtime are unchanged. Existing main-bundle size warnings remain unchanged.

### September 26: direct path actions and hidden continuations

A real map-card click exposed an event-bubbling defect: its path button opened
Next screen, then React Flow's enclosing node handler immediately reset the
inspector to Content & visibility. The node handler now leaves button actions
to their own handlers. Regression coverage models the enclosing click handler,
so testing a path button alone no longer hides this failure.

Conditional graph cards expose their “When hidden” continuation as a keyboard
button. Distinct dashed hidden connections carry the source and hidden-route
identity used by pointer selection. Both open Next screen and focus Continue at;
reconnecting a hidden edge selects the same inspector. Route highlighting
includes the hidden destination and preserves the normal line when visible and
hidden continuations share that line. Hidden connections have named accessible
labels identifying their meaning.

In the 13-screen WordPress draft, clicking the first-match Home path now opens
Next screen and focuses its answer. Temporarily changing Garden's hidden route
to the combined save separated it from its visible continuation and removed it
from the independent-follow-up group. Enter on the new When hidden button and
an actual pointer click on the dashed line each opened and focused the correct
Continue at control. Undo restored the original Balcony continuation; Save draft
was disabled afterward. No campaign was saved or published. Complex dashed
connections can still pass behind other cards in the all-map overview; this
readability issue remains part of the complex-layout release gate.

Validation passed: all 2,884 JavaScript tests, TypeScript, ESLint, and Free/Pro
admin builds. The PHP contract and visitor runtime are unchanged in this slice.

### September 26: keyboard canvas traversal and inspector return

A real keyboard walkthrough exposed extra Tab stops on raw connection lines,
internal IDs in their accessible names, and focus disappearing beyond the
canvas. The map now tabs through its actual screen/path buttons and grouped
follow-up controls. React Flow's redundant wrapper/edge Tab stops are disabled;
edge names use campaign screen names, and the node description explains the
available editing controls instead of promising unsupported Delete behavior.
The shared focus camera pans only as needed to reveal a keyboard-focused control,
preserving zoom and card positions. It waits a frame for WebKit's focus-visible
state and any internal group scrolling before measuring the control.

Closing screen settings returns focus to its originating control, or the screen
search when that control no longer exists. It preserves the merchant's Flow or
Screens view. The inventory no longer draws downward arrows between adjacent
cards: those cards may belong to different branches and are not necessarily
connected.

The 13-screen local WordPress fixture was traversed using Tab from screen search
through the first screen, both branch controls, both groups of four follow-ups,
the combined save and ending. All 21 canvas controls were visible when focused
at default zoom on desktop, 390px and 320px viewports. Enter opened the selected
screen. Closing its settings restored the card's focus; the equivalent inventory
interaction preserved Screens view and focused its originating card. The viewport
was reset, and no campaign edits were saved or published. These checks do not yet
prove 200% browser zoom, RTL or assistive-technology behavior.

The full JavaScript suite passed 2,881 tests across 150 files with four workers;
the initial unconstrained run timed out in an unrelated builder-history test,
which passed both focused and final full runs. The 98-test focused editor/map/
builder suite, TypeScript, ESLint and both admin builds passed. The visitor
runtime and PHP contract are unchanged in this slice.

### September 26: real product availability and result repair

Selected products now require a fallback destination and label even when the
merchant disables “Require live products before publishing.” Disabling that
catalogue check must not permit an unavailable-product dead end. The PHP
publication contract and admin readiness both enforce this. Text-only results
can still omit links. Review names the affected result and opens its specific
variant, focusing the fallback field; broken result-condition repairs also
select their own variant. Focus runs after the requested variant's controls
commit, avoiding both parent focus competition and focus loss on tab replacement.

A disposable WordPress 7.1.2 / WooCommerce 11.1.2 site verified the actual visitor
popup, using keyboard controls throughout. Garden + Mostly sunny showed the
$29 available product and excluded a selected sold-out product. Changing the
remaining product to out of stock, going Back, and continuing preserved the
answer and fetched the updated availability. The result retained its heading
and message, displayed the unavailable-products explanation, and its fallback
opened the actual shop. No Lead was created. A further browser pass confirmed
the result action and Back have the shared vertical gap instead of touching.
The temporary campaign was unpublished and its pages/products returned to draft.
WooCommerce was installed only in this disposable site, not wconvert.local.

A separate unpublished local admin fixture verified the missing-link blocker,
correct-variant repair and keyboard focus, removal of the blocker after filling
both fields, and Undo restoring the original draft. Full suites passed 2,879 JS
tests and 2,127 PHP tests / 10,929 assertions. The final focus change passed the
43-test editor/readiness suite, TypeScript, ESLint and both admin builds.
PHPStan and unchanged loader budgets passed, including Node 22 compression.
These checks cover basic live availability and fallback, not all product
combinations, API failures or external destination delivery.

### September 26: named Undo/Redo and coherent journey typing

Campaign history now describes the actual action being undone/redone: screen
addition/removal/rename, path changes and priorities, visibility, questions,
results, saves, styles, campaign name, display rules and destinations. Labels
come from the adjacent whole-draft snapshots, so coalesced typing and normalized
server responses do not turn them into a separate command log. Shared history
semantics remain unchanged: saved draft edits can be undone without changing
the published version, and a saved Goal change starts fresh history.

Journey screen names, question labels/help/choices and result copy now pass
stable per-field typing keys to the existing history coalescer. One typing
burst is one Undo step; different fields and non-typing operations remain
separate. Desktop/focus-view controls expose the action as their accessible
name and title; the mobile action menu displays the full text and wraps long
screen names within the viewport.

Local WordPress verification covered two distinct typing bursts, two Undo
steps, Redo, Save draft, retained labels after save, and restoration/save of the
original QA content. A reviewed path change was named and undone coherently.
The 390px/320px mobile menu exposed a long-label clipping issue; the final
viewport-constrained menu wraps it. Test changes were restored and temporary
viewport overrides reset. The full JavaScript suite passed 2,876 tests;
TypeScript, ESLint and both admin builds passed, followed by the stylesheet
suite after the mobile wrapping fix. No visitor or PHP behavior changed.

### September 26: path-change save consequences and direct capture repair

Reconnecting a line, drawing a new path or changing the path inspector now
reviews newly bypassed required saves as well as newly unreachable screens.
The confirmation names the ending/result and the save screen even when all
screens still have incoming connections. Existing bypasses do not trigger
repeated confirmation on unrelated edits, and optional captures are not treated
as required gates. This is conservative connectivity analysis, not a claim
that every rule combination can occur.

Publish review now blocks these required-save bypasses before the server write
and provides a repair link to the implicated connection. Hidden exits focus
Continue at; default exits focus Go to. Cancel restores focus to the path
control; canvas impact review returns to the selected screen heading.

In local WordPress, Indoor details' hidden exit was redirected to Request
received while Contact details stayed connected. The warning named the skipped
save. Applying it produced a disabled Save & publish action and a named issue.
Its repair link focused Continue at; restoring Contact details removed the
blocker. Both draft changes were undone, leaving Save draft disabled. No
campaign was saved or published during this check.

Validation: the complete JavaScript suite passed 2,870 tests; the final
connection-focus regression is also covered by the editor suite. TypeScript,
ESLint and both admin builds pass. This closes the required-save bypass repair
gap, not all server-only validation or the broader release gate.

### September 26: focused journey workspace and nested keyboard behavior

An embedded journey can now expand into Focus journey without remounting its
map or resetting manually moved cards. The transient view hides campaign and
WordPress chrome, keeps Undo/Redo and Save draft available, and restores the
campaign with its separate Full width preference unchanged. Escape dismisses
an open menu or Test journey first; a subsequent Escape leaves focus view and
returns keyboard focus to its toggle. Embedded test-dialog focus restoration
is synchronous so a queued animation frame cannot steal that focus afterward.

A real WordPress check verified the 13-screen branch fixture, preserved dragged
positions across the view switch, edited/undid/redid/saved from focus view and
restored the QA draft. The canvas grew from about 236px to 487px tall at
1280×720. Phone checks at 390×844 and 320×740 exposed a WordPress body toolbar
offset; focus view now removes it and leaves map controls reachable. These
checks improve space, not prove fit-all text readable for every large graph.
Broader zoom/RTL, graph-edit scenarios, delivery evidence and merchant testing
remain release work. No QA campaign was published for this slice.

Validation: 2,861 JavaScript tests pass, including same-map identity, nested
Escape and saved Full width preference regressions; TypeScript and ESLint pass;
Free and Pro admin builds pass. Visitor/PHP code is unchanged by this slice.

### September 26: question budgets follow routes, with actual capture evidence

The eleven-question bank in the two-branch fixture now passes publication.
Version 3 counts the longest connected route, with hidden exits skipping their
source questions, instead of summing mutually exclusive branches. The existing
ten-answer capture request bound is unchanged. The Add question control applies
the same route capacity, so an already-full home branch does not disable adding
a question to the shorter business branch. This is a conservative topology bound,
not predicate solving: a connected route over ten is refused even if particular
answers might hide enough screens. Version 2 keeps its existing total bound.

Review names an over-limit route and disables Publish. In the local browser,
the repair link opened Irrigation and maintenance and focused its question text.
The delete confirmation explained reconnection of its two incoming routes to
the common enquiry. Removing that one screen cleared the blocker; Undo restored
the untouched draft. No negative test campaign was published or saved by the UI.

A separate clone of the 13-screen fixture was published through the real REST
publication service, restricted to the existing local QA page with local-only
capture and no destinations. Keyboard interaction with the production visitor
popup selected Business, Office planting and Ongoing care, answered those two
follow-ups and submitted. The database confirmed one Lead, one enquiry snapshot,
and exactly the branch choice, business interests and two selected follow-up
answers. No home answers were saved. The campaign was then unpublished and the
QA page returned to draft. Test Lead: `branch-budget-20260926@example.test`.

JS covers separate branch budgets, additions on a full versus shorter branch,
repair text/target, hidden exits and malformed cycles. PHP covers the same shared
fixture, ten accepted answers, rejection of an eleven-answer request, hidden
exit accounting and refusal of an eleven-question route. Full suites passed
2,859 JavaScript and 2,126 PHP tests. Final focus-related checks passed 70 JS
tests; expanded contract coverage passed 10 PHP tests / 56 assertions. TypeScript,
ESLint, PHPStan and Free/Pro admin builds passed. The first full JS run timed out
under concurrent load; the rerun used four workers with unchanged test timeouts
and passed. Visitor loader code and payload bounds were not changed.

### September 26: parallel branches, measured layout and reading order

A new 13-screen draft fixture has mutually exclusive home/business branches,
four independent follow-ups on each branch, long labels, and a shared enquiry
save. Expanding its groups in WordPress exposed four pairs of overlapping cards:
the layout estimated heights instead of using the rendered text's dimensions.
Layout now settles using measured widths/heights. Browser DOM geometry confirmed
zero intersecting card pairs after expansion. Moving a card opts out of automatic
measurement-based arrangement; Tidy up or a structural change explicitly starts
a fresh layout. A regression checks tall parallel cards, retained manual positions
after another card grows, and explicit re-arrangement.

Canvas node order now follows the same topological reading order as the screen
numbers and Screens inventory. The reversed-storage fixture previously put the
ending first in the DOM; it now begins with the entry question and ends with the
shared capture and ending. Browser Try answers selected Business + Office +
Ongoing care: two business follow-ups shown, no home follow-ups, and one simulated
enquiry. The fixture and test assert exclusion of stale home answers. These were
draft-only checks, with no publication, Lead creation or destination request.

The server check initially identified a graph-wide ten-question cap despite
only six questions on either visitor path. The route-budget change and actual
publication/capture evidence above supersede that gap. Fit-all on a branching
map remains too small in a short desktop
canvas; selecting a screen is usable, but the broader workspace-size/focus view
still needs work.

The full JavaScript suite passed 2,856 tests, and TypeScript, ESLint and Free/Pro
admin builds passed. No PHP or visitor loader code changed in this slice.

### September 26: readable independent follow-ups

The map now summarizes a safe sequence of independent conditional questions in
one “Relevant follow-ups” card. Each screen retains its name and complete rule,
and the card explains that every matching screen appears in order. Capture
screens, exclusive branches, different hidden exits and external entries into
the middle stay explicit. Grouping changes only the view; it does not rewrite
screens, connections, priorities or visitor behavior. Expand restores the
original nodes and connections and focuses the first screen. Group members open
their existing inspector. Summary arrows cannot be reconnected as fake runtime
nodes; expanding reveals the editable connections.

The local WordPress six-screen enquiry now fits as four readable stages.
Try answers with Garden + Indoor reports “2 of 3 shown,” marks Balcony skipped,
and still describes one combined enquiry. Search selects a grouped screen and
opens its actual condition editor. Expansion and regrouping were exercised in
the browser, including restored keyboard focus. No campaign was changed, saved
or published in this check.

The map toolbar occupies its own row, including zoom controls, so it does not
cover cards. Camera fitting responds to height changes as well as width. At
390px and 320px, a compact View options menu exposes the remaining controls.
Short phones scroll a workspace with a readable map height instead of shrinking
cards into the remaining space. Wheel scrolling on those narrow screens moves
the workspace rather than panning the diagram away. Header actions wrap, search
fits, and campaign tabs can scroll horizontally. The normal viewport was restored
after browser verification. This is focused responsive evidence, not a completed
touch-device, RTL, zoom or full accessibility audit.

The full JavaScript suite passed 2,854 tests; after relocating the final zoom
controls, the focused grouping/stylesheet suite passed 456 tests. TypeScript,
ESLint and Free/Pro admin builds passed. No visitor loader or PHP code changed.
Complex nested branches/merges, long groups, larger maps and broader keyboard
workflows remain required evidence. The grouped common enquiry is improved;
the overall release gate is still open.

### September 26: canvas authoring for explicit graphs

The graph inspector supported v3 edits, but the map still refused every v3
connection. Flexible graph cards now expose new-connection handles, and existing
edge arrowheads can be dragged to change their destination. New answer branches
append after existing answer priorities, preserve Everyone else, and deliberately
start with an unchosen answer. Drawing repairs a missing default when necessary.
Cycles, self-loops, unknown targets and duplicate new routes are refused. A
reconnection preserves its edge ID, condition and priority; newly stranded
screens are named in a review before application. The old five-answer-branch UI
limit no longer applies to flexible graphs. Parser bounds remain unchanged.

The real WordPress draft was used to draw a branch from the initial interests
question to Balcony. The condition panel opened with focus on its answer choices.
Review blocked publication with a named missing-answer repair link; choosing
Balcony repaired it. Drawing an existing arrow from the Garden destination to
Balcony first warned that Garden would become unreachable. Applying showed the
unreachable-screen warning; Undo restored the original route. A backward drag
from Garden to the initial question left the draft unchanged. All test edits
were undone without saving or publishing. An obsolete branch instruction after
Undo was found and corrected, with a browser recheck. Card data now remains stable
while positions change, so moving a box does not recreate all card content.

The full JavaScript suite passed 2,842 tests. The expanded focused suite, including
the additional six-branch regression, passed 35 tests. TypeScript, ESLint and
Free/Pro admin builds passed. No visitor or PHP changes were made. This closes
canvas branch creation/reconnection, not the whole layout gate: Fit journey on
the six-screen enquiry still makes cards too small for comfortable reading.
Grouped independent follow-ups and complex-map readability remain required work.

### September 26: actual publication and visitor capture

The first real graph publication attempt exposed a missed boundary:
`OptinRepository::publish()` still used the version-2-only form validator after
REST had accepted the graph. It returned null, surfaced as “No such Campaign.”
The repository now applies the same goal-aware capture contract to v3 graphs.
Regression tests promote an unordered combined enquiry, refuse a later branch
that bypasses its required capture without changing the live snapshot, and
allow an anonymous graph quiz only under the quiz goal.

A separate local QA campaign was restricted to one QA page and configured for
local-only capture, with no destinations. The **published visitor popup**, not
the admin simulation, was operated by keyboard in its production closed shadow
root. Garden and Balcony both showed their follow-ups. After entering email,
Back retained both answers; deselecting Garden skipped it, retained Balcony's
answer, and retained the contact draft. Submit reached Request received. The
WordPress database contained exactly one Lead, one enquiry snapshot, the Balcony
selection and answer, and no Garden answer. Back showed the accepted email
read-only and disabled the accepted question choices; Continue did not create
another Lead. The QA campaign was then unpublished and its page returned to
draft. The two original QA campaigns were not changed. The test Lead remains
for inspection (`journey-browser-20260926@example.test`).

Real WordPress 6.8 / MySQL checks also passed in a separate disposable database
under PHP 8.2, in both Free and Pro: graph publication, Pro graph capture,
inactive-answer exclusion, replay returning the same Lead, Free refusal of
premium graph capture, six concurrent submissions producing one Lead, and
recovery across 120 queued submissions. The lead-log SQL verifier passed with
the distinct-millisecond fixture fix. CI now runs the capture verifier with
both Free and Pro installed in sequence. GitHub's latest run could not allocate
a runner because of the account billing/spending limit; local evidence does
not mean that required CI gate has passed.

The full PHP suite passed 2,124 tests / 10,873 assertions after the publication
fix, and PHPStan passed. No visitor bundle changes were needed for this slice.

The following quiz and saved-screen slice closes the missing read-only
explanation and published informational quiz checks. External delivery and
live WooCommerce recommendation availability remain separate release checks.

### September 26: published quiz timing and saved-screen details

Accepted screens now explain “Already saved” on Back in Free, Pro and Test
journey. The shared localized labels support older cached payloads; Free no
longer discards translations when PHP supplies more than two labels.

A real local quiz publication exposed three additional gaps. Moving the signup
before the result retained the generated marketing checkbox; required gates now
hide and unown that generated checkbox, restoring it for optional signup.
Merchant-written consent is preserved. Hidden consent can remain as design copy
only when no submission claims it. The review's capture classification now uses
graph result timing rather than storage order. Result content renders before
navigation, absent links no longer paint an empty button, and the modal's
accessible name follows the selected result rather than the fallback. Test
journey also updates the selected result link instead of retaining the fallback.

Two isolated published local fixtures verified both timings through the visitor
popup using keyboard controls. The required gate refused an empty email, then
accepted a test address and reached Sunny garden picks. Back showed the accepted
address and read-only notice. The database held one Lead, both answers, purpose
`request`, and no accepted marketing consent. The anonymous fixture reached the
same result before signup, displayed optional signup with the restored checkbox,
and allowed “No thanks” to reach Thanks for visiting. It created zero Leads.
Review correctly distinguished the required request gate from optional marketing
signup. Both fixtures were unpublished and their shared QA page returned to
draft afterward. Original QA drafts were untouched. These were informational
results with product requirements disabled, not WooCommerce availability tests.

Validation: the full JavaScript suite passed 2,834 tests; an additional selected
result-link regression passed in the six-test Test journey suite. PHP passed
2,125 tests / 10,876 assertions. TypeScript, ESLint, PHPStan, Free/Pro admin
builds and all unchanged visitor/phone byte budgets passed, including loader
compression under Node 22. Required GitHub CI remains externally blocked by
account billing/spending-limit status.

### September 26: repair controls and path-aware authoring review

Readiness now names missing/deleted question sources, questions that cannot be
answered before a rule on any incoming path, stale answer choices, incompatible
comparisons, and missing default/hidden continuations. A question available on
only some incoming paths remains allowed. The controls retain invalid selections
visibly instead of displaying an unrelated question, let merchants replace them,
and repair absent continuations without drawing lines. Editing visibility keeps
an existing hidden route even while the default route is missing. Empty required
branch conditions stay invalid until repaired; removing their last clause cannot
silently turn them into a match-everyone route.

In local WordPress, the unpublished multi-interest QA campaign was temporarily
changed so Balcony details referenced the Garden answer, then Garden's normal
and hidden routes were sent directly to Contact details while a separate branch
still reached Balcony. Review correctly blocked publication and named the
impossible Garden dependency. Its repair opened Balcony's condition and focused
the unavailable-question selector. Replacing the source with the initial
interests question cleared the blocker. All scenario edits were undone, leaving
the saved QA campaign unchanged. No campaign was published by this check.

The focused repair/readiness/editor suite passed 37 tests, the full JavaScript
suite passed 2,830 tests, and Free/Pro admin builds completed. The database CI
fixture also now separates lead writes by milliseconds so random ULID suffixes
cannot make its newest-first expectation flaky; confirmation awaits the next CI
run. These checks do not close the remaining release gate below.

The current branch now accepts several answers in a multi-choice condition in
the editor, PHP normalization, capture validation, and the existing JS matcher.
The editor uses checkboxes, and the map names the matching choices. Tests cover
authoring, PHP/JS evaluation, invalid references, and vocabulary round-trip.

Test journey now keeps contact drafts, marks simulated accepted and skipped
submissions, supports a retryable save failure, and locks accepted fields and
question answers when going Back. Each accepted snapshot includes the visited
questions through that save point, including optional ones left unanswered, and
excludes answers from later screens. A failed save preserves a draft question
typed on the same screen as the contact fields. The preview also separates a
simulated accepted save from queued or failed destination delivery, lets the
merchant retry delivery without another save, and names traversed graph edges
with their conditions. The local WordPress browser check exposed and fixed a
narrow modal and internal submission IDs in its summary. These improvements
are slices of the release work, not a claim that path-sensitive validation or
full prototype parity is done.

Publish review now catches an unfinished answer condition on a v3 connection
before the server rejects it. Its fix action opens that connection's source
screen and path settings; incomplete screen visibility/result rules and
disconnected screens likewise name the affected screen. This is a focused
authoring check, not a replacement for the server's full graph and capture
contract. Other server-only failure codes still need precise repair targets.

The live visitor and Test journey now share one capture-prefix calculation.
Submitting from an earlier save includes only answers on screens reached before
that save; it never accidentally sends a retained answer from a later screen.
An accepted save locks every reached question, including optional questions
left blank. The server stores that question coverage with the accepted snapshot
and rejects a later progressive submission that changes a covered answer or
fills a previously blank one. A new transaction test exercises both refusals
and a valid unchanged second capture; the mounted visitor test exercises Back,
earlier optional signup, and retained later answers. This closes the accepted
snapshot gap but does not replace a real browser visitor walkthrough.

The next slice added route and skip decisions to the shared JS/PHP evaluator.
Try answers now explains whether a screen was bypassed by a winning branch or
hidden by its own condition; Test journey labels that distinction too. This
trace still uses the ordered v2 journey model and does not yet identify stable
edge IDs or capture boundaries. Those remain part of the graph-contract work.

The graph-contract slice now has an explicit v3 entry and stable edges, equivalent
JS/PHP traversal, structural validation, a v2 migration with path-parity checks,
and an unordered multi-interest fixture. The visitor runtime, server answer
capture, purpose detection, Try answers, and Test journey use that graph when
present. Draft normalization preserves graph IDs and priority; v2 remains on its
old evaluator. The v3 publish boundary now checks capture ownership,
goal-specific required paths, and result/question requirements. The editor can
explicitly upgrade a v2 draft, insert on a named edge, and edit branch
priority, fallback and hidden destinations without changing visitor routing
through array order. The Screens inventory and map use a topological reading
order. Safe one-destination graph deletion previews its reroute and supports
Undo. This is still an implementation slice, not prototype parity: complex
branch deletion, result-gate authoring, grouped follow-ups, browser scenario evidence,
and precise readiness repair links remain open. The server currently requires
field and consent screens to appear on every path to their save point because
capture requests cannot otherwise prove a conditional field was visited.

## Initial gaps recorded September 25

This table preserves the initial audit, **not the current implementation status**.
Use the progress and dated browser evidence above/below for completed changes;
the release checks at the end remain open until explicitly verified.
“Current” below meant source inspection of PR #190 plus a real WordPress browser
walkthrough on the local Pro build. “B” means prototype behavior, which used
simulated submissions and delivery. A gap is not proof of an observed visitor bug
unless stated as such.

| Area | Current plugin | B behavior / required decision | Priority |
| --- | --- | --- | --- |
| Journey data | `tree.steps` is both storage order and implicit continuation; paths may only target later array items before the next capture/result boundary. Seven screens and two submissions maximum. | A graph with stable screen/edge IDs, explicit default continuation, directed acyclic branches and merges. Content order and canvas position must not silently route visitors. Reassess limits with payload and layout measurements. | P0 |
| Hidden screens | A false `when` falls through to the next array item, even when that item is not the intended visual continuation. | The skip destination must be explicit, named in the inspector, and exercised in preview/server validation. | P0 |
| Question availability | PHP validates conditions against globally earlier questions, not questions guaranteed to be available on each incoming path. A branch can legally reference a question from another branch and never match for some visitors. | Validate path-specific source availability. An unvisited or unanswered question evaluates false, with a named explanation on paths where it is absent. Reject a source that cannot be visited before this rule on **any** path; do not reject useful conditions after a merge merely because one incoming path lacks the question. | P0 |
| Multiple answers in one clause | JS matcher accepts `values[]`, while PHP normalization requires exactly one value and the admin editor exposes one `<select>`. | Align authoring, JS, PHP and the saved schema. Multi-choice “contains any of…” needs a deliberate multi-value control; otherwise keep single-value semantics everywhere. | P0 |
| Capture boundaries | Existing ordered model owns field/consent references and forbids paths crossing the next save/result boundary. | Specify which goal requires capture, prove all required paths reach it, and prevent a path from bypassing required consent or saving fields from unvisited screens. Preserve one Lead across explicit progressive submissions. | P0 |
| Visitor trace | `journeyPath()` returns visible indices and active answers. The sample dims cards but does not mark the actual winning edge or explain an exact skipped rule. | One evaluator returns visited screens, traversed edge IDs, winning condition, bypassed screens and reason, active answers, and capture boundaries. Visitor, sample and server must agree. | P0 |
| Full preview | `JourneyTest` uses the real renderer, but Submit/Skip just advances. It has no accepted-submission ledger, failed-save/retry state or destination outcome. It stores only question answers; remounting can discard a typed contact draft on Back. | A test session runs the actual navigation semantics without network writes, keeps unsaved drafts, freezes accepted snapshots, and explains that provider delivery is queued/failed separately from local save. | P0 |
| Back after acceptance | The live runtime locks accepted fields and question IDs; the preview does not model that boundary. | Back reviews accepted data read-only; no replacement or duplicate Lead. Answers after the accepted boundary remain editable. | P0 |
| Publish validation | Readiness catches structural route problems but has no end-to-end scenario evidence, precise clause/edge repair path, shadowed-rule warning, or path-sensitive capture proof. | Link every blocking issue to a field/edge; warn on redundant priority; offer representative walkthroughs as evidence, not a mandatory publish checklist. | P0/P1 |
| Map overview | This branch now opens the Journey tab on a full-width map and opens the inspector on selection. It does not group independent follow-ups; a five-screen modal needs horizontal panning for later screens. | Group repeated independent follow-ups without changing semantics; keep the expanded group navigable by keyboard. | P1 |
| Context and saving | The Journey summary now reuses the Display rules wording, and capture cards say where details are saved with a link to Destinations. The map still cannot distinguish accepted save from queued delivery or trace separate submissions. | Differentiate saved request, queued delivery, result completion and optional signup at the exact handoff. | P1 |
| Authoring affordances | New connection can create an empty answer condition, then opens path settings. Insertion lives in the inspector. The Screens list now calls itself an inventory, and Add screen names its actual insertion point. | Offer clear intent before connecting; put insert action on the specific path; show exact rule priority/fallback. | P1 |
| Rule repair | Referenced answer replacement exists, but discovery remains mostly through selected settings. | Direct “Used by” links, exact clause focus, impact preview for reroute/delete, and one named undo action for structural edits. | P1 |
| Screen preview | The current map offers text previews; B offers per-screen preview from the card and full path preview. | Separate “Preview screen” from “Test journey” in labels and controls; render the selected screen at realistic viewport sizes. | P1 |
| Canvas state | Map layout is recalculated from the ordered graph and drag positions are local to the mounted tab. Sample path styles leave edges visually present regardless of whether they were traversed. | Persist or deterministically restore layout independent of routing; highlight actual traversed edges; preserve viewport/selection across tab changes; keep drag smooth. | P1 |
| Small screens and access | Mobile Map/Edit switch exists. The map and inspector still have dense controls and the canvas is pointer-oriented. | Complete every task through controls without drag, test focus and announcements, 200% zoom, 320/390px, RTL, long labels, and reduced-motion preferences. | P1 |
| Scale | Current seven-screen cap makes realistic multi-interest and branching campaigns run out of space quickly; B's 20-screen fixture is only a stress example. | Set a measured limit after testing dense branches, serialization, layout, preview, server processing and loader budget. Do not treat 20 as a user-requested limit. | P1 |

The code evidence is concentrated in `resources/loader/src/journey-rules.ts`,
`src/Template/JourneyRules.php`, `src/Template/CaptureJourney.php`,
`pro/modules/journeys/loader/journey.ts`, and `resources/admin/src/builder/`
`JourneyEditor.tsx`, `JourneyMap.tsx`, `JourneySample.tsx`, `JourneyTest.tsx`,
`JourneySettings.tsx`, and `ReadinessDialog.tsx`. The prototype's [evaluation](../../tools/design-system/editor-prototype/flow-prototype/EVALUATION.md)
is engineering evidence, not a merchant study.

## Browser walkthrough, September 25

The local WordPress campaign **Reveal a welcome discount** remained a saved,
two-screen draft throughout the walkthrough. Its Display rules said **after 12
seconds on the page**, while the Journey tab initially said **Automatic
trigger**. The Journey summary now uses the same rule sentence. Before the
map-first change, its inspector occupied 35% of the canvas at entry; after the
change the two-screen map opens full-width, the capture card names the save
point, and the instruction sits above rather than on top of that card. The
Add screen menu had said **After Details** but inserted a question **before
Details**; it now states the actual insertion location. No campaign change was
saved or published during this check.

In the isolated five-screen comparison fixture, the former fit-all camera
made the nodes illegibly small inside Manage screens. The camera now starts
with the first two screens at readable size; later screens require scrolling
or **Fit journey**. The inspector can be closed to return to the overview.
The production Test journey still advances straight from a simulated submit
to its ending without a save ledger, unlike B's preview. Readiness checks
structural errors but does not present a route and capture walkthrough.

B's **Multiple interests** scenario was walked through with garden and balcony
selected, then Back to deselect garden. Both relevant questions appeared
before one combined enquiry; the garden answer was removed, the balcony answer
and contact draft persisted, and a simulated save failure kept the form.
The **Find your coffee** scenario showed a result before any contact details;
choosing **No thanks** at optional email signup ended the journey with no
simulated submission. Its result preview also offers product-unavailable and
loading-failed states. B's Add screen dialog initially clipped its action below
the viewport; it now has a scrollable form and a visible footer action. These
are prototype observations, not claims about the production visitor runtime.

In a separate local WordPress enquiry draft, the first question was changed to
three interests and three conditional follow-ups were inserted before one
contact save. Try answers showed Garden and Balcony together, then Balcony
alone after Garden was deselected; both paths still reached one contact save.
The draft is saved as **QA — Multi-interest graph (draft)** and remains
unpublished for review.
That walk exposed a real insertion defect: adding a follow-up after a hidden
conditional screen originally left its hidden edge pointing beyond the new
screen. The insertion helper now retargets that hidden edge when it shared the
selected default destination, and a graph traversal regression test covers it.
The same walkthrough found that Design's screen picker still numbered screens
by storage position; it now uses the Journey's topological reading order.
The full Test journey modal rendered the real first screen and its route and
capture summary, but the browser automation surface could not interact with
the renderer's closed shadow root. JS mounted-visitor tests cover the Back and
answer-pruning behavior; the full WordPress visitor interaction remains a
release check.

A separate local **QA — Graph quiz capture (draft)** exercised the product
finder after explicitly enabling flexible paths. The merchant can now add an
optional email signup after an anonymous result, then move that same signup
before the result as a required gate. Both transformations preserve upstream
graph edge IDs, explicit field/consent ownership, and the existing ending
screen, including merchant-written ending content. The required version was
saved and reloaded in WordPress; the map and Design screen picker showed
contact before the result, then the ending. The readiness dialog reported destination
configuration as the remaining publish blocker for this local draft, not a
graph-route error. This is evidence for a simple quiz gate, not proof that
arbitrary result topology can be rearranged; the editor disables the timing
choice when it cannot safely transform the existing connections. The browser
walkthrough also caught and corrected misleading first-capture and stale
status wording.

After rebuilding the Pro admin assets, the same saved quiz draft was reloaded
in WordPress. Test journey showed the real first screen, the required-contact
notice, topological path summary, an expandable connection trace, and the
capture checkpoint summary. The browser control could inspect the rendered
screen and modal but could not click inside the renderer's closed shadow root;
mounted-renderer UI tests cover the simulated save failure, snapshot, Back,
and destination retry. This does not yet satisfy the full real-browser visitor
interaction release gate.

The saved quiz draft was reloaded again after the readiness-link change. Review
& publish still showed destination setup as its only publish blocker; it
did not invent an unfinished-path problem for a valid route. A draft with an
empty graph answer condition is covered by the readiness UI test, which checks
that its fix action selects the stable source screen and matching path.

## Browser follow-up, September 26

The admin-only Test journey mount now uses an open shadow root, allowing the
browser test to operate its actual rendered controls. Published visitor mounts
retain the existing closed root. Both QA campaigns remain unpublished drafts;
the following evidence is real WordPress **admin simulation**, not a claim of
published visitor capture or provider delivery.

- **Required quiz gate:** selected Garden and Mostly sunny, reached contact
  before the result, typed an email and consent, simulated failure, then retried.
  The retry reached Sunny garden picks. Back showed accepted contact fields and
  the preceding answer read-only. This exposed generated “Back to result” copy
  on a gate before that result; result-timing transformations now use “Back.”
- **Combined enquiry:** selected Garden and Balcony, answered both follow-ups,
  typed contact details, then went Back and deselected Garden. Balcony's answer
  and the email remained. Garden and Indoor were hidden. A simulated failed
  save stayed on contact, and retry accepted one snapshot with only Balcony,
  its follow-up and the email. The snapshot initially displayed stored option
  keys; its review now resolves the visible choice labels.
- **Authoring gaps:** inserted question screens lacked Back. New follow-ups now
  include it; inserting/moving a screen to the start removes Back there and
  gives the former first screen a Back control. Existing merchant content is
  not silently rewritten; the two old QA follow-ups were repaired using Design.
- **Design parity:** Layers called every later storage item “After they submit,”
  disabled Question on an upstream follow-up stored after contact, and described
  Continue as “Shows a result.” Layers now uses named screens, graph additions
  follow navigation rather than storage order, and button summaries describe
  their actual action. The WordPress browser confirmed Garden details and its
  enabled Question insertion control after rebuilding.
- **Phone and keyboard:** at 390px and 320px, Test journey now scrolls its body
  while retaining its title and Close action. Snapshot labels and values stack
  at phone widths. Opening focuses the visitor heading, Tab reaches the first
  answer, and keyboard selection/Continue advances to the next heading. Closing
  returns focus to Test journey; a condition repair instead targets its screen
  settings. These checks cover this modal, not the entire editor's accessibility.

The accepted-save implementation initially exceeded the Basic/Pro/Elite loader
budgets. Reusing the existing node index and sharing question enumeration across
the v2/v3 route and save-prefix evaluators brought all tiers back under the
unchanged budgets. No diagram library is included in the visitor loader.
CI's Node 22 compression initially remained above the local Node 24 result.
The follow-up consolidation shares the full node traversal and result-timing
classification too. The shared shell's result-first check now follows graph
connections rather than storage order; fixtures reverse storage for both
optional and required signup and retain the expected classification.

Remaining release work includes external delivery, broader product combinations
and API-failure evidence, precise repair targets for server-only failures,
complex/large-map readability, complex graph edits, and the responsive/keyboard/RTL
checks below. Basic live-product availability and fallback are verified above. Do not mark
the feature merge-ready solely from the successful admin simulation.

## Scenario contract before more visual polishing

For each fixture, assert the same visited screens, winning edge, skipped-screen
reason, active answers, result, capture snapshot, and conversion boundary in
JS, PHP, real preview and the WordPress visitor. The following set is the
minimum; record expected outputs as fixtures instead of duplicating the
evaluator's implementation in tests.

| Scenario | Expected invariant |
| --- | --- |
| Simple signup | One visible save point and one acknowledgement. Next/Back never saves. Failed save retains inputs; retry creates one Lead. |
| Multi-interest enquiry | All seven nonempty combinations of three interests. Every relevant follow-up appears; unrelated follow-ups do not. One final enquiry contains only visited answers. |
| Change interests | Answer two follow-ups, type contact details, go Back and deselect one interest. Retain the still-relevant follow-up and contact draft; discard the excluded answer permanently. |
| Independent and exclusive rules together | Several independent conditions may match; only the first matching exclusive branch is taken. A merged screen appears once. Everyone else is explicit. |
| Missing answer and negative rule | An unanswered optional question does not satisfy either positive or negative comparison. A newly visited required question blocks forward travel. |
| Inaccessible rule source | A rule depending on a question from a skipped sibling path evaluates false on that path and preview names why. A rule whose source is unreachable on every incoming path is a publication error with a direct repair link. |
| Reroute or delete | Show disconnected screens, lost submissions and changed result/capture paths before applying. Undo restores one coherent graph. |
| Product finder | Test 48 brew/taste/grinder combinations, result fallback, unavailable products, result-first anonymous completion and optional signup. No Lead before explicit capture. |
| Required result gate | Every route to the result passes the required capture with its fields and consent; quiz text promises a gate on the first screen. |
| Progressive email/SMS | Email acceptance creates one Lead; skip or failed SMS does not replay email. Accepted question/field snapshots are read-only on Back. Explicit later SMS adds to that Lead with its own consent. |
| Save versus delivery failure | Save failure stays on the form with inputs. After accepted save, a provider failure means queued/retry delivery, not a second visitor submission or a claim of subscription. |
| Display and destination context | Different display rule combinations affect campaign eligibility, not the journey route. A destination is associated with an actual accepted capture, not mere arrival at a card. |
| Draft edits and publication | Rename preserves IDs; removing a referenced option requires repair; incomplete draft saves; publish blocks on actionable structural/capture errors; walkthrough evidence is advisory. |
| Responsive/accessibility | Complete creation, rule priority change, test, repair and publish review by keyboard and touch; maintain focus at 320/390px, 200% zoom and RTL. |
| Free and paid boundaries | Existing Free linear journeys keep working. If paid capability is unavailable, a conditional campaign does not silently run as a linear campaign; its draft remains inspectable and publishing reports the missing capability. |
| Template/design transfer | Import, duplicate and design replacement preserve stable question/choice/submission references or show a concrete repair preview. No orphaned rule publishes. |
| Draft versus live version | Editing a published campaign does not change an already mounted visitor's capture contract mid-session; the saved draft and published behavior are distinguishable. |

## Implementation slices and gates

The recommended representation is one entry screen ID; stable screen, question,
choice, edge and submission IDs; and explicit connections. A non-ending screen
has one default continuation, zero or more prioritized answer connections,
and, where applicable, a separate **when hidden** continuation or optional
**Skip** action. A result/ending is terminal only when no further action is
available; result-first optional signup remains an explicit continuation.
Independent conditional follow-ups are ordinary screens with `showWhen`, not
exclusive outgoing branches. A collapsed group is a visual view of those
screens, not an extra runtime node. The graph is acyclic, and screen array
order and canvas coordinates have no routing meaning. This is an implementation
recommendation to settle in the contract slice, not an already-shipped schema.

React Flow remains a suitable **admin canvas**. Its core supports focusable
nodes/edges and localized accessibility text, so a parallel Screens inventory
can be a deliberate accessible route rather than a concession. Its official
[sub-flow guidance](https://reactflow.dev/learn/layouting/sub-flows) supports
visual groups, but `parentId` affects positioning, not visitor semantics.
The [layout guide](https://reactflow.dev/learn/layouting/layouting) notes a
known Dagre issue with groups whose children connect outside the group; it
lists ELK as supporting edge routing. Therefore keep Dagre for the simple
overview only if measured grouped/branching fixtures stay readable; use an
admin-only ELK chunk if those fixtures show crossings or misrouted edges.
Do not add another diagram library just for styling. The current controlled
`JourneyMap` updates the whole `positions` record for every drag movement;
verify drag continuity and re-render counts with the official
[performance guidance](https://reactflow.dev/learn/advanced-use/performance)
before accepting it at the higher graph limit. Localize canvas instructions
and preserve full non-drag editing, as described in React Flow's
[accessibility guide](https://reactflow.dev/learn/advanced-use/accessibility).

1. **Freeze the behavior contract.** Define that graph shape in `TemplateTree`,
   including explicit default and skip continuations, edge IDs, capture IDs,
   ending semantics, and layout metadata outside visitor behavior. Measure
   representative payloads and loader budget before setting limits. Amend ADR
   0107 and the inline superseded claims in ADR 0106 in the implementation
   commit. Keep Free linear journeys functioning; React Flow/layout remain admin
   only. No table/column is proposed.
2. **Make traversal and capture authoritative.** Implement a trace-producing JS
   evaluator and equivalent PHP path validation. Validate acyclicity, reachability,
   question availability, default routes, required capture/consent, result
   fallback and submission ownership. Use the same semantics in the live loader,
   capture endpoint, answer pruning, result selection and analytics. Add
   scenario fixtures, including combinatorial cases and failure/Back behavior.
3. **Replace the split preview experience.** Make Try answers a quick route
   explanation backed by trace, and Test journey a realistic simulated session
   with the real renderer, contact drafts, immutable accepted snapshots, save
   and provider outcomes, result states, exact skip/branch explanations and
   direct edit links. Neither action writes a Lead or calls a Destination.
4. **Finish the workspace.** Give simple campaigns a calm overview; group
   independent follow-ups; make branch priority and fallback visible; add
   contextual connection/insert actions, screen preview, per-save handoff,
   issue/usage navigation, named undo and stable map layout. Keep Screens as an
   inventory and a complete non-drag editing route. Connect Display rules and
   Destinations to the relevant context without recreating their settings.
5. **Release gate.** Run the scenario matrix in unit, PHP integration and a real
   WordPress browser; verify both Free and paid builds, loader and design byte
   budgets, RTL, keyboard, mobile, 200% zoom, and drag continuity. Run a small
   qualitative merchant study on common tasks against the current manager;
   prioritize confidently wrong predictions about saving or routing over visual
   preferences. Keep PR #190 unmerged until P0 behavior and the common-task UX
   are coherent. Split later polish only if it does not leave an unusable
   interim model.

## Decisions still open

- The precise higher screen/edge/question limits need measured evidence, not an
  arbitrary number. The graph should stay acyclic; “arbitrary branches” need
  not imply loops or unrestricted contact-capture bypass.
- Test the wording for a rule with a missing source on one incoming path with
  occasional merchants. Recommended behavior is false on that path, explained
  by name; only an impossible-on-all-paths reference blocks publication.
