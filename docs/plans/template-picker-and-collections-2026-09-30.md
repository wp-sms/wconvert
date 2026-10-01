# Template picker and featured collections implementation plan

Status: Local picker implementation and prototype-parity audit completed on 30 September 2026. The full eight-slice programme is **not complete**. Local preferences and reviewed seed collections work; slices 5–8 remain partial or pending, and the initial studio does not simulate every proposed capability/locale/failure context. See the [requirement-by-requirement audit](../reviews/picker-plan-audit-2026-09-30.md), [coverage inventory](../reviews/picker-coverage-audit-2026-09-30.md), [ADR 0112](../adr/0112-template-discovery-and-reviewed-collections.md) and [initial validation](../reviews/template-picker-implementation-2026-09-30.md). No deployment or merge is included.

Build one clear template discovery experience inside the plugin, backed by reviewed campaign setups and an optional remote catalog. Help merchants choose something relevant, understand what they must configure, and reach a useful draft. Extend the existing template, Playbook, Prefill, catalog and review systems rather than creating a second builder.

Follow-up: the [1 October flow audit](../reviews/picker-flow-audit-2026-10-01.md)
records remaining UI corrections and actual WordPress checks across creation,
editor comparison, detail inspection and pack discovery. It does not change the
partial status of the wider programme above.

The approved study is at `http://127.0.0.1:9442/picker-prototype.html?variant=A`. Its files under `tools/design-library/out/seasonal-ux/` are ignored, disposable review artifacts. Its 108 setups and 59 design IDs describe that snapshot, not the complete installed or future API library. Preferences, dates, offline behaviour and internal review records in the study are demonstrations.

## Product decisions

- Use A as the production visual direction: search, useful filters, grouped designs, compact featured collections, and a spacious preview within one dialog.
- Support two explicit intents: **Create a campaign** and **Change layout**. Selecting a campaign setup and applying another layout have different effects.
- Keep the existing seven Goals and five core display formats. Broader business and industry labels describe examples, not eligibility rules on reusable designs.
- Count campaign setups and distinct designs separately. Copy or colour changes do not create a new design.
- Collections are curated discovery lists; packs are versioned delivery units. One setup may appear in several collections without duplicate installation.
- A campaign receives its own prepared snapshot. Catalog updates, expiry, retirement and collection edits never rewrite its content or schedule.
- Begin with shared Black Friday/Cyber Monday, New Year when reviewed, evergreen task collections, and merchant-owned occasions. Do not generate collections merely to fill calendar slots.
- Keep the internal studio in this repository under `tools/design-library`; ship only approved runtime data to customers. Verify exclusion from every release artifact, not just the Free configuration.
- Use local checks and manual visual review. No CI work or real email/SMS delivery testing is included, as requested.

## Existing implementation and reuse points

| Existing area | Reuse and required change |
| --- | --- |
| `resources/admin/src/goals/GoalScreen.tsx` and `goals/api.ts` | Preserve Goal-first creation, grouped setup choices and actual Prefill content. Adapt discovery to the new visual surface. |
| `resources/admin/src/builder/TemplatePickerDialog.tsx` | Reuse the single dialog and existing pack entry. Replace ad hoc subview state with explicit library, collection, preview and review navigation. |
| `TemplatePicker.tsx`, `Gallery.tsx`, `TemplateCard.tsx` | Retain metadata/tree separation, lazy loading, goal-fit guidance, refusal reasons and installed capability checks. |
| `TemplateDesignDetail.tsx`, `templates/api.ts`, `OptinBuilder.tsx` | Reuse desktop/mobile and screen inspection, `prepareTemplate`, actual content transfer and undoable draft application. |
| `src/Rest/PlaybookController.php`, `src/Playbook/Prefill.php` | Keep one preparation path. The existing goal-specific index prepares full trees; do not call it for every Goal on first open at 500 setups. |
| `src/Rest/TemplateController.php` | Preserve the small design index and bounded tree loading. Do not add authored Goal or industry facts to structural Template facets. |
| `src/Template/Catalog/*` and `TemplateCatalogController.php` | Extend explicit refresh, preview and installation, validated local archives, digest checks and offline use. |
| `tools/design-library/build/*`, `review/*`, `MAINTENANCE.md` | Extend current revision-bound review, dependency and duplicate checks for collections and published releases. |

