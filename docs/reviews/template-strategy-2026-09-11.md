# Template collection and editor recommendation — 11 September 2026

Recommendation: build a curated collection of complete, useful campaigns, supported by a flexible editor and a downloadable catalog. Start with twelve flagship designs across stores, publishers, and service businesses, while improving or consolidating the existing collection. Count a design when its composition or purpose changes meaningfully; color variants are options within a design.

This records the collection direction and the initial audit. The implementation sections below are historical snapshots; the current status is recorded here.

The subsequent [full-library curation](template-library-curation-2026-09-11.md)
is complete: 47 existing designs improved, ten retired and two premade guide
designs added. The subsequent [twelve flagship starting points](flagship-starting-points-2026-09-11.md)
are now implemented in creation, reusing eleven designs and adding Reading slip.
The current library has 50 designs (37 Free, 13 Basic). Inventory figures below
describe the earlier audits. **Next: review and merge the flagship collection,
then build catalog installation and compatibility handling.**

**Agreed direction**

- Balanced coverage of stores, publishers, and service businesses.
- WConvert is before launch, so the bundled collection can be reshaped.
- Quality comes first, with further collections added over time.
- Updated direction after the interrupted session: use placeholders and do not generate images throughout this collection. Keep headlines, offers, fields, and buttons as editable elements. Any production artwork is a later review.
- The resumed editor work retained `codex/editor-controls-audit`; the subsequent flagship collection is on `codex/flagship-starting-points`.

**What was inspected**

The reference file was found at `/Users/navidkashani/.codex/visualizations/2026/09/08/01a07f62-700c-7d10-9a8d-02a82c17a8d8/opt-in-collection/opt-in-collection.html`. Its HTML, CSS, interaction code, specimen descriptions, and implementation notes were inspected. It contains sixteen specimens in eight visual families, with initial and subsequent states, embedded imagery and fonts, and responsive compositions.

The initial session could not open the local file URL. In the resumed session, the user supplied `http://127.0.0.1:8769/opt-in-collection.html`. Its existing HTTP server was returning empty responses; restarting that server in its original directory restored the supplied URL. The reference was then inspected in Chrome, including Fieldwork, Sunday marginalia and the Practica guide, with desktop and narrow comparisons. All sixteen specimens were inventoried, but this was not a complete visual acceptance pass over every reference state.

The initial inspection covered the live WConvert editor and popup gallery in Chrome at `wconvert.local`, including the existing Fieldwork draft, Layers, premium popup examples and Sunday marginalia. The resumed session additionally applied all three sample designs for editor verification, tested the split setting and a phone-label edit, and undid the changes. A temporary inline enquiry draft was created for Callback notes and deleted after the check. Existing drafts were restored and the browser returned to the original six Optins. No campaign was published.

Code review covered the template manifest, library sources, normalization, snapshots, content preservation, catalog endpoints, shared renderer, editor controls, structure operations, themes, and relevant domain decisions. `composer verify:templates` passed: all 56 designs survive registration intact. This validates structure, not appearance, accessibility, or fulfillment of the sample offer.

**The initial collection inventory**

| Distribution | Popup | Inline | Floating bar | Slide-in | Total |
|---|---:|---:|---:|---:|---:|
| Free | 27 | 11 | 0 | 0 | 38 |
| Pro | 4 | 2 | 6 | 6 | 18 |

All eighteen premium designs declare `basic`; the current product presents the paid tiers as Pro. Free supplies popup and inline rendering; Pro supplies the additional display types. A bar template cannot become a Free offering just by changing its metadata.

The collection has recognizable directions worth developing: Fieldwork, Sunday marginalia, Punched ticket, A quieter frequency, The summer archive, and the testimonial and number-led layouts. Their typography, hierarchy, surfaces, and composition give them more identity than a new background color would.

The main weaknesses are uneven assets, overlapping simple designs, limited service-business examples, and uneven attention to mobile composition. Only `inline-choice` uses the new `interest` field. None of the Pro entries has an explicit `narrow` style bag. This is an authoring observation, not proof of a responsive defect: the renderer already wraps layouts automatically.

Concrete content problems also need attention:

- `photo-wash` and Pro `popup-flash` contain the visitor-facing sentence “Swap the picture for your own on the Design tab.” That belongs in authoring guidance.
- `stacked-signup` captures a phone number but contains hidden consent copy referring to email offers. Enabling it exposes the mismatch.
- `benefit-grid` presents an unqualified sample count of 4,000 readers. Sample evidence should not be publishable as if verified.
- `makers-index` invites a product-specific restock alert. The design itself supplies neither product/variant binding nor inventory-triggered delivery. An acknowledgement screen does not complete that workflow.

