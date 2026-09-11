# WConvert flow-by-flow review — 10 September 2026

Baseline: `59a13b7`. The findings below describe that baseline unless a delivered
slice is identified. The gallery slice is complete under
[ADR 0069](../adr/0069-the-library-helps-merchants-compare-before-applying.md).
Phase 2 adds editor review/publishing, saved-change visibility, in-editor
destination setup and placement guidance under
[ADR 0070](../adr/0070-drafts-are-reviewed-and-explicitly-published-from-the-editor.md).
Its completed verification is recorded below. Phase 3 connects addressable
reports, capture history and delivery recovery under
[ADR 0071](../adr/0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md);
its completed local verification is recorded below, and
[CI passed on 5d57068](https://github.com/navidkashani/wconvert/actions/runs/34492334584).
Phase 4 simplifies creation and display settings under
[ADR 0072](../adr/0072-setup-choices-state-their-effect-and-scope.md), with completed
local and WordPress verification below. Current-head CI is recorded on the PR.
Phase 5 steps 1–2 are implemented under
[ADR 0073](../adr/0073-capture-acknowledgement-is-not-provider-confirmation.md):
truthful capture acknowledgement and clearer existing-field feedback. Completed
checks, WordPress findings and test fixture cleanup are recorded below. These
two steps are complete. The remaining editor, qualification and destination
contract work is implemented under
[ADR 0074](../adr/0074-destinations-declare-requirements-and-show-shared-usage.md),
[ADR 0075](../adr/0075-draft-history-and-template-content-choices-stay-predictable.md)
and [ADR 0076](../adr/0076-an-enquiry-captures-one-optional-choice-before-handoff.md).
The final section distinguishes its verification from the earlier phase records.

## What a successful experience means

WConvert helps a WordPress business attract a visitor, capture useful details,
and send those details to the plugin or service that handles the relationship.
Its main user starts from something ready-made and changes it to fit their site.
Deeper design and targeting controls remain available when needed.

The product should carry one intention through the whole experience:
**choose an offer → customize it → choose its audience and placement → connect
the handoff → publish → check the result → improve it.**

For example, a checklist, a newsletter offer and an enquiry capture have different
next steps; they should not all end with the same generic success message.

The [domain boundaries](../../CONTEXT.md) remain useful:

- A Lead is an immutable submission event, written locally first. Several
  submissions from one address remain several events. Grouping is a view.
- Destinations are optional outbound routes. WConvert owns no Contact lifecycle,
  follow-up inbox, subscription confirmation or enquiry-management workflow.
- A click-through offer can convert without creating a Lead.
- A Template supplies a design; a Playbook supplies starting copy and rules.
  Designs stay Goal-agnostic. A Goal determines the reporting outcome.
- Save draft and Publish remain separate acts and snapshots. They can share a
  screen without becoming the same act.

## 1. Choose a Goal and a starting point

**Merchant question:** “Which of these fits what I want visitors to do?”

**Implemented in Phase 4:** Goal remains first. The second choice shows rendered
Playbooks, called starting points, with compact facts about their actual resolved
setup. **Customize this starting point** says it creates a draft and opens the
editor directly. The former third preview-only step is removed. Longer notes are
optional, and relevant placement/destination work is stated before choosing.
Facts come from the existing Prefill result, not invented tags or a second
interpretation of authored rules before this install resolves them.

The first screen also lacks an obvious answer for a service business collecting
enquiries. Its available labels concern email/SMS lists, offers, carts and lead
magnets. Revisit the intended enquiry outcome before adding enquiry templates;
do not silently make newsletter subscription mean “request a quote.” A broader
countable capture Goal fits the authorized outbound lead-capture direction, but
its copy, useful qualification field and named destination should be handled
together in Phase 5. Phase 4 adds no new Goal or CRM workflow.

**Completed in Phase 5:** **Collect enquiries**, **Request a quote**, and the
**Choice card** design now supply that starting point. Email is required; name
and one service choice are optional. Capturing a request counts a Conversion;
replying, quoting and managing the relationship remain with the receiving service.

**Implemented safeguards:** read failures can be retried at the current choice;
obsolete Goal/Playbook/name responses cannot replace a newer choice. A same-tick
guard prevents duplicate customization actions, and an abandoned prefill cannot
start creation. An uncertain create response tells the merchant to check Optins
before trying again; it does not claim that no draft was saved.

Sources: [creation flow](../../resources/admin/src/goals/GoalScreen.tsx),
[Goal wording](../../src/Goal/Goal.php),
[prefill contract](../../src/Playbook/Prefill.php).

## 2. Browse designs

**Merchant question:** “Can I find a suitable design, inspect it properly, and
choose it without losing my work?”

**Confirmed at baseline:** search matches names only. “Newsletter” finds nothing
despite many email forms. The toolbar renders all declared facet choices, even
those with no matches in the shipped library. Email + Phone means either field,
although a merchant can reasonably read it as both. Image detection counts
image blocks but misses image backgrounds. Cards show only the first screen and
offer immediate application, so success and mobile layouts cannot be compared
before replacing the working design.

**Observed in WordPress before this slice:** “email” returned two of 31 popup
designs despite 24 capturing email. “With a picture” excluded Fieldwork's actual
background image. Keyboard Tab entered a sample preview's shadow host. Decorative
gradients are correctly excluded from the picture filter.

**Implemented gallery scope, subject to final QA:**

- Keep the current display format explicit, with search and relevant filters
  available at every catalogue size. Search uses localized, derived feature terms.
- Offer an optional form/link choice without preselecting from the Goal. Keep
  deeper appearance and availability filters secondary.
- Show facet counts, active filters and a reset action. Distinguish incompatible
  combinations from options the library never contains.
- Make a capture selection mean all requested details: Email + Phone finds a
  form containing both. State that behavior where the choices are made.
- Include background imagery. Keep features derived, without Goal/industry tags.
- Offer a large detail preview with Desktop/Mobile and the actual design screens,
  a collected-field summary, and one **Use this design** action. Returning to
  results should preserve search, filters and the merchant's place.
- Label sample content. Preserve the accepted draft/Undo behavior and warning
  that carried content may move, disappear or leave empty slots. The user's
  “keep mine versus use sample content” choice was deferred in Phase 1 and is now
  implemented under ADR 0075. The detail preview prepares and displays the exact
  content that Apply will use.
- Make preview examples inert to keyboard as well as pointer interaction.
  A failed thumbnail fetch must have a visible retry, not an endless skeleton.

Validate empty results, unavailable designs, small screens, RTL and keyboard-only
comparison against the real catalogue, not just a few selected example cards.
Prioritizing clear, relevant filters follows [NN/G's filter guidance](https://www.nngroup.com/articles/filter-categories-values/);
the specific arrangement is a reasoned design decision, not a WConvert user-study result. Dialog
focus, Escape and focus restoration follow the [W3C modal pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Sources: [picker](../../resources/admin/src/builder/TemplatePicker.tsx),
[facet matching](../../resources/admin/src/builder/facets.ts),
[derived features](../../src/Template/TemplateFacets.php),
[cards](../../resources/admin/src/builder/TemplateCard.tsx),
[snapshot boundary](../../src/Template/TemplateLibrary.php).

## 3. Edit the design and content

**Merchant question:** “How do I change this part, and what will that affect?”

Keep the large canvas, contextual inspector and optional Layers introduced by
[ADR 0067](../adr/0067-the-editor-starts-with-the-preview-and-the-selected-element.md).
Phase 4 makes the existing scope more explicit; deeper appearance-control work
should continue to preserve inherited values and mobile overrides.

**Implemented:** Phase 3 added addressable editor routes and dirty/busy navigation
protection. Phase 4 labels header actions **Undo design change** and **Redo design
change**, matching history's design-and-template-id scope. Name, rules,
destinations and Goal remain outside that history. Goal correction explicitly
says that it saves the current name and complete draft without publishing it.
Mobile editing keeps a reminder that text and blocks are shared across sizes,
including before an element is selected.

**Completed in Phase 5, superseding the Phase 4 scope above:** header actions
are **Undo draft edit** and **Redo draft edit**, covering the name and complete
working configuration. Ordinary Save retains this history; immediate Goal
correction explicitly starts a new history. Publication and shared destination
settings remain separate writes. Appearance controls support amount/unit entry
and exact custom CSS values while preserving inheritance and mobile overrides.
Neither change introduces server-side history or a new document version.

Sources: [editor state and save](../../resources/admin/src/builder/OptinBuilder.tsx),
[routing](../../resources/admin/src/App.tsx),
[Goal confirmation](../../resources/admin/src/builder/ChangeGoalDialog.tsx).

## 4. Choose display rules

**Merchant question:** “Where will this appear, to whom, and when does it stop?”

**Implemented in Phase 4:** the sections are **Pages**, **Audience**, **When it
appears**, and **Schedule & frequency**. Schedule and repeat visits have distinct
headings; overlay priority is advanced and absent for inline designs. The view
changes while the flat rule engine and its AND/OR semantics remain. Form/link
completion wording follows the design's act, and repeat limits describe one
browser rather than a person or daily quota.

Dates name the actual site timezone. Schedule labels keep the authored time even
across an admin-browser DST gap; ended-status guidance uses the explicit site
zone and stays conservative at ambiguous boundaries. The actual saved site-wide
limits are read beside per-Optin settings, with failure/retry distinct from no
limits. An Optin cannot override the site veto.

Rule starting points compare current and proposed settings before confirmation.
They replace only supplied sections and preserve campaign dates and priority,
including when repeat frequency changes. Applying is draft work, without Save or
Publish. Page/term lookup now separates failed searches, no matches and unavailable
saved names; the stored identifier survives those states. Pending or stale
results cannot silently change the selected rule.

Sources: [rule sections](../../resources/admin/src/builder/rules/DisplayRules.tsx),
[frequency and dates](../../resources/admin/src/builder/rules/HowOften.tsx),
[summaries](../../resources/admin/src/builder/rules/sentence.ts),
[page search](../../resources/admin/src/builder/rules/ObjectPicker.tsx).

## 5. Connect this Optin to a destination

**Merchant question:** “Where will these details go, and is that route suitable?”

**Confirmed at baseline:** the editor provides route checkboxes but no Add/configure action
or return path. Its original response stays loaded after configuration elsewhere.
Hints describe the Playbook's intended fields, not necessarily the edited form.
Deleted bindings become plain warnings in Summary and cannot be found among the
checkboxes. Missing target configuration and required field compatibility are
not fully represented in readiness.

**Recommendation:** offer **Add a destination**, preserve the draft, return to
this Optin, and offer the new route without selecting it silently. Say **Saved
in WConvert only** when none is chosen. Show provider, target and the details a
route accepts. Turn warnings into direct actions: choose another route, complete
settings, remove a missing binding or view delivery health.

One compatibility contract should drive editor and adapter checks. A phone-only
form cannot supply MailPoet an email address; local-only capture remains valid.

**Delivered and checked in Phase 2:** Add/provider selection
and shared destination Settings open inside the editor. The same settings
controls are reused; creation updates the route list without selecting it.
Rows show provider and target. Refresh/retry stays in the draft, and missing
references can be removed explicitly. Editing a route explains that its settings
apply immediately to every Optin using it, including published versions.

**Completed in Phase 5:** adapters now declare required capture alternatives,
required saved settings and forwarded fields through one contract. The gap
identified in the original review was: MailPoet requires email and a list, lead-magnet email
requires email and a file link, while WP SMS accepts email or phone and has
optional tags. An empty generic target must not be treated as universally
broken. Setup and Review now expose these declared requirements alongside
availability, missing bindings and recorded health. Shared settings list the
saved/live Optins affected by a change. Interest mapping names its limitations;
publishing still does not test delivery.

Sources: [destination selection](../../resources/admin/src/builder/DestinationsEditor.tsx),
[summary wording](../../resources/admin/src/builder/destinations.ts),
[readiness actions](../../resources/admin/src/builder/ReadinessDialog.tsx).

## 6. Publish, update and place it on the site

**Merchant question:** “Is this saved, is it live, and what must I do next?”

**Confirmed at baseline, highest priority:** Save draft does not update the live snapshot.
The editor sends the merchant to Optins to publish, but a published row offers
only Unpublish, with no Publish changes action. The existing publish endpoint can
promote a new snapshot directly. No new storage is needed for that action.

Readiness also skips design checks when there is no template. A blank draft can
therefore be created and published. “Guide download” promises a resource by email,
but prefill binds no destination and no binding raises no readiness problem.
Publishing an inline design has no placement handoff, although a block and
shortcode exist. The earlier Playbook instruction is easy to lose.

**Recommendation:** add **Publish changes** immediately, then introduce an editor
**Review & publish** flow with distinct Save draft and Publish actions. Show
the draft's content, placement, schedule and handoff; separate missing essentials
from optional recommendations. Let incomplete drafts save, but refuse a launch
with no design. Do not claim readiness checks prove provider delivery.

After publishing, inline designs need **Place this on a page**, block instructions
and a copyable shortcode. Overlays need **Check on your site** with a relevant
page and the existing eligibility inspector. Show draft-versus-live differences
and use Scheduled/Ended as explanatory state without changing loader behavior.

**Delivered and checked in Phase 2:** the editor's **Review &
publish** flow separates Save draft from promotion, saves unsaved edits before
publishing, and retains failures for retry. Both editor and list expose saved
changes awaiting publication. The flag compares the existing draft and published
configuration; it adds no storage. An absent design is now refused at promotion.
Review offers actions into design, rules and destinations, and distinguishes
essential design checks from warnings. Inline placement includes the existing
block and shortcode; published site checks explicitly use the current signed-in
session and published version. They do not promise anonymous-visitor visibility.

Phase 3 adds addressable editor URLs and preserves the originating report or
capture filters. Dirty/busy navigation is guarded, including when an open editor
is narrowed below its working width. Phase 4 clarifies schedule timezone and
ended-status labels. A visual draft/live comparison, richer provider checks and
Goal-specific promised-outcome checks remain follow-ups.

Sources: [list actions](../../resources/admin/src/optins/OptinList.tsx),
[snapshot publishing](../../src/Optin/OptinRepository.php),
[write validation](../../src/Rest/OptinController.php),
[inline block](../../src/Frontend/InlineOptinBlock.php),
[inline shortcode](../../src/Frontend/InlineOptinShortcode.php).

## 7. Manage Optins and understand results

**Optins asks:** “What is running, what needs attention, and which one do I edit?”
Keep search, status filters and intact A/B families. Phase 2 adds saved changes
awaiting publication and **Publish changes**. **Delivered in Phase 3:** row actions
open individual results and captured leads; the links retain the report's actual
period. Published still must not imply that an ended, scheduled or unplaced
design is being shown now.

**Analytics asks:** “Did this offer work, and what should I inspect next?”
**Delivered in Phase 3:** Optin names open focused results, with routes to the
editor and matching captures. The focused page uses that Optin's numbers and
series, not Goal totals. Editor return links preserve the accepted period; capture
links use the payload's actual start/end dates even if a requested refresh fails.
The UI distinguishes requested and displayed periods, supports bookmarked custom
periods, and explains missing impressions and unavailable individual results.
The delivery gap is explicitly a same-period difference of event totals, not
particular Leads awaiting delivery. An expandable explanation covers deleted
Optins, changed Goals and retention's independence from historical counters.

Equal-length previous-period comparison remains a proposal using existing daily
counters. Do not average unlike Goal rates or call every conversion a Lead.

**Leads asks:** “Can I find a capture and see exactly what was submitted?”
**Delivered in Phase 3:** exact canonical email/phone or Lead-ID search combines
with Optin and inclusive site-date filters. Older/Newer pages use a ULID upper
capture bound and cursor; refresh starts a new view. Group drilldown retains the
email-first partition and filters, with its own event paging and export. Counts
remain submissions. CSV explicitly covers all retained matching events across
pages under the applied filters and snapshot. Failed reads preserve the previous
table and its export scope. Retention or privacy deletion can still remove rows
after the view loads; the snapshot is not a stored copy. Contact status, follow-up
workflow and editable Lead records remain out of scope.

Sources: [Optins](../../resources/admin/src/optins/OptinList.tsx),
[Analytics](../../resources/admin/src/stats/Dashboard.tsx),
[Leads](../../resources/admin/src/leads/LeadLog.tsx),
[Lead API](../../src/Rest/LeadController.php).

## 8. Manage delivery, recovery and occasional settings

**Destinations asks:** “Where does this route go, what uses it, and how do I fix it?”
**Delivered in Phase 3:** skipped-capture recovery sits beside its explanation,
with the published-binding and last-success scope stated explicitly. It can
replay already successful sends and is not restricted to the skipped count.
Terminal failures name the Destination and link to that route and the exact
capture; removed references have explicit missing states. The ring remains
bounded diagnostics, not a complete per-Lead delivery ledger. Showing Optin
usage before shared settings are changed remains a useful follow-up.

**Testing asks:** “Who receives this test, and what does it prove?”
**Delivered in Phase 3:** Send a test opens a form showing the saved named route,
recipient and likely external effect. The WordPress profile email is a visible
`test_sample` suggestion; the endpoint requires the chosen email explicitly and
never silently substitutes it. The sample includes no invented name or phone.
Unsaved destination settings are called out because the test uses saved settings.
Connection check, sample push, local form preview and real visitor capture remain
different operations. A successful handoff does not establish subscription
confirmation or actual inbox receipt. A test push creates no Lead, queued job,
health event or report counter.

**Retention asks:** “Exactly what will be deleted, and when?”
**Delivered in Phase 3:** both choices are local drafts until Save retention.
Automatic deletion starts with an empty period and confirms the actual validated
days before a write, including changes to an existing period. Typing, Enter in
the field and blur do not save; there is no intermediate suggested-90-day write.
Failures retain the draft and accurate saved disclosure. Confirmation Cancel
keeps the draft; Cancel changes restores the stored policy and focus. The
existing daily prune and site-wide default remain unchanged, as do site-wide
frequency settings.

Sources: [destination management](../../resources/admin/src/destinations/Destinations.tsx),
[test endpoint](../../src/Rest/DestinationController.php),
[retention](../../resources/admin/src/leads/LeadRetention.tsx),
[site limits](../../resources/admin/src/optins/SiteAllowance.tsx).

## 9. Improve fields and the internal format through real use

Start with email, phone and name: labels, autofill, required state, phone entry,
errors that preserve input, and clear destination support. Then take one bounded
qualification field through the entire path. For example, “Interested in:
installation / repair” is useful only if the receiving workflow gets the value.
A short message is another candidate; neither implies an inbox inside WConvert.

Preserve stable field meaning separately from editable labels and appearance.
Extend the existing manifest's constraints and control metadata; derive authoring
diagnostics or JSON Schema from it instead of maintaining a second schema. Better
spacing controls do not automatically require a new JSON version.
Keep filtering metadata in the server's derived index; never fetch every design
tree just to determine which filters apply.

Today [CaptureForm](../../src/Lead/CaptureForm.php) validates the published form
and requires an email or phone identifier; [CanonicalFields](../../src/Destination/CanonicalFields.php)
forwards only email, phone and name. A new input is incomplete until renderer,
server validation, log/export, test push and supported adapters agree on it.
Use the existing fields JSON where appropriate; propose any table/column change
separately for explicit sign-off. Keep authoring metadata out of visitor payloads.

## Implementation sequence and decision record

1. **Choose confidently:** complete the gallery slice and test representative
   search/filter/detail-preview journeys in WordPress. Retain draft/Undo safety.
2. **Finish and update confidently:** Phase 2 delivers Publish changes,
   actionable review, in-editor destination setup and inline placement.
   Phase 3 adds addressable editor routes; provider compatibility metadata remains
   separate work.
3. **Understand and recover:** Phase 3 connects reports, captures and route
   failures, exposes skipped-delivery recovery, and makes test recipients and
   retention explicit. Verification is recorded separately below.
4. **Refine the setup language:** Phase 4 simplifies creation, regroups display
   rules and clarifies undo/mobile/save scope. The enquiry Goal and field are
   carried into Phase 5 with the real outbound handoff.
5. **Extend a proven handoff:** verify one deliberate capture and named provider
   result, then add one useful qualification field through the same path.

The gallery decision is recorded in [0069](../adr/0069-the-library-helps-merchants-compare-before-applying.md),
with [0043](../adr/0043-the-library-is-indexed-and-its-facets-are-derived.md) and
[0059](../adr/0059-the-converting-act-belongs-to-the-design.md) amended inline.
Phase 2 is recorded in [0070](../adr/0070-drafts-are-reviewed-and-explicitly-published-from-the-editor.md),
with publishing in [0067](../adr/0067-the-editor-starts-with-the-preview-and-the-selected-element.md)
and the narrow editor action-placement exception in
[0039](../adr/0039-a-screen-is-regions-and-scope-decides-placement.md) amended inline.
Phase 3 is recorded in
[0071](../adr/0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md),
with reading/navigation [0068](../adr/0068-reading-pages-put-results-and-routes-before-occasional-settings.md),
editor routing [0070](../adr/0070-drafts-are-reviewed-and-explicitly-published-from-the-editor.md),
capture reads [0033](../adr/0033-the-lead-log-reads-without-a-new-index.md),
retention [0018](../adr/0018-erasure-deletes-rather-than-anonymises.md),
recovery [0008](../adr/0008-delivery-state-is-destination-health-not-per-lead.md)
and report interpretation [0020](../adr/0020-conversions-are-interpreted-at-read.md)
amended inline.

Phase 4 is recorded in
[0072](../adr/0072-setup-choices-state-their-effect-and-scope.md), with the
superseded creation, history-scope, frequency and schedule statements amended at
their original decisions. The closed Goal/rule/storage models remain unchanged.
Future implementation must amend affected decisions inline: creation/action
scope [0039](../adr/0039-a-screen-is-regions-and-scope-decides-placement.md);
actionable guidance [0042](../adr/0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md);
editor history/publishing [0067](../adr/0067-the-editor-starts-with-the-preview-and-the-selected-element.md);
reading/recovery placement [0068](../adr/0068-reading-pages-put-results-and-routes-before-occasional-settings.md).
Revisit [0050](../adr/0050-a-scheduled-optin-stays-in-the-published-set.md) before exposing
schedule state on the list. Field evolution must also update the relevant
capture, template and destination contracts. Those remaining recommendations
are not decisions silently adopted by this review.

## Completed gallery slice and verification

Implemented the Browse designs changes described above. The library identifies
its current format, searches names and real features, keeps relevant filters
available, and moves layouts into More filters. Cards describe their fields or
link action. A detail view inspects sample content, desktop/mobile layouts and
actual screens before Apply. Background pictures, explicit preview retry,
bounded tree requests, inert sample controls and focus restoration are included.
Other page and handoff recommendations were outside this gallery slice; the
following Phase 2 record identifies the subset subsequently delivered.

Verified in the local WordPress admin at its normal 1512px viewport and at
1024px and 782px. Search for email returned 24 popup designs instead of two;
Email + Phone returned the single design containing both. Picture filtering
included Fieldwork. Back retained the visible query, filters and card focus;
Tab skipped sample form controls. Mobile/success inspection did not change the
draft. Apply returned focus to Change template, and Undo restored the original
draft with Save disabled. The temporary application was not saved. The narrow
detail layout was corrected after a browser check found preview/facts overlap.
The viewport override was reset afterwards.

Validation: 1,934 frontend tests, TypeScript, ESLint and Free/Pro admin builds
passed. The facet/library PHP slice passed 271 tests and focused PHPStan.
Regression coverage includes omitted/failed tree responses, the 24-tree cap,
localized feature search, field intersections, native-width preview fitting,
percentage-width layouts, compatibility refusals and successful/failed Apply.
The gallery slice made no publication, retention, route-setting or provider-send
changes.

## Phase 2 delivered slice and verification

Phase 2 implements explicit editor review and publishing, list **Publish changes**,
saved configuration differences derived from existing snapshots, a no-design
promotion guard, in-editor shared destination setup, refresh/retry and missing
binding cleanup, and inline placement guidance. It retains local capture as the
first write and leaves provider delivery and Contact management outside the
editor.

The destination component and existing destination page passed 54 focused tests:
17 cover the editor and 37 cover the existing page. They exercise real schema
controls with mocked route saves, explicit selection after creation, shared
settings scope, retained input on error, close focus, refresh and missing-account
guidance. These checks send no provider data.

Final validation: **1,994 frontend tests** and **1,757 PHP tests / 7,665 assertions**
pass. TypeScript, ESLint, focused PHPStan and Free/Pro admin builds pass. Publishing
regressions cover refused saves, failed promotion and retry, keeping draft/live
snapshots separate, suspended responses, and design-less promotion refusal.
Dialog tests cover actionable warnings, local-only capture, focus, publication
busy state, and preventing editor Undo from operating behind a modal.

Verified in real local WordPress at 1512px, 1024px and the 782px editor floor.
At 782 × 600 the review body scrolls while its final action remains visible;
there is no horizontal page overflow. Reviewed Add/provider settings, cancelled
without saving, then checked an existing shared destination's settings notice
and cancelled. Existing destination bindings and settings were not changed.

A dedicated temporary **inline** Optin, unplaced and bound to no destinations,
exercised Create → Save & publish → change display limit → Save draft → return
to list → Publish changes → reopen Review. The actual database/read API changed
from current to saved-but-unpublished and back to current. Publication offered
the real block/shortcode instructions. The fixture was then unpublished and
deleted; the original six visible Optins and their publication states remained.
No test capture, provider send, re-push or page placement was performed. Browser
viewport overrides were reset after the responsive checks.

Provider-owned required capture/settings metadata is still deferred. This phase
cannot prove that a form's fields meet every adapter's requirements, that an
audience or file is correctly configured, or that a successful promotion produces
a delivered message. The next handoff slice should establish that metadata and
then verify one deliberate capture against a named provider and recipient before
extending the capture-field format.

## Phase 3 delivered implementation

Phase 3 connects Optin results, focused reports, exact capture history, editor
return routes and named Destination/failure links. Hash navigation preserves a
dirty or busy editor until navigation is accepted; an already-open draft also
survives a narrow viewport. Report links retain accepted periods, and capture
history adds exact search, inclusive dates, cursor pages, email-first group
drilldown and all-matches export under a shared upper capture bound.

Retention now requires explicit Save and exact-period deletion confirmation.
Skipped recovery states the existing broad replay scope. Test sends require a
reviewed email sample and saved route, without an implicit profile fallback.
The report's aggregate delivery gap no longer claims to count pending Leads.
These changes add no schema, index, delivery ledger, Contact status or new
capture origin.

### Verification

Local verification is complete: the frontend suite passes **2,081 tests across
85 files**, and PHP passes **1,782 tests / 7,752 assertions**. Full PHPStan,
TypeScript, ESLint and Free/Pro admin builds pass. PR CI is checked separately
against the pushed commit; its result is not inferred from local checks.

Real local WordPress checks followed report → focused Optin → captured leads
with the correct start/end dates. The Optins row's **View results** action also
opened that Optin's matching report. The retention flow displayed a 45-day deletion
confirmation, then Cancel and Cancel changes restored the saved keep-forever
policy without writing it. A MailPoet test dialog showed the profile email as a
visible suggestion and was cancelled without sending. An incomplete search for
`alex` returned an actionable complete-identifier error.

Navigation checks edited the Optin name locally, used Back → Keep editing,
narrowed to 641px, and widened again with the name intact. Back → Discard then
returned to the original focused Analytics route. The narrow notice's Back
action also requested discard before leaving. The 360px reading pages showed no
horizontal overflow. These checks persisted no draft, capture, test-send,
retention or recovery changes.
The original six Optins remained unchanged: one published and five drafts, with
the published Optin’s saved unpublished changes preserved. Temporary viewport
overrides were reset after verification.

The isolated populated fixture exercised 140 submissions; an exact email search
matched 65 and its Older page showed the remaining 15. Group history had its own
Older navigation. A failed report-period request retained the accepted numbers,
dates and links, and retry updated them. A terminal-failure capture link resolved
one exact submission. The fixture also showed no horizontal overflow at 360px.
Fixture data is not evidence of a real capture, provider push or inbox delivery.

## Phase 4 delivered implementation

Creation now leads from Goal to starting point to the editor, using an explicit
draft-creation action. Compact facts describe the same effective setup Prefill
will supply. Async guards, in-place retry and uncertain-create guidance preserve
the current choice without silently repeating a write.

Display rules use Pages, Audience, When it appears, and Schedule & frequency.
Section labels sit above their full-width summaries so longer settings remain
readable without squeezing the explanation into a narrow column.
Repeat visits use act-aware language, dates name the site zone, saved site-wide
limits are visible, and priority is advanced. A replacement review compares the
rule sections before applying, with campaign dates and priority preserved. Name
lookup failures and stale search results do not change a saved page/term rule.

The editor names design-only Undo, keeps mobile shared-content guidance visible,
and discloses the whole-draft save when changing Goal. Schedule labels preserve
authored components and use the site zone for ended-status guidance. No new Goal,
field type, rule semantics, schema, index or delivery state is introduced.

### Verification

Final local verification passes **2,154 frontend tests across 88 files** and
**1,788 PHP tests / 7,791 assertions**. TypeScript, ESLint, full PHPStan and
Free/Pro admin builds pass. PR CI remains a separate check against the pushed
commit. Creation tests also cover the browser-leave warning while prefill or
creation is pending, and its removal after success, failure or unmount.

Real WordPress creation selected **Welcome discount** and opened the editor
directly from the second choice. It created one disposable draft,
`01M25YQ1JN0BPBAABV1T9R7FXF`, renamed **Phase 4 QA — disposable**. Keyboard entry
of an end before the start showed the inline schedule error; correcting it cleared
the invalid window. The valid October 10–November 9, 2099 dates, impression limit
of 3, and priority of 7 survived applying a timer starting point, Save draft and
reload. The replacement review showed current/proposed settings; Cancel restored
focus, and applying changed the timer while retaining the other settings.

The page picker found **Sample Page** (`#2`), and the selection survived Save
and reload. A no-match search followed by Escape kept that saved identifier.
The picker fit at 1024px. Creation cards had no horizontal overflow at 390px,
and opening the editor at that width displayed its explicit wider-screen notice.
The editor showed the actual site timezone, **+00:00**, and the saved state of
**no site-wide limits**. The live review also prompted the stacked section-label
and full-width-summary layout.

Only the disposable draft was created and saved for these checks. Global settings
and destinations were not changed; nothing was published, captured or sent to a
provider. The disposable draft was deleted through the Optins list. The original
six visible Optins retain their names and publication states: one published, five
drafts, with the existing published Optin’s saved unpublished changes preserved.
The final page replacement review distinguished **A specific page or post: #2**
from **Any single item of a type: Post**, followed by cancellation. Mobile
appearance guidance was visible without selecting an element; Goal correction
stated its whole-draft save and was closed without saving. No browser console
errors were recorded. Temporary viewport overrides were reset, and the existing
Editor UX check draft was left open on Display rules without changes.

## Phase 5 steps 1–2 implementation and verification

Success copy in **39 templates and 9 Playbooks** now acknowledges the visitor's request,
without claiming provider subscription, confirmation or delivery. Offer setup
notes and the success-text inspector explain that boundary. Library examples
and new drafts receive the revised wording; saved merchant copy and published
snapshots are not bulk rewritten.

The existing email, phone and name fields gain clearer inspector labels,
fallback field names, required markers and input guidance. Fallback names use
the renderer's existing English chrome; authored labels retain their wording
and can be translated. Field-only rows keep
visible labels, and compact field-and-button labels return on narrow
containers. Native and server validation messages appear with the relevant
field, preserving values. Pending submission locks the submitted values and
shows busy state; a bounded request restores controls on refusal or an unknown
result. Malformed successful responses must not advance to the success screen.
No new field type, JSON schema, storage or provider-status synchronisation is
part of this slice.

### Completed checks and browser findings

The PHP suite passes **1,788 tests / 7,796 assertions**, and PHPStan is clean.
All admin, block, loader and inspector builds pass. All **55 templates** pass
library verification, and the source check passes. The loader budget check
passes for every tier: Free 10,267, Basic 11,064, Pro 12,021 and Elite 12,205
bytes gzipped, below the 12,288-byte limit.

The final focused frontend run passes **53 tests**, including a regression
reproduced before its fix for Chrome's native invalid-event ordering and focus
on the first invalid field. The final full frontend run passes **2,167 tests
across 88 files**. Final TypeScript and ESLint checks also pass. Pending controls,
timeout recovery and malformed-response
handling were checked in automated tests, not by simulating those failures in
the live browser.

Real WordPress checks in Chrome used page `22` and the dedicated Optin
`01M27CV94KQ81TMCJFMBN9WAMZ`, targeted only at that page and bound to no
Destinations. A blank submit focused **Your name**, the first invalid field,
and displayed its native validation message inline. An invalid email and a
server refusal of the phone number preserved all entered values and checked
consent. One corrected local submission advanced to copy acknowledging receipt
of the request. No Destination send or provider delivery was involved.
An independent blank-submit check against the final built assets confirmed
that **Your name** remained focused with its inline required message visible.

At **390 × 844**, labels and required markers remained visible, fields stacked,
and there was no horizontal overflow. Existing saved merchant copy was
intentionally not bulk rewritten.

### Cleanup and remaining scope

Before cleanup, Lead `01M27D2JDR15E9N6YN9BC30DVR` was checked for **Sam Test**,
`wconvert-fields-20260911@example.test`, canonical phone `+447700900000`, and
the exact submitted consent text. That Lead and page `22` were removed. The
disposable Optin was soft-deleted at `2026-09-11 05:06:05`. In accordance with
the existing statistics contract, its historical counters remain: **4
impressions and 1 conversion** on `2026-09-11`.

Full-row hashes for the original Optins, including previously deleted rows,
match the baseline. The Destination option hash also matches. The final state
has **6 visible Optins: 1 published and 5 drafts**, **0 Leads**, and **0
`wconvert_push_lead` actions**. This run changed no Destination, provider or
email configuration and sent no email.

**Phase 5 steps 1–2 are complete.** This historical subsection records only
that slice. The qualification, internal-format and editor remainder is recorded
below; the separate lead-journey report labels its later run independently.


## Phase 5 remainder — editor, qualification and destination contracts

The final slice completes the outstanding work from this review:

- **Browse designs:** Keep my content and Use this design’s sample content
  prepare the actual normalized candidate before Apply. Desktop/mobile and all
  design screens show that candidate. Failed preparation stays open with Retry;
  Undo restores the previous draft.
- **Draft editing:** name, design, rules and destination bindings share local
  Undo/Redo. Save keeps that history; explicit Goal correction explains its
  reset. Measurement inputs accept an amount/unit or custom CSS. Pending text
  applies on Enter or leaving the control and cancels with Escape.
- **Destination setup:** provider-owned requirements drive adapter checks and
  admin guidance. Shared settings show which saved/live Optins use the route.
  MailPoet optionally maps interest to a real custom text field when creating a
  new subscriber; existing subscriber fields and status stay unchanged.
- **Enquiries:** Collect enquiries, Request a quote and Choice card ask for a
  reply email with optional name and service. There is one closed qualification
  key, `interest`, with at most 12 labelled choices. This introduces no message
  inbox, CRM lifecycle, arbitrary custom-field builder or new database schema.
- **Format and capture:** the existing v1 document carries `{value,label}` choices.
  The visitor submits the stable value; the server validates it against the
  published options and stores that value with the published display label.
  Capture history and CSV retain both; supported forwarding sends the stable
  value. Structured Slot Role copy keeps the list under an `options` wrapper.
- **Incomplete edits:** malformed nonempty choice lists are refused before Save
  can discard rows. An empty list can remain an unfinished draft, but publication
  requires useful choices and an email or phone field on the submitting screen.
  Keyboard focus follows moved/removed choices and malformed imported rows cannot
  crash the renderer.
- **Visitor layout:** the modal dialog uses the design width and centers its
  actual content. Its inner form fills that width, preventing percentages from
  resolving twice. Mobile gutters and internal scrolling keep long forms usable.

### Automated verification

The final complete frontend suite passes **2,239 tests across 92 files**; the
PHP suite passes **1,839 tests / 8,205 assertions**. Full TypeScript, ESLint and
PHPStan pass. All **56 templates** validate, the source contract passes, and
all admin, block, loader and inspector builds succeed.

The loader contract passes on **Node 22.23.2**, matching CI's Node 22 runtime:
Free **10,395 B**, Basic **11,130 B**, Pro **12,094 B** and Elite **12,280 B**
gzipped, within the unchanged **12,288 B** ceiling. Shared pending/rejection
handling, redundant beacon guards and equivalent JSON serialization were
simplified; the fallback remains explicit about an unconfirmed submission.
Native invalid-field traversal remains explicit, with regressions for barred
controls and event ordering. No feature or accessibility behavior was removed
and the size limit was not increased.


### Real WordPress journey and cleanup

The new enquiry starting point was created through WordPress, customized,
saved and published using one disposable Optin. Draft Undo/Redo restored its
name, display rule and destination binding. Both content-choice previews were
checked on desktop/mobile and Form/Success screens. Custom CSS applied both on
Enter and when clicking Save from an active control; the temporary override was
removed before publication.

One visitor submitted **Repair** with a synthetic email and name. The server
stored `interest=repair` and the published `interest_label=Repair`; the visible
Lead detail and production CSV matched. The normal background job completed in
one attempt, creating the intended MailPoet list membership and custom-field
value. Its confirmation email reached local Mailpit. No confirmation link was
followed and no external inbox delivery is claimed.

The destination page showed successful delivery and named the test Optin as
**Live and saved draft**. Percentage-width and tall popup fixtures passed
desktop/mobile geometry checks, internal scrolling, Close, Escape and backdrop
dismissal. The visitor page's normal close flushed its one conversion beacon.

Guarded cleanup removed the exact test Lead, subscriber, action/logs, page,
destination/health entry, list, custom field and Mailpit message. Original Optin,
destination and provider row hashes matched the baseline. The site has six
visible Optins, two original destinations, zero Leads and zero forwarding
actions; Mailpit retains its one original message. The disposable Optin is
soft-deleted and retains five impressions and one conversion as required.

Exact identifiers, times and evidence are in the separately labelled enquiry run
in [the lead-journey QA report](2026-09-11-lead-journey-qa.md).


### Final creation layout

When a Goal has one starting point, it now gets a larger preview beside the
setup and action on wide containers. The existing comparison layout remains
for multiple starting points. A real WordPress check at **1512 × 862** showed
the complete enquiry form and primary action together; at **390 × 844** the
preview, facts and action stacked cleanly. Document scroll width was exactly
390 pixels and the action remained readable. This inspection created no draft
or other record; viewport overrides were reset and the dedicated tab closed.


The final isolated browser validation check used the actual renderer and capture
handler with a null endpoint, so it could create no Lead or email. Blank submit
focused Email address with its inline browser message. After entering only a
valid synthetic email, submit focused the required interest select and kept the
email. Choosing Repair cleared the inline error. The fixture tab closed and
the viewport reset; no extra visitor submission or WordPress record was created.