The existing catalog has no default production URL. It reads local state on normal browsing and contacts the configured remote origin only through explicit administrator actions. It currently limits the catalog to 50 packs; each pack has up to 12 templates and 12 Playbooks, with a 256 KiB JSON bound. The installed archive has a 128-file bound. These are validation limits, not proof that the whole path performs well with 500 setups and years of retained releases.

### Corrections when translating the prototype

1. **Paid labels:** use existing availability and tier presentation. Current customer-facing paid naming is “Pro”; do not ship the study's Basic/Elite labels as a new pricing policy.
2. **Availability:** preserve `ready`, `locked` and `unavailable`. Missing WooCommerce or a provider is not a reason to advertise Pro. Creation recommendations omit unsupported site-specific setups; deliberate catalog inspection explains the missing dependency.
3. **Changing layout:** keep the campaign Goal and suggest fitting designs first, while retaining existing **Show all designs** behaviour and publication checks. Do not implement the study's hardcoded email-only restriction.
4. **Creation:** preserve the current Goal-first entry. The optional helper refines business and goal; changing an already selected goal is explicit. An all-goal entry is a separate documented extension, not an accidental change to the existing `/playbooks` contract.
5. **Thumbnails:** generated images would amend the current live-rendered gallery approach. Record that decision, bind images to prepared-content and renderer revisions, and retain exact live inspection before applying.
6. **Network:** approved API-backed discovery does not itself implement background contact, telemetry or paid-download authentication. Preserve explicit catalog connection/refresh for the first production slice.

## Customer flows

### Create a campaign

Enter with the selected Goal when available. Keep it visible and offer business, format, collection, availability and search filters. An optional **Help me choose** asks who the merchant serves and what visitors should do; it never blocks normal browsing.

Filter setups first, then group by canonical design identity and effective format. Choose a matching setup as the representative preview. A design with three matching setups appears once, with three named choices. Changing a choice updates preview, requirements and the exact setup used by the create action together.

The preview shows every screen, result and fallback, mobile/desktop sizes, format, availability, concise “Have ready” requirements, and expandable setup details. **Use this setup** prepares that exact revision and uses the existing draft creation flow. It does not publish, send a message, schedule an event or imply a completed booking.

### Change layout

Open from an existing draft with its real Goal, content, source baseline, bound destinations and A/B context. Hide featured collections, custom occasions and the creation helper. Default to goal-fitting designs and **Keep my content**.

Keep **Show all designs** available under the existing outcome contract. Distinguish an advisory Goal mismatch from a hard refusal such as incompatible A/B conversion acts or bound destinations with no capture. Changing layout does not change the Goal. A different campaign objective follows the existing separate goal-change or duplicate flow, as applicable.

Prepare the actual candidate through the existing snapshot endpoint. Show retained, moved, unplaced and unverified content, format changes and sample-content replacement effects. Apply exactly the reviewed candidate, only to the working draft, with Undo. Reprepare if the draft or candidate revision changes before Apply; never silently apply a different preview.

### Browse a collection

Show a concise purpose, reason for relevance, exact matching counts, grouped previews and practical requirements. Explain whether entries are alternatives or different campaign stages. A collection is not a bundle the merchant must install or publish in full.

Keep the setup selector and full preview scoped to that collection and the active filters. Provide **Back to collection**, then **All collections** when that was the entry point, then **Back to library**. Preserve setup choice, stage, filters, page/cursor, scroll and focused control. Use one dialog with internal views, not nested modal stacks.

## Featured collection rules

Evaluate eligibility before ranking. The WordPress server supplies authoritative site context and time; the browser does not infer the merchant's country or invent availability.

1. Require a published, supported collection revision with valid setup references and media metadata.
2. Apply merchant-selected markets or event participation preferences. If market is unknown, allow approved broadly applicable examples and evergreen collections; suppress region-specific holidays until a relevant market is selected. Business tags may overlap.
3. Apply setup availability, active Goal/business/industry/format filters, personal dismissals and event opt-outs. Do not hide reusable generic setups solely because they lack an industry tag.
4. Require at least one matching setup. Group it before calculating the displayed design count.
5. For the featured shelf, require the feature window to be open. Browse collections can also show approved upcoming collections before that window, clearly dated. Expired occurrences leave normal discovery; the team retains their history.
6. Rank by explicit task/filter relevance, useful event timing and reviewed editorial priority, with stable ID as a tie-breaker. Prefer a mixture of relevant evergreen and seasonal work. Do not rank on invented conversion performance or centrally collected browsing history.
7. Show at most five cards, preferably three to five when relevant. One useful card is sufficient; never fill space with irrelevant ones. Keep View all/Browse collections available.

