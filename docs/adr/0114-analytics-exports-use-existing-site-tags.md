# 0114 — Analytics exports use existing site tags

Date: 2026-10-03

## Decision

The managed analytics integration ships in every paid tier, disabled by default.
GA4 is the first provider; Plausible is next and has no shipped implementation.
Free retains native counters and the public browser events from ADR 0110.

The Pro presenter observes semantic impression, dismissal and conversion callbacks;
accepted leads use the existing first-acceptance notification. No template selectors,
form DOM listeners, private form values or visitor identities cross this seam.
Content lock now supplies the same accepted-lead notification as other presenters.
Provider-neutral observations and allowlisted campaign metadata feed an isolated
provider adapter. Future providers can consume this seam without editing templates.
The optional asset decorates the presentation session; only the campaign ID and
semantic act cross from that observer into the provider adapter. When the asset
is absent, the presenter is returned unchanged. Both registration and provider
failures remain isolated from campaign behavior.

One site route is selected: `gtag('event', ..., {send_to})` into an already configured
stream, or a namespaced `dataLayer.push` for a merchant-configured GTM event tag.
WConvert installs no Google tag, sends no server requests to Google, stores no API
secret and makes no receipt claim from a successful local call. No route fallback,
replay queue or cross-provider event deduplication is introduced.

Capture-driven campaigns emit `generate_lead` on first acknowledged acceptance.
Quiz completion emits `wconvert_conversion`; separate quiz contact capture uses
`generate_lead` with a secondary capture role. Optional follow-up signups do not
emit another lead. Impressions follow actual presentation, including viewport
visibility for inline forms. Existing journey/presenter deduplication remains owner.

## Consent and configuration

The default gate requires an initialized WP Consent API policy and statistics
permission, respecting explicit Google Analytics service denial checks.
Do not use `wp_has_service_consent` as an additional gate: an unregistered
service falls back to marketing, which would block statistics-only permission.
Use the category plus `wp_is_service_denied` when available.
Unknown permission withholds events. An explicitly selected alternative delegates
collection to the existing Google tag/GTM consent configuration; advanced Consent
Mode may issue cookieless requests. WConvert never grants consent. Permission is
checked for each observation; earlier withheld observations are not replayed.

A non-autoloaded site option contains enablement, route, stream ID, consent mode,
data-layer name and the optional dismissal/manager switches. No table or column is
added. Routine exports require the saved site URL and a production environment;
managers are excluded by default, ordinary signed-in customers are not.

Settings use the shared Region, loading/error states and footer. Connection and
consent use native radio chips; uncommon switches stay under Advanced settings.
Contextual tips and the setup guide carry supporting detail. Diagnostics open
from a separate test dialog after changes are saved. Successful saves are
reflected by the form state without a generic success message.

Campaign configuration contains an opt-out and bounded public label. Published
family preferences are projected separately from visitor payloads, including from
paused parents. The projection query includes previously published paused rows for
this inheritance only; paused rows never become visitor candidates. A winning A/B
child materializes the parent's preferences, preserving draft/live separation.
Duplication resets the public label. Campaign names, submitted values and lead IDs
are never copied into analytics metadata.

Publishing or changing the site settings purges known page caches via a published-
set action. Other caches still require clearing by the merchant. Deactivation or
an absent adapter asset must leave campaigns functional.

## Diagnostics and size

Manager-only diagnostics are explicit, uncached and locally inspect routine
activity without exporting it. An explicit synthetic action sends `wconvert_test`
with no campaign identity; the direct route requires a test stream ID. The panel
expires after ten minutes. Handoff does not establish Google receipt.

The optional analytics asset is separately capped at 4096 bytes gzip and is only
enqueued on eligible pages (or a manager's diagnostic page). Existing Free/Pro
loader ceilings are unchanged; the small semantic bridge fits those ceilings.
Artifact checks require the adapter and its setup guide in each Pro package.
Combined loader/analytics/phone costs are measured by `bin/check-analytics.mjs`.

No user research or live GA property receipt is claimed by repository/browser
checks. The integration guide covers GTM setup, custom dimensions, key events,
consent choices, duplicate tagging and differences from native counts.
