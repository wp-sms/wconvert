# WConvert merchant journey review — 10 September 2026

Status: product recommendations, not a new set of accepted architecture decisions.
The preview-width repair and corrections to outdated authoring instructions are
implemented in this review. A subsequent pass implements the four reading-page
improvements described in [ADR 0068](../adr/0068-reading-pages-put-results-and-routes-before-occasional-settings.md): Optin search
and filters, reports with daily charts, readable capture details, compact route
settings and saved-state disclosures. Subsequent Phases 1–5, template curation
and PR #156 implement most recommendations below. Treat the findings as the
September 10 baseline; the [audit closeout](audit-closeout-2026-09-14.md) records
current completion and the remaining proposals.
The domain docs also clarify that a stored capture does not establish a
Contact's subscription status; this preserves the existing ownership boundary.

## The product we are improving

WConvert helps a WordPress business turn a visitor's interest into a useful lead
and send that lead to the plugin or service that handles the relationship.
The main customer customizes a ready-made starting point, with deeper editing
available when needed.

The journey should answer five ordinary questions:

1. What am I offering the visitor?
2. What should it look like, and what details do I need?
3. Where and when should it appear?
4. Where should the captured details go?
5. Is it working, and what needs my attention?

For example: a business offers a useful guide, asks for an email address, shows
the offer after a relevant article, and sends the capture to its chosen
destination. WConvert can deliver the promised lead magnet through its existing
email destination. MailPoet, WP SMS or another receiving service owns the contact
and subsequent communication.

The [domain model](../../CONTEXT.md) makes the boundaries concrete:

- A **Lead is an immutable capture event**, always stored locally first. The
  lead log and CSV export remain useful without any destination.
- A **Contact belongs to the receiving system**. WConvert does not own
  subscription status, follow-up sequences, enquiry handling or appointments.
- A **Destination is an optional outbound route**, configured site-wide and
  selected on an Optin. Several can be selected. A failed handoff does not
  undo the local capture; the merchant needs a useful recovery action.
- A **Template owns structure and appearance**. Its sample text illustrates the
  gallery. A **Playbook** supplies the goal-specific starting copy and rules.
  Designs remain goal-agnostic.
- A design offers one converting act. Existing click-through offers remain part
  of the product even though they do not create Leads.
- Saving and publishing remain separate snapshots. The requested warning and
  Undo for template switching were the initial boundary. Keep my content and
  Use sample content are now implemented under ADR 0075, with picture matching
  and pre-Apply notices under ADR 0084. Arbitrary content merging is not implied.

The plumber example is therefore an optional lead-qualification use case, not
a decision to build enquiry management or add another Goal.

## What the real WordPress review found

| Area | Observed behavior | Recommendation |
|---|---|---|
| Browse designs rendering | Several cards collapsed into vertical strips, with shadow hosts around 40–48px wide. | **Fixed:** give the preview a definite containing width outside the protected shadow host. |
| Finding a design | Searching “newsletter” returns no designs. Search intentionally checks names only; the main filters describe layout shapes. | Let search understand a small, explicit vocabulary of merchant terms and derived properties. Keep layout filters available. Explain matches; do not invent an industry/Goal taxonomy on design files. |
| Comparing designs | Cards offer a small preview and “Use this design.” A merchant cannot inspect a large mobile or success preview before choosing. | Add a detail view with Desktop/Mobile and Form/Success, the collected fields, and one clear apply action. Preserve search and scroll when returning. Label gallery copy as sample content. |
| Starting an Optin | Three steps, long Playbook explanations, “Use this Playbook,” then another preview before creation. | Use short descriptions of the offer, placement and trigger. Prefer “Use this starting point.” Consider moving from the selected starting point directly into editing while keeping the save boundary explicit. |
| Editor controls | The large canvas and contextual inspector work well. Raw CSS-like values still appear for spacing, shadows and gradients. | Keep the canvas and optional Layers. Add controls suited to each value: linked/unlinked spacing sides, units, visual gradient stops, and clear inherited/mobile states. Keep advanced values available. |
| Undo scope | Undo is in the global header, but history holds the template and template id, not the whole draft. | Prefer draft-wide Undo, or explicitly label it “Undo design change.” A change to the display delay should not look as though the same Undo button will restore it when it cannot. |
| Connecting a destination | The draft lists two available MailPoet destinations but recommends WP SMS in its starting-point hint. Neither list state offers an inline add/connect action. | Prefer compatible destinations actually available on the site; offer “Add a destination” with a return to this Optin. Show the target list and which collected details it accepts. Never select one silently. |
| Readiness | With no selected destination, Summary says “Nowhere. Leads are still captured here, and exported.” Publishing is on the list outside the editor. | Say “Saved in WConvert only,” with an action to choose a destination. Make the review actionable with links to the relevant controls. Consider “Review and publish” inside the builder while preserving separate draft/published snapshots. |
| Destination management | Every destination opens as a full settings form, with test, re-push and removal actions. Health is present. | Start with compact route summaries: name, target, health, where used. Expand settings on demand. Surface recovery when there is a failure and keep testing distinct from saving configuration. |
| Analytics | “Nothing is live yet” appears alongside four impressions, while the list shows a published Optin. | Diagnose this inconsistency. The guidance reads a first-publish milestone; absence of that historical record is insufficient evidence that nothing is published. Do not repair it by inventing a date. |

