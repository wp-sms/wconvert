# Inline content locking: implementation and UX follow-up plan

Date: 20 September 2026. Parent: [#165](https://github.com/wp-sms/wconvert/issues/165).

Status: the original implementation was delivered through #180 / PR #181. The UX follow-up in section 15 was researched and authorized on 20 September 2026. Local implementation and verification are recorded in sections 17–19. The manual divider in section 19 supersedes the earlier prototype-only scope. Earlier sections record the original feature contract, with authoring guidance updated to match the follow-up. Competitor findings are documentation research, not runtime testing. This plan update is local only; PR changes require user confirmation.

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
| [Bloom locked-content documentation](https://help.elegantthemes.com/en/articles/8607755-using-the-bloom-locked-content-opt-in) and [shortcode setup](https://help.elegantthemes.com/en/articles/8600681-creating-and-using-shortcodes-in-bloom) | Locked Content is a distinct opt-in type. Its generated shortcode encloses a resource link or article section. Setup includes selecting an email service/list. The reviewed page does not specify retry, storage-failure, or remembered-access details. | Adopt the explicit boundary without adding a sixth WConvert Display Type or requiring a Destination for local capture. |
| [MailOptin content-locking documentation](https://mailoptin.io/article/setup-wordpress-content-locking/) | In-post campaigns hide or blur content below the form; additional CSS selectors can be specified. Automatic top/middle placement and manual block/shortcode embedding are documented. Local lead storage is an alternative to an email integration. Global success-cookie settings can unlock site content. | Broad selectors and automatic article gating offer convenience, but greatly expand failure and layout scope. Keep these as later evaluated extensions. |
| [Gravity Wiz Submit to Access](https://gravitywiz.com/documentation/gravity-forms-submit-to-access/) | Its documentation lists version 1.0.17, updated 7 May 2026. Authors enable gating in post or individual block settings and choose the required form. Shortcode placement is also supported. Its access-control scope is broader than WConvert promotional gating. | Make existing-content setup possible directly from the selected blocks. Borrow the low-friction authoring idea without implying equivalent protected access or payment support. |
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
6. In the WordPress post/page editor, insert **WConvert Content lock**, choose a published, lock-enabled Campaign by name, and add content inside it. For existing supported blocks, **Transform to → WConvert Content lock** performs the enclosing step in place; it must preserve content and support Undo. The block displays the boundary and ordinary editable child content; it does not introduce a second WConvert form designer.
7. Classic-editor users copy an enclosing shortcode from the placement guidance: `[wconvert_content_lock id="…"]…content…[/wconvert_content_lock]`. The existing empty `[wconvert_optin]` shortcode is unchanged.
8. Preview Locked, Unlocked, and Form unavailable states in the existing right-hand Campaign preview, with a visible sample-content label. WordPress editing/preview shows the actual content and layout, but preview contexts intentionally remain readable; test actual gating on a published page with an eligible fresh visitor and the real-page inspector. Campaign simulation never writes unlock receipts, Leads, or analytics.
9. Publication review names the placement and gives the next action: add or wrap the content in the WordPress page editor. Keep remembering, fallback and SEO details in expandable help or future WConvert documentation. The Google guidance link was admin-only and has been removed in the local UI cleanup. Until real documentation exists, use in-product help rather than a dead `#` link. Do not imply a global scan proved that every page contains a correct wrapper.

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

Historical delivery sequence for #180 / PR #181. These slices describe the original feature, not new work to repeat. Section 15 defines the next UX work.

1. **Prove the explicit-region journey.** Finalize the proposed ADR/config contract; deliver the native block, saved-content fallback, compatible Campaign setting, actual capture/reveal, basic inspector states, and Free/Pro boundaries. Verify one real WordPress page through success, field refusal, missing Campaign, and Pro deactivation. Demonstrates a full journey across authoring, publishing, runtime, and capture.
2. **Complete return visits and experiment behavior.** Add bounded family receipts, reload/cross-page continuity, blocked storage behavior, compatible A/B family validation, first-anchor conflicts, duplicate/nested wrapper handling, and terminal per-document state. Demonstrate two pages and a returning reader without an extra Lead.
3. **Complete resilience and classic authoring.** Add the paired shortcode using the same region contract, typed technical-failure fallback, live loss of eligibility, pending-request behavior, optimizer/cached-page handling, and back/forward lifecycle. Demonstrate an outage and a delayed loader without stranded content.
4. **Complete merchant guidance and release verification.** Finish the three preview states, publication guidance, accessibility review, privacy/storage and SEO guidance, full browser/WordPress fixtures, regression coverage, production builds, and required CI. Include real examples of a bonus region and an article remainder.

The original implementation ticket was #180 under #165. Do not reopen or repeat that work as part of the UX follow-up. No lower-priority Display Types are included.

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

The principal trade-off to review is explicit: this first release prioritizes a predictable selected region and readable failure behavior over automatic whole-article gating and strict access enforcement. The implemented runtime defaults remain in force. Section 15 improves authoring without changing those defaults.


## 15. UX follow-up: make selecting and placing content easier

### Evidence and decision

Research refreshed on 20 September 2026 against the official sources in section 2 and the WordPress sources below. Retrieval date does not mean every vendor recently changed its product. This is a design recommendation to validate with users, not a measured usability result.

Keep the explicit content container as the underlying model. Promote **select existing blocks, wrap them, choose a Campaign** into the next delivery scope rather than leaving it as an unspecified future convenience. New content still starts with an empty Content lock block. No manual copying or rewriting should be required for supported existing content.

WordPress already teaches selecting multiple blocks and grouping them in its [Group block documentation](https://wordpress.org/documentation/article/group-block/). Its [block transforms reference](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-transforms/) documents multi-block transforms and ungrouping (page last updated 17 August 2026). Prefer that native interaction where it preserves the selected block objects; verify the exact extension point on supported versions before committing to a custom toolbar action. These APIs establish feasibility, not a guarantee that our mixed-block wrapping implementation already works.

Thrive and Bloom support an explicit enclosing region. OptinMonster and MailOptin provide convenient content-below placement, with different container and selector rules. Gravity Wiz demonstrates a more direct authoring entry point on existing blocks. Our inference: reduce the work of making an explicit selection before adding automatic article-wide behavior.

### Baseline before the UX follow-up

- Implemented: saved InnerBlocks container, enclosing shortcode, capture/reveal, remembered access, readable fallback and ordinary inline form reuse.
- Local cleanup complete: settings overflow fixed, helper copy shortened, detailed setup collapsed, placement em dashes removed, Google button removed. Those changes remain unpushed.
- Pending at that baseline: moving the example to the right-hand preview, wrapping/unwrapping selected blocks, and better Campaign selection/recovery. These are now implemented locally; see section 17.
- Before this follow-up, the block called `publishedInlineOptins()`, which supplies only IDs and names for all published inline Campaigns. It cannot identify lock-ready Campaigns, distinguish temporary suspension, or refresh after another tab publishes one. Its generic instruction is not a substitute for readiness information.
- `InnerBlocks.allowedBlocks` limits direct children, as the [WordPress nested-block documentation](https://developer.wordpress.org/block-editor/how-to-guides/block-tutorial/nested-blocks-inner-blocks/) explains. It does not prove that pasted or transformed descendants are supported. Preserve the current static-content boundary; validate complete selections before wrapping.

### Recommended authoring experience

| Situation | Planned experience |
|---|---|
| New bonus content | Insert Content lock, choose the Campaign, write inside the clearly labelled region. Keep the public introduction outside. |
| Existing article section | Select supported sibling blocks, choose **Transform to → WConvert Content lock**, then choose the Campaign. Preserve order, attributes, links, formatting and nested list/button children. One Undo restores the previous structure. |
| Remove a lock | Offer a native ungroup/unwrap action that keeps all child content. Removing the entire block retains normal WordPress delete behavior; distinguish these actions clearly. |
| One eligible Campaign | Keep the choice explicit, with a single obvious named option; do not silently connect a Campaign just because it is the only one. |
| Many Campaigns | Offer search by name using a native accessible WordPress control. Keep the ordinary inline picker unchanged. |
| No suitable Campaign | Explain **No published Content lock Campaigns yet**. Users with Campaign-management permission can open the Campaign list in a new tab and create one; authors without it get an instruction to ask the site administrator. Content remains editable. |
| Newly published Campaign in another tab | Provide **Refresh Campaigns** without reloading the post editor or losing unsaved content. Specify the narrow read permission and data delivery before implementation; do not reuse an admin-only API for Authors. |
| Previously selected Campaign changed or disappeared | Keep its saved ID and content. Explain unpublished, locking-disabled, temporarily unavailable and unreadable-list states accurately, with a repair action appropriate to the user's permissions. Never silently substitute another Campaign. |
| Duplicate or nested region | Explain the one-region limit in the editor before publication. Do not discard pasted content or claim a second region will be locked. Keep the existing runtime fallback. |
| Unsupported blocks, Group/Columns, synced patterns or active embeds | Do not offer a transform that drops or flattens content. Initial wrapping supports the existing validated set. Preserve an unsupported selection and explain the limit. Broader layout support requires a separate preservation/compatibility check. |
| Classic Editor | Keep the enclosing shortcode under **Classic editor**, with a copy action and a short example. Both ends must enclose one complete region. |
| Elementor/Divi or a private download | Do not claim Gutenberg coverage applies. Test builder-specific placement separately; private delivery remains a different feature. For a simple public download, first consider the existing success-step link. |

Campaign readiness comes from the published snapshot and existing compatibility/family rules, not the current draft. Offer ready published lock Campaigns for new selection; retain an existing unavailable selection with its status. Readiness here means configured for locking, not guaranteed eligible for every visitor. Schedule, audience and frequency can still leave content readable.

### Preview and copy

Use one preview in the existing right-hand workspace. Place **Locked**, **Unlocked**, and **Form unavailable** controls above it when inspecting Content lock placement. Reuse the form renderer; preserve the normal Design editing workflow and avoid a second simultaneous form preview. Preview-state changes are simulation state only and do not dirty the Campaign or alter its design step.

Show sample introduction/content around the form and label it **Example content**. WConvert cannot know the actual page content from a reusable Campaign alone. Viewing a WordPress draft confirms content layout; verifying visitor gating requires the actual published page. At narrower supported editor widths, stack or use the existing preview switcher instead of squeezing a full form into the settings column. Preserve keyboard navigation and focus when switching views.

Keep the initial placement help to an action and one material limitation:

> Publish this Campaign, then add a Content lock block to your page or wrap existing blocks. Choose this Campaign and update the page.
>
> Content stays readable if the form is unavailable. Private content is not protected.

Use the published variant without the first publishing instruction. Keep 30-day browser remembering, one-region guidance, shortcode help and targeting exceptions under **Setup details**, with the one-region constraint also shown contextually when violated. Do not remove information the user needs to correct a problem. Avoid em dashes in new UI copy.

Use **WConvert Content lock** or **Wrap in Content lock** for the action; do not reuse WordPress’s generic Lock control, which concerns editing/moving blocks. The post-editor region gets a compact **Revealed after submission** label and selected Campaign name. Explain “Enable Content lock in the Campaign” only for that actual configuration problem, not as a permanent notice on every valid block. Future WConvert docs can hold SEO and advanced compatibility guidance. Until those pages exist, omit the external link; a `#` link does not provide help.

### Delivery order and implementation seams

1. **Unify preview and placement help.** Move the local settings example into the existing right-hand preview with the three simulation states and sample-content label. Keep the overflow regression and verify normal inline/Design preview behavior. No visitor-runtime changes.
2. **Make Campaign selection trustworthy.** Extend the block-editor list service with the smallest published readiness/status metadata. Specify and implement the permission-limited refresh path, empty/recovery states, and permission-aware create/edit links. Reuse existing Campaign creation and publishing; no nested form designer or automatic publication. Record any change from enqueue-only list delivery in the relevant ADR alongside implementation.
3. **Make existing content easy to wrap and unwrap.** First prove native transform/ungroup behavior on representative mixed selections. Implement one undoable mutation of the current post draft only. Keep child objects/serialization and never flatten HTML to recreate the selection. Do not mutate other posts, infer an article boundary, or auto-enable a shared Campaign. Update ADR 0102 authoring details if implementation changes its supported content contract.
4. **Verify the two end-to-end authoring paths and prepare concise help.** Cover new content and an existing article section, then the permission/recovery cases below. Keep website documentation drafts local until a real hosting destination exists. PR creation or updates still require user confirmation.

Primary seams: `pro/modules/content-lock/block/index.tsx`, the block-editor list in `src/Frontend/InlineOptinBlock.php` / `resources/blocks/inline-optin/src/optins.ts`, `LockSettings.tsx`, and the existing Campaign preview composition. Preserve premium boundaries, ordinary manual embed behavior and saved-content fallback. No new storage, visitor entitlement model or global content scan.

### Acceptance and usability checks

- A first-time editor can complete both **new checklist** and **lock an existing article section** using on-screen instructions, without writing a shortcode or rebuilding the content. Conduct a small observed usability check; record task completion, wrong turns and requests for help. This has not yet been done.
- Wrapping, unwrapping, Undo/Redo, saving and reopening preserve all supported content and its order/attributes. Reject unsupported transforms before mutation. Verify list view, keyboard selection and focus recovery.
- Cover zero, one and many eligible Campaigns; missing list data; refresh failure; unpublished/deleted/lock-disabled Campaigns; temporary suspension; and a Campaign published in another tab while the post has unsaved edits. No content or selection loss.
- Authors can place a ready Campaign without gaining permission to edit or publish it. Refresh exposes only allowed picker data. Ordinary inline blocks keep their existing list and behavior.
- Test narrow and wide editor layouts, RTL, zoom and all three preview states. Preview simulation writes no Leads, receipts or analytics. Changing tabs preserves Campaign and preview state appropriately.
- Verify the published page for an eligible fresh visitor, acknowledged submission, return visit and unavailable form. A readable WordPress draft preview must not be mistaken for a failed lock.
- Check block APIs against the declared WordPress 6.2 floor and the currently supported release. The browser fixture is pinned to 6.8.3, so it alone cannot establish both. ADR 0100 already records an activation dependency mismatch below 6.5; report that blocker separately rather than silently raising the floor or claiming full minimum-version coverage.

Automatic remainder locking, blur, arbitrary block toggles, Group/Columns expansion, native page-builder widgets and protected downloads stay outside this follow-up. Revisit automatic placement if observed authoring difficulty remains after wrapping is available or users need repeated rules across many articles.


## 16. Block reuse and automatic remainder locking

### One block type, many placements

There is one registered **WConvert Content lock** block type, not a separate block type for each Campaign. Each inserted instance stores its selected Campaign ID and its own child content. A Campaign supplies the form and locking configuration; the post owns the content. One published Campaign can therefore be selected on multiple pages without copying the content or creating new block types.

The current supported limit is one active locked region per page across all Campaigns. Repeated or nested regions are not independent working gates; preserve the existing readable fallback and make the limit visible while authoring. A saved block is not automatically a synced pattern, and changing content on one page does not change another page. Updating the Campaign's published form affects its placements, subject to the existing serving/cache lifecycle.

| Scenario | Expected behavior |
|---|---|
| Ten articles share the same newsletter offer | Select the same Campaign in one region on each article. Each region owns different article content. A successful unlock is remembered for that Campaign family across eligible pages in the same browser for 30 days. |
| Two resources should ask separately | Use separate Campaigns on their respective pages. A receipt for Campaign A does not unlock Campaign B. A/B arms retain their existing shared family receipt. |
| Two unrelated offers on one page | Multiple ordinary inline forms are possible; two independent active content gates are outside current scope. Do not present two lock blocks as supported independent gates. |
| An editor duplicates a page | Its copied block still names the original Campaign, so it shares remembered access. Explain this when relevant; a copied page does not create a new Campaign. |
| Campaign design changes | The page's gated content stays in the post. Publishing a form change updates the reusable Campaign, not the saved article content. |
| The same subscriber uses another device | No identity lookup or cross-device unlock. The browser receipt model remains explicit. |

### Distinguish three different placement ideas

| Approach | Merchant action | Assessment |
|---|---|---|
| Explicit region, current model | Add a container or transform selected blocks into WConvert Content lock. | Implemented default, with local UX improvements in section 17. Predictable for a bonus section or selected article remainder. |
| Manually placed start marker | Insert a marker that gates following content to the article boundary. | Easier initial placement but still requires editing every article. Adds ambiguous end boundaries and future-content behavior. The manual divider was prototyped in section 18 and implemented locally after approval in section 19. |
| Automatic article remainder | Choose a Campaign, eligible posts/categories and an insertion point such as after three paragraphs. | Valuable for publishers applying the same exchange across many standard articles. Recommended as a separately scoped later option, disabled by default; not implemented or part of the current UX delivery. |

A possible later automatic flow is **Content lock → Automatic article remainder → After 3 paragraphs → Choose posts/categories → Review representative pages → Publish**. The reader sees the introduction, then the form; the supported article remainder is hidden until acknowledged capture. Navigation, sidebars, footer and comments outside that article region stay available. No saved post is rewritten. This requires an explicit amendment to the current rule that automatic placement and Content lock are mutually exclusive; the existing Automatic option only places a form and must not start gating because of this plan.

OptinMonster documents gating below its inline embed within the same container, with page-builder container limitations. MailOptin documents automatic top/middle insertion plus additional selectors. These are evidence of the convenience and compatibility trade-off, not proof of demand or a tested WConvert implementation. See the official source links in section 2.

Before implementing automatic remainder locking, establish these acceptance boundaries:

- One precisely owned main article region, a documented paragraph-count rule, and a safe end boundary. Never hide arbitrary later page DOM. If a safe boundary cannot be established, leave content readable and explain why in the inspector.
- Posts/categories are an explicit merchant choice. Provide exclusions and an actual-page inspection path; the generic Campaign preview cannot certify every article layout.
- A short article with fewer than the selected paragraph count, or no meaningful remainder, stays ungated. Do not unexpectedly gate the whole article or place an empty reward behind the form.
- Initially limit compatibility to validated standard post content. Embedded applications, forms, nested layouts and builder output need specific checks; skip unsupported regions rather than breaking them.
- An explicit content region takes precedence on that page. Resolve competing automatic Campaigns to one winner using documented priority; keep ordinary manual-anchor precedence and the one-active-lock rule. Final precedence must be specified and regression-tested before changing runtime behavior.
- Reuse acknowledged capture, remembered access and readable failure behavior. Eligibility/frequency rules can leave content readable. No global subscriber recognition or protected-content claim.
- Verify representative long/short posts, plugin-inserted content, cached pages, delayed scripts, accessibility and deactivation. Validate with publishers who need repeated article gating before committing to the feature.

Decision: ship the explicit-region UX improvements first. Keep automatic article remainder as a named follow-up for bulk publishing needs, with the above boundaries, rather than rejecting it permanently or quietly including it in the current implementation.


## 17. Local UX implementation and verification

Implemented on 20 September 2026 in the local `codex/content-lock-ui-cleanup` checkout. No PR or remote branch has been updated.

### What changed

- Content lock now uses the right-hand Campaign canvas on **Display rules → Placement → Content lock**. The controls simulate Locked, Unlocked and Form unavailable. The form uses the shared preview renderer, surrounded by labelled example content. These controls hold separate local state and do not change the Campaign design or visitor state. Narrow layouts stack the settings and canvas.
- Placement help is shorter, with secondary details collapsed. Related Design, Destinations and Display rules helper copy was shortened. The admin-only Google guidance button and placement em dashes were removed. No dead documentation link was added.
- One reusable **WConvert Content lock** block still owns a selected Campaign ID and its child content. A native multi-block transform wraps supported existing content. WordPress Undo/Redo and **Remove lock, keep content** preserve that content. Wrapping rejects unsupported selections and a second region; pasted duplicates receive an authoring warning. Unwrapping respects WordPress removal permission.
- The searchable picker offers published, lock-ready Campaigns. Refresh reads a narrow authenticated endpoint without editing the post. Missing, disabled and temporarily unavailable selections remain visible for repair. Authors can place Campaigns without receiving Campaign-management permission; authorized managers can open the existing Campaign list in a new tab.
- The original readable fallback, one active region per page, Campaign-scoped browser receipt and supported static-content boundary remain the runtime contract. Automatic article-remainder locking remains deferred under section 16.

### Setup in plain language

1. Create an inline Campaign, enable **Content lock** in Display rules, and publish it.
2. Edit the post or page in WordPress. Add **WConvert Content lock**, or select supported existing blocks and use **Transform to → WConvert Content lock**.
3. Choose the published Campaign. Put the content to reveal inside the block and keep the public introduction outside.
4. Save or update the page. Check the published page in a fresh browser session to try submission and reveal.

If the Campaign was published in another tab, use **Refresh Campaigns**. To keep the content and stop gating that region, use **Remove lock, keep content**.

### Verification completed

- Full JavaScript suite: 122 files, 2,580 tests passed. Focused picker and selection tests cover refresh failure, preserving a saved selection, missing data, supported mixed descendants and refusing unsupported selections.
- Full PHP suite passed with 2,001 tests and 9,772 assertions. A subsequent focused run also passed the added temporary-suspension/permission case (3 picker tests, 12 assertions). Type checking, lint, PHPStan and source-boundary checks passed. Admin, Pro admin and block production bundles were rebuilt.
- WordPress 6.8.3: the Campaign setup/publication journey passed with the right-hand preview, all three simulated states and narrow layout. The six visitor-runtime browser checks passed. All three editor checks passed: registration/readable serialization, mixed-content wrapping with Undo/Redo and unwrapping, and author-only refresh with unsaved content followed by save/reopen.
- WordPress 7.1.1 (resolved by the Playground `latest` fixture, confirmed from the running installation): both wrapping/Undo/unwrap and author refresh/save/reopen browser journeys passed.
- Native mixed-block transform behavior was checked against the WordPress Group implementation for 6.2 and 6.8. The implementation uses the same conversion hook and clones complete block subtrees instead of rebuilding HTML.

### Remaining validation limits

Observed usability sessions, a manual screen-reader pass, the full RTL/zoom matrix and full runtime coverage on the declared WordPress 6.2 floor have not been completed by this follow-up. The previously documented activation dependency mismatch below WordPress 6.5 still prevents claiming a verified 6.2 installation. No external documentation site or automatic remainder-locking feature was published.


## 18. Writing-first container and manual-divider experiment

Authorized after reviewing the actual Gutenberg screenshot on 20 September 2026.
The screenshot exposed excessive editor chrome and ambiguous inside/outside
writing prompts. Passing serialization tests did not establish easy authoring.

### Local plugin change

Keep the explicit selected-section container. Move Campaign settings to the
native block inspector after initial inline setup, use compact start/end markers
with the Campaign name, start empty regions with a writable paragraph, and move
**Remove lock, keep content** to the native toolbar. Warnings stay visible in the
canvas. Scope CSS to editor chrome so the theme still controls actual content.
No visitor behavior or block-compatibility expansion is implied.

### Prototype, not a production divider

The manual divider is brought forward for interaction review. Compare three
approaches at `http://127.0.0.1:5191/content-lock.html?variant=B`, started with
`npm run prototype:content-lock`: A selected section, B article divider, C
individual block choices in a sidebar. This follows the existing local editor
prototype convention. The standalone simulation is necessary to compare boundary
models without registering experimental blocks in saved WordPress posts.

Try an existing article, writing a new article, and a bonus with a public
conclusion. Controls support moving the boundary, editing/reordering/appending
blocks, Undo, removing the lock, choosing a sample Campaign, and simulating
before submission, after submission and unavailable form. All edits live in
memory. The prototype uses only paragraphs/headings and an embed placeholder;
it does not prove Gutenberg or third-party block compatibility.

The proposed divider covers subsequent top-level post content through the end
of the article. Appended content is included. Footer/comments remain outside.
One region per page remains the intended limit. Unsupported content must receive
an actionable explanation, with readable fallback; no blind page-DOM hiding.
Existing selected sections must not silently migrate. Automatic placement across
multiple posts remains deferred.

The initial interaction comparison supports B for article remainders and A for
bounded bonuses. C adds per-block bookkeeping and is retained only as a comparison.
Observed team usability testing is still pending. Durable experiment notes and
promotion checks are in `tools/design-system/editor-prototype/CONTENT-LOCK-NOTES.md`.
The comparison code was retired after the decision. Section 19 records the real
WordPress divider implementation that replaced it.

Verification for this follow-up: block production builds, type checking, lint,
PHPStan and source contracts passed. The four focused picker/selection unit tests
passed. WordPress 6.8.3 passed registration/serialization, mixed wrapping with
Undo/unwrap, author refresh/save/reopen, and initial Campaign selection followed
by typing into an empty region with a public conclusion outside. The latter two
journeys also passed the current `latest` WordPress fixture. The writing test
checks that boundary text remains 13px under the block theme's larger article
styles. Prototype interactions were checked manually in the browser; no claim of
observed content-team usability or universal block compatibility is made.


## 19. Option B: real Gutenberg divider

The user selected B on 20 September 2026. This supersedes section 18's
prototype-only scope and the earlier decision to defer a manually placed marker.
Automatic placement across posts remains deferred. All changes remain local;
PR updates and pushes still require confirmation.

### Setup

1. Publish an inline Campaign with Content lock enabled.
2. In Gutenberg, add **WConvert Lock from here** after the public introduction.
3. Choose the Campaign. Write or retain ordinary blocks below the divider.
4. Update the article and try the published page in a fresh browser session.

The divider contains no content input and no InnerBlocks. Following blocks keep
their original structure and formatting. Moving it changes the boundary. New
content appended below is included. Removing it preserves all article blocks;
native Undo restores it. Campaign changes affect only the marker's selection.
Keep the existing selected-section block for a bonus followed by a public
conclusion. Do not migrate existing sections automatically.

### Scenario decisions

| Scenario | Behavior |
|---|---|
| Existing article | Insert one divider between top-level blocks; no dragging content into a container. |
| New article | Insert the marker, then continue writing normal blocks below it. |
| Long public introduction | Move the marker with WordPress's native controls. |
| Newly appended content | Included in the same article remainder; visible guidance explains this. |
| Empty remainder | Show an authoring prompt; do not activate an empty gate. |
| Another divider | Inserter prevents ordinary duplicates; pasted duplicates warn and stay public. |
| Selected lock section or enclosing shortcode already present | Divider stays inactive; preserve the existing section behavior and explain the conflict. |
| Marker inside Group/Columns/pattern | Ask the writer to move it into the main article; do not infer a nested boundary. |
| Unsupported block below | Name the block and offer **Find unsupported block**. The remainder stays public. |
| Embeds, forms, shortcodes or dynamic bindings | Remain unsupported inside the remainder; do not hide active content blindly. |
| More / Page Break | Divider stays inactive; use a bounded section instead. |
| Missing/disabled/unavailable Campaign | Preserve saved selection and article content with existing repair guidance. |
| Draft preview / feed / REST / password protection / secondary loop | Readable fallback. Verify actual gating on the published main article. |
| Missing Pro / JavaScript / unavailable form | Article remains readable. |
| Footer and comments | Outside the main post-content region, so stay public. |
| Public conclusion after a bonus | Use the selected-section block; the article-remainder divider intentionally includes the conclusion. |

### Implementation and review

The Pro-only divider is saved as a marker. A bounded `the_content` pass at priority
8 prepares a transient region before WordPress renders blocks at priority 9. It
never updates saved post content. Validation uses a shared static-block schema;
the existing region renderer and capture/receipt runtime perform gating.
Publication guidance now names the real divider. The comparison prototype and
startup command have been removed; the outcome is retained in the design notes.

No claim of universal block compatibility, private-content security or observed
team usability is made. The WordPress 6.2 activation dependency limitation recorded
in ADR 0100 remains unresolved.

### Verification

The full JavaScript suite passes (122 files, 2,580 tests), as does the PHP suite
(2,006 tests, 9,802 assertions). Type checking, lint, PHPStan and source contracts
pass. All three staged Pro packages pass their artifact contracts, including
required divider CSS and the runtime static-block schema. The contract tests
also reject a package missing either file.

The disposable WordPress 6.8.3 checks passed divider capture/reveal in classic
and block themes, remembered access, normal-block writing, moving the divider,
save/reopen, removal and Undo. Invalid scopes, missing/disabled Campaigns, no
JavaScript, an authenticated draft preview and Pro absence remain readable.

The full 16-test browser regression suite also passes against the current
Playground `latest` WordPress build, covering existing sections and the new
divider. This includes the actionable unsupported-block warning and its jump
button. The captured real-editor view is
`tools/visual-tests/out/content-lock/content-lock-writers-inser-0d018-e-it-without-losing-content/divider-editor.png`.

The final authoring rerun also verifies that the following paragraph sits below
the divider after WordPress's Undo movement animation settles; the resulting
screenshot was inspected visually.


## 20. Consistent sidebar setup and shorter guidance

Campaign setup now lives in the sidebar for both the empty and selected states,
for both authoring blocks. The canvas uses a **Choose Campaign** button to open
WordPress Block settings when needed, keeping form controls out of article
content. This follows WordPress's documented
[complementary-area action](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-interface/).

A selected Campaign displays its full wrapping name with Change and Clear
controls. Change can be cancelled without editing the post; clearing returns to
the same sidebar picker. Refresh and management remain secondary actions, and
management links remain unavailable to post authors without that capability.
The article boundary remains compact, with empty-content help shown as plain
text rather than a large notice. Repair warnings retain their cause and action.
Extra preview and section guidance is under **Setup tips**.

There are still two authoring choices: **Lock from here** for the article
remainder, and **Content lock** for a bounded section with public content after
it. No standalone end marker is added in this follow-up. The recommendation is
to retain the bounded section for that use case, avoiding a third overlapping
workflow and missing, duplicate, moved or nested start/end pairing rules.

Verification: the original canvas-only empty picker was reproduced in WordPress
before the fix. Five focused picker/selection tests pass, as do production block
builds, type checking and lint. Three real WordPress authoring journeys pass on
6.8.3 and the current Playground `latest` build: initial sidebar setup and writing,
post-author refresh/save/reopen without added management access, and divider
setup with a closed sidebar, Change/Cancel/Clear, movement, save/reopen and Undo.
The editor typography assertion waits for the iframe stylesheet to settle.
Empty and selected sidebar screenshots were inspected. No PR update or push.