**What to take from the reference**

The useful standard is a complete exchange: visitors understand what they give, what they receive, and what happens next. The reference source also demonstrates distinct type pairings, purposeful photography, nested surfaces, deliberate line breaks, recognizable success states, and narrower-screen recomposition.

Its standalone implementation is not a drop-in template format. WConvert should translate designs into its validated tree and shared renderer. Several reference flows also need product work beyond visual translation:

| Reference idea | Recommended treatment |
|---|---|
| Welcome discount | Support now with a merchant-created shared code, clear terms, and an honest success state. Add a convenient copy action. |
| Newsletter invitation | Support now with clear cadence, appropriate consent setup, and a configured destination. |
| Resource download | Add a prominent post-submit resource action. A text link is already expressible, but a proper success button needs a defined non-converting action. |
| Sale announcement | Support now with a working destination and the campaign's real schedule. |
| Return to basket | Use the existing click-through approach where cart support is present. |
| Email an existing basket | Requires a separately designed integration; do not advertise it as a layout feature. |
| Product/variant restock notification | Defer the promise until product binding and a notification provider work together. Reuse the visual composition for supported campaigns meanwhile. |
| Email first, optional SMS second | Defer until separate capture and consent semantics are designed. The present two screens are form and acknowledgement, not two independent subscriptions. |

WConvert should keep one primary counted conversion. Download, copy-code, close, and continue actions on a success screen should be explicitly non-converting. The current button vocabulary treats buttons as converting actions, so this deserves a small, deliberate model extension rather than a visual workaround.

**The first twelve flagship designs**

These coverage targets are now implemented as twelve Playbooks; see the [completed mapping and setup requirements](flagship-starting-points-2026-09-11.md). They are recommendations, not claims of measured customer demand.

| Audience | Four starting designs | Essential outcome |
|---|---|---|
| Stores | Photo-led welcome offer; ticket with code reveal; scheduled sale poster; restrained cart-return card | Claim a valid offer or reach the correct shopping destination. |
| Publishers | Editorial letter; article-end signup; guide preview with download; compact reading recommendation | Understand the content and cadence, then submit or follow the relevant link. |
| Services | Callback request; service-interest enquiry; consultation invitation; checklist/report offer | Request contact with minimal friction, or reach an existing booking page. |

For services, begin with **callback requests**: name where useful, one contact method, and an optional service-choice question. Add consultation links alongside them. These serve a useful need with today's capture model. A bounded message field is the next sensible addition if users need to describe a project; it is an explicit extension to captured fields, storage, exports, and destination mapping. Do not silently expand into a general form builder or scheduling system.

The collection should cover several visual directions: minimal, editorial, product photography, bold typographic, warm craft, and professional service. Each audience needs both restrained and expressive choices. The flagship set should include inline, popup, bar, and slide-in work where each format fits; do not adapt every design mechanically to all four.

**Free and Pro**

Apply the same quality standard to both. Free demonstrates that WConvert can produce a polished result; Pro adds breadth, premium compositions, coordinated campaign collections, and the capabilities it already supplies.

A reasonable initial curation target is approximately **12–16 Free and 24–32 Pro designs**, counting retained and redesigned entries. These are planning ranges, not a launch quota. Ship a smaller excellent set if needed, then add distinctive collections regularly. Keep a strong Free example for each core audience, including an image-led design, a newsletter, and a service enquiry.

Retain a small “Simple layouts” group for useful minimal foundations. Do not force a customer who wants a plain article-end form to select an elaborate photograph-based design. Avoid duplicate gallery entries for palette changes. Premium packs should have meaningful differences such as composition, placement, and an associated campaign setup.

Since this is before launch, assignments can change. When an entry is renamed, removed, or moved between tiers, update Playbook references, locked metadata, seeds, and fixtures together. After launch, existing campaign snapshots and installed entitlements should not be retroactively rewritten.

**The editor recommendation, in practical terms**

Let a shop owner replace a picture, change an offer, move the picture to the other side, and shorten the mobile version. Let an advanced user add a testimonial panel. Both should remain inside a layout system that handles wrapping, accessibility, and one primary conversion predictably.

