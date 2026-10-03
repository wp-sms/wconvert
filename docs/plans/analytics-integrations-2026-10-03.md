# GA4 integration and future analytics providers

Planning date: 2026-10-03. Repository reviewed at `bfe726e`.
Status: implementation authorized by the user on 2026-10-03; implemented on `codex/analytics-integrations`. See ADR 0114 and the packaged setup guide.
Scenario review: updated 2026-10-03 after the user's questions about transport,
template compatibility and admin configuration. Accepted product scope is unchanged.

## Product decisions

The user selected:

- First release sends campaign events to GA4. GA reports stay in Google Analytics.
- Use the site's existing Google tag or Google Tag Manager installation.
- Prepare for Plausible as the next provider. Matomo is out of scope for now.

Recommendation: package the managed integration, setup assistance and diagnostics
in WConvert Pro. Keep native WConvert counters and the existing public JavaScript
events available in Free. The user suggested premium packaging; implementation includes every internal paid tier. This does not change subscription pricing. No new subscription price is proposed.

The customer outcome is: “See which sources and campaigns produce accepted leads
and other campaign outcomes in the analytics tool I already use.”

## Research findings

Research uses first-party product documentation and a public support discussion.
These establish supported workflows and examples of friction, not market share,
feature quality, customer willingness to pay, or validated WConvert demand.
Competitor implementations were not independently exercised.

| Product | Documented approach | Implication for WConvert |
| --- | --- | --- |
| OptinMonster | GA integration is documented for Pro and higher. Uses custom impression, conversion and interaction events, campaign parameters, event-scoped dimensions, and a site default that can apply to campaigns. | Premium is a defensible position. Site defaults and reporting instructions belong in the feature. |
| Popupsmart | Uses an existing Google Analytics installation; supports direct installation and a GTM container import. Documents display, close and interaction events. | Offer separate Google-tag and GTM setup paths, plus reusable GTM configuration. |
| Convert Pro | Documents an Analytics add-on, GA4 reporting authorization through a Google Cloud client, and a GTM event workflow. | Sending events and reading reports are distinct scopes. Avoid the reporting authorization burden in this release. |
| Popup Maker | Its GA4 guide requests a Measurement ID and Measurement Protocol API secret, and describes open, close and conversion tracking. | Do not assume all competitors use browser-only tracking. Our proposed browser route deliberately avoids server credentials and identity plumbing. |
| Conversion Bridge | Provides a WordPress integration product spanning multiple analytics and advertising platforms. | A broader integration ecosystem exists; stable events will help interoperability. Rebuilding its entire platform is unnecessary for WConvert. |