Hide the featured shelf during search, Saved-only browsing and layout replacement. A manual shelf supports arrows, touch scrolling and visible next-card hints; it never rotates automatically. Removing it must not remove access to the template library. When no recommendation is relevant, omit the empty promotional area and retain a quiet preferences entry.

### Seasonal dates and stages

Store three distinct concepts: collection feature window, event occurrence dates, and merchant campaign schedule. For all-day retail occasions, use calendar dates interpreted in the site's timezone, with an exclusive next-day end internally. For a genuinely timed event, require an explicit event timezone and present converted times clearly. Never mix date-only and instant semantics in one field.

Example: the 2026 Black Friday/Cyber Monday occurrence is 27–30 November; a proposed feature window is 16 October through 30 November. These dates do not schedule a merchant campaign. Each year's occurrence is reviewed independently; last year's campaign never restarts automatically.

Prefer Before, During or After according to the occurrence date, then choose the first relevant nonempty stage if filters exclude that stage. A bar-only filter should open During if it contains the matching bar. Display counts and explain filtered-out stages. Preserve an explicitly selected stage when switching to available choices if it still contains a match.

Re-evaluate time when the picker opens or resumes after inactivity. Avoid moving the card the user is interacting with at midnight: finish inspection safely, mark the changed recommendation, and revalidate before drafting. Expiry removes the recommendation, not an installed reusable design. Countdown deadlines remain unset or explicitly reviewed until the merchant supplies real campaign dates.

### User preferences and occasions

| Data | Owner and proposed storage | Behaviour |
| --- | --- | --- |
| Favourites | Current WordPress user on this site; bounded user metadata | Store canonical design keys, not pack digest IDs. Refresh and another browser retain stars. No central account is required. |
| Hidden collections | User/site preference | Hide a collection family until restored; changing its revision does not defeat dismissal. |
| Event opt-outs | User/site preference keyed by event family | “I don’t run Black Friday” suppresses future occurrences until restored. |
| Business/industry/market preferences | User/site preference | Optional, editable and multi-valued where useful; never inferred from IP location. |
| Browse position | In-memory navigation state; optional scoped session storage | Restore within the editing session. Do not persist search terms remotely or restore a stale draft implicitly. |
| Custom occasion | Site-owned, non-autoloaded option document for the first bounded implementation | Authorized campaign managers can edit it. It stays private to that site. |
| Campaign dates | Existing campaign settings | Independently chosen and validated. Occasion edits never cascade to schedules. |

Use a schema version and revision token for preference/occasion writes, validate IDs and bounds, and handle concurrent writes without replacing unrelated values. Initial proposed bounds: 200 favourite IDs, 100 hidden IDs and 50 custom occasions/site. Make a limit understandable and provide removal; revise bounds from usage rather than allocating unbounded options. Multisite preferences must include blog/site scope because WordPress user metadata can otherwise be shared across sites.

Creating a custom occasion asks name, start/end and displays the site timezone. After saving, show compatible preparation/announcement/follow-up ideas without inventing automatic scheduling. Deleting an occasion removes planning metadata only. Existing campaigns retain their own dates and optional provenance snapshot. No custom occasion is uploaded into the shared calendar.

## Taxonomy and coverage

Retain broad business models: stores, services, publishers/creators. Add controlled optional industry tags to Playbooks or a curation overlay, never to design trees. Suggested initial candidates are fashion, beauty, home/garden, food/drink, home services, professional/creative services, education/coaching and fitness/wellness.

Audit current registered setups, third-party entries and installed packs before exposing these filters. Untagged setups remain under All businesses; no speculative tag is silently applied. Support aliases such as quote/estimate and bar/banner through a reviewed search dictionary. Only expose an industry with real reviewed coverage and show generic alternatives alongside it. A coach may span services and publishing.

The initial coverage deliverable is a matrix of Goal × business × format, plus optional industry and visitor-task gaps. Every proposed new setup names a different visitor need or workflow; every proposed new design explains the composition difference from its nearest neighbours. Keep delivery, booking and revenue claims within the domain's actual evidence boundaries.

