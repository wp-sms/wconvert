# WConvert flow-by-flow review — 10 September 2026

Baseline: `59a13b7`. Status: source-confirmed findings and product proposals.
The gallery slice below is implemented, subject to final integration and browser
QA, with its decision recorded in [ADR 0069](../adr/0069-the-library-helps-merchants-compare-before-applying.md).
Other changes remain proposed. This review supersedes no ADR and claims no tested
delivery; final verification belongs in the change record.

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

**Confirmed:** the creation flow asks for a Goal, shows Playbook previews, then
repeats the selected preview on a third step before opening the editor. That
third step edits nothing, including the name. “Step 3 of 3” describes draft
creation, although setup and publishing still remain. “Ready-to-run” also hides
work only the merchant can complete: a destination, a download or page placement.

**Recommendation:** keep Goal first, shorten each starting-point description to
the offer, placement and timing, and use **Customize this starting point** with
**Creates a draft** beside it. Make the second large preview optional. A direct
handoff to the editor is more useful than a compulsory confirmation of the same
picture. Show setup facts from the existing Playbook data, not invented tags.

The first screen also lacks an obvious answer for a service business collecting
enquiries. Its available labels concern email/SMS lists, offers, carts and lead
magnets. Revisit the intended enquiry outcome before adding enquiry templates;
do not silently make newsletter subscription mean “request a quote.” A broader
countable capture Goal is a product decision, not a reason to build a CRM.

**Correctness follow-up:** late Goal/Playbook responses can reopen an abandoned
choice. Add stale-response guards and retry failed reads on the current step.

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
  deferred “keep mine versus use sample content” choice remains deferred.
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
The next improvement is clearer scope: inherited values, mobile overrides,
selected element versus whole design, and content shared between sizes.

**Confirmed:** header Undo/Redo covers the design and template id, not rules or
destination selection. Changing Goal immediately calls the full draft save even
though its confirmation explains only the reporting change. Editor identity is
held in React state, so a bookmark or reload cannot reliably reopen that Optin.

**Recommendation:** add addressable editor routes with unsaved-change protection.
Prefer draft-wide Undo; until then name its design scope. Explain Goal correction's
save effect or isolate the write. Improve appearance controls by value kind;
preserve token semantics and test nested mobile inheritance.

Sources: [editor state and save](../../resources/admin/src/builder/OptinBuilder.tsx),
[routing](../../resources/admin/src/App.tsx),
[Goal confirmation](../../resources/admin/src/builder/ChangeGoalDialog.tsx).

## 4. Choose display rules

**Merchant question:** “Where will this appear, to whom, and when does it stop?”

**Confirmed:** the summaries are a useful overview, but “When” holds triggers
while start/end dates sit under “How often,” beside per-visitor limits and
overlay priority. Completion copy says “sign up” even for click-through designs.
The per-Optin view does not explain active site-wide limits. Page/term search
turns a failed request into an empty result list.

**Recommendation:** present Pages, Audience, Trigger and Schedule & frequency as
clear decisions; place priority under an advanced disclosure. This changes the
view, not the flat rule engine or its AND/OR semantics. Use completion wording
from the design's converting act. Show the site's actual timezone beside dates
and relevant global limits beside the per-Optin settings. Distinguish a failed
page search from “no matching pages.”

Starting points should show the settings they replace. Keep confirmation until
draft-wide Undo makes trying a rule bundle reversible.

Sources: [rule sections](../../resources/admin/src/builder/rules/DisplayRules.tsx),
[frequency and dates](../../resources/admin/src/builder/rules/HowOften.tsx),
[summaries](../../resources/admin/src/builder/rules/sentence.ts),
[page search](../../resources/admin/src/builder/rules/ObjectPicker.tsx).

## 5. Connect this Optin to a destination

**Merchant question:** “Where will these details go, and is that route suitable?”

**Confirmed:** the editor provides route checkboxes but no Add/configure action
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

Sources: [destination selection](../../resources/admin/src/builder/DestinationsEditor.tsx),
[summary wording](../../resources/admin/src/builder/destinations.ts),
[readiness actions](../../resources/admin/src/builder/ReadinessDialog.tsx).

## 6. Publish, update and place it on the site

**Merchant question:** “Is this saved, is it live, and what must I do next?”

**Confirmed, highest priority:** Save draft does not update the live snapshot.
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

Sources: [list actions](../../resources/admin/src/optins/OptinList.tsx),
[snapshot publishing](../../src/Optin/OptinRepository.php),
[write validation](../../src/Rest/OptinController.php),
[inline block](../../src/Frontend/InlineOptinBlock.php),
[inline shortcode](../../src/Frontend/InlineOptinShortcode.php).

## 7. Manage Optins and understand results