Sources: [OptinMonster](https://optinmonster.com/docs/how-optinmonster-uses-google-analytics-to-measure-conversion-analytics/),
[Popupsmart](https://popupsmart.com/help/integration/how-to-set-event-integration-in-google-analytics),
[Convert Pro authorization](https://convertpro.net/docs/authorize-convert-pro-to-view-google-analytics4-data/),
[Convert Pro GTM](https://convertpro.net/docs/convert-pro-events-gtm/),
[Popup Maker GA4](https://wppopupmaker.com/docs/popup-analytics/how-to-set-up-ga4-in-popup-analytics/),
[Conversion Bridge](https://conversionbridgewp.com/docs/getting-started/).

### Customer needs and examples

| Need | Example | Proposed response |
| --- | --- | --- |
| Acquisition attribution | “Does search or my newsletter bring more quote requests?” | Send accepted capture events into existing GA sessions. Provide an exploration recipe using session source/medium and WConvert campaign. |
| Campaign comparison | “Does the inline signup or exit popup work better?” | Include campaign, exact variant and display format; expose impressions and outcomes. Do not sum unrelated goal rates. |
| Correct success measurement | “A rejected form should not be a lead.” | Track the first server-acknowledged capture, not button clicks or native form-submit detection. |
| Setup confidence | “I enabled it, but GA shows nothing.” | Explain consent, missing tag, selected route, local handoff, GA DebugView and reporting delays separately. |
| Agency compatibility | “We already manage all tracking in GTM.” | Provide structured data-layer events and a reviewed GA4 tag recipe/import. |
| Alternative analytics | “We use Plausible and want campaign goals there.” | Add a provider adapter later without changing campaign behavior. |

A [Site Kit support thread](https://wordpress.org/support/topic/analytics-not-tracking-6/)
shows a merchant's missing-data complaint and uncertainty about consent tooling.
Treat this as evidence of a support scenario, not evidence of its prevalence or
current compatibility of the plugins mentioned in that older thread.
Current [Site Kit event documentation](https://sitekit.withgoogle.com/documentation/using-site-kit/event-tracking/)
and [consent documentation](https://sitekit.withgoogle.com/documentation/using-site-kit/consent-mode/)
should guide compatibility testing.

Before public release, validate the proposed setup with at least three representative
customers/testers: a merchant with Site Kit, an agency with GTM, and a multistep
campaign user. Have each configure a test property, find one accepted lead,
compare two campaigns and diagnose one withheld event. This research does not
replace those usability checks or justify committing to more providers.

## Fit with the current code

The current repository already provides:

- `resources/loader/src/events.ts`: public `wconvert:open`, `wconvert:close`, and
  `wconvert:capture` notifications with campaign ID, exact optin ID and display type.
- `resources/loader/src/present.ts`, `shell.ts`, and `beacon.ts`: semantic
  impression, deliberate dismissal and conversion callbacks. Inline impressions
  are tied to viewport entry. Native counters are not raw GA events.
- Free and Pro journey callbacks: first accepted Lead is distinct from campaign
  completion; Pro quiz results can convert without contact capture.
- `src/Destination/`: existing contact-delivery adapters, credentials, mappings,
  scheduling and diagnostics. Mailchimp/Brevo code is already present; an older
  ADR's “not implemented” sentence is stale relative to the current code and plan.
- `resources/loader/src/consent.ts`: WP Consent API handling for existing storage
  behavior. Missing or throwing APIs currently fail open. That helper must not
  silently become the external analytics consent policy.
- `src/Privacy/DataMap.php` and `PolicyText.php`: installed data-flow guidance.
- `tiers.json`, Pro modules and separate loader builds: premium behavior can be
  absent from the Free artifact rather than shipped behind a runtime paywall.

The public events alone are insufficient for complete GA tracking: `open`
includes reopening, inline forms do not emit it, `close` includes transitions
that are not deliberate dismissals, and `capture` excludes anonymous quiz
completion and offer clicks. Do not rename these events or change their meaning.
Introduce a narrow internal observer at the existing semantic callbacks; preserve
the public API. Analytics callbacks must be isolated from the capture/display path.

### Template compatibility and runtime coverage

Existing supported templates, saved campaigns and imported designs should work
without individual edits or tracking snippets. Observe the shared runtime's
accepted actions, not CSS selectors, button labels, form DOM events or template
names. Changing colors, wording, placement or a design must not break tracking.
There is no new required analytics field in the template format and no bulk
rewrite of existing campaign designs.

This requires actual runtime work, not merely subscribing to `wconvert:capture`.
For example, the current content-lock path in
`pro/modules/content-lock/loader/index.ts` wires `onCaptured` but does not supply
`onLeadAccepted`; other presenters do. Explicitly connect every accepted-capture
path to the same observation contract without conflating it with a conversion.
Audit standard presenters, Pro journeys, content locking and reopen/recovery.
Preserve deduplication already owned by those paths rather than deduplicating
all visitors or all activity with the same campaign ID.

Template replacement/import preserves campaign analytics preferences. Portable
template exports carry no Measurement ID, consent configuration or analytics
label. Duplicating a campaign gets a new ID, preserves its exclusion preference,
and resets a custom analytics label to a neutral label for the new campaign.
A/B arms inherit the family's analytics inclusion and label while exporting their
own optin ID. On winner promotion, materialize those inherited preferences so an
excluded family cannot unexpectedly become tracked. Read event metadata from the
published runtime snapshot, never from the merchant's current unpublished draft.

Third-party embedded forms or scripts are outside this automatic compatibility
promise. Only outcomes acknowledged by WConvert's supported runtime count. Do not
infer a successful external form submission from a generic click or DOM submit.

Relevant contracts: [public events](../adr/0110-public-browser-events-describe-campaign-outcomes.md),
[no WConvert visitor identifier](../adr/0017-no-visitor-identifier.md),
[aggregate native counters](../adr/0019-analytics-stores-daily-counters-not-events.md),
[progressive capture](../adr/0103-progressive-capture-keeps-one-lead-per-journey.md),
[integration foundation](integration-foundation.md).

## First-release experience

1. Open **Settings → Analytics integrations → Google Analytics 4**. Keep native
   Analytics reporting in its current home and lead delivery under Connections
   & destinations. This adds one settings category, not a new integrations app.
2. Choose **Existing Google tag** or **Google Tag Manager**. Detection is a hint;
   the merchant chooses the route. A `dataLayer` alone does not prove GTM exists,
   and a `gtag` function alone does not prove GA receives events.
3. For Google tag, supply the GA4 web-stream Measurement ID (`G-…`). Send only
   to that explicit target with `send_to`. Do not add a Google script, run a new
   `config`, send a page view, change consent defaults or connect a Google account.
   The selected stream must already be configured by the existing tag; entering
   a valid-looking ID does not configure or verify it. Explain the difference
   between a `G-…` stream ID and a numeric property ID, `GTM-…` container ID or
   `GT-…` Google tag ID. An absent tag leads to installation guidance, not a
   “Connected” success state.
4. For GTM, show the data-layer contract and a versioned, reviewed GA4 tag recipe
   or import. The merchant reviews merge changes and publishes the container.
   Support the standard `dataLayer` first and a validated custom name under
   advanced settings. Never overwrite an existing data layer.
5. Enabling the integration applies the site default to existing and future
   published campaigns; say this explicitly before Save. Per campaign, offer
   **Use site setting / Off**, following draft, Undo and Publish semantics.
   Use one GA4 stream per site in v1; separate campaign properties can wait.
6. Show a local diagnostic panel and instructions to verify in GA DebugView or
   Realtime. Provide event-scoped dimension setup and a reporting recipe.

### Admin controls and defaults

Keep ordinary setup compact; disclose advanced choices only when relevant.

| Scope | Control | Proposed default / behavior |
| --- | --- | --- |
| Site | Enable GA4 integration | Off; saving configuration alone does not enable sending |
| Site | Existing Google tag / GTM | Explicit selection; never automatically switch routes at runtime |
| Site | Measurement ID | Required for direct route; the GTM guide supplies it in the container's GA tag |
| Site | Consent handling | Verified WP Consent API integration where available; otherwise an explicit existing-tag/GTM-managed choice with the limits below |
| Site, advanced | Include dismissal events | Off; impressions and accepted outcomes form the default useful set |
| Site, advanced | Exclude campaign managers | On for logged-in users with WConvert management capability; ordinary logged-in customers remain eligible |
| Site, advanced | Data-layer name | `dataLayer`, GTM only; validate as an allowed global key and reject prototype-related names; no expressions or `eval` |
| Campaign | Analytics tracking | Use site setting / Off; an individual campaign cannot override a disabled site integration |
| Campaign | Analytics label | Optional public plain text, maximum 80 Unicode characters; IDs identify campaigns even if labels match |
| Setup | Test on a website page | Local inspection first, then a separate explicit synthetic event action |

Event names, payload fields and conversion rules are fixed in v1. No arbitrary
parameter mapping, custom code box, money/value field, per-button configuration
or per-campaign Measurement ID. Consent is an integration concern, not an editor
checkbox that bypasses a visitor's choice.

An excluded-campaign count/link makes the site-wide enable action's scope visible.
Show each campaign's effective state, including “Site integration off” and
“Requires Pro,” rather than presenting a saved preference as proof of tracking.
Global configuration is site-scoped, including on multisite; do not inherit
another site's stream. A property/route change resets setup verification and
shows how to remove the previous GTM recipe. Historical events remain in the
old property and are not migrated.

The integration starts disabled. A global disable takes effect on subsequent
fresh page loads, subject to page caches; do not promise immediate revocation on
already-loaded pages. Document cache purging on configuration changes. Removing
Pro stops future integration loading without disabling campaign capture or native
statistics; saved settings can remain inert for reactivation.

Routine tracking is disabled on environments WordPress identifies as local,
development or staging. Test there using an explicitly selected test property
and a temporary authorized diagnostic session. Bind activation to the site's
normalized home URL: a database copy to a different site requires review before
sending to the copied stream. Same-URL clones still depend on correct environment
configuration; no heuristic can reliably identify every staging site. Keep the
actual environment and stream visible in diagnostics.

Recommended paid packaging: include the analytics module at the internal `basic`
rung and every higher rung, all currently branded Pro at launch. This makes a
basic paid campaign measurable without requiring advanced targeting. Confirm the
commercial placement before implementing the tier manifest change.

## Event contract

Use a small closed vocabulary. Campaign identities belong in parameters, never
in dynamically generated event names. Google documents both
[recommended and custom events](https://developers.google.com/analytics/devguides/collection/ga4/events).

Proposed provider-neutral observations: `impression`, `lead_accepted`,
`campaign_converted`, and `dismissed`. They contain only allowlisted campaign
metadata and the outcome kind; no Lead or submission object reaches the adapter.

| GA4 event | When | Reporting meaning |
| --- | --- | --- |
| `wconvert_impression` | The existing semantic impression callback, including inline visibility | A campaign appearance; reopening follows native impression semantics |
| `generate_lead` | First server-acknowledged Lead in the mounted journey | Accepted contact capture, not subscription confirmation or provider delivery |
| `wconvert_conversion` | Primary conversion of a click or quiz campaign | Offer/cart-return click or quiz completion; not a purchase or revenue |
| `wconvert_dismiss` | Existing deliberate-dismiss callback, if enabled | Optional diagnostic interaction; never inferred from page exit or internal teardown |

For a capture-driven campaign, `lead_accepted` maps to `generate_lead`, and the
paired `campaign_converted` observation does not send an additional conversion
event. Quiz capture still sends `generate_lead`, but is a separate acquisition
measure from the quiz's primary conversion. Add `wcv_capture_role` with
`primary` or `secondary` on lead events so reports can distinguish them.
An optional SMS addition after email never sends another `generate_lead`.

Example: a quiz displays its result, then the visitor requests an emailed copy.
GA receives one `wconvert_conversion` and one `generate_lead` with secondary
capture role. This is one quiz completion and one lead, not two completed quizzes.
The supplied campaign-outcome report counts primary lead captures plus click/quiz
conversions. A lead-acquisition report counts all `generate_lead` events.

GTM uses the same mapping as the direct adapter. A capture-led conversion's
paired `campaign_converted` observation must not trigger a second GA event;
include that exclusion in the supplied trigger/mapping, not just in prose.
Pre-result and post-result quiz contact both use `secondary` capture role: role
describes the campaign's converting act, not the order in which the events occur.

Google defines `generate_lead` for lead acquisition and `sign_up` for account
registration; a newsletter capture should not claim an account was created.
See [Google's event reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events).

Parameters: `wcv_campaign_id`, `wcv_optin_id`, `wcv_display_type`, `wcv_goal`,
`wcv_outcome`, optional `wcv_capture_role`, and a schema version. IDs remain
strings. Reuse published IDs; document the existing A/B winner-promotion identity
change. Do not create persistent experiment or visitor IDs to hide that behavior.

For readable reports, offer an optional explicit **Analytics label**, saved as
campaign configuration and intended to be public. Start with a neutral generated
label; do not automatically send the merchant's internal campaign name, question
text or result names. Explain that the label is sent externally and must not
contain personal or sensitive information. IDs remain authoritative across renames.
Use the bounded label as `wcv_campaign_label`; do not attempt to certify arbitrary
merchant-entered text as PII-free. Reject markup/control characters, serialize
safely, and show the exact outbound fields during setup. Keep parameter names
and values within [GA4 collection limits](https://support.google.com/analytics/answer/9267744?hl=en),
including multibyte labels; reserve space for the Google tag's own parameters.

Never send form fields, email/phone (including hashes), Lead IDs, capture grants,
answers, selected result IDs, DOM text, link query strings, custom monetary
values, or a WConvert-created user/client ID. Do not modify GA acquisition
parameters such as `campaign_id`, `campaign_name`, source or medium. GA's own tag
owns its session attribution; WConvert's metadata uses the `wcv_` namespace.

Set up event-scoped dimensions for campaign, variant, format, outcome and capture
role as needed, with the optional label for readability. Document that parameter
collection and report availability are separate: Google notes
[custom dimensions can take 24–48 hours](https://support.google.com/analytics/answer/14240153?hl=en).
Do not create one GA event or custom definition per campaign.

The guide should explain marking `generate_lead` as a key event for acquisition,
and selecting the appropriate click/quiz outcomes separately. Never mark
impressions or dismissals as key events, automatically modify a property's key
events, or sum lead and quiz totals into an unqualified “conversions” number.
An existing property may already treat `generate_lead` as a key event; disclose
that enabling tracking can therefore affect its existing reporting.

### Reporting that answers the intended questions

Ship two worked report recipes, with a small expected-event example for each:

- **Lead acquisition:** `generate_lead` events that have WConvert campaign
  metadata, broken down by campaign/variant and session source/medium. Other
  plugins may also emit `generate_lead`; never present the unfiltered property
  total as WConvert leads. A captured enquiry is not a qualified lead or sale.
- **Campaign outcomes:** appearances and the campaign's primary outcome, grouped
  by campaign and compatible goal. Use event counts for repeated accepted acts;
  GA's user/session key-event rates answer different questions. Do not divide
  GA outcomes by native WConvert impressions or compare mixed populations.

Explain discrepancies with a concrete example: WConvert might record 100
appearances and 10 captures, while GA observes 60 appearances and 7 captures.
Neither tool's rate establishes missing sales or exactly 60 consenting people.
Consent timing, blockers, staff exclusion, script readiness, lost acknowledgements,
report filters, date boundaries and processing can all affect comparability.
An appearance before consent followed by a capture after consent can legitimately
produce a GA lead without a GA impression. Do not backfill an impression or claim
that these independent counts form a complete visitor funnel.

Setup includes creating a reusable event-scoped campaign ID dimension, adding
optional label/variant dimensions when needed, and making an actual report—not
only checking DebugView. Document the manual GA steps and required permissions;
without OAuth the plugin cannot create definitions or verify those changes.
Use campaign IDs for durable grouping; label edits affect future events only.
Do not register schema version as a routine reporting dimension or send precise
timestamps as custom dimensions.

## Transport, consent and reliability

**Exactly one WConvert route to GA per setup.** The direct adapter calls the
existing Google tag with explicit routing; the GTM adapter pushes one structured
event object containing its complete namespaced data. Do not run both. In GTM,
use provider-neutral names such as `wconvert.lead_accepted`, then map them in the
GA4 tag. Reset absent optional fields in each pushed event to prevent GTM from
reusing a previous event's values. Google documents
[routing](https://developers.google.com/tag-platform/gtagjs/routing) and
[data-layer processing](https://developers.google.com/tag-platform/tag-manager/datalayer).
Use per-event parameters in the direct call; do not use a global `gtag('set', …)`
that could attach WConvert campaign metadata to unrelated site events. The GA
script performs the network send. WConvert does not post browser events to a new
WordPress endpoint or use a Google server API in this release.

Other plugins, custom listeners or GTM tags can independently duplicate events.
The setup guide must cover disabling an older WConvert tracking recipe and
checking automatic form tracking. WConvert can prevent its own double dispatch,
not guarantee deduplication across arbitrary third-party tracking.

Google's [enhanced measurement](https://support.google.com/analytics/answer/9216061?hl=en)
can collect `form_start`/`form_submit`; those events do not replace WConvert's
accepted-capture acknowledgement. Do not globally disable a customer's form
tracking or unrelated plugin integrations. Remove only duplicate WConvert
triggers/mappings, including any rule that derives a second `generate_lead` from
its form submit. [Site Kit's plugin conversion tracking](https://sitekit.withgoogle.com/documentation/using-site-kit/plugin-conversion-tracking/)
is another integration to inspect, not an assumption that WConvert is already
one of its supported providers. A GTM import must merge with a reviewable diff,
never overwrite unrelated tags or auto-publish the customer's workspace.

Consent policy is a required implementation decision. This review refines the
original blanket positive-consent requirement: respect the site's configured
consent system without requiring every installation to adopt the same CMP or
silently weakening enforcement when a signal is missing.

| Configured handling | Dispatch rule | Honest setup status |
| --- | --- | --- |
| WP Consent API integration | Wait for a verified initialized CMP policy, then respect its statistics permission and applicable Google Analytics service denial. Pending/denied/unavailable/throwing blocks dispatch. | Permission allowed/withheld/unknown according to the configured CMP; not “visitor explicitly agreed” merely because a boolean is true |
| Existing Google tag or GTM manages consent | Merchant explicitly selects this advanced integration contract. Hand allowlisted observations to the existing installation; its CMP/Consent Mode/tag rules govern collection. Do not silently switch here if the WP bridge breaks. | Consent managed by site tag/GTM; WConvert cannot verify permission or guarantee that no request is sent |

The second choice supports agency-managed Consent Mode and sites whose policy
does not expose WP Consent API. It is not a consent bypass and must not be labelled
“ignore consent.” Show that existing tags may send cookieless pings under advanced
Consent Mode. A site with no consent manager gets installation/configuration
guidance and no automatic claim of permission; choosing delegated handling is
an explicit site-owner configuration decision. WConvert does not choose the
site's jurisdiction, legal basis, region rules or basic/advanced mode.

The [WP Consent API documentation](https://wordpress.org/plugins/wp-consent-api/)
states that it can return true when no CMP sets a consent type, and that an
opt-out policy can allow a category before an explicit choice. Therefore API
presence or a single true return is insufficient to establish initialized policy.
Verify initialization/change handling and version-specific service-level support
in slice 1; do not map GA to `statistics-anonymous` or ignore a known service denial.

Keep analytics consent separate from email/SMS consent evidence. Re-evaluate the
selected policy on each event; never set permission to granted or change the CMP.
WConvert creates no pre-consent replay queue and never synthesizes a historical
impression after permission changes. In delegated handling, the existing Google
or GTM queue and consent behavior are outside WConvert's control—document that
distinction. The supplied GTM recipe defaults to requiring analytics consent for
the event tag; deliberately different advanced-mode behavior belongs to the
agency's configuration and must be tested and labelled accordingly.

Record supported plugin/CMP versions and observed request behavior. Do not mark
the setup “verified” from WP permission, a gtag callback or a successful data-layer
push; verification describes one tested page/session, not every future visitor.

These are product safeguards, not a declaration of legal compliance. Google
explains the distinction between
[basic and advanced Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode).
Existing functional campaign storage and anonymous native counters retain their
current contracts.

Update WConvert's data map, privacy-policy suggestions and documentation to say
that enabling the integration sends campaign observations to Google, whose tag
can attach its own identifiers and page context. WConvert does not read or store
those IDs. This needs an explicit clarification of ADR 0017: the native system
remains identifier-free, while the optional external integration participates in
the site's existing analytics context. Do not describe the combined system as
anonymous or guarantee that Google receives only WConvert parameters.
Google's [PII guidance](https://support.google.com/analytics/answer/6366371?hl=en)
also covers page URLs and titles; those can expose data independently of our
payload. Include a site-tag redaction check in the setup guide.

Register observers before immediate campaigns can appear. Emit promptly at the
semantic callback, before a redirect where applicable. Never delay submission,
close, navigation or rendering to await GA. Missing/blocked/throwing integrations
must leave capture working. No server fallback, Action Scheduler retry, stored
event log, backfill or network delivery guarantee. For missing tag readiness,
drop with an honest local diagnostic in v1; use the site's existing initialized
tag queue when available, and test delayed-tag configurations explicitly.
Do not define a replacement `gtag` stub, create a second tracker or read private
Google objects to guess readiness. The setup guide should describe preserving
the existing tag bootstrap's order when an optimizer delays network loading.
The semantic observer is installed synchronously before the campaign engine starts;
an optional later-loaded provider must not introduce a race with an immediate popup.

Google positions [Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4)
as a supplement to tagging. Do not introduce it merely to bypass blockers or
recover browser events: it creates separate consent, identity, attribution,
secret management and duplicate-delivery requirements.

## Extensible architecture

```text
Existing campaign lifecycle and accepted-capture callbacks
                         |
             Small semantic observation interface
                         |
          Payload allowlist + enabled/consent policy
                         |
               Analytics adapter interface
                 /          |           \
       Existing GA tag   GTM dataLayer   Plausible (next)

Accepted lead submissions → existing Destination system → CRM/email/webhooks
```

Keep the optional observation interface provider-neutral in shared code. Keep
managed analytics configuration, provider mapping and transports under a Pro
analytics module. The observer is not a public arbitrary event bus or a new
database. Adapters declare an ID, configuration validation, supported event
mapping, readiness result and non-blocking send operation. Separate readiness,
consent and dispatch observations in diagnostics.

Use one site option through the established OptionStore pattern, a schema
version and campaign exclusions/labels in existing draft/published configuration.
No new tables, credentials, Google OAuth connection, per-lead job or visitor
storage is required for the first release. Authenticated settings writes use
the existing capability and nonce conventions; validate IDs and configuration
server-side and serialize only public runtime settings.

When disabled, do not initialize provider transports or add a provider network
request. Budget the enabled module and any extra published metadata against the
repository's existing loader/payload limits. Do not hide growth in an unmeasured
lazy asset or raise build limits as part of this feature without a separate
justification. Avoid repeated DOM scans, network readiness polling, loading the
Google SDK twice, or sending screen-by-screen progress by default.

Keep GA4 and GTM mutually exclusive routes for the GA setup. Model the adapter
boundary so a later independently enabled Plausible adapter is possible, but
do not build a multi-provider routing UI, general capability framework or
workflow engine now. Add a second test adapter in verification to prove event
production does not depend on Google.

Plausible is the only selected next provider. Its
[custom events](https://plausible.io/docs/custom-event-goals) and
[custom properties](https://plausible.io/docs/custom-props/for-custom-events)
can represent the same campaign outcomes. The future adapter will use an existing
Plausible installation, define matching goals, and verify the customer's enabled
event/property support. Its consent requirements and capabilities get their own
review; do not copy GA-specific assumptions. Matomo, advertising pixels,
PostHog, server-side conversion APIs and report import are deferred.

## Delivery sequence and acceptance gates

| Slice | Deliverable | Completion evidence |
| --- | --- | --- |
| 1. Verify the contract | Short technical spike for semantic callbacks, consent interoperability, existing-tag readiness, capture mapping and GA DebugView. Finalize proposal-level details and an ADR. | A capture, inline appearance, click and quiz result each produce the intended observation; prove no duplicate primary capture conversion. Resolve direct-route consent support before building settings. |
| 2. Ship direct GA as a vertical slice | Pro module, persisted settings, campaign override/label, semantic observer, existing-tag adapter, payload allowlist. | One real campaign reaches a dedicated test GA property; the WP-gated route withholds dispatch when permission is denied/unknown; delegated handling is labelled and tested independently; missing GA does not affect capture. |
| 3. Add GTM | Data-layer adapter, single-route validation, versioned recipe/import and instructions. | Import reviewed in a test workspace; correct events and dimensions reach the test property exactly once through WConvert. Test custom data-layer name and absent-parameter clearing. |
| 4. Make setup supportable | Diagnostics, synthetic test, reporting guide, data map and privacy text, Free upgrade entry. | A tester distinguishes disabled, consent withheld/unknown/delegated, tag unavailable, handed off and externally verified. UI works on narrow screens, keyboard and RTL. |
| 5. Release validation | Focused automated tests, Free/paid artifact checks and real WordPress compatibility matrix. | Acceptance matrix below passes with recorded versions; external GA verification is recorded separately from local automated checks. |
| Later: Plausible | Reuse settings conventions and event producer; add mapping/transport and matching-goal guide. | Same campaign fixtures work without adding provider branches to presenters or lead capture. |

### Concrete scenario acceptance examples

| Scenario | Expected behavior |
| --- | --- |
| Existing Site Kit Google tag, supported initialized CMP | Direct events go to the configured stream only when the selected WP consent policy permits; no extra Google script or page view |
| Agency's GTM, no `window.gtag` | GTM route works through the configured data layer; lack of `gtag` is not an error for this route |
| No GA installation or wrong/unconfigured stream | Configuration can be saved disabled; explain the missing prerequisite; no false connection success |
| Popup is opened, closed and reopened repeatedly | Follow existing once-per-mounted-presentation impression/conversion guards; public open/close can repeat without manufacturing impressions |
| Two independent campaigns accept the same email | Two lead events; do not deduplicate by email, person, date or a global already-converted flag |
| Email accepted, optional SMS accepted, email Destination fails | One GA lead event; provider failure does not undo local capture or trigger another analytics send |
| Content lock opens using an earlier unlock receipt | No new lead/conversion; a new accepted capture uses the shared acknowledgement path |
| Request accepted server-side but response lost | No event until this browser receives a valid acceptance acknowledgement; retries within the same mounted journey must not emit twice |
| Visitor opts in after seeing the campaign | Future eligible lead event can be sent with no matching tracked appearance; no replay or invented impression |
| A/B winner promoted, campaign duplicated or template replaced | Apply the identity, preference and label rules above; no template-by-template instrumentation |
| Staff member tests a live campaign | Routine external tracking excluded by default for campaign managers; dedicated synthetic test remains available without changing production visitor settings |
| Production database copied to a staging hostname | Copied integration is inactive pending environment/site review; no automatic production-property pollution |
| Script blocked, callback throws or visitor leaves immediately | Campaign still works; event delivery is best effort; no forced navigation wait or retry through the server |

This is a browser outcome feature, not fraud-proof evidence: public pages and
tags can be manipulated. Do not treat a GA event as authorization, proof of a
saved Lead, provider delivery or a basis for a financial transaction.

Diagnostics are local and ephemeral; show the last few allowlisted observations
only in an explicit administrator test session. Do not add site-wide polling or
store visitor event histories. A dedicated **Send test event** sends
`wconvert_test` with `debug_mode` through the configured consent-respecting route;
it never creates a Lead, native conversion or `generate_lead`. Disclose that it
is a real analytics event and may appear in the selected property. Preview and
journey simulation remain silent unless that dedicated test is invoked.
A function call or GTM push is “handed off,” never “received by Google.” Only
external DebugView/Realtime observation verifies receipt. Real-conversion tests
belong in a dedicated test property because debug events are still real events.

Run diagnostics on a real front-end URL where the selected campaign and Google
tag can load. A wp-admin settings page usually does not load the visitor tag and
cannot establish this. Launch through the existing authorized front-end inspector
or a short-lived capability-checked session; never enable debug sending for all
visitors via an unauthenticated URL flag. Local inspection sends nothing to GA.
The explicit synthetic test can bypass staff/environment exclusion only for its
test target, but it never bypasses the selected consent policy. It must traverse
the same transport, with a `wconvert.test` GTM mapping that the supplied recipe
actually handles. Stop or expire test mode without changing the global stream.

Acceptance matrix:

- Popup, floating bar, slide-in, fullscreen and inline; inline below the fold;
  immediate display; deliberate close/reopen; A/B variants and promoted winner.
- Capture succeeds, fails validation, is spam-refused, times out, retries after an
  accepted server write, and adds optional SMS; one browser-acknowledged lead
  observation per mounted journey, with no exactly-once server-delivery promise.
- Click navigation, anonymous quiz completion, quiz contact before/after results,
  back/skip, content unlock and acknowledgement links; no false extra outcome.
- Both tag routes; explicit stream routing when multiple Google destinations
  exist; optimized/delayed scripts; tag blocked or absent; page cache; browser
  back/forward restoration; preview/admin and prerender exclusion.
- Consent pending/granted/denied/revoked and API exceptions; supported Site Kit/CMP
  setup and GTM consent recipe; API installed without a CMP; delayed region/policy
  initialization; supported service-specific denial; explicit delegated handling;
  no WConvert replay of pre-consent observations and no silent policy fallback.
- Allowlist tests plant contact fields, tokens and sensitive answers and assert
  none can reach the adapter; optional labels are bounded and clearly public.
- Site enable/disable, campaign exclusion, duplication, draft/publish, Pro absent,
  lower-tier artifacts, cached settings and reactivation behavior; template import,
  family exclusion through A/B promotion, staff versus logged-in customer,
  staging/site clone and multisite isolation.
- Focused Vitest/PHPUnit tests for affected seams, lint/typecheck, existing loader
  size/build and artifact-contract checks, then live browser/GA verification.
  Reuse public-event/journey/beacon tests; do not change native counter behavior.

Dependencies: an existing Google tag/GTM test setup, a dedicated GA4 property
and access to its DebugView, and the CMPs selected for supported interoperability.
No connected property has been inspected or changed in this planning task.

## Scope boundaries and decisions still to confirm

Accepted: event export only; existing tag/GTM; GA4 first; Plausible next; no Matomo.
Recommended defaults above can guide implementation without another broad design
interview. The remaining decisions are exact internal tier placement and the
supported consent setup matrix, followed by verification of event names and
payload/report recipes during slice 1. Implementation uses every paid tier and the fail-closed WP Consent API gate, with an explicit delegated alternative. Live GA receipt and specific CMP compatibility require a configured test property and remain release validation work.

Excluded from v1: embedded GA reports, Google login, tag installation, ad pixels,
enhanced conversions or contact hashes, arbitrary custom event builders, revenue
attribution claims, lead-quality lifecycle events, and per-visitor tracking owned
by WConvert. CRM/email integrations continue on their existing implementation plan.

## Implementation record — 2026-10-03

Implemented the GA4/GTM module, site settings, campaign preferences, privacy copy,
manager diagnostics, setup guide and a provider-neutral observation seam. No
template JSON edits were required. Content-lock acceptance now uses the same
public capture notification. Existing loader budgets remain unchanged; the
conditional adapter measures about 1.9 KB gzip.

Validation includes the full PHP/JavaScript suites, PHPStan, TypeScript, ESLint,
source/loader budgets, Free and all paid artifacts, and disposable WordPress on
PHP 8.1 browser scenarios for GA/GTM handoff, consent, progressive capture, quizzes,
content unlock, REST access control, settings and diagnostics. These browser
checks use recording tags and do not claim real Google receipt.

Still requires a configured external test environment before promoting the
integration as verified with a named CMP: real GA DebugView receipt, Tag Assistant
with the published GTM recipe, and chosen Site Kit/CMP combinations. No Google
property, container or merchant production settings were changed by this work.
