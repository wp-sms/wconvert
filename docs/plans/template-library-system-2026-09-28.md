# A repeatable system for WConvert's template library

Research and proposal: 28 September 2026. This document records the agreed direction and expansion plan.

**Implementation update:** the first twelve campaign review studio is now implemented.
It uses six new Free designs and six revised designs; eight new
Playbooks and four revised Playbooks. The source inventory is now 66 designs and
39 Playbooks. Build and review instructions are in the [design-library README](../../tools/design-library/README.md#first-twelve-internal-creation-and-review-studio).
The original audit below is preserved as the baseline. The full 48/400 expansion,
shared workflow, automated generation and catalog scaling are not yet implemented.

## Agreed direction

- Serve stores, service businesses and publishers, prioritising stores and services.
- Target **300–500 useful campaign setups**, with the distinct design count reported separately. Initially plan for approximately **100–150 distinct designs** behind that library.
- Plan the whole collection, prove the process with 30–50 examples, then expand in reviewed batches.
- Build an **internal creation and review system** first.
- Include design, complete visitor journey, suggested display setup and merchant instructions.
- Mix designs that work without images with reusable licensed or generated artwork where useful. This supersedes the earlier placeholder-only direction for future work; artwork installation still needs engineering.
- Provide a strong Free starter collection across all three audiences. Paid plans add breadth and advanced flows, with the same quality standard.

The allocation, thresholds and pilot below are recommendations, not measured demand or promises about conversion lift.

## Baseline before this implementation

The source inventory contains **60 designs and 31 bundled Playbook files**. Metadata-only locked cards and installed pack copies are not additional designs.

| Format | Free | Paid | Total |
| --- | ---: | ---: | ---: |
| Popup | 29 | 6 | 35 |
| Inline | 12 | 2 | 14 |
| Floating bar | 0 | 4 | 4 |
| Slide-in | 0 | 4 | 4 |
| Fullscreen | 0 | 3 | 3 |
| Total | 41 | 19 | 60 |

The current foundation is worth keeping:

- Templates are validated JSON trees with editable content and styles, rendered by the shipping renderer.
- Playbooks already supply goals, copy, display rules, destination hints and instructions.
- Seven supported goals cover email, SMS, enquiries, cart return clicks, promotional clicks, lead-magnet email and matching quizzes.
- Linear journeys and optional second-channel capture exist. Paid question journeys support conditional paths and results.
- New campaign setup and design changes use snapshots. Library updates do not rewrite existing campaigns.
- A design index is separate from full trees; previews fetch trees near the viewport.
- Catalog packages are versioned, validated and retained locally for offline use.
- The Design Bench, gallery, contact sheets, vocabulary generator and structural verifier already exist.

Before expanding, address these findings:

| Finding | Implication |
| --- | --- |
| Catalog index permits 20 packs; each pack permits 12 designs and 12 Playbooks | One current catalog advertises at most 240 pack designs or setups. It cannot carry the intended full library as-is. |
| Pack JSON is limited to 256 KiB; local archive is capped at 128 files including old versions | Growth and update retention need deliberate bounds and lifecycle handling. |
| Pack assets must be empty; imported links and pictures are tightly restricted | Artwork needs a supported distribution path, not embedded remote URLs slipped into template JSON. |
| Current full-library review builder reads Free and display-types directories only | Its review omits the three designs in the journeys module. Discover modules centrally and fail on missing coverage. |
| Older authoring documents describe six goals and older journey limitations | Reconcile the instructions with the current enums, schemas and domain model before AI uses them. |
| Paid pack validation lists `bar`, while bundled designs use `floating_bar` | Investigate format-name consistency before promising downloadable bar packs; this inspection did not reproduce an installation failure. |
| Some gallery text displays broken currency/apostrophe characters | Investigate preview encoding and add non-ASCII sample text to review. This is an observed gallery issue, not a diagnosed production defect. |

`composer verify:templates` passed for all 60 designs during this research. The gallery was rebuilt and representative popup compositions visually inspected. This was not an exhaustive mobile, accessibility, journey or conversion audit, and it does not establish that all 60 deserve retention.

Source anchors: [domain model](../../CONTEXT.md), [pack validator](../../src/Template/Catalog/PackValidator.php), [catalog](../../src/Template/Catalog/TemplateCatalog.php), [installed archive](../../src/Template/Catalog/InstalledPacks.php), [design tooling](../../tools/design-library/README.md), [full-library review builder](../../tools/design-library/build/library-review.mjs).

## What competitors teach us

Research uses public vendor libraries, documentation and customer examples. Their performance claims are vendor reports, not predictions for WConvert.

| Product | Useful pattern | WConvert adaptation |
| --- | --- | --- |
| [OptinMonster Playbooks](https://optinmonster.com/features/playbooks/) | Ready-made campaigns with personalisation instructions | Ship useful setups and clear remaining tasks alongside designs. |
| [OptiMonk use cases](https://www.optimonk.com/use-cases) | Browsing by goal, industry and difficulty | Help merchants choose an appropriate strategy before choosing its appearance. |
| [Wisepops templates](https://wisepops.com/popups-templates) | Goal-led selection across capture, promotions and other use cases | Separate the visitor's task, campaign format and required product capabilities. |
| [ConvertFlow quizzes](https://www.convertflow.com/quizzes) | Product and lead-qualification journeys in several placements | Design and review questions, navigation and results as a complete experience. |
| [Klaviyo forms](https://help.klaviyo.com/hc/en-us/articles/360026474752) | Filters by form type and goal, followed by design and targeting | Make setup discovery simple, with deeper filters available when needed. |
| [Privy swipe file](https://www.privy.com/swipe-files) | Inspiration spanning email, SMS and popups | Maintain a broad research library, but distinguish inspiration counts from installable WConvert campaigns. |

Real examples are useful because they show reasons to ask for attention:

- **Converse** offers early knowledge of launches and collaborations: a useful non-discount signup pattern.
- **Vepsäläinen** offers interior-design tips: content can support a shop's list growth without a coupon.
- **Makerflo** uses a first-order offer with a minimum spend: offer terms must be prominent and must match the merchant's real coupon.
- **Sud Express** uses collection discovery as an exit invitation: an alternative to giving a discount to everyone who leaves.

These examples come from the [Wisepops customer showcase](https://wisepops.com/customer-showcase). Adapt the strategy, with original copy and artwork; do not reproduce brand assets.

For services, [OptinMonster's Woodside Communities case study](https://optinmonster.com/case-study-woodside-increased-revenue-294435-two-months/) describes a visit-planning capture on a relevant page. The transferable lesson is a request that matches the visitor's current intention. Its historical before/after results do not isolate the layout's effect.

Keep a research record for each source: URL, access date, audience, offer, placement, journey, observed mechanism, evidence strength, rights constraints and adaptation idea. Ask potential users in each priority audience to choose and customise examples; competitor coverage alone is not proof of demand.

## Count and organise the library honestly

Maintain four separate objects:

1. **Design:** reusable composition, styles and screen structure.
2. **Campaign setup:** a real use case combining a design with copy, questions, rules and guidance.
3. **Style variant:** colour, type and decorative choices within a design.
4. **Collection:** a curated set of campaign setups, such as home services or store launches.

A green newsletter card and its blue version count as one design. A callback request and a guide request may share a composition but qualify as different setups because the exchange and follow-up differ. Changing only “plumber” to “electrician” does not automatically earn a new setup.

Preserve WConvert's existing separation: goals, audience and season belong to Playbooks or the curation index. Structural facts such as fields, format and screen count remain derived from the tree. Do not add an authored goal to the reusable design.

Proposed taxonomy:

| Dimension | Examples | Where it belongs |
| --- | --- | --- |
| Goal | Email, enquiry, offer click, match | Campaign setup; existing goal enum |
| Business | Store, service, publisher; gardening, home repair, education | Campaign curation metadata |
| Visitor task | Compare products, request help, read an article, claim an offer | Campaign brief |
| Visitor context | Product page, service page, article end, active cart | Brief and supported display rules |
| Format | Popup, inline, bar, slide-in, fullscreen | Derived design format |
| Journey | Single capture, offer first, optional SMS, qualification, results | Derived structure plus curation description |
| Visual family | Editorial, product stage, ticket, compact utility, professional | Internal design curation metadata |
| Requirements | Paid feature, WooCommerce, email provider, real coupon, resource | Capability checks and merchant checklist |
| Occasion | Evergreen, product launch, local season, holiday | Campaign curation metadata |

Use controlled values and aliases rather than unlimited free-form tags. Support localisation and RTL from the start; languages, currencies and colour variants do not inflate the design count. Avoid treating “returning visitor” as proof of customer or subscriber identity.

## A coverage plan for 400 setups

Use 400 as a planning midpoint, with 300 and 500 as sensible release milestones. The following cells are editorial budgets, not a cartesian product to generate blindly.

| Goal | Stores | Services | Publishers | Total |
| --- | ---: | ---: | ---: | ---: |
| Grow email list | 50 | 15 | 30 | 95 |
| Grow SMS list | 30 | 10 | 5 | 45 |
| Collect enquiries | 10 | 75 | 5 | 90 |
| Promote offer or content | 45 | 20 | 15 | 80 |
| Deliver lead magnet | 10 | 15 | 20 | 45 |
| Recover abandoned carts | 25 | 0 | 0 | 25 |
| Find a match | 10 | 5 | 5 | 20 |
| Total | 180 | 140 | 80 | 400 |

Rebalance based on research and use. For example, do not fill 25 cart slots unless they represent meaningfully different contexts or interactions. Leave a cell under target rather than manufacture repetition.

Start with 10–12 visual families: quiet utility, editorial letter, bold typography, product photography, warm craft, professional service, offer ticket, resource preview, structured benefits, authentic testimonial, conversational questions and product results. Each needs an explicit visual principle. Reuse reliable field and button components while varying composition, hierarchy, imagery, information density and mobile behaviour.

Keep roughly 70% of setup planning evergreen, 20% specialised and 10% seasonal as an initial editorial guide. Occasion packs should fit regional calendars and hemispheres. Never turn a holiday label change into a new design.

## Internal production workflow

Extend `tools/design-library` and the existing authoring workflow. Start with repository files, command-line checks and a local review page. A separate hosted application or database is unnecessary for the first batch.

The production stages are:

**Research → approved brief → design alternatives → validated implementation → duplicate review → visual and functional review → merchant trial → versioned release → maintenance.**

Every stage produces saved evidence and an explicit status. Recommended states: proposed, brief approved, drafting, checking, needs revision, approved, released, deprecated. Archive rejected ideas with their reasons so they are not repeatedly regenerated.

For each candidate, store:

- Stable setup ID, design ID and family; version and content hash.
- Merchant, visitor task, page context, offer and supported goal.
- Exact converting act and the metric WConvert can observe.
- Needed fields and why each is needed; screens, branches and results.
- Required capabilities, dependencies and merchant-supplied values.
- Proposed timing, page targeting, exclusions, frequency and mobile behaviour.
- Copy, acknowledgment, error and fallback expectations.
- Source references, artwork provenance and localisation status.
- Nearest existing alternatives and the specific difference this candidate adds.
- Automated checks, screenshots, human decisions and renderer/schema versions reviewed.

Use AI to propose briefs, alternatives, copy and valid trees. Give it the generated vocabulary, current capability manifest, an approved brief and the nearest existing designs. Ask for two or three substantially different compositions and a reason to choose each. Do not ask for hundreds of unrestricted templates in one prompt.

Choose a direction before polishing it. Compile it into the existing tree and Playbook contracts, then render the **actual prepared campaign snapshot**, not just the design's gallery sample. A visually attractive example can still fail when real Playbook copy binds to its slots.

The internal review page should show coverage gaps, candidate status, every screen, desktop/mobile views, closest matches, requirements and unresolved checks. Record the review against the exact bytes; changing copy, art, structure or rules invalidates affected approvals. A generation agent's own quality score is evidence to inspect, not release approval.

## Prevent repetition at three levels

**Before generation:** require an unmet need or a purposeful design gap. Retrieve the nearest five approved and in-progress candidates. The brief must explain why editing one of those is insufficient.

**During automated review:** compare several signals independently:

- Exact canonical content hashes detect identical files under new IDs.
- Structural fingerprints compare layouts, node ordering, fields, submissions, navigation and results. Normalise arbitrary IDs while preserving their references; ignore decorative colour and sample wording for this comparison.
- Visual comparison uses consistently rendered mobile and desktop screenshots. Compare both colour and grayscale so new artwork does not disguise an identical composition.
- Semantic comparison considers visitor problem, exchange, fields, targeting and follow-up. Similar words alone should not decide whether two campaigns serve the same need.

**At editorial review:** show close candidates side by side, including later screens. Approve as a new design, approve as a new setup using an existing design, group as a style variant, revise, or reject. Record justified exceptions.

Start with deterministic structure checks and contact sheets. Add embeddings or image similarity when useful; calibrate thresholds on labelled same/different pairs from the pilot. A similarity percentage is not an objective originality verdict.

Examples:

| Candidate | Decision |
| --- | --- |
| Same signup with another accent colour | Style variant |
| Same quote form with only the trade name changed | Usually an alias or industry example |
| Repair enquiry asking service type versus wedding enquiry asking event needs | Potentially separate setups; review actual questions and downstream needs |
| Same first screen but optional SMS after email | Different journey/setup; screen-one similarity must not discard it |
| A narrow bar derived from a popup | New design only if composition and interaction were deliberately adapted |
| A guide offer rebuilt around a readable resource preview and mobile reordering | Potentially a distinct design |

## The quality standard

Release requires all mandatory checks to pass. A weighted score helps compare candidates but cannot compensate for a broken flow, inaccessible control, misleading claim or duplicate.

Suggested editorial score: usefulness 25, visual quality 25, clarity and friction 20, mobile/accessibility 20, distinctiveness 10. Trial an 85/100 acceptance threshold, require no category below 70% of its maximum, and recalibrate after the pilot. This is a review rubric, not a conversion forecast.

Mandatory review covers:

- **Purpose:** one understandable exchange and one primary counted outcome. Ask for the minimum useful information; explain extra qualification questions.
- **Copy:** specific benefit, descriptive CTA, credible terms, no invented testimonials, scarcity, purchase counts or unsupported delivery promises. Acknowledgment describes what actually happened.
- **Visual design:** clear hierarchy, deliberate spacing, coherent type, usable contrast and a complete success/result screen. Test brand replacement and longer merchant copy.
- **Interaction:** labels, keyboard navigation, visible focus, clear validation, working dismissal, correct Next/Back/Skip, loading and retry behaviour. Submitted information and separate consent follow the journey contract.
- **Responsive behaviour:** test 320/390/768/1440 viewport widths and actual smaller container widths, including approximately 288px of available popup space. Inspect short screens, zoom, the phone keyboard, long translations, RTL and missing media.
- **Placement:** inline behaves as inline; bars stay compact; fullscreen and popups do not obstruct access indiscriminately. Document a supported mobile alternative for a desktop-specific trigger. Display/frequency suggestions are starting hypotheses, not universal best timing.
- **Compatibility:** Free, paid modules, absent WooCommerce/providers, unavailable products, unconfigured links, real schedules and asset failure. Check installation, updating, offline reuse and snapshot safety.
- **Performance:** retain the current design/payload budgets and measure actual assets separately. Test the picker with 500 entries; keep full trees and rich previews lazy-loaded.

The existing internal target of 44px controls and 16px input text is a useful house standard, not a claim of complete WCAG conformance. [W3C's form guidance](https://www.w3.org/WAI/tutorials/forms/labels/) supports explicit, understandable labels; its [initial evaluation guidance](https://www.w3.org/WAI/test-evaluate/preliminary/) covers keyboard access and useful errors. Automated checks require manual follow-up.

Suggested display defaults should preserve access to page content. [Google's interstitial guidance](https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials) is a further reason to avoid indiscriminate obstructive entry campaigns.

## Keep promises within actual capabilities

| Scenario | Suitable WConvert treatment |
| --- | --- |
| First-order discount | Capture plus real merchant-created code and clear terms; the template does not create or enforce the coupon. |
| New collection or upcoming launch | Capture interest or link to a real page; the connected provider/merchant handles later announcements. |
| Quote, callback, consultation, trial lesson, venue visit | Capture a request; never imply a confirmed appointment, reservation or quoted price. |
| Webinar, event, donation or membership | Link to an external registration/payment system, or clearly collect an enquiry. Neither implies ticketing, payment nor access control. |
| Resource offer | The lead-magnet goal requires its configured email destination. Distinguish that from a post-capture resource link and test the real delivery setup. |
| Product or content finder | Use supported paid question/result journeys; bind local products after install and provide fallback results. |
| Return to basket | Use supported WooCommerce/cart requirements; count return clicks, not recovered purchases or revenue. |
| Email followed by optional SMS | Separate explicit submissions and consent; skipping SMS preserves the accepted email capture. |
| Promotional content lock | Public bonus content with the existing behaviour; not a secure paywall or private document system. |
| Product restock alerts, automatic cart emails, unique coupon creation | Require explicit verified integrations; do not promise them through copy alone. |
| Dynamic shipping-progress bars, wheels, scratchcards, loyalty points | Separate feature proposals until supported and tested; ordinary static offers must be described accurately. |
| NPS or anonymous survey reporting | Do not assume the quiz result contract supplies general survey storage or analytics. |

Use three requirement labels internally: works with shipped capabilities, needs merchant configuration, needs product/integration work. Only the first two enter the release queue.

## Artwork and assets

Mix text-led compositions, editable decorative elements and image-led designs. A design should survive a missing or replaced picture. Keep headlines, terms and buttons as real editable elements rather than flattened into images.

For each shipped asset record source, licence or generation provenance, permitted redistribution, dimensions, file size, alt-text intent, desktop/mobile crop and replacement guidance. Generated artwork must not fabricate product results, endorsements or customer evidence. Avoid dependence on remote fonts or hotlinked stock imagery.

Add a versioned asset manifest, approved formats and size limits, integrity checks, local installation, safe URL handling and predictable missing-asset behaviour. Design remote asset transport with the same care as pack JSON. Separate this implementation from designing the first text-led pilot examples so the pilot can start sooner.

## Choosing a template should be easier than browsing 400 cards

Retain goal-first creation. Offer an optional business filter, then show approximately six strong matching setups. Explain why they fit and what remains to configure. Make the full library searchable with filters for goal, business, format, journey, requirements and visual style.

Each setup detail should show the full visitor flow on mobile and desktop, what is captured, what is counted, when and where it is suggested, prerequisites, and who must provide the next step. Use names such as “Request a home repair quote”; keep poetic design names available in the design view.

Group cosmetic variants under their parent. Offer related alternatives with a reason: “fewer questions”, “works without a photo”, “inline rather than an overlay”. Allow favourites or saved shortlists if pilot users need them. Do not label a design “best converting” because it is popular or has a high review score.

Free should offer roughly 20–30 excellent campaign setups backed by enough varied popup/inline designs to represent every audience. This is an initial packaging proposal, not a requirement to delete today's 41 Free designs. Paid breadth and feature-dependent formats should be clearly explained; do not imply a paid feature works in Free because its preview is visible.

## Review the existing collection before replacing it

Classify all 60 current designs and their dependent setups as keep, improve, merge or retire. Prefer candidates such as Fieldwork, Sunday marginalia, Callback notes and Punched ticket for the initial benchmark review; their earlier flagship status does not exempt them from the new checks.

Retirement requires a dependency map covering Playbooks, locked metadata, pack memberships, previews, fixtures and source references. Save old sources, stable IDs and replacement guidance. Update dependent library records deliberately. Existing campaign snapshots and installed pack baselines stay intact. Colour duplicates can become variants; useful simple layouts should remain available.

Retire in batches with replacements ready. Deleting everything first discards useful material and makes comparison harder.

## Pilot: 48 concrete campaign briefs

These are candidates to validate, not 48 instructions to produce separate designs. Reuse or improve existing work where it meets the standard. Aim for approximately 30–36 distinct approved designs across the pilot, subject to the duplicate review.

| Audience | Proposed briefs | Count |
| --- | --- | ---: |
| Stores | First-order code; non-discount new-arrival list; VIP collection announcement signup; general SMS launch updates; email then optional SMS | 5 |
| Stores | Skincare preference finder; plant finder; gift finder; product enquiry | 4 |
| Stores | Shipping-terms announcement; real sale deadline; seasonal collection link; collection discovery on desktop exit; product care guide | 5 |
| Stores | Plain cart return; cart return with delivery information; cart return with returns information | 3 |
| Stores | Maker story newsletter; restyling tips signup; sizing guide request; launch-interest signup; wholesale enquiry | 5 |
| Services | Home repair quote; cleaner enquiry; landscape project enquiry; renovation callback; photographer enquiry; wedding venue visit request | 6 |
| Services | Agency project brief; accountant consultation request; tutor trial-lesson request; fitness introductory-session request; course advice enquiry | 5 |
| Services | Service finder; project-readiness checklist; maintenance tips newsletter; SMS service-news signup; seasonal service promotion link; consultation request after a service explanation | 6 |
| Publishers | Article-end newsletter; editorial weekly letter; topic preference signup; checklist email request; guide recommendation | 5 |
| Publishers | Related article link; membership information link; event registration link; optional SMS headline alerts | 4 |
| Total | Stores 22, services 17, publishers 9 | 48 |

Questions beyond the simple enquiry field require paid question journeys. Event, trial and consultation examples remain requests or external links. Cart examples require supported cart capabilities. Exact rules and content must pass current setup validation before approval.

Start with 12 benchmark setups chosen from this list, covering all five formats, each audience, a no-image design, a photo design, a resource offer, a real deadline, a conditional quiz and optional SMS. Expand to 48 only after the benchmark makes the quality standard concrete.

## Release and maintenance sequence

1. **Inventory and foundations:** establish one complete inventory, reconcile stale authoring guidance, create the brief/coverage/decision schemas, and make review include all modules and screens. Preserve the current library while collecting keep/improve/merge/retire decisions.
2. **Twelve benchmarks:** implement full setups through the shipping Prefill path, add duplicate comparisons, and test merchant customisation. Adjust the rubric from actual review difficulties.
3. **Forty-eight pilot setups:** complete the initial coverage, retain explicit review evidence and measure time/cost per approved setup. This supplies a defensible production estimate.
4. **Distribution and discovery:** expand the bounded catalog through an explicit versioned contract or pagination; support shared design references where appropriate, assets, paid delivery and old-version retention. A merchant should not install several copies of one design just to obtain related setups. Validate a 500-entry catalog and offline operation before broad release.
5. **Expansion:** publish coherent batches of roughly 15–25 setups, progressing through 100, 200, 300 and 400. Select each batch from demonstrated coverage gaps, not an arbitrary novelty quota.
6. **Maintenance:** recheck affected templates after renderer/schema changes; review stale seasonal promises and broken resources; deprecate with replacements; preserve current campaigns and rollback baselines.

Each batch should have a named editorial owner and technical reviewer. Track generation attempts, review time, revision causes, acceptance rate and asset cost. Predict throughput from pilot measurements rather than promising a calendar based only on file generation speed.

## Learn whether the library is helping

Track merchant success first: finding a suitable setup, time to a usable draft, configuration completion, successful publication, major edits and support problems. Use pilot observation or explicitly agreed telemetry; the proposal does not introduce automatic remote tracking.

Evaluate visitor outcomes using the goal's honest metric: accepted submissions, enquiries, link/cart clicks, completed results, or emails accepted for sending. Capture events are not unique people; provider acceptance is not inbox delivery; a cart click is not a sale.

Compare changes within relevant site, audience, offer, placement and timing contexts. Use controlled A/B tests where available, choose a primary outcome and sample plan before testing, and report uncertainty. Merchant follow-up can assess enquiry quality outside the plugin. Low-traffic sites need qualitative feedback as well as counts.

Do not aggregate all edited descendants into a universal “template conversion rate”: edits and traffic change what is being measured. Record the actual tested version and context. A global ranking based on raw conversion percentages would favour easy offers and mislead service businesses.

## Immediate recommendation

Build the internal inventory, brief and review workflow first; then produce the twelve benchmarks. Use that evidence to approve the 48-setup pilot and the catalog/asset work. Preserve and improve useful existing templates while retiring repetition deliberately. This establishes a repeatable process for reaching 400 setups and continuing beyond it without allowing the count to replace usefulness.


## Second batch implemented, 2026-09-28

The user approved the twelve benchmarks and asked to move forward. The studio now
contains 24 campaigns using 21 distinct design IDs. The full inventory is 70 designs
and 49 Playbooks. The second batch covers six store, four service and two publisher
needs: plain cart return, delivery guidance, standalone SMS, scheduled sale,
product care resource, wholesale enquiry, venue visit, course advice, maintenance
newsletter, seasonal service link, external workshop registration and topic signup.

Four new Free compositions are Resource index, Appointment note, Agenda card and
Preference card. Venue and course enquiries intentionally share Appointment note;
existing designs are reused where the visitor workflow, rather than appearance,
is the reason for a new setup. Ten Playbooks are new and two already existed.

Versioned briefs now require a batch, comparison designs and a written reuse/new
composition decision. The studio exposes batch and goal filters, a coverage matrix
and correct campaign-level paid requirements. This remains an internal production
workflow. Customer discovery, catalog scaling, asset transport, 48-campaign
completion and actual merchant conversion trials remain separate next milestones.


## Practical coverage batch implemented, 2026-09-28

The user approved the next steps. The collection now has 48 campaign setups using
36 designs: 22 stores, 17 services and 9 publishers. Twenty-four additional
Playbooks reuse existing compositions. This is useful campaign breadth, not a
claim of 24 new visual designs. Discovery now combines business, Goal, format,
collection and search, with setup details and previews retained.

The final selection adapts the proposed briefs to supported, testable workflows.
Gift-planning and sizing resources, manual restock announcements and enquiries
are implemented; the proposed skincare/gift/service finders and third cart variant
remain coverage opportunities rather than being mislabeled as completed.

A disposable real WordPress/MySQL/WooCommerce site publishes all 48 through the
normal API. Capture checks cover required fields, canonical phones, preferences,
idempotent retries and one Lead across optional-channel submissions. Six resource
campaigns hand off actual emails into a local outbox with working content links.
Browser checks cover creation/edit/publication, real phone selection, capture,
and coupon/cart use. All new screens were visually reviewed at desktop and phone
widths; final responsive audit: 720 cases, zero measured layout findings.

The catalog bound is now 50 packs, using one shared constant; per-pack and byte
limits remain. This removes the old 240-design capacity ceiling but does not
complete paid asset transport, shared design references or a 500-entry end-to-end
installation trial. Those remain prerequisites for broad distribution.

Continue in reviewed batches selected from uncovered needs. Preserve revisioned
review evidence, distinguish editorial review from release approval, and obtain
real merchant outcome evidence before claiming conversion improvements. No remote
tracking or external email/SMS sending was introduced.

## Shared review and next-batch preparation, 2026-09-28

The internal review queue is now repository-backed. All 48 current campaign
revisions have reconciled visual, journey and WordPress evidence; a local gate
checks that evidence without CI. Changes to campaign output or evidence invalidate
its approval. External delivery is skipped at the user's request.

`tools/design-library/pilot/next-batch.json` prepares 24 needs (12 stores, eight
services, four publishers) toward 72 setups. Each brief includes type, existing
comparisons, a proposed reuse/new-design decision, meaningful differences and
practical acceptance checks. These remain planned, not added to the 48/36 counts.
Three real-WordPress walkthroughs make the whole visitor task reviewable across
store selection, service enquiries and publisher recommendations/optional signup.
See the [implementation review](../reviews/template-review-system-2026-09-28.md).