## Data contracts

Names below are proposed contracts, not existing classes or routes. Freeze them with implementation fixtures in the first slice.

| Record | Minimum fields and constraints |
| --- | --- |
| Design identity | Source namespace plus stable logical ID; immutable revision/hash separately; renderer/tree compatibility; derived structural facts. |
| Campaign setup | Stable ID, revision, exact design reference, Goal, task name, business/industry tags, structured requirements, supported rules/hints, prepared-preview reference. Reuse Playbook and Prefill validation. |
| Collection | Stable family ID, revision, localized title/description, owned cover reference, business/market applicability, ordered exact setup references, optional occurrence ID, priority and publication status. |
| Collection item | Setup ID and immutable revision, optional stage and concise requirement summary. One design may intentionally have several setups. |
| Event occurrence | Stable event family plus occurrence ID/year, date semantics/timezone, event start/end, feature start/end, approved market scope. |
| Preview asset | Content digest, mime, dimensions, locale, prepared-setup revision, renderer revision, desktop/mobile variant and asset licence/provenance in internal records. |
| Internal review | Owner role/person, changed dependencies, exact hashes reviewed, visual/functional evidence, reviewer, status and publication reference. Excluded from public payload except approved display metadata. |

Separate editorial publication states from design availability and user preference. Do not overload the existing installed Playbook `collection` field, which identifies its source pack, with many-to-many featured membership. Map legacy pack membership into a source facet; use a separate discovery relation for editorial collections.

A canonical favourite/grouping key should resemble `source_namespace:design_id`, with a separate installed revision reference. Existing installed IDs include a pack digest. Preserve those historical IDs for baseline lookup; add an explicit mapping rather than renaming saved campaign references. Never merge third-party IDs because their display names match.

## API and local integration

The first remote implementation should publish immutable JSON releases and image assets behind a small versioned catalog API. No remote customer database is needed for public discovery. Keep private studio records in the repository and expose only approved release output. Hosting provider and final service URL are not yet selected.

Recommended path: internal review → immutable catalog release → explicit WordPress refresh → validated local index → plugin picker → exact local prepared preview → draft. The visitor-facing runtime never needs the remote catalog to display an existing campaign.

### Proposed remote surface

- A bounded discovery manifest with schema version, release revision, generated timestamp and paginated indexes for setups/collections. Pages must belong to one release; do not mix snapshots during a refresh.
- Immutable setup/design or pack resources referenced by identity, version and digest. Initial transport may reuse existing packs; collection membership must not require installing duplicate designs in different packs.
- Immutable cover/thumbnail assets referenced by digest and dimensions. Local caching avoids leaking admin browsing through third-party image requests.
- Conditional refresh support can be added to the transport after measuring the baseline. Keep validation and response-size bounds when adding conditional responses or pagination.

Do not enlarge the existing single index payload indefinitely or silently relax its validator. Introduce a versioned discovery reader/adapter alongside the current schema, retain legacy installed packs, and test unknown versions. Paged refresh commits atomically only after all required indexes validate. Bad responses keep the last known good index.

### Proposed WordPress surface

Use authenticated local REST endpoints under the existing namespace. Proposed responsibilities are a metadata-only discovery query, a collection detail query, exact setup preparation, user preference read/write and site occasion CRUD. Exact path names are finalized in the contract slice. Existing explicit catalog refresh/preview/install and draft creation remain authoritative operations, not side effects of discovery reads.

Discovery queries accept allowlisted search/facets and a bounded cursor/page size, and return grouped card summaries, matching counts, availability reasons, collection context and release revision. Reuse existing server registries to calculate compatibility; the remote API cannot declare a missing runtime feature usable.

Remote content that is only listed is not necessarily installed. Distinguish **Available to add**, **Installed**, **Update available**, **Pro required** and **Needs a site dependency**. Use a clear **Add to library** step for supported uninstalled content. Installing a pack creates no campaign; continue to the exact chosen setup afterwards. Preview bytes and installed bytes must match. If they changed, request a refreshed preview rather than substituting a new revision.