The current editor is already a good basis. It supports direct selection, Layers, block insertion, duplication and removal with guards, sibling reordering, six layout types, element and container styling, desktop/mobile style inheritance, image selection, font selection, simple text formatting, form/success editing, and draft undo. Preserve these features rather than replacing the editor.

Priorities before expanding the library substantially:

| Improvement | User example | Present boundary |
|---|---|---|
| Move between containers and swap split panes | “Put this image on the right.” | Dragging currently reorders siblings. Add an accessible Move to action, destination validation, cycle protection, and undo before broader dragging. |
| Focal point and practical image sizing | “Keep the person visible on a phone.” | Fit and shape exist; image/background positioning is largely fixed by renderer CSS. |
| Responsive composition controls | “Shorten the photo on a phone and keep the form near the top.” | Mobile token overrides exist, but they do not express every layout parameter, order, or device visibility decision. Hide decorative content only; retain essential terms and controls. |
| Friendly spacing and gradient editing | “More room above the heading; darken the bottom of the photo.” | Values are expressible, but complex spacing/gradients can require raw CSS strings. Preserve custom expressions while adding useful controls. |
| Post-submit actions | “Copy the code” or “Download the guide.” | The code node is selectable text; an additional styled non-converting button is not a first-class action. |
| More reliable content transfer | “Keep my product image, logo, and destination when switching.” | Copy roles and image/button transfer exist, but background-image tokens are not covered by `MerchantsOwn`, and image matching is positional. |
| Useful preview widths | “Check this at 320px, 390px, and in a sidebar.” | The normal mobile preview is `22rem`; the narrow styling threshold is `24rem`. Add explicit width inspection without making a separate tree per device. |

Artwork and fonts are part of a template's design. Use purpose-made image assets with intended crop, alt/decorative intent, and desktop/mobile treatment. Avoid generated text baked into artwork. Use fictional brands for samples, and never present a generated person as a real customer endorsement. Preserve font fallbacks and visibly explain a missing preferred font; the present font integration reads the site's font library.

**A template library people can find their way around**

Keep the distinction already present in the model: a design supplies structure and look, while a Playbook supplies purpose, copy, rules, and destination hints. Use that distinction to improve discovery.

In creation, offer useful campaign choices such as “Request a callback” and show several fitting visual options. In the editor, keep “Change template” focused on design comparison and preserving the current campaign. Add curated collection metadata for browsing by style and example use case, while continuing to derive technical capabilities from the tree. A seasonal example should not prevent the underlying layout from being used elsewhere.

The current picker already searches names/features and previews the real design, including the user's carried content. Preserve that. Add useful ordering and curated recommendations rather than depending on alphabetical IDs. Identify whether consent is actually visible, rather than merely saying a hidden checkbox exists. Show the real setup requirements next to an offer that needs a code, resource, deadline, or destination.

For premium browsing, allow real preview images without distributing premium editable trees to Free installations. Generate previews from the same versioned renderer/template pair, label the required tier, and keep an optional live preview. This deliberately revisits the old no-static-thumbnails decision: a screenshot is presentation metadata, while a template tree supplies the editable design.

**The future server**

There is a useful source seam already: `TemplateSource`. Current implementations are bundled templates, locked metadata, and Pro templates; a production download/install source is not implemented. The admin API already separates a lightweight index from batched trees, with a cap of 24 per tree request.

Recommended flow: browse cached catalog metadata → inspect a preview and requirements → download a compatible authorized design with its assets → validate and install locally → apply a snapshot to a draft. Published visitor campaigns should render entirely from local data and assets even if the catalog server is unavailable.

The catalog needs stable IDs, immutable version identifiers, minimum plugin/schema versions, required renderer capabilities, tier, curated collection metadata, preview URLs, asset metadata, package size, and integrity information. Assets need provenance/license records appropriate to their source, dimensions, MIME types, and safe local paths. Validate authorization on the server. Use authenticated HTTPS and verified package integrity; restrict import sizes, remote asset locations, and archive paths where archives are used.

Keep renderer code in plugin releases. Downloaded packages supply configuration/content and approved media, not PHP, JavaScript, or arbitrary stylesheets. Known token names currently accept broad scalar values, so reusing the normalizer alone is not a complete remote import policy: validate URLs, assets, nesting/size limits, and required capabilities before registration. Unknown capabilities should produce an “Update required” explanation instead of silently damaging a downloaded design.

