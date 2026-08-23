# ESP landscape for v1

Type: research
Status: resolved

## Question

Which third-party Destinations ship in v1, and what do their APIs demand of the
Destination contract?

Premium gating is already decided (third-party ESPs are premium; WSMS is free),
so this is about *which* and *what shape*, not whether.

Candidates to assess: Mailchimp, Klaviyo, ConvertKit/Kit, Brevo, ActiveCampaign,
MailerLite, HubSpot, and a generic Webhook. Note that WSMS already integrates
EmailOctopus and Mailtrap — worth knowing why those, since the same reasoning
may or may not transfer.

For each candidate, establish:

- Market share among WordPress site owners specifically — this is the primary
  ranking signal, not general popularity.
- Auth model: API key vs. OAuth. OAuth means a callback URL, token storage and
  refresh, and possibly an app-review process — a materially larger build than a
  pasted key, and it changes the settings UI.
- The add-a-contact-to-a-list call: endpoint, required fields, whether lists or
  tags or both, and whether custom fields need discovery.
- Rate limits and whether they force async pushing.
- Double opt-in behaviour — several ESPs own this, which bears directly on
  *Consent, privacy and retention*.
- Any that offer a WordPress-native path worth preferring over raw HTTP.

Deliver a ranked shortlist with a recommended v1 set, plus the specific
constraints the *Destination contract* must accommodate (the OAuth ones and the
rate-limited ones are what shape it).

## Answer

**v1 set: Mailchimp, MailerLite, Brevo, Kit — plus a generic outbound Webhook. No
OAuth in v1.**

### Ranking used WP-specific evidence, not general popularity

wp.org active installs, read 2026-08-23: MC4WP **1,000,000**; HubSpot `leadin`
**200,000**; Klaviyo / Brevo / MailerLite **100,000** each; Kit and ActiveCampaign
**40,000**; EmailOctopus **3,000**. Mailtrap has **no official plugin at all**.

Raw counts were cross-checked against which ESPs Elementor Pro, WPForms, Fluent Forms,
Popup Maker and Hustle actually ship. Mailchimp and Kit appear in **5/5**, Klaviyo in
**1/5** — and that check is what promotes Kit over Klaviyo despite 40k vs 100k installs.
Kit is also the natural ESP for the *Deliver a lead magnet* Goal.

### Deferred to v1.1 on build shape, not demand

- **HubSpot** — its cheap path (unauthenticated `api.hsforms.com` Forms endpoint,
  `security: []`) has no list discovery and no field mapping: a different contract shape
  entirely.
- **Klaviyo** — required `revision` header with a dated `410 Gone` cliff, a standing
  maintenance obligation, and installs that are WooCommerce-weighted.
- **ActiveCampaign** — 5 req/s *per customer account*, shared with their other
  integrations; numeric field IDs that are not portable across accounts.
- **EmailOctopus** — cheapest possible build, negligible WP demand.
- **Mailtrap** — out permanently.

### Push must be QUEUED, not synchronous

Mailchimp documents a 120-second timeout against only a 10-simultaneous-connection cap;
WP's own `wp_remote_*` default timeout is 5s (`class-wp-http.php:181`); Kit needs 2
calls per lead against 120 req/min. Action Scheduler, one job per (Lead × Destination),
**local Lead row written first** — matching WSMS's `OutboundSyncManager` →
`MarketingPushContactJob` → `as_enqueue_async_action` precedent, and matching the
write-order constraint that *WSMS integration surface* (04) arrived at independently.

### Constraints on the Destination contract (15 in full; the shaping ones)

- **`retryable` must be a Destination-set flag, not derived from HTTP status.**
  Mailchimp packs four terminal cases into `400` — three of them undocumented — while a
  bodyless `403` *is* retryable. Klaviyo returns `400` for a bad key.
- **No vendor offers an idempotency header**, so every push must use the vendor's
  email-keyed upsert.
- **`push()` is not one HTTP call.** Kit needs 2–3; HubSpot CRM needs an ID round-trip.
- **Field-key type differs per vendor**, and ActiveCampaign's numeric IDs are not
  portable between accounts.
- **Double opt-in has three incompatible shapes and cannot be one boolean:**
  caller-chooses (Mailchimp / MailerLite / EmailOctopus), separate endpoint with its own
  required config (Brevo — `templateId` + `redirectionUrl`), or not the caller's choice
  at all (Klaviyo / Kit / ActiveCampaign / HubSpot). Direct input to *Consent, privacy
  and retention* (10).
- **"Success" never means "subscribed"** — 5 of 9 vendors silently accept suppressed
  addresses.

### Why EmailOctopus and Mailtrap in WSMS — and why that does not transfer

EmailOctopus is a **reference implementation**: five capability interfaces from one
pasted key and a 227-line client. Mailtrap is a **free rider** — `getAuthType()` returns
`'gateway'`, `getAuthSchema()` returns `[]`, and it borrows the premium Mailtrap *email
sending gateway's* token, which WSMS holds for another purpose entirely.

Neither rationale transfers as a shipping decision: WConvert's ESPs are a paid
conversion feature, and WConvert holds no ESP credential for any other purpose. The
**structure** transfers — capability interfaces, `SyncResult.retryable`,
`getAuthSchema()`, per-integration `RateLimiter`, Action Scheduler.

### Biggest booked risk

**Kit explicitly disclaims supporting API keys for public integrations** — *"We do not
offer any official support for apps or public integrations that rely upon API keys for
authentication."* The header works today, so v1 needs no OAuth; but Kit could gate it or
decline support tomorrow, and the fallback is OAuth gated on Kit's **per-creator
approval queue** — an L-sized build with an external dependency. Ship it, and treat Kit
as the Destination most likely to need rework. Dropping Kit for a three-ESP v1 is
explicitly called defensible.

Full findings, with the exact subscribe call per vendor and all 15 contract constraints:
[`research/05-esp-landscape-for-v1.md`](../research/05-esp-landscape-for-v1.md)
on branch `research/05-esp-landscape-for-v1`.
