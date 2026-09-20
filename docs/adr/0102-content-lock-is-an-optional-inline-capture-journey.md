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