Catalog refreshes must not change existing campaigns. Keep downloaded versions and their assets available locally. Define separately whether an expired subscription can fetch new collections; the existing product promise is that expiry stops updates/support and does not turn off installed functionality. Include offline fallback, retry, and useful catalog-local error messages.

WordPress.org rules address external code, disclosure/consent for external communication, and included asset licensing. Document the template service and keep the core library useful without it. This proposed architecture follows those constraints but does not itself constitute directory approval. [WordPress plugin guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/)

**What to retain, rebuild, and consolidate**

- Develop Fieldwork, Punched ticket, Sunday marginalia, and A quieter frequency as recognizable families; complete assets and mobile review before acceptance.
- Keep The summer archive as a sale direction, with verified campaign terms and a configured end date. It is a reusable composition; the example season is content.
- Rework The maker's index into a supported offer unless a real restock integration is supplied. Keep its visual potential separate from its current promise.
- Rebuild photo-led entries whose artwork is placeholder geometry. Replace merchant instructions in sample visitor copy. Review both Free and premium variants together.
- Compare Centred card, One-line signup, Inline signup, Inline bar, Inline rule, and similar simple entries on a common sheet. Retain meaningful differences in purpose, arrangement, and placement; consolidate superficial duplicates.
- Redesign or consolidate the two-field floating bar. The authoring guidelines explicitly prefer one compact ask in a bar, and the current `bar-two-field` is a candidate for conversion to a better-fitting format.

These are curation candidates, not final deletions. The next visual review must show all retained entries and all screens together.

Snapshotting protects an existing campaign from a removed gallery entry. It does not solve every retirement problem: `MerchantsOwn::changedIn()` returns no asset changes when the original entry is unavailable. Preserve the necessary source baseline or replace that comparison before claiming complete content preservation after retirement.

**Acceptance and production process**

Use the same gate for Free and Pro: distinctive composition, clear offer, truthful sample content, appropriate fields, usable mobile form, designed success screen, predictable customization, and acceptable loading cost. A structurally valid template can still fail this gate.

