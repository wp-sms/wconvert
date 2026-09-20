# Content lock is an optional inline capture journey

Issue #180 implements the researched contract under #165. Content lock ships in
all paid tiers as a `content-lock` Module. It adds no Display Type, Goal, Template
token, conversion step, table or column. `config.content_lock = {"mode":"hide"}`
is explicit; absence disables it. Automatic placement and Content lock are
mutually exclusive. Publication requires inline, only page load, and a complete
two-step submit form. An incompatible design change requires an explicit choice
to turn off locking. Drafts may remain incomplete while being edited.

## A region owned by the merchant

The native `wconvert/content-lock` block saves InnerBlocks content. The paired
`[wconvert_content_lock id="…"]…[/wconvert_content_lock]` shortcode wraps a
complete region. Both emit a shared manual Anchor and a readable content region.
Free registers a rendering fallback; Pro supplies editor controls and the active
marker on singular, public post/page main content. Feeds, previews, secondary
loops, REST, password-protected content and unsupported contexts stay readable.
Disabling both plugins retains the block's saved content (shortcode delimiters
may remain). The standard inline block is unchanged.

Only one region can be locked per document. First manual Anchor precedence is
preserved: an earlier ordinary form remains an ordinary form. Repeated/nested
regions do not compete. Ordinary forms for different Campaigns remain independent.
Text, static images, lists, quotes, tables and links are supported; forms,
scripted embeds, audio and video within a region are not.

Server output never hides content. The Pro controller hides only its owned region
after mounting and binding a working form. It restores readability on teardown,
mount failure, unavailable eligibility or unconfirmed capture. There is no
whole-page overlay, focus trap, or global selector. Hidden descendants cannot
receive keyboard focus. Capture acknowledgement exposes a polite status and an
explicit Continue to content button; it does not steal focus from the page.

Initial ineligibility is final for that document: consent, schedule or targeting
changes cannot take already-readable content away. An active gate observes
eligibility and schedule loss and opens without relocking. Its own Impression
must not invalidate it through frequency caps. A pending capture can settle after
the form closes; a real acknowledgement still counts. No auto retry occurs.

## Authoring and preview follow-up

The same block now appears in WordPress's native **Transform to** menu for
supported selected blocks. It wraps cloned block objects, preserving attributes,
formatting and nested list/button content. The grouping hook is the one used by
WordPress's Group block on the supported API versions. Unsupported or locked
content is not transformed. Native Undo/Redo and ungroup are retained; an explicit
**Remove lock, keep content** action also preserves children and respects the
editor's removal permission. Duplicate regions receive an editor warning.

Pro supplies a separate published Campaign picker, leaving the ordinary inline
picker unchanged. New selections offer only lock-enabled, currently available
published Campaigns; saved unavailable selections are retained with an explanation.
The published projection remains authoritative, including mixed A/B-family
handling. Readiness does not override visitor targeting, schedules or frequency.

The initial choices are delivered with the block-editor assets. The authenticated
read-only `GET /wconvert/v1/content-lock-campaigns` refreshes them without reloading
or saving the post. `Routes::canPlaceCampaign()` requires `edit_posts` or
`edit_pages`; it grants no Campaign-management capability. Responses contain only
published inline IDs, names and ready/disabled/unavailable status, plus a management
link for users who already have `manage_options`. They contain no drafts, designs,
Destination details or Leads, and use `Cache-Control: no-store`. This is an explicit
post-author exception to the management permission, separate from public capture
and beacons. Free does not register this Pro route.

Both authoring blocks keep Campaign selection in native InspectorControls,
including the empty state. A canvas **Choose Campaign** button opens the block
settings when the sidebar is closed, expands a collapsed settings panel, and
moves focus to the Campaign picker.
A selected Campaign uses a wrapping name
card with Change and Clear actions; unavailable selections remain repairable.
Change and Clear move keyboard focus into the picker. Selecting a Campaign or
cancelling returns focus to Change. Mounting the block or refreshing choices
does not request focus.
Refresh and permission-aware management links are secondary actions. Compact editor-only start/end labels identify the region and
selected Campaign without inheriting the theme's article font size. An empty
region starts with a writable paragraph. The native block toolbar holds
**Remove lock, keep content**; warnings remain visible in the canvas. Saved
InnerBlocks markup and the runtime rendering contract are unchanged.