This historical Analytics observation is addressed by the later reading-page
pass: milestone guidance now uses impression/conversion evidence and does not
invent a first-publication date. See `tests/js/milestones.test.tsx`, including
partial milestone history. It is no longer an outstanding audit defect.

Other copy to review: incomplete “See our.” text when no policy link is
available, sample claims such as a reader count, and the welcome-discount
Playbook's unsupported “highest-converting” claim. Starting content should
describe a real offer without asserting facts about the merchant's business.

Source anchors: [gallery search](../../resources/admin/src/builder/facets.ts),
[destination selection](../../resources/admin/src/builder/DestinationsEditor.tsx),
[editor history](../../resources/admin/src/builder/OptinBuilder.tsx),
[readiness](../../resources/admin/src/builder/ReadinessDialog.tsx), and
[milestone guidance](../../resources/admin/src/milestones/api.ts).

## Field improvements should complete the handoff

There are two different kinds of field improvement: controls the merchant uses
to edit a design, and inputs the visitor fills in. Both deserve attention.

For visitor inputs, start by making the current email, phone and name fields
excellent: clear labels, appropriate autofill, understandable phone formatting,
optional/required states, and errors that preserve what the visitor entered.
Ask only for details the receiving workflow uses. This follows the
[GOV.UK question guidance](https://design-system.service.gov.uk/patterns/question-pages/)
and its guidance on [field errors](https://design-system.service.gov.uk/components/error-message/).

The proposed short qualification choice is now implemented as `interest`
under ADR 0076 and verified through MailPoet in the lead-journey report.
The original recommendation was one short qualification choice. For example:
“Interested in: installation / repair.” That is useful when the selected
destination can receive it. A short message is another candidate, but it should
be a bounded capture field whose text is handed off, not the start of a reply
inbox inside WConvert. Neither addition needs to be mandatory on other forms.

The contract remains intentionally small. Updated inventory after ADR 0076:

- The [manifest](../../resources/templates/manifest.json) offers email, phone,
  name and the bounded `interest` choice. Renderer behavior follows each kind.
- [CaptureForm](../../src/Lead/CaptureForm.php) validates against the published
  design and requires at least an email or phone identifier.
- [CanonicalFields](../../src/Destination/CanonicalFields.php) exposes email,
  phone, name and the stable interest value. Provider requirements describe which
  details a route supports. Merely adding an editor control would not deliver
  a further field.

Before shipping another visitor field, carry one example through editor,
preview, server validation, local Lead serialization, log/export, test send and
the supported destination adapter. Show when a receiving service cannot accept
that detail. Keep provider mapping on the destination/type; do not introduce a
mapping form for every Optin × Destination pair.

This does not call for file uploads, arbitrary forms, conditional questionnaires
or a new multistep conversion flow. Those would need separate product evidence
and decisions. No new database table or column is proposed.

## Improve the internal format by strengthening its existing contract

The format already has a manifest, a closed tree vocabulary, `v: 1`, stable
leaf identities, scoped tokens and mobile overrides. Generated authoring
vocabulary and raw-versus-normalized template verification also already exist.
We should build on those foundations.

1. **Describe editing values explicitly.** Extend the existing manifest control
   metadata where needed with value kinds, allowed units/options and applicable
   constraints. A spacing control should know it edits a length; a gradient
   control should know it edits a gradient. Avoid guessing everything from raw
   strings or duplicating registries in PHP and TypeScript.
2. **Separate field meaning from its appearance.** A stable key identifies the
   captured detail. The input kind defines interaction and validation. The label
   is editable and translatable. Renaming “Email address” must never change what
   the destination receives.
3. **Keep one field registry across the whole path.** Describe the current three
   fields first, with renderer behavior, constraints and destination support.
   Extend it only when the end-to-end field behavior is defined. Message limits
   or choice values must be enforced server-side, not only in an inspector.
4. **Give authors useful diagnostics.** Keep normalization at the trust boundary,
   but expose paths and reasons when authoring would silently lose an unsupported
   token or node member. Build on `verify:templates` and the generated vocabulary;
   a generated JSON Schema can support editor tooling without becoming a second
   hand-maintained contract. See the official
   [JSON Schema introduction](https://json-schema.org/learn/getting-started-step-by-step).
5. **Keep presentation changes cheap.** Better controls can serialize existing
   token values. A new control does not automatically need a new JSON version.
   Change the version deliberately if the meaning or structure changes, and
   preserve stable identities when editing. This pre-release project does not
   need an unsolicited migration framework.
6. **Keep authoring metadata out of the visitor payload.** Continue using the
   published projection and the existing loader budgets. Browsing a larger
   library must not make visitors download the library or editor descriptors.

This is a contract refinement, not a wholesale JSON rewrite. The authoring
instructions had fallen behind the implementation: they still said there was
no canvas, token bags were layout-only, and the narrow breakpoint was 360px.
Those statements are corrected in this change to match ADRs 0064 and 0067.

## Original recommended implementation order

The four steps below have delivered implementations and recorded QA. See the
[audit closeout](audit-closeout-2026-09-14.md) for remaining limits; these steps
must not be treated as a fresh backlog.

**First: choose and connect with confidence.** Improve Browse designs with a
large detail preview, understandable search and field summaries. Make destination
selection actionable from the builder and Summary, using the actual routes on
the site. Keep the accepted warning/Undo behavior for template switching.

The acceptance example is simple: choose an email design, inspect it on mobile,
change its headline, choose “MailPoet — Newsletter,” and see an accurate summary
of what is captured and where it goes. Leaving destination selection empty must
clearly say it is stored in WConvert only.

**Second: finish the editing details.** Improve spacing, typography, gradients,
image crop/focal controls where the renderer supports them, and inherited mobile
values. Resolve Undo's scope. Compare template typography, imagery and spacing
with the reference collection on both form and success screens.

**Third: verify the complete capture and handoff.** Exercise a deliberate test
on the local WordPress site, using the merchant's own test identity. Distinguish
local form Preview, destination test send, and actual visitor capture. Verify
what appears in WConvert and the receiving plugin, then test a failure and its
recovery. A successful capture or provider acceptance must not claim to prove a
contact's confirmed subscription status.

**Fourth: add the first useful context field through that same path.** Refine
the manifest/field registry as needed to support it, rather than building a large
unused field system first.

Changing the creation sequence, adding in-builder publishing, or widening gallery
search revisits existing UI decisions. Update the affected ADRs when those
proposals are implemented; this review does not silently supersede them. An
actionable final review follows the principle of showing relevant answers with
direct change links from [GOV.UK's check-answers pattern](https://design-system.service.gov.uk/patterns/check-answers/).

## What was verified in this pass

The preview fix supplies the design width (or the renderer's existing default)
on a plain wrapper capped at the available width. The protected shadow host can
then size as a block. It avoids weakening the renderer's `:host` reset. The
failure is consistent with the documented behavior of
[inline-size containment](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/container-type).

- Real WordPress: creation steps, design gallery, existing draft, Display rules,
  destination selection, Summary, destination management, Analytics and lead-log
  navigation. No visitor lead details were needed for the log inspection.
- Repaired cards render at useful widths. At a 1024px browser width, measured
  visible hosts were approximately 220–299px and there was no document overflow.
  The editor retained its 600px desktop and 352px mobile preview widths.
- 283 targeted frontend tests passed; TypeScript, ESLint and Free/Pro admin builds
  passed. Existing tests cover preview behavior and gallery interactions; these
  tests do not prove browser geometry. Real-browser measurements cover this fix.
- The final browser pass reported no warnings or errors. The browser viewport
  was restored and the existing review draft was left unchanged.

No Optin was published, no destination was changed, and no capture or external
test send was performed in this pass. Delivery correctness remains part of the
planned complete-workflow verification, not a result claimed by this review.