Test each retained design at 320px, common phone widths, tablet/sidebar widths, and desktop, with longer copy, RTL, font fallback, images replaced/absent, visible consent, keyboard navigation, reduced motion, errors, and success. At narrow widths, essential content must reflow without losing functionality. Visible labels are preferable where the design allows them. [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [W3C form labels](https://www.w3.org/WAI/tutorials/forms/labels/)

Prefer comfortable touch controls; a 44px product target is a useful design choice, while WCAG 2.2 AA's minimum target-size criterion is 24px subject to its exceptions. Do not confuse the two. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

Offer contextually appropriate inline forms and compact dismissible prompts. Avoid aggressive entrance overlays that obstruct the content visitors came to read. This is both a visitor-experience recommendation and consistent with Google's interstitial guidance. [Google Search Central](https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials)

Keep existing payload/loader checks and add an explicit asset budget. Image file bytes should be measured separately from the JSON configuration budget; putting larger artwork into inline data URIs defeats that separation. Full performance measurement needs actual browser rendering and network inspection, not the registration validator.

The original `tools/design-library/BRIEF.md` described twenty designs, no canvas and sample words visitors never see. It has now been rewritten around the current editor, the first three examples, truthful sample content, placeholders and a repeatable review process. Continue generating the vocabulary from the manifest and using the shared renderer for visual review.

Recommended order: finish the reference browser review; agree on a curation sheet; prove three representative designs end to end (store, publisher, service); add only the editor capabilities those designs demonstrate; build the twelve-design flagship set; complete catalog installation and compatibility handling; expand through curated releases. This gives each new capability a real design and each new design a supported visitor outcome.


**Resumed implementation — first three examples**

| Audience | Result | Availability |
|---|---|---|
| Stores | Refined Fieldwork: editable gradient placeholder, readable offer, visible email label, code reveal and honest acknowledgement. | Free popup |
| Publishers | Refined Sunday marginalia: editorial hierarchy, italic excerpt, fluid display type, visible email label and complete acknowledgement. | Free popup |
| Services | Added Callback notes: phone capture, optional name and topic, purpose-specific consent and a callback acknowledgement that does not claim a booked appointment. | Free inline |

At the end of that initial batch the library had 57 designs: 39 Free and 18 Pro. Existing Fieldwork and
Sunday marginalia leaf IDs were retained where those leaves remain. Templates
supply sample content; actual codes, policies, destinations and fulfilment still
belong to campaign setup. No images were generated and no remote fonts are
required by these examples.

A 390px browser check showed that a fixed 12rem split basis left the forms
cramped even though they did not overflow. The new **Minimum column width**
control offers 12rem, 16rem and 20rem. The two split examples use 16rem on both
screens. The default remains 12rem and nested layouts keep their own basis.
The 24rem narrow-style breakpoint is unchanged. See ADR 0079.

The comparison page uses the shipping renderer, with controls for width,
form/success, palettes, RTL, visible consent, longer copy and absent placeholder.
It reports measured width, pane arrangement, horizontal overflow and control
height. Rebuild with `./tools/design-library/build.sh renderer designs review`,
then open:

[First three template comparison](http://wconvert.local/wp-content/plugins/wconvert/tools/design-library/out/flagships.html)

Verification completed:

- All 57 templates survive registration; source contract and PHPStan pass.
- PHP: 1,851 tests, 8,274 assertions. JavaScript: 2,298 tests across 93 files;
  final typecheck and lint also pass.
- Free and Pro admin builds pass. All four loader budgets pass, with the Elite
  loader at 12,285 bytes against a 12,288-byte cap. This leaves very little
  headroom for future renderer work.
- Browser comparisons covered 288px, 320px, 390px and natural desktop widths,
  plus success screens and palette/RTL/consent/long-copy checks. The two split
  forms stack at 390px and use two columns at 688px/768px. Checked variants
  show no horizontal overflow; normal controls measure 45–49px tall. Long copy
  requires vertical scrolling.
- All three designs were inspected in the WordPress picker/editor. Sample
  application, mobile previews, success screens, split controls, phone-label
  editing and undo were checked. The temporary QA draft was removed.

Limits: the comparison page only simulates the form-to-success transition.
This pass did not submit leads to external destinations, verify coupon validity,
or perform a complete accessibility audit. The editor's contrast helper displays
“No reading” for a color alias such as `input-bg: bg`, although the renderer
resolves that alias correctly; improving the helper remains an editor follow-up.
That initial batch did not implement the twelve-design collection, broader
curation, non-converting success actions or remote catalog. The first three
of those are now implemented in the subsequent passes; catalog work remains.

**Resumed implementation — editor controls and success actions**

Implemented the next bounded editor pass (ADR 0080):

- Split **Swap sides** moves both complete panes and reverses their ratio in one
  undoable operation, retaining leaf IDs. Layout controls now appear before
  appearance settings.
- **Picture focus** applies to backgrounds and image leaves, with nine positions,
  a custom value and an independent mobile override through the existing bag.
- A code block can display a copy button, with editable success/failure messages.
  Fieldwork enables it. The code remains selectable if the clipboard is unavailable.
- **Resource link** opens a file or page after capture. It carries its label and
  destination together, and does not count another conversion. Incomplete or
  misplaced links block publication while drafts remain editable.
- The comparison includes swapping and a resource-link example that opens an
  explicitly labelled local placeholder. No images were generated.

Validation: PHP 1,852 tests / 8,283 assertions; JavaScript 2,312 tests across
94 files. The first full JavaScript run hit existing interaction-test timeouts
under high concurrency; the complete run passed with `--maxWorkers=4`, without
changing test timeouts. Typecheck, lint, PHPStan, source contract, template
registration and both admin builds pass. All four loader checks pass: Free
10,411 B, Basic 11,145 B, Pro 12,100 B, Elite 12,288 B. The largest is exactly
at the existing cap. Visitor builds strip editing metadata and construct narrow
CSS mirrors compactly; the vocabulary and tier capabilities remain available.

WordPress QA verified swapping and undo, independent desktop/mobile focus,
copy-button editing, the resource option on the success screen, and the publish
blocker disappearing after its URL was supplied. All temporary edits to the
existing draft were undone, and no campaign was published. The final inspector
was visually checked for control order and wrapping labels. Browser review of the
visitor build covered 288px/320px success screens, swapped desktop panes, resource
navigation to the placeholder and the HTTP preview’s clipboard-unavailable message.
Automated tests cover successful clipboard writes and distinguish counted links
from both kinds of follow-up action. No external lead or fulfilment service was
exercised.

The subsequent curation and [twelve-start collection](flagship-starting-points-2026-09-11.md)
complete the next two collection milestones. The next collection phase is catalog
installation and compatibility handling. General movement between arbitrary
containers and colour-alias contrast readings remain separate editor work.