The manual **Lock from here** divider is now implemented as
`wconvert/content-lock-divider`, registered only by Pro. It saves a self-closing
block comment and no inner content. Writers retain ordinary top-level blocks
before and after it. Native movement, deletion and Undo affect the marker; no
saved article content is reparented or migrated. All Campaign setup and changes
live in the inspector. Extra guidance is collapsed under Setup tips. The canvas always
states that the rest of the article is included. Appended content is included.
The marker is limited to one by the inserter; pasted duplicates are also checked.

Before WordPress's `do_blocks`, Pro examines only singular main post/page content
with the queried post ID. One top-level divider and a supported, nonempty static
remainder become a transient `ContentRegion` for that render. Existing capture,
receipts, eligibility and readable failure behavior are reused. No saved post is
rewritten and no whole-page DOM selector is introduced. Footer/comments outside
post content remain outside the region. The shared static-block schema is read
by PHP and the editor, and required by the artifact contract.

Nested/duplicate dividers, a selected Content lock section anywhere in the post,
its enclosing shortcode, More/Page Break, unsupported descendants or dynamic
bindings, active embeds/shortcodes in the remainder, invalid Campaign IDs and an
empty remainder leave divider content readable. An explicit section keeps its
existing behavior. Missing/unpublished/disabled/unavailable Campaigns remain
readable through the existing loader rules. Draft previews, feeds, REST,
secondary loops and password-protected contexts do not activate the divider.
Without Pro, WordPress ignores the marker while ordinary following blocks render.
If a malformed marker carries saved content, it is preserved and not gated.

The divider is the recommended article workflow. The selected-section block and
paired shortcode remain for bounded bonuses and Classic Editor. Supported content
is still the documented static set; Groups, Columns, synced patterns and third-party
blocks are not promised compatible. Automatic insertion across posts stays deferred.
The user-selected prototype was removed; plan section 19 records the decision.

Content lock simulation uses the existing right-hand Campaign canvas on Display
rules, with Locked, Unlocked and Form unavailable controls outside the scaled
preview. At narrow editor widths it stacks below settings. It renders example
content, not the linked WordPress page; its state is separate from the Campaign
and the Design step. The form preview sends no capture or analytics requests and
writes no unlock receipt. Setup details and a copyable enclosing shortcode remain
in placement help. Advanced documentation links are omitted until real WConvert
docs exist. Actual page gating is checked on a published page; WordPress draft
preview contexts intentionally remain readable.

## Acknowledged capture, never subscriber verification

Only the existing acknowledged capture callback reveals success and records one
Conversion. Generic click conversions, frequency `c` state, Destination delivery,
email verification and provider membership never establish access. Correctable
field/consent refusals retain the form and values. Network, server, malformed
acknowledgement and rate-limit failures expose the content with truthful feedback,
without a success receipt or invented Conversion. Form values are never persisted
by the locking module.

A 30-whole-day unlock receipt remembers the Campaign family within one browser.
The localStorage key starts `wcv_unlock1:` and includes the site's capture endpoint;
values are only family ULIDs and expiry days. Reads do not renew access. Bounds are
64 records and 8 KiB; corrupt/expired data is ignored. There is no cookie fallback,
identity, fingerprint or PII. Memory preserves this document if storage fails;
cross-tab storage changes open active regions. Receipt expiry does not promise a
new gate: ordinary frequency and eligibility can still leave content readable.
The Data map and suggested privacy text describe this storage.

Every A/B draft must agree on lock mode and form compatibility before publication.
During sequential publication a mixed live family is projected without locking;
regions stay readable until all live arms agree. Family IDs survive winner
selection and a child serving alone. Capture and Impression still name the chosen
arm; remembered access creates neither count.

## Product boundary and verification

Content lock is promotional gating. HTML and direct asset URLs remain public;
it is not membership, payment, age verification or protected-file delivery.
Merchants own public excerpts, restricted-content markup and search presentation.
No SEO outcome or downstream subscription is promised. See the competitor sources,
scenarios and deferred work in [the implementation plan](../plans/165-inline-content-locking.md).

Tests cover lifecycle/refusals, storage bounds/expiry/site scope, manual precedence,
publication and family projection. Disposable WordPress Playwright checks classic
and block themes, block serialization, paired shortcode, narrow viewport, keyboard
focus exclusion, hostile hidden CSS, no JavaScript, technical failure, duplicates
and remembered access. Existing loader budgets and absence checks remain binding.