**Optins asks:** “What is running, what needs attention, and which one do I edit?”
Keep search, status filters and intact A/B families. Add saved changes awaiting
publication and direct paths to results and captures. Published must not imply
that an ended, scheduled or unplaced design is being shown now.

**Analytics asks:** “Did this offer work, and what should I inspect next?”
Optin names in breakdowns are still plain text. Make them routes to editing and
captures, retaining the period. Consider an equal-length previous-period comparison
using existing daily counters. Do not average unlike Goal rates or call every
conversion a Lead.

**Leads asks:** “Can I find a capture and see exactly what was submitted?”
The normal read defaults to 50 events with no cursor/offset. Grouped results lack
event drilldown and hide the truncation notice. Add honest limits, pagination,
identifier search and group-to-event navigation. Export needs explicit scope;
Contact status, follow-up workflow and editable Lead records remain out of scope.

Sources: [Optins](../../resources/admin/src/optins/OptinList.tsx),
[Analytics](../../resources/admin/src/stats/Dashboard.tsx),
[Leads](../../resources/admin/src/leads/LeadLog.tsx),
[Lead API](../../src/Rest/LeadController.php).

## 8. Manage delivery, recovery and occasional settings

**Destinations asks:** “Where does this route go, what uses it, and how do I fix it?”
Compact summaries are a good base. Show Optin usage before shared settings are
changed. A skipped-capture message currently tells merchants to re-push while
that action may remain inside Settings because only failures expose it. Bring
recovery beside the reason. Terminal failures need the route name and a link to
the capture, not just a raw Lead id. They are a bounded diagnostic log, not a
complete per-Lead delivery ledger.

**Testing asks:** “Who receives this test, and what does it prove?”
Send test currently acts immediately and defaults to the WordPress user's email.
Show a small test form with the recipient and likely effect before sending.
Distinguish connection check, sample push, local form preview and real visitor
capture. A successful handoff does not establish subscription confirmation or
actual inbox receipt. A test push must still create no synthetic Lead.

**Retention asks:** “Exactly what will be deleted, and when?”
Enabling deletion commits the suggested 90 days before the merchant can edit the
period; subsequent edits save on blur. Let the merchant choose a draft period,
then explicitly save/confirm that actual value and its consequence. Keep the
current saved-state disclosure. Do not change an existing site's retention or
site-wide frequency defaults as a side effect of this redesign.

Sources: [destination management](../../resources/admin/src/destinations/Destinations.tsx),
[test endpoint](../../src/Rest/DestinationController.php),
[retention](../../resources/admin/src/leads/LeadLog.tsx),
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
2. **Finish and update confidently:** add addressable editor routes, Publish
   changes, actionable review, destination setup return and inline placement.
3. **Understand and recover:** connect reports, captures and route failures;
   expose skipped-delivery recovery; make test recipients and retention explicit.
4. **Refine the setup language:** simplify creation, regroup display rules,
   clarify undo/mobile scope, and decide the enquiry positioning.
5. **Extend a proven handoff:** verify one deliberate capture and named provider
   result, then add one useful qualification field through the same path.

The gallery decision is recorded in [0069](../adr/0069-the-library-helps-merchants-compare-before-applying.md),
with [0043](../adr/0043-the-library-is-indexed-and-its-facets-are-derived.md) and
[0059](../adr/0059-the-converting-act-belongs-to-the-design.md) amended inline.
Future implementation must amend affected decisions inline: creation/action
scope [0039](../adr/0039-a-screen-is-regions-and-scope-decides-placement.md);
actionable guidance [0042](../adr/0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md);
editor history/publishing [0067](../adr/0067-the-editor-starts-with-the-preview-and-the-selected-element.md);
reading/recovery placement [0068](../adr/0068-reading-pages-put-results-and-routes-before-occasional-settings.md).
Revisit [0050](../adr/0050-a-scheduled-optin-stays-in-the-published-set.md) before exposing
schedule state on the list, [0033](../adr/0033-the-lead-log-reads-without-a-new-index.md)
for log paging, and [0018](../adr/0018-erasure-deletes-rather-than-anonymises.md)
for retention interaction. Field evolution must also update the relevant capture,
template and destination contracts. These are future amendments, not decisions
silently adopted by this review.

## Completed gallery slice and verification

Implemented the Browse designs changes described above. The library identifies
its current format, searches names and real features, keeps relevant filters
available, and moves layouts into More filters. Cards describe their fields or
link action. A detail view inspects sample content, desktop/mobile layouts and
actual screens before Apply. Background pictures, explicit preview retry,
bounded tree requests, inert sample controls and focus restoration are included.
Other page and handoff recommendations in this review remain future work.

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
This pass made no publication, retention, route-setting or provider-send changes.