All mutating endpoints use existing management capabilities, authenticated nonces and current-user scoping where appropriate. Do not accept another user's ID for preference writes. Follow the project's controller conventions and [WordPress endpoint guidance](https://developer.wordpress.org/rest-api/extending-the-rest-api/adding-custom-endpoints/) for permissions and argument validation.

### Network and assets

Keep explicit service connection/refresh in the first release, with bundled seed collections and installed content usable without connecting. Show last checked time and a refresh action. Optional background metadata updates would require a separately documented opt-in policy; no new background contact is implied by this plan.

Preserve safe HTTPS transport, origin restrictions, bounded bytes, timeouts, digest checks and fail-closed validation. Paid asset/download entitlement is a separate boundary to complete before enabling remote paid installation; do not fake it from client labels. Existing installed functionality follows current possession-based capability rules.

Current packs prohibit remote media and require empty asset lists. Supporting artwork therefore needs a reviewed asset extension before those designs are remotely distributable. Distinguish gallery thumbnails from assets embedded into campaigns. Validate mime/size/digest and licence, reject executable content, retain referenced campaign assets, and use a neutral image fallback. Do not bypass these limits by injecting external URLs into old pack fields.

## Internal collection workflow

Extend the existing studio rather than build a separate administration service first. Proposed source files belong under `tools/design-library/collections/`; build outputs remain under ignored `out/`. Customer seed metadata, if needed, is generated separately into a reviewed runtime resource directory.

Workflow: brief → choose exact setups → compare duplicates → prepare actual output → inspect all screens and requirements → review occurrence dates/markets/assets → approve exact revisions → build immutable release → publish to configured staging → verify in WordPress → promote release.

A setup, design, renderer, asset or occurrence change invalidates the affected approval. Approval is not publication. The release build rejects missing references, stale evidence, unsupported capabilities, invalid date windows and unapproved artwork. Reuse existing review gates; do not create a second approval truth.

The studio must preview the customer result for business/goal/format, site capabilities, Free/Pro, market, locale, site timezone, date and empty/offline states. Label this **Preview in plugin picker**. It is a simulated customer view, not access to a customer's account, leads or campaigns.

Record owner, review reason and release history. Publish a new revision for a correction; never replace immutable release bytes. Withdraw a broken featured collection without rewriting existing installations. For a runtime defect, use the normal plugin fix path because renderer changes can affect existing snapshots.

## Frontend structure and accessibility

Use existing React, dialog, button, select, tier and renderer components. Do not ship the prototype HTML, inline event handlers, fake dates or A/B/C switcher.

A small shared discovery layer should own normalized identity, grouping, relevance and navigation state. Keep separate adapters for creation setups and layout replacement so a reusable visual component cannot accidentally invoke the wrong mutation. Suggested components include a collection shelf, collection detail, setup group card, requirement summary, preference view and optional helper. Names are provisional; avoid a new generic UI framework.

Represent navigation as a view stack with stable entry keys and saved scroll/focus anchors. Preserve selected setup across thumbnail/card/detail transitions. Cancel stale requests when filters change, and ignore late responses from an earlier query or release. Opening a preview, favouriting, changing filters and dismissing a recommendation create no campaign.

Keep search and neighbouring buttons equal height. Use responsive grids, one-column phone cards, enough space for translated labels, and toolbars that wrap without clipping. Do not stack multiple promotional sections above the library. Test 320, 390, 768 and 1280 CSS-pixel widths, 200% zoom and RTL.

Dialog focus stays inside the active modal; Escape closes it and closing restores the invoking control or a sensible fallback. Initial focus must not scroll past the heading. These behaviours follow [W3C dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Manual carousel navigation must work without swipe, with understandable labels and visible focus; keep Browse collections as an alternative because carousel content can be missed. See [W3C carousel guidance](https://www.w3.org/WAI/tutorials/carousels/).

Use actual contrast measurements for body text, labels, placeholders, borders and focused/disabled/paid states. Generated thumbnails are visual summaries; their embedded forms are not interactive controls. The full preview uses the production renderer and existing phone/select components and must not submit to real destinations.

## Performance and failure handling

Start with paged metadata, at most 24 cards per page, lazy thumbnails and a full renderer only for visible/live previews. Do not prepare every Playbook tree for every catalog query. Cache metadata by release and compatibility context, and previews by exact setup/renderer revision. Derive or validate search facets server-side; locale and install changes must invalidate affected caches.

Proposed performance targets to measure on a recorded local reference environment: a warm cached picker usable within one second, cached filtering visibly updated within 200 ms, and no initial request for all 500 prepared trees. These are acceptance targets, not current benchmark claims. Record hardware, browser, dataset and network conditions with the result.

Keep installed content usable on timeout, malformed data, unavailable assets and unknown catalog versions. Never replace a good cache with a partial refresh. Expire featured placement using site time even while offline. A bad thumbnail should not block a usable setup. An uninstalled setup cannot be used offline unless its validated content is already available locally; explain that distinction.

Before broad remote rollout, resolve the 128-file archive lifetime problem. Garbage collection must retain versions referenced by campaign source baselines and content-transfer history, or move those baselines into a safe durable record first. Do not delete old pack files merely because the library displays a newer version.

## Implementation slices and completion criteria

Each slice should be independently reviewable and finish with evidence. No automatic merges, deployment or issue publication are part of preparing this plan.

| Slice | Work and deliverable | Completion criteria |
| --- | --- | --- |
| 1. Contract and coverage | Inventory installed/bundled/third-party identities, business tags, actual availability and taxonomy. Define collection/setup references, date policy, grouping and ownership. Document proposed amendments to ADRs 0082/0085 and thumbnail policy. | Fixtures cover repeated designs, overlapping businesses, locked/unavailable setups and missing tags. No duplicate source of Goal/design truth. |
| 2. Real local picker | Implement A's components using real plugin indexes and Prefill, preserving creation and replacement paths. Add grouped collection previews, requirements, helper and navigation restoration against bundled seed metadata. | Store, service and publisher users can choose the exact previewed setup; replacement keeps real content and Undo. No prototype code in runtime. |
| 3. Preferences and occasions | Authenticated per-user/site favourites and collection preferences; site-owned custom occasions; migration/bounds/error handling. | Refresh and separate users/sites behave correctly. Dismissal survives collection revision changes. Editing an occasion changes no campaign dates. |
| 4. Collection rules and studio | Production relevance/date evaluator, occurrence metadata, exact-reference authoring, stale review checks and customer-context simulator. | Deterministic matching/counts, valid stage fallback, expiry, opt-outs and revision-bound approvals. Real seasonal copy reviewed before being labelled a seasonal pack. |
| 5. API discovery and assets | Versioned manifest, staging service/release output, validated local adapter/cache, bounded pagination, thumbnails and media extension. Reuse explicit installation. | Same exact content is previewed and installed; malformed/stale/mixed releases rejected; offline library works; legacy packs still resolve. Paid remote installation remains disabled until its entitlement boundary is finished. |
| 6. Migration and resilience | Canonical identity aliases, pack/source membership separation, old saved references, retirement/update cases, archive retention and release rollback. | Existing campaigns, schedules, counters and baselines remain unchanged; favourites follow canonical designs across updates without merging unrelated sources. |
| 7. Release rehearsal | 500-setup scale fixture, local functional/security checks, accessibility/visual review and observed merchant tasks. Verify Free/Pro artifacts. | Acceptance matrix passes with evidence and known limitations stated. Internal studio/mock controls excluded. No CI or real provider sending required. |
| 8. Reviewed expansion | Choose unmet needs from the coverage matrix, then author useful batches of roughly 15–25 setups with deliberate reuse/new-design decisions. | Each batch has reviewed practical tasks, distinct-design counts, all-step evidence and publishable metadata. No clone quota. |

Dependency order: 1 → 2; 3 and 4 build on 1–2; 5 uses the contracts and approved collection output; 6 resolves release identity/retention before broad distribution; 7 gates rollout; 8 grows the library afterwards. API hosting decisions do not block the first real local picker slice.

## Acceptance matrix

| Scenario | Required result |
| --- | --- |
| First-time user skips helper | Full usable library; no mandatory business onboarding. |
| Helper selects service enquiries | Relevant grouped setups; existing available-only preference retained; changed filters explained. |
| Search matches a nondefault setup | Matching preview and exact create action; no irrelevant default hiding the result. |
| Two setups share one design | One design card, accurate setup count, selector updates preview/requirements together. |
| Same setup appears in two collections | One canonical favourite/install identity; no duplicate design downloads. |
| User opens and returns from a detail | Same setup, stage, filters, page, scroll and focus. |
| Black Friday plus bar filter | Opens the matching nonempty stage, with accurate counts. |
| Seasonal date crosses midnight or DST | Site-time interpretation stays consistent; no expired featured card on resume; no campaign rescheduling. |
| Merchant ignores a regional event | No matching suggestion; preferences can be restored explicitly. |
| Event occurrence ends | Shelf/catalog occurrence expires; reusable installed content and saved campaigns survive. |
| Free customer selects paid content | Correct Pro requirement; no paid draft/install bypass; useful alternatives where they exist. |
| Pro site lacks WooCommerce | Missing dependency is explained, never sold as an upgrade fix. |
| No matching Free alternative | Honest empty state; no silent Goal or format change. |
| Existing published campaign changes layout | Goal/history rules preserved; actual content review and Undo; publish checks unchanged. |
| Previewed content updates remotely | Explicit repreview; never apply different bytes silently. |
| API fails or refresh is partial | Last good cache retained; installed drafts can be created; retry is bounded. |
| Thumbnail missing or invalid | Neutral fallback; title, requirements and inspection remain usable. |
| Favourite points to a retired design | Keep a named unavailable/retired saved entry and optional replacement; never auto-substitute. |
| Two users or multisite blogs | Preferences and permissions remain correctly scoped; no cross-user write. |
| Concurrent preference/occasion changes | Revision conflict or safe merge; no lost unrelated settings. |
| Custom occasion edited/deleted | Existing campaign schedules and content unchanged. |
| Malformed remote content or unsupported capability | Reject before rendering/registration; explain compatibility; cache remains intact. |
| 500 setups and repeated revisions | Bounded metadata/pages; lazy previews; retention protects referenced baselines. |
| Narrow screen, RTL, zoom and keyboard | Controls remain reachable; focus restored; no page overflow or obscured action. |
| Free and all paid artifacts | Correct public tier labels/capabilities; no tools, prototype controls or review evidence shipped. |

Use existing targeted tests such as `template-design-detail`, `template-packs`, `TemplateCatalogTest`, `PackPlaybooksTest`, `PlaybookSetupTest`, `GoalAndPlaybookRoutesTest` and the studio build tests, adding behaviour-focused coverage for new contracts. Run `npm run typecheck`, relevant Vitest/PHPUnit suites, affected admin builds, template validation/review gates and artifact checks as each slice requires. Run lint/static analysis on affected work. Record actual commands/results in the implementation review; this planning task has not run those suites.

For practical testing, use local fixture destinations/outbox or Collect only where supported. Do not claim inbox/SMS delivery from a simulated capture. Observe merchants completing an appropriate setup and explaining what still needs configuration. Proposed initial study: five participants across stores, services and publishers; use findings diagnostically, not as statistically proven conversion improvement.

## Rollout and unresolved decisions

Ship the real local picker against bundled/installed data first, behind a development rollout switch while rehearsing. Then enable the configured staging API and reviewed seed collections, test update/offline/rollback paths, and only then release remote discovery broadly. Keep the old source adapter available during migration; avoid maintaining two competing customer pickers long-term.

Rollback restores the prior plugin discovery UI or catalog release pointer without mutating campaigns. Preserve immutable releases and source baselines. A rollback must not download older bytes over a newer installed release or bypass existing downgrade checks. A forward corrective catalog revision can withdraw recommendations while older installed content remains available.

Decisions needed before remote deployment, with recommended defaults:

- **API host and endpoint:** use the planned company template service with immutable releases; do not add a new hosted studio database initially. No endpoint was supplied, so deployment remains a later integration task.
- **Refresh policy:** explicit connect/refresh first. Add opt-in automatic metadata refresh only with a separate network/privacy decision and failure policy.
- **Markets:** merchant-selected participation/market preferences, no IP inference. Begin with shared approved events; expand only with reviewed regional coverage.
- **Paid downloads and artwork:** reuse the company's entitlement mechanism when identified; approved reusable assets with provenance. Do not enable unsupported media or paid transport merely to meet a template count.
- **Release ownership:** assign editorial and technical reviewers before publication. Prototype owner labels are examples, not staff assignments.

These unresolved deployment details do not require another design round or block slices 1–4. The recommended first implementation deliverable is slice 1 followed by a working local production picker slice 2, proven with the four curated collection themes and all three business groups.
