# Inline content locking — research and proposed implementation plan

Date: 20 September 2026. Parent: [#165](https://github.com/wp-sms/wconvert/issues/165).

Status: implementation authorized on 20 September 2026. This is the implementation contract. Competitor findings are documentation research, not runtime testing.

## 1. Recommendation

Build **Content lock** as an optional inline Campaign capability in every paid Pro tier. A merchant selects a specific region of ordinary WordPress content, places a familiar WConvert form immediately before it, and reveals that region after an acknowledged Lead capture. Remember the successful unlock for that Campaign family in the same browser for 30 days.

The first release should provide a native container block and an enclosing shortcode, one active locked region per document, and one treatment: hide the selected region while the form is available. Existing inline designs supply the form and success state. A merchant can write a public excerpt above the region in WordPress.

This is a promotional content gate. The content remains in the delivered page, and it becomes readable if the gate cannot operate. It does not establish subscriber identity or provide protected membership, payment, file, or age-restricted access. Explain this at setup, where it changes the merchant's decision about whether to use the feature.

**Go/no-go:** proceed if the intended need is exchanging a useful bonus or article section for a captured request. If the required outcome is enforceable access for verified subscribers or paying members, this proposal does not meet it; that requires an authenticated content-delivery design outside #165's inline journey.

## 2. What competitors document

Sources were reviewed on the date above. These are documented capabilities, not verified implementations, measured conversion improvements, or evidence of WConvert merchant demand. Where a reviewed page does not describe persistence, accessibility, or failure behavior, that remains unknown.

| Product | Documented behavior | Implication for WConvert |
|---|---|---|
| [OptinMonster content locking](https://optinmonster.com/docs/optinmonsters-content-blocking-feature/) | Inline campaigns can blur or remove content below the embed, within the same container. The feature is documented for Plus and higher. Success-cookie duration controls remembered access; global success settings can unlock across the site. The troubleshooting section explicitly calls out page-builder container boundaries. | Reuse inline; make the content boundary explicit. Remember successful access, but do not couple every resource to an unrelated site's conversion by default. |
| [Thrive Leads shortcode documentation](https://thrivethemes.com/docs/how-to-use-thriveboxes-and-shortcode-forms/) and [official tutorial](https://thrivethemes.com/thrive-leads-content-lock/) | A Lead Shortcode wraps the selected content. Hide and Blur modes are available. The tutorial demonstrates immediate reveal after submitting and retention after reload; it does not establish a precise retention contract for this comparison. | An explicit region maps well to WordPress authoring and avoids guessing which following elements belong to an offer. Reload continuity is part of a complete journey. |
| [Bloom locked-content documentation](https://help.elegantthemes.com/en/articles/8607755-using-the-bloom-locked-content-opt-in) | Locked Content is a distinct opt-in type. Its generated shortcode encloses a resource link or article section. Setup includes selecting an email service/list. The reviewed page does not specify retry, storage-failure, or remembered-access details. | Adopt the explicit boundary without adding a sixth WConvert Display Type or requiring a Destination for local capture. |
| [MailOptin content-locking documentation](https://mailoptin.io/article/setup-wordpress-content-locking/) | In-post campaigns hide or blur content below the form; additional CSS selectors can be specified. Automatic top/middle placement and manual block/shortcode embedding are documented. Local lead storage is an alternative to an email integration. Global success-cookie settings can unlock site content. | Broad selectors and automatic article gating offer convenience, but greatly expand failure and layout scope. Keep these as later evaluated extensions. |
| [Elementor content-lock popup documentation](https://elementor.com/help/how-to-create-a-content-lock-popup/) | An adjacent pattern uses a Yes/No popup, disables ordinary close routes, closes on Yes, and directs No elsewhere. This is a button-choice gate rather than the inline Lead-capture journey. | Whole-page blocking and confirmation buttons solve a different need. They should not determine this feature's conversion or accessibility contract. |

The common useful behaviors are a clear content boundary, immediate reward delivery, a reusable form, and recognition of a prior successful interaction. Competitors differ on scope, visual treatment, and recognition. We should specify those differences rather than treating “content locking” as one universal contract.

Several vendor pages make broad SEO claims. Do not reproduce them. Google's [subscription and paywalled-content documentation](https://developers.google.com/search/docs/appearance/structured-data/paywalled-content) describes markup for registration/subscription restrictions and explicitly distinguishes client-delivered content from content withheld from the browser. It does not promise a ranking outcome for this feature.

## 3. Merchant and visitor needs

| Need / scenario | Proposed answer |
|---|---|
| Blogger offers a checklist after a useful public article | Keep the article public; wrap the checklist; acknowledge capture and reveal in place. Primary v1 use case. |
| Publisher gates the latter section of an article | Wrap the selected remaining blocks manually. Allow it, while recommending enough public context to explain the exchange. |
| Consultant offers a sample report or worksheet | Gate a public sample or its link. If only a download is needed, the existing success-step resource link may already solve the problem without this feature. |
| Merchant offers a coupon | Prefer the existing coupon success action unless surrounding WordPress content itself needs revealing. No claim that a shown code is unique or valid. |
| Creator wants to gate a video | A wrapper may hide the embed visually, but cannot promise to stop scripts, downloads, autoplay, or third-party tracking. v1's supported authoring set is text, images, lists, tables, and ordinary links; rich active embeds need separate validation before support is claimed. |
| Agency uses Gutenberg or classic content | Provide the native region block and a paired shortcode with equivalent rendering. |
| Agency uses Elementor, Divi, or custom layouts | The shortcode must wrap one complete, balanced content region in one supported rendering boundary. No automatic selector discovery or promise that two shortcode halves in unrelated modules will work. |
| Reader already completed this Campaign on another eligible page | A valid family unlock receipt reveals the region without another form or new conversion. |
| Reader is already subscribed elsewhere or uses a new device | WConvert cannot establish that fact. A new form capture is allowed; Destination subscription state never decides access. Explain the browser scope without claiming subscriber verification. |
| Merchant wants one signup to unlock an entire library | Reuse the same Campaign across those pages for v1. Unlocking unrelated Campaigns globally is deferred. |
| Merchant wants paid membership, verified email, or private files | Outside this design. Public HTML, media URLs, feeds, and APIs are not access-controlled by a browser gate. |

These needs are hypotheses drawn from the documented use cases and WConvert's domain. Before release, validate the authoring flow with a real bonus-content page and an article-remainder page. Do not claim demand validation from the existence of competitor features.

## 4. Product decisions and first-release boundary

| Decision | Recommendation and reason |
|---|---|
| Format and Goal | Retain `inline` and the chosen Goal. Content lock is a placement behavior, not a new format, Goal, conversion step, or subscriber status. |
| Availability | Every paid Pro tier, disabled by default. Ordinary manual inline remains Free. |
| Compatible designs | A validated submit-metered inline design with the existing capture and terminal success flow. Click-only offers cannot unlock through an arbitrary click. No new field types. |
| Placement | Manual, explicit region only. Automatic inline placement and content locking are mutually exclusive. |
| Treatment | Hide the region; leave its public introduction outside the wrapper. Defer Blur until its accessibility, rendering cost, and media behavior justify it. |
| Unlock | Successful capture acknowledgement from the existing public capture endpoint. Never a button click, submitted event, pending request, or Destination delivery result. |
| Remembering | Fixed 30-day receipt per Campaign family, scoped to this WordPress site and browser. No global unlock switch, custom durations, or visitor identity in v1. |
| Multiple locks | At most one active locker on a document. Other wrappers remain readable with an inspector explanation. Multiple ordinary inline Campaigns retain their existing behavior. |
| Unavailable gate | Readable content, no invented conversion. Readers should never meet hidden content with no usable route through the gate. |
| Existing content | Never automatically rewrite saved posts or enclose them because a Campaign setting changed. The merchant explicitly places the new wrapper. |

The 30-day receipt is a convenience period, not a promise to re-lock on day 31. Existing targeting and frequency settings may continue to suppress the form, in which case the region remains readable. This is a deliberate consequence of preserving those settings.

Proposed stored shape: `config.content_lock = { mode: "hide" }`; absence means off. This is a closed value in v1, with no stored region HTML, duration, arbitrary selector, or template data. Strip unknown keys and normalize invalid/off values to absence. Publication rejects a retained setting whose Campaign, trigger, placement, or A/B family is incompatible. The payload carries only this validated non-default configuration plus any necessary family reference.

## 5. Merchant workflow

1. Create or edit a Campaign through the existing Goal-first flow and choose an inline submit design.
2. Under **Display rules → Placement**, choose **Content lock** alongside the existing manual and automatic choices. Internally it remains manual placement plus optional `config.content_lock`.
3. Explain the exchange: “Show this content after a successful form submission. If the form cannot load, the content stays available.” Show the same-browser remembering rule and the public-content limitation here.
4. Enabling requires the page-load trigger. Present trigger replacement as part of the explicit, undoable mode change; do not silently carry delay, scroll, click, or exit triggers into a content gate. Preserve page targeting, conditions, consent requirements, schedules, and frequency controls.
5. Edit form and success copy in the existing Design workspace. Offer a suitable inline starting point only if a review shows existing designs are inadequate. “Content unlocked” is accurate after reveal; “Subscription confirmed” is not.
6. In the WordPress post/page editor, insert **WConvert Content lock**, choose the published Campaign by name, and add or move the selected content into it. The block displays the boundary and ordinary editable child content; it does not introduce a second WConvert form designer.
7. Classic-editor users copy an enclosing shortcode from the placement guidance: `[wconvert_content_lock id="…"]…content…[/wconvert_content_lock]`. The existing empty `[wconvert_optin]` shortcode is unchanged.
8. Preview Locked, Unlocked, and Form unavailable states. The Campaign editor uses representative article content; the WordPress preview/real-page inspector shows the actual region. Preview never writes unlock receipts, Leads, or analytics.
9. Publication review names the placement, trigger rule, browser remembering behavior, and public fallback. It links to the real-page inspector and SEO integration guidance. It must not pretend a global scan proved that every page contains a correct wrapper.

Use ordinary WordPress post-editing capabilities for placing and editing the region. An author who can embed an existing Campaign does not thereby gain permission to modify its design, publishing state, or site settings. Preserve standard child-block sanitization and supported WordPress-version behavior.

Same-format design changes preserve locking only when the resulting design remains compatible. Incompatible changes require an explicit choice to turn locking off or cancel; a direct API write that retains incompatible locking is rejected at publication. Turning locking off opens saved regions and leaves the Campaign's ordinary inline anchor usable. Changing Display Type clears locking as part of the same undoable edit. Duplicating a Campaign copies settings into its normal draft state, but receives a new identity and no previous unlock receipts.

## 6. Region and rendering contract

Introduce a separate container block, tentatively `wconvert/content-lock`. The existing `wconvert/inline-optin` block remains an empty anchor. Its current `save: null` contract must not be copied into a block that owns valuable article content.

Save the child content using the normal InnerBlocks save path, with no persistent hidden state. A server callback can emit the region wrapper and a canonical inline anchor. WordPress documents [saved fallback markup and saving InnerBlocks for dynamic blocks](https://developer.wordpress.org/block-editor/getting-started/fundamentals/static-dynamic-rendering/); verify actual deactivation behavior with the supported child blocks.

Responsibilities:

- The WordPress wrapper owns **which content** belongs to the gate. Its attributes identify the Campaign, not arbitrary selectors or remote HTML.
- Campaign configuration owns **whether this inline presentation locks** and the fixed remembering policy. Template JSON owns the existing form/success appearance.
- The Pro controller owns temporary hidden state and its lifecycle. Hide a WConvert-owned inner wrapper, never mutate an arbitrary article ancestor or remove and rebuild child nodes.
- The content is delivered readable by default. No server-output `hidden`, persistent lock CSS, or inline script whose failure strands the region.
- Mount and bind a working form, establish cleanup and eligibility monitoring, then hide the owned region. If any of those operations fail, roll back to readable content.
- Keep the form outside the hidden region. Gate wrappers cannot nest or enclose another WConvert anchor; unsupported nesting leaves the affected subtree readable and produces diagnostics. The supported block inserter prevents this structure where possible.
- In v1, support manually authored singular post/page content. Archives, feeds, excerpts, REST output, secondary query loops, theme headers/footers, and widgets do not activate locks. Wrapper output remains readable there.
- Bound shortcode content processing and reject malformed/nested wrappers safely. Do not evaluate inner content twice or add a second pass through the entire article's content filter.
- Pro deactivation leaves saved child content visible. Free may provide the inert server fallback for this new authoring surface, but carries no premium gate controller, storage, or settings implementation. If all WConvert plugins are removed, saved standard block markup remains; classic shortcodes may leave visible delimiter text and require ordinary shortcode cleanup. Never promise clean removal of every third-party child block.

## 7. Visitor lifecycle and eligibility

Use distinct states: `open_initial`, `locked`, `submitting`, `unlocked_capture`, `unlocked_remembered`, and `open_fallback`. The last three are terminal for gating within a document. An `open_fallback` is not a conversion and must never be persisted as a successful unlock.

At DOM readiness and the initial normal eligibility evaluation, inspect the explicit region and selected Campaign arm. A remembered unlock opens the content without mounting the gate. Otherwise, only a currently ready, renderable, compatible Campaign may claim the region. A blocked, waiting, capped, missing, or malformed gate leaves the content readable for this document. Do not wait for a later scroll, consent change, or audience change and then take already-available content away.

If eligible locked content is already focused or being interacted with when delayed initialization reaches it, skip locking. Delayed scripts may expose content before initialization; this is an accepted limitation of readable-by-default delivery. Do not claim zero flash or zero layout movement. Document optimizer exclusions and measure delayed-load behavior before release.

Once locked, observe only the rules necessary to detect lost eligibility. If consent, conditions, or schedule make the gate unavailable, open the region and retain that decision for the document. Restoring eligibility never re-locks it. Exclude impression/frequency changes caused by this gate itself from this live invalidation check; otherwise its first impression could immediately remove its own gate.

| Event or condition | Required result |
|---|---|
| New eligible visitor, working form, no receipt | Show form and lock exactly the selected region. Rest of page remains usable. |
| Valid receipt before normal frequency checks | Open region; no gate impression, new capture, or conversion. |
| Invalid required input or known field/consent refusal | Keep region locked, preserve values, provide existing field feedback and an explicit retry path. |
| Form submitted | Stay locked while the request is pending. Reuse busy state and duplicate-submit prevention. |
| Successful HTTP response with the expected nonempty Lead ID | Open region, store the receipt, count one normal conversion, and show the existing terminal success step. Reveal must not depend on analytics delivery or storage success. |
| Destination is delayed, fails, or rejects an existing subscriber | Already acknowledged local capture still unlocks. No subscriber-state read and no later re-lock. |
| Timeout, offline transport failure, malformed success response, server outage, rate limit, or unclassified refusal | Open as fallback; preserve truthful submission feedback and entered values for optional retry. No receipt and no invented conversion. |
| Missing endpoint, broken template, unsupported form, failed mount, or controller cleanup | Open fallback. No hidden orphan region. |
| Pending request while eligibility is lost | Open fallback, stop future gating, retain the in-flight request and truthful result handling. A genuine later acknowledgement still counts the capture and can remember access; do not pretend the request was cancelled server-side. |
| Navigation destroys an unacknowledged request | No persisted form data, replay queue, or assumed success. The server may already have stored a Lead; the existing retry/duplicate limitation remains. |
| Reload or another page using the same family | Valid receipt restores readable content. Without usable storage, ordinary eligibility applies afresh. |
| Receipt expires while the reader is on the page | Keep the content open for this document. Re-evaluate only on a new document. |
| Storage throws, quota is exceeded, or browser is private | Successful reveal still works in memory. Do not promise remembering across reloads or devices. |
| Campaign missing, unpublished, removed, excluded, suspended, or outside schedule | Open region. Cached pages may contain stale configuration until normal cache expiry/purge; no new per-view freshness request is introduced. |
| Prior conversion exists only in generic frequency state | Do not manufacture an unlock receipt. If frequency suppresses the gate, content is open because the gate is unavailable. |
| Reader declines marketing consent required by the form | No submission or conversion; ordinary validation remains. The rest of the page is usable. Do not infer consent from reading or unlocking. |
| User follows a fragment into gated content | Keep a visible gate explanation at the boundary; do not hide the entire page or automatically scroll repeatedly. Browser and keyboard behavior require fixtures. |
| Back/forward cache restores a document | Preserve conversion/impression guards and already-open state; revalidate a still-locked gate's availability without duplicating listeners or locking again after release. |

Technical failures and correctable refusals must be distinguishable through a typed capture outcome. The current `onCaptured` callback alone is insufficient. Add a generic failure outcome seam without changing ordinary Campaign behavior, and have Pro consume it for fallback. Maintain a closed list of known correctable field/consent errors; an unknown refusal must not create an indefinite lock.

## 8. Multiple placements, A/B tests, and other campaigns

- Discover candidate wrappers in document order after DOM readiness. The first valid, eligible, successfully mounted locker claims the one locker slot. Invalid, remembered-open, and otherwise unavailable wrappers do not consume it. Other regions stay open. Once claimed, the slot is not reassigned after completion or teardown on that document.
- Preserve the existing first-anchor behavior for one Campaign family. If an ordinary manual anchor precedes that family's lock anchor, it remains the rendering anchor and the lock region stays open with a clear reason. Do not silently move a form away from where it was embedded.
- A lock wrapper's manual anchor suppresses automatic placement for the same family, consistently with ADR 0099. Configuration rejects enabling both automatic placement and content locking, but runtime still handles stale/corrupt combinations safely.
- The locker slot is separate from automatic-inline selection and overlay arbitration. Other ordinary forms and the existing single overlay remain governed by their current rules. Do not introduce an implicit global popup-suppression policy.
- Where the tier supports A/B testing, run existing assignment once before mounting. All active family arms must be inline submit designs with the same lock mode; design/copy may differ. Publishing/starting a mixed incompatible family is rejected, and corrupted payloads leave content open.
- Attribute the impression and conversion to the selected arm. Remember successful access against the stable parent Campaign family. Ending the test or choosing a winner within that family should not ask the visitor to submit again.
- Projection currently supplies `campaign` for teaser families and `anchor` for inline child arms. Define family resolution explicitly for content locking rather than importing an accidental assumption from the teaser implementation.
- Any acknowledged submit through a compatible lock-enabled Campaign family can write its unlock receipt, including an ordinary manual placement of that Campaign. A generic conversion callback or unrelated Campaign cannot do so.

## 9. Remembered access and data boundaries

Recommended v1 receipt: one bounded, versioned, site-scoped localStorage map of public Campaign-family ID to expiry day. Scope the key using the site's canonical capture endpoint, as existing recovery state does for same-origin WordPress installations. Use whole days, not precise timestamps.

- Default lifetime is 30 days from acknowledged capture; passive reading does not extend it.
- At most 64 entries and 8 KiB serialized input. Validate shape, IDs, and expiry bounds; discard malformed/expired entries and evict earliest expiry at capacity. Eviction can reduce remembering and never creates an unlock for another family.
- Read and write defensively; memory fallback always works for the current document. No cookie fallback for this new receipt store, avoiding another per-request cookie and revival of deleted local receipts from a second store.
- No Lead ID, email, phone, visitor ID, URL history, submitted fields, or article text in the receipt. Do not query Lead history to reconstruct access. Receipts never travel in analytics.
- Re-read before deciding on navigation/pageshow. A valid same-origin storage event may release an already-locked region in another tab. Removing or expiring a receipt never re-locks the current document. No cross-device or cross-subdomain guarantee.
- Merge validated current storage before a write and keep newly acknowledged access in document memory. Concurrent tab writes are best-effort because localStorage does not provide transactional merging; loss of a receipt may reduce future remembering but never reverses an already-open region or invents a capture.
- No remote revocation or per-visitor entitlement endpoint. Normal republishing does not invalidate receipts. A new Campaign identity starts a new exchange; edits to content under an existing family remain covered during its receipt period.
- Treat remembering a requested unlock as functional state within the project's current storage model. This is a proposed product classification to document alongside existing exceptions, not a legal conclusion or a new marketing-consent grant.
- Explain the new store and its retention in Data & privacy and suggested privacy text. Keep marketing consent and WP Consent API-controlled rule eligibility separate from capture success.

Do not reuse `wcv1.c` as the receipt: it can represent a click conversion, is arm-scoped, and has no unlock expiry. Do not reuse the reopen button's session-stop list: it represents a different action and lifetime. This proposal therefore needs an explicit ADR 0017/Storage Consent amendment for Pro's additional bounded persistent state before implementation is considered settled.

## 10. Accessibility, content integrity, and search

The gate is in normal document flow. It does not trap focus, lock page scrolling, open a modal, intercept Escape, or cover navigation. Its explanation identifies what submitting reveals.

Hide the owned region with semantics that remove its descendants from both keyboard navigation and the accessibility tree. Do not implement the gate with opacity, visual blur, or `aria-hidden` alone. Avoid `hidden="until-found"`, which can reveal content through find/fragment navigation. MDN describes the distinction in its [hidden attribute reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden). Verify computed visibility against hostile theme styles; if the boundary cannot be hidden correctly, abandon the gate and keep it readable.

On successful submission, reveal first, present a concise polite acknowledgement, and keep the normal success view. If the replaced form held focus, move it to the acknowledgement with `preventScroll`; if the visitor has moved focus elsewhere during the request, do not steal it. Offer a keyboard-operable **Continue to content** action that focuses the region heading/start only when activated. Restored remembered access never auto-focuses. A technical fallback uses truthful error wording, not the success announcement.

Keep original DOM nodes and author-set attributes intact; final cleanup removes only owned state and listeners. No blanket rewriting of child `tabindex`, existing `aria-hidden`, styles, or IDs. Do not auto-start media on reveal. Nested forms, interactive application blocks, embeds that execute while hidden, and third-party dynamic widgets are not included in the initial compatibility claim.

The HTML and direct media URLs remain public. Feeds, REST responses, excerpts, print, browser reader mode, and scripts-disabled pages may expose the material. Test and document that limit; do not add bot-specific rendering, claim secure downloads, or promise that page source cannot reveal content.

For publishers who want gated sections indexed, provide a stable wrapper class and integration guidance for their existing Article/WebPage schema owner, based on [Google's registration/subscription markup guidance](https://developers.google.com/search/docs/appearance/structured-data/paywalled-content). Do not blindly emit a second competing Article entity. Include an example and validate an integrated page with the applicable structured-data tooling. No “100% SEO friendly” or guaranteed conversion-lift claim.

## 11. Engineering seams and compatibility

Inspected baseline: local `main` at `077d8c3`, including merged reopen-button PR #179. These paths identify current seams, not a requirement to preserve every interface unchanged.

| Area | Current seam and planned work |
|---|---|
| Configuration | Add a closed optional `content_lock` configuration, omitted when off; validate inline/submit/manual/page-load compatibility. Keep it in existing Campaign config JSON. |
| Projection | Extend `src/Optin/PublishedProjection.php` with only the necessary setting and stable family reference. Article content stays in page HTML, never the Campaign payload. |
| Authoring | Add the container block and paired shortcode beside existing frontend placement services. Share one region renderer. Save child content and provide inert Free fallback; put Pro editor behavior in the paid module. |
| Presentation | Compose a content-lock controller through `resources/loader/src/types.ts` presentation sessions and Pro's presenter, preserving existing automatic placement and recovery composition. Avoid a second loader or payload parser. |
| Capture | Generalize `resources/loader/src/capture.ts` outcome reporting and `present.ts` capture binding so only acknowledged submit writes access state. Keep ordinary form feedback and timeout semantics. |
| Lifecycle | The current shell stops rule listeners after candidates settle. A locked region requires an explicit monitoring lifetime and idempotent disposal; reuse/generalize session seams instead of leaving every trigger active. |
| Eligibility | Reuse current decision functions for initial readiness; use a clearly scoped live availability check after mount. Inspector and runtime share the same result/reason model. |
| Receipts | New small Pro-only module, separate from `wcv1` and teaser state, with site scoping, validation, bounds, and memory fallback. |
| Inspector | Explain locked, remembered-open, fallback-open, missing/malformed region, unavailable Campaign, first-anchor conflict, unsupported nesting, and another locker owning the slot. Expose no form data. |
| Analytics | Retain impression, conversion, dismiss daily counters. Do not add unlock, bypass, unique-reader, or recovered-revenue metrics. |
| Build | New module in all paid tier compositions; Free source/artifact scans prove absence of premium runtime and storage logic. |

One impression occurs when the gate form actually enters the viewport, using the existing inline contract. Hiding content itself is not an impression. Capture records the existing single conversion; repeat reveal, receipt restoration, technical fallback, and success-step actions produce none. Preserve current per-document guards and existing fallback behavior when IntersectionObserver is unavailable. Do not reinterpret absence of a conversion as a unique reader who abandoned content.

No new database table, column, remote service, per-visitor request, or server session. Existing template JSON remains valid. No visual token is added unless an actual reviewed design proves the current vocabulary insufficient.

Record the final decision in a new ADR and amend affected records inline in the implementation: ADR 0017 (storage), ADR 0073 (capture result and truthful failure), ADR 0099 (placement interaction and future-phase wording), ADR 0100 (new region authoring surface), and the Anchor/Storage Consent glossary. Reaffirm ADRs 0004, 0019, 0028, and 0047. Existing empty-anchor contracts remain true for ordinary embeds; explicitly name the new region contract rather than rewriting history as though all anchors owned content.

## 12. Delivery sequence

Each implementation slice must produce a complete, reviewable behavior with its own tests. The overall feature is complete only after all release slices below.

1. **Prove the explicit-region journey.** Finalize the proposed ADR/config contract; deliver the native block, saved-content fallback, compatible Campaign setting, actual capture/reveal, basic inspector states, and Free/Pro boundaries. Verify one real WordPress page through success, field refusal, missing Campaign, and Pro deactivation. Demonstrates a full journey across authoring, publishing, runtime, and capture.
2. **Complete return visits and experiment behavior.** Add bounded family receipts, reload/cross-page continuity, blocked storage behavior, compatible A/B family validation, first-anchor conflicts, duplicate/nested wrapper handling, and terminal per-document state. Demonstrate two pages and a returning reader without an extra Lead.
3. **Complete resilience and classic authoring.** Add the paired shortcode using the same region contract, typed technical-failure fallback, live loss of eligibility, pending-request behavior, optimizer/cached-page handling, and back/forward lifecycle. Demonstrate an outage and a delayed loader without stranded content.
4. **Complete merchant guidance and release verification.** Finish the three preview states, publication guidance, accessibility review, privacy/storage and SEO guidance, full browser/WordPress fixtures, regression coverage, production builds, and required CI. Include real examples of a bonus region and an article remainder.

Before starting slice 1, turn this reviewed plan into a separate implementation ticket under #165, with the agreed scope and acceptance criteria. Do not mark #165's evaluation item complete merely because a prototype renders a form. No lower-priority Display Types are included.

## 13. Verification and acceptance

Domain and PHP checks:

- Config validation, omitted-off projection, incompatible-format/action/trigger rejection, same-design preservation, atomic mode switches and undo, and duplication.
- Stable family projection and mixed-arm refusal; cache-independent region output; block/shortcode parity; unchanged post content; bounded malformed/nested shortcode handling.
- Inert fallback in Free, inactive/suspended/deleted Campaigns, and missing Pro; no new database storage; saved InnerBlocks remain recoverable.

Runtime contracts:

- All lifecycle-table transitions, including acknowledged success after availability loss, timeout without assumed failure-to-save, genuine success despite storage/beacon failure, and idempotent cleanup.
- Per-document terminal open states; no late re-lock after consent, condition, schedule, receipt expiry, or receipt removal.
- One locker slot; ordinary inline and automatic selection remain correct; overlay/reopen arbitration unchanged; per-arm analytics and family receipts.
- Receipt bounds/corruption, site isolation, capacity eviction, expiry, blocked storage, pageshow/storage events, and no personal fields in stored bytes.

Real browser and WordPress checks:

- Classic and block themes; native block and classic shortcode; 320px mobile and desktop; LTR/RTL; long translations, zoom, reduced motion, keyboard-only, and a manual screen-reader pass.
- Locked descendants cannot be focused or read by assistive technology; error and success announcements are accurate; focus only moves when appropriate; outside page navigation remains available.
- Pro off, Free only, both plugins off for saved static children, JavaScript off, missing assets, optimizer relocation/delay, stale cached page, malformed payload, and duplicate boot.
- Offline/slow response, validation rejection, 429, 5xx, ambiguous response, double submission, navigation during capture, and failed outbound Destination after successful local capture.
- Existing ordinary inline, automatic placement, A/B, popup/fullscreen, reopen, and form-success browser contracts continue to pass.
- Measure layout movement at activation/reveal and verify no repeated shifting. A known content flash under delayed JS must be documented, not reported as a zero-flash success.

Build and release gates:

- The current enforced gzip-9 ceilings are **14,012 bytes for Free and 18,432 bytes for each paid loader**, from `bin/check-loader.mjs`. Measure actual builds and the new feature's delta; do not substitute the older ADR 0099 budget.
- Pass existing payload scaling, source boundaries, artifact contracts, production builds, and `CI / Required checks`. Do not silently raise a budget or introduce a lazy visitor chunk to avoid the gate. A necessary budget change must be measured and explicitly included in the implementation review.
- Validate actual activation, authoring, publication, capture, remembering, fallback, and deactivation on a real WordPress installation. Unit tests alone do not establish that this journey works.

Completion means a merchant can publish a clearly bounded inline gate, a visitor can unlock and return without repeated capture within the stated browser policy, an unavailable gate leaves usable content, counters remain truthful, and ordinary Campaigns and saved content remain intact.

## 14. Explicitly deferred decisions

- Automatic “lock everything after paragraph N”: evaluate after the explicit-region release, using real merchant demand and the existing rendered-content parser. It needs a precise end boundary and builder compatibility contract.
- Blur preview: evaluate a bounded treatment, hidden descendant semantics, media behavior, and performance rather than merely adding a CSS filter.
- Multiple independent active locks on one page, nested gates, global unlock across unrelated Campaigns, configurable retention, and signed newsletter bypass links.
- Rich embed/script deferral, private download delivery, account login, payment, subscription verification, email confirmation, and cross-device entitlements.
- New Display Types, forced fullscreen gates, social/share gates, and new analytics funnels.

The principal trade-off to review is explicit: this first release prioritizes a predictable selected region and readable failure behavior over automatic whole-article gating and strict access enforcement. The proposed defaults above resolve the initial product choices; they can be revised in the implementation ticket before code begins.
