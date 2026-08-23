# Ticket 05 — ESP landscape for v1

**Researched 2026-08-23.** All vendor API facts were read from the vendor's own
developer documentation (or its published OpenAPI schema) on that date; the API
version is stated per candidate. All WordPress install counts were read on
2026-08-23 from the wp.org plugin directory's own API,
`https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=<slug>`,
which returns the same rounded `active_installs` figure the directory shows.
WSMS citations are `path:LINE` relative to
`/Users/navidkashani/Local Sites/wsms8/app/public/wp-content/plugins/wp-sms-premium`
(read only). Anything not from a vendor-owned or first-party source is tagged
**SECONDARY** with a confidence note.

---

## 1. Answer

**Ship four third-party ESPs in v1 — Mailchimp, MailerLite, Brevo and Kit — plus
a generic outbound Webhook, and nothing that needs OAuth.** The ranking signal
was WordPress-specific evidence, not general market share: Mailchimp is
unarguable (MC4WP alone is **1,000,000** active installs, and Mailchimp is the
only ESP present in all five competing WP form/optin plugins surveyed, and the
only one in Fluent Forms' *free* tier), while MailerLite (**100,000**, official),
Brevo (**100,000**, official) and Kit (**40,000** official but present in 5 of 5
competitor lists, and the natural home for the *Deliver a lead magnet* Goal) are
the next tier that is also cheap to build — all four authenticate with a single
pasted key and all four reach a subscribed contact in one or two HTTP calls.
**HubSpot (200,000), Klaviyo (100,000) and ActiveCampaign (40,000) are deferred
to v1.1 on build shape, not on demand** — HubSpot's cheap path needs no list
discovery and no field mapping at all (a different contract shape), Klaviyo's
required `revision` header carries a dated `410 Gone` break and its WP install
base is WooCommerce-weighted (it appears in only 1 of 5 competitor lists), and
ActiveCampaign's 5 req/s ceiling is *per customer account* shared with every
other integration they run. **EmailOctopus and Mailtrap are out** — 3,000 and
zero official wp.org installs respectively. **The push must be queued, never
synchronous**: Mailchimp documents a 120-second request timeout against a
10-simultaneous-connection cap, Kit needs two calls per lead against 120
requests/minute, and WordPress's own `wp_remote_*` default timeout is 5 seconds
(`wp-includes/class-wp-http.php:181`, WP 7.1) — a synchronous push either hangs
the visitor's form POST or drops the lead.

**Deferred, in the order they should land:** HubSpot (via the unauthenticated
Forms submission endpoint), EmailOctopus (cheapest possible build; WSMS already
has a working client to copy), ActiveCampaign, Klaviyo. **Never:** Mailtrap —
it has no official WordPress plugin and no API-addressable double-opt-in state.
The generic Webhook is what makes deferring all of them survivable.

---

## 2. Ranking table

### 2.1 The candidates

Ranked by WordPress-specific install evidence, which is the primary signal.
"Competitor presence" is out of the five WP form/optin plugins surveyed in §2.2.
Build cost is S/M/L for a WConvert Destination talking raw HTTP over
`wp_remote_request()`.

| Candidate | WP install evidence (2026-08-23) | Competitor presence | Auth | List / tag model | Rate limit | Double opt-in owner | Build | v1? |
|---|---|---|---|---|---|---|---|---|
| **Mailchimp** | `mailchimp-for-wp` **1,000,000** (3rd-party MC4WP); official `mailchimp` **60,000**; `mailchimp-for-woocommerce` **200,000** | **5 / 5** | API key, DC in the key suffix (`-us14`). OAuth optional, no review, tokens never expire | audience ID **required**, discovered via `GET /lists`; tags separate (2nd call on the PUT path) | **10 simultaneous connections**, no RPS quota; 120 s timeout | **Caller chooses** — `pending` vs `subscribed` | **S** | ✅ |
| **HubSpot** | `leadin` **200,000** (official) | 4 / 5 | **API keys sunset 30 Nov 2022.** Private-app token (super-admin, ~8 steps) or hosted OAuth. **Or the Forms endpoint: no auth at all** | lists take **record IDs, not emails** (2-call flow); properties must pre-exist | 100–190 / 10 s (private app); 110 / 10 s (OAuth); **50 / 10 s** (Forms) | **None** — no `PENDING` state | **M** (Forms) / **L** (OAuth) | ⏸ v1.1 |
| **Klaviyo** | `klaviyo` **100,000** (official, WooCommerce-weighted) | **1 / 5** | private `pk_` key + **required `revision` header** | list ID **optional**; no per-contact tags (use `properties`) | 75 / s burst, 750 / min steady | **Klaviyo** — list `opt_in_process`, not the caller's | **M** | ⏸ v1.1 |
| **Brevo** | `mailin` **100,000** (official) | 3 / 5 | `api-key` header | `listIds` inline on the create call; discovery `GET /v3/contacts/lists` (`limit` max 50) | **10 RPS / 36,000 RPH** (all plans) | **Separate endpoint** with its own required `templateId` + `redirectionUrl` | **M** | ✅ |
| **MailerLite** | `official-mailerlite-sign-up-forms` **100,000** (official) | 4 / 5 | `Authorization: Bearer` + `X-Version` pin | **groups** inline; discovery `GET /api/groups`; no tags at all | 120 / min — **but 5 / min if you batch subscriber upserts** | **Caller chooses** — `status: "unconfirmed"` (gated on an account toggle) | **S** | ✅ |
| **Kit** (ConvertKit) | `convertkit` **40,000** (official) | **5 / 5** | `X-Kit-Api-Key` — **but Kit disclaims supporting API keys for public integrations**; OAuth needs Kit's approval | **no lists** — forms, tags, sequences; **2 calls per lead** | **120 / min** on API keys (600 / min on OAuth) | **The form** — `state: "inactive"` until confirmed | **M** | ✅ |
| **ActiveCampaign** | `activecampaign-subscription-forms` **40,000** (official, **last updated 2025-11-14**, flagged untested on the last 3 WP releases) | 4 / 5 | `Api-Token` + a **full per-account base URL the user must paste**. No OAuth into the API | lists need discovery (`limit` defaults to 20); **tags auto-create by name** | **5 / s, per customer account, shared with every other integration** | **None writable on v3** | **M** | ⏸ v1.1 |
| **EmailOctopus** | `emailoctopus` **3,000** (official) | 1 / 5 (MailOptin) | `Authorization: Bearer` | `PUT /lists/{id}/contacts` upsert; `GET /lists` | 10 / s sustained, burst 100 | **EmailOctopus** — send `status: "pending"` | **S** | ⏸ v1.1 |
| **Mailtrap** | **no official wp.org plugin** (searched 2026-08-23; only 3rd-party `mailtrap-for-wp`, 300 installs) | 0 / 5 | `Api-Token` or Bearer | `PATCH /api/contacts/{email}` upsert; `GET /api/contacts/lists` | 200 / 60 s per account for Contacts | **None in the API** (UI-only) | S | ❌ |
| **Generic Webhook** | n/a | 5 / 5 (all ship one) | user-supplied URL + optional shared secret | **none — no discovery, no field IDs** | whatever the receiver imposes | n/a | **S** | ✅ |

### 2.2 The corroborating WordPress evidence

Raw install counts alone would rank Klaviyo above Kit. They do not survive a
second WP-specific check: which ESPs the plugins that already do this job in
WordPress actually ship. Read 2026-08-23 from each vendor's own page.

| Plugin (installs) | ESPs it ships |
|---|---|
| **Elementor Pro** (free Elementor: `elementor` **10,000,000**) — <https://elementor.com/help/form-widget/> | ActiveCampaign, AWeber, ConvertKit, Drip, GetResponse, **HubSpot**, **MailChimp**, **MailerLite**, MailPoet, Zapier. **No Klaviyo. No Brevo.** |
| **WPForms** (`wpforms-lite` **5,000,000**) — <https://wpforms.com/addons/> | ActiveCampaign, AWeber, **Brevo**, Campaign Monitor, Constant Contact, Drip, GetResponse, **Klaviyo**, **Kit**, **MailerLite**, **Mailchimp**, Mailpoet, SendGrid, **HubSpot** — all Pro |
| **Fluent Forms** (`fluentform` **700,000**) — <https://wordpress.org/plugins/fluentform/> | **free: Mailchimp** (+ FluentCRM, Mailpoet, Mautic). Pro: ActiveCampaign, **Brevo**, Campaign Monitor, Constant Contact, **Kit**, CleverReach, Drip, GetResponse, **HubSpot**, iContact, **MailerLite**, … **No Klaviyo.** |
| **Popup Maker** (`popup-maker` **700,000**) — <https://wordpress.org/plugins/popup-maker/> | "MailChimp, AWeber, InfusionSoft, GetResponse, Convertkit, Constant Contact, Mail Poet, Mad Mimi, FluentCRM, Hubspot, Emma". **No Klaviyo. No Brevo. No MailerLite.** |
| **Hustle** (`wordpress-popup` **90,000**) — <https://wordpress.org/plugins/wordpress-popup/> | AWeber, ActiveCampaign, Campaign Monitor, **MailChimp**, Constant Contact, **ConvertKit**, GetResponse, Mailster, **Hubspot**, Sendy, Mad Mimi, Mautic, Infusionsoft, **Brevo**, MailPoet, **MailerLite**, iContact, Zapier, SendGrid, Zoho CRM, Newsletter. **No Klaviyo.** |

Two conclusions the raw counts do not give you:

- **Mailchimp and Kit/ConvertKit are the only ESPs in all five.** Kit's 40,000
  official installs understate it badly — every competitor treats it as table
  stakes.
- **Klaviyo appears once, in WPForms.** Its 100,000 installs are for a plugin
  whose own wp.org listing says non-WooCommerce sites get "reduced
  functionality"; its rating is 2.8/5. That is ecommerce demand, not
  lead-capture demand. This is the clearest case in the report of general market
  share diverging from *WordPress lead-capture* market share, and it is why the
  ticket's instruction to rank on WP-specific evidence changes the answer.

One further corroboration: the third-party `contact-form-7-mailchimp-extension`
(**40,000** installs) is titled *"Connect Contact Form 7 to Mailchimp, Brevo,
MailerLite & Klaviyo"* — an independent WP developer, picking four, picked three
of ours.

## 3. Per-candidate detail

Every subscribe call below was read from the vendor's own reference on
2026-08-23. Where a fact comes from anything other than a vendor-owned page it
is marked **SECONDARY** with a confidence note.

### 3.1 Mailchimp — Marketing API `3.0`

**WP evidence.** MC4WP `mailchimp-for-wp` — **1,000,000** active installs, updated
2026-08-20, author *Danny van Kooten* (third party). Mailchimp's own
`mailchimp` (Mailchimp List Subscribe Form) — **60,000**, updated 2026-06-03;
`mailchimp-for-woocommerce` — **200,000**, updated 2026-08-07; both authored by
`profiles.wordpress.org/mailchimp`. Read 2026-08-23 from the wp.org plugin API.
Mailchimp is the only ESP that appears in *every* competitor list surveyed
(§2.2), and is the only ESP in Fluent Forms' **free** tier.

**Auth — API key, not deprecated.** Key format `…-us14`; the segment after the
hyphen *is* the datacenter and the base URL is `https://<dc>.api.mailchimp.com/3.0/`.
Either `Authorization: Bearer <key>` or HTTP Basic with any username.
<https://mailchimp.com/developer/marketing/docs/fundamentals/>
OAuth 2 exists (registered app at the Registered Apps page, `POST https://login.mailchimp.com/oauth2/token`),
**needs no app review**, and — unusually — **tokens never expire**, so there is no
refresh loop; the datacenter comes from `https://login.mailchimp.com/oauth2/metadata`.
<https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/>
For a self-hosted plugin the pasted key is strictly better: OAuth would need a
WConvert-hosted callback and buys nothing.

**The subscribe call — upsert, keyed by MD5.**

```http
PUT https://<dc>.api.mailchimp.com/3.0/lists/{list_id}/members/{subscriber_hash}
Authorization: Bearer <api_key>
Content-Type: application/json

{ "email_address": "a@b.com",
  "status_if_new": "pending",
  "merge_fields": { "FNAME": "Ada" } }
```

`subscriber_hash` is *"The MD5 hash of the lowercase version of the list member's
email address"* — `md5(strtolower(trim($email)))`
(<https://api.mailchimp.com/schema/3.0/Definitions/Lists/Members/Response.json>).
Required for `PUT`: `["email_address", "status_if_new"]`
(<https://api.mailchimp.com/schema/3.0/Definitions/Lists/Members/PUT.json>).
Required for `POST /lists/{list_id}/members`: `["email_address", "status"]`
(<https://api.mailchimp.com/schema/3.0/Definitions/Lists/Members/POST.json>).

**Lists and tags.** Audience ID is mandatory and must be discovered:
`GET /lists` (<https://mailchimp.com/developer/marketing/api/lists/get-lists-info/>).
Tags are per-contact and separate. `tags` is accepted inline on the **POST**
schema but is **absent from the PUT schema** — so an upsert that also needs tags
costs a second call to
`POST /lists/{list_id}/members/{subscriber_hash}/tags` (body requires `name` *and*
`status`). Groups/interests are a third concept keyed by interest ID.

**Merge fields — discovery required.** `FNAME`, `LNAME`, `ADDRESS`, `PHONE`
exist by default in every new audience; anything else must be created first.
Discover with `GET /lists/{list_id}/merge-fields`, create with `POST` of the same
(<https://mailchimp.com/developer/marketing/docs/merge-fields/>). Required merge
fields are validated by default; the escape hatch `?skip_merge_validation=true`
avoids a hard failure but silently drops data. `address` needs a structured
object with `addr1`/`city`/`state`/`zip`.

**Rate limits — a concurrency cap, not a quota.** *"The Marketing API has a limit
of 10 simultaneous connections. You'll receive a 429 error if you reach the
limit."* Plus: *"At exceptionally high volumes, you may receive an HTTP 429 or
403 without a JSON body"*, and a **120-second** request timeout.
<https://mailchimp.com/developer/marketing/docs/fundamentals/>
There is no documented requests-per-second quota. This is the single strongest
argument against a synchronous push: a slow Mailchimp response can hang a form
POST for up to two minutes, and ten concurrent submissions exhaust the cap.

**Double opt-in — owned by Mailchimp, and *you choose per call*.** The audience
carries a `double_optin` flag, but the status you send wins. Status enum on
POST/PUT: `subscribed`, `unsubscribed`, `cleaned`, `pending`, `transactional`
(PATCH omits `transactional`). `pending` is the double-opt-in state and
**Mailchimp sends the confirmation email** — *"waiting for user action to confirm
the double opt-in via email confirmation or SMS message"*
(<https://mailchimp.com/developer/marketing/docs/audiences-introduction/>).
Sending `subscribed` bypasses confirmation regardless of the audience setting.

**Idempotency.** `PUT` is a true upsert and the MD5-in-the-path *is* the
idempotency key — there is no `Idempotency-Key` header. Use `status_if_new` so a
re-submit never stomps an existing member's status. `POST` on an existing email
fails 400.

**Errors.** RFC7807-ish body: `type`, `title`, `status`, `detail`, `instance`.
The official glossary (<https://mailchimp.com/developer/marketing/docs/errors/>)
lists `Bad Request`, `Invalid Resource`, `API Key Invalid`, `Forbidden`,
`Resource Not Found`, `TooManyRequests`, `InternalServerError` — and **none of
the three cases the Destination contract actually cares about**:

- *already subscribed* → 400 `Member Exists`, `detail` = `"… is already a list member. Use PUT to insert or update list members."` — **SECONDARY**, but the JSON is a verbatim captured response in Mailchimp's own (archived) `mailchimp/APIv3-examples` repo (<https://github.com/mailchimp/APIv3-examples/issues/49>). High confidence. Terminal, treat as success-equivalent.
- *invalid email* → 400 `Invalid Resource`. The famous `"… looks fake or invalid, please enter a real email address."` string is **SECONDARY, low confidence** — widely reported, absent from every Mailchimp doc page. Terminal. Note `Invalid Resource` is *also* what a merge-field failure returns, so `detail`/`errors[].field` must be parsed to tell them apart.
- *suppressed / cleaned / compliance state* → 400, `"… is already a list member in compliance state due to unsubscribe, bounce, or compliance review and cannot be subscribed."` — **SECONDARY, low confidence on the exact wording**; the *behaviour* is vendor-confirmed: *"Contacts who unsubscribe themselves will need to resubscribe through your signup form"* (<https://mailchimp.com/help/resubscribe-a-contact/>). **Terminal, never retry.** The documented workaround is to send `pending` instead of `subscribed` so Mailchimp re-asks for consent.

**WordPress-native path.** The PHP SDK `mailchimp/marketing` is a trap: latest
stable **3.0.80, released 2022-11-02** (read from
<https://packagist.org/packages/mailchimp/marketing.json>, 2026-08-23 — 3.8 years
stale), requires `guzzlehttp/guzzle` + `guzzlehttp/psr7`, and its `composer.json`
declares `"license": "proprietary"`, which is a live problem for a GPL wp.org
submission. **Do not bundle.** Two endpoints over `wp_remote_request()`.

---

### 3.2 MailerLite — `connect.mailerlite.com/api`

**WP evidence.** `official-mailerlite-sign-up-forms` — **100,000** active
installs, updated 2026-06-26, author `profiles.wordpress.org/mailerlite`
(official). Read 2026-08-23. Appears in 4 of the 5 competitor lists in §2.2.

**Auth — Bearer token, no OAuth at all.** `Authorization: Bearer XXX`,
`Content-Type: application/json`, `Accept: application/json`, plus an optional
but *strongly recommended* `X-Version: 2038-01-19` pin — without it *"All
requests use the latest version"*.
<https://developers.mailerlite.com/docs/>
Two operational traps worth surfacing in the settings UI: keys are *"permanently
bound to the user who created them"* and stop working if that user is removed;
and MailerLite **Classic** (accounts created before March 2022,
`api.mailerlite.com/api/v2`, header `X-MailerLite-ApiKey`) is a different API
whose token does **not** work here
(<https://www.mailerlite.com/help/which-version-of-mailerlite-am-i-using>).
MailerLite's own plugin carries both clients and probes at runtime
(`src/Api/MailerLiteAPI.php` vs `src/Api/RewriteAPI.php`,
<https://plugins.svn.wordpress.org/official-mailerlite-sign-up-forms/trunk/src/Api/>).
WConvert should target the new API only and say so in the error message.

**The subscribe call — one call, upsert by default.**

```http
POST https://connect.mailerlite.com/api/subscribers
Authorization: Bearer <token>
Content-Type: application/json

{ "email": "a@b.com",
  "fields": { "name": "Ada" },
  "groups": ["4243829086487936"],
  "status": "unconfirmed" }
```

*"If a subscriber already exists, it will be updated with new values. This is
non-destructive operation, so omitting fields or groups will not remove them."*
**`201` = created, `200` = already existed** — that pair is the created/updated
signal. <https://developers.mailerlite.com/docs/subscribers.html>

**Groups, not lists or tags.** `groups` *"must contain existing group ids"* — no
create-by-name. Discover with `GET /api/groups`; create with `POST /api/groups`.
There is **no tag concept**. Group IDs are strings exceeding 2^53 — never decode
them into PHP numbers.

**Custom fields — name-keyed, must pre-exist, and read back under a different
key.** `GET /api/fields`, `POST /api/fields` with only three types: `text`,
`number`, `date`. You **write** by `name` but responses come back keyed by
`key` — a field named `ZIP` reads back as `z_i_p`
(<https://developers.mailerlite.com/docs/fields.html>). Persist both.

**Rate limits — 120/min, plus a 5/min trap.** *"MailerLite API has a global rate
limit of 120 requests per minute"*, `429` with `X-RateLimit-Limit`,
`X-RateLimit-Remaining`, `Retry-After`. **But** import endpoints are capped at
**5 requests per minute**, and *"Batch requests where all items are `POST api/subscribers`"*
are silently reclassified as an import
(<https://developers.mailerlite.com/docs/batching.html>). The obvious
optimisation — batch queued leads into one `POST /api/batch` — drops throughput
by 24×. **Do not batch pure-subscriber upserts.**

**Double opt-in — the cleanest of any candidate.** Status enum: `active`,
`unsubscribed`, `unconfirmed`, `bounced`, `junk`. Sending `"status": "unconfirmed"`
puts the subscriber in the pending state and MailerLite sends the confirmation
email — gated on an account toggle, *"Double opt-in for API and integrations"*
(<https://www.mailerlite.com/help/how-to-use-double-opt-in-when-collecting-subscribers>).
Confirmation email is throttled to once per 24h per subscriber. **The toggle is
not readable from the API**, so the same call yields single or double opt-in
depending on account config WConvert cannot see — the settings UI must say so.

**Idempotency.** Clean upsert, no duplicate error. Unsubscribed subscribers are
*not* silently resurrected — that needs `"resubscribe": true`, which should be an
explicit, off-by-default option.

**Errors.** Laravel envelope: `{"message": "...", "errors": {"email": ["..."]}}` —
note `errors` is an **object keyed by field**, values are arrays. `401` returns
`{"message":"Unauthenticated."}` with **no `errors` key at all**. Invalid email →
`422`. Already exists → not an error, `200`. Suppressed/bounced → **no documented
error shape**; governed by `resubscribe`, not by a code.

**WordPress-native path.** `mailerlite/mailerlite-php` v1.0.5 (2025-11-12) is
maintained but its dependency graph is the php-scoper worst case —
`php-http/discovery` resolves an HTTP client at runtime by scanning installed
classes, which prefixing breaks (or worse, makes it find an *unscoped* copy from
another plugin). **MailerLite's own WP plugin has no `composer.json` at all** and
hand-rolls a namespaced client. Follow that precedent.

---

### 3.3 Brevo (formerly Sendinblue) — API `v3`

**WP evidence.** `mailin` — **100,000** active installs, updated 2026-06-24,
author `profiles.wordpress.org/neeraj_slit` listed as *Brevo* (official). Read
2026-08-23. Appears in 3 of 5 competitor lists. Also in the third-party
`contact-form-7-mailchimp-extension` (40,000 installs), whose title —
*"Connect Contact Form 7 to Mailchimp, Brevo, MailerLite & Klaviyo"* — is itself
a market signal about which four a WP connector author picks.
**In-house bonus:** WSMS already ships a `BrevoProvider` SMS gateway
(`premium/modules/premium-gateways/src/Provider/BrevoProvider.php`), so the brand
and the credential shape are already known to the VeronaLabs stack.

**Auth — `api-key` header, unreservedly fine for a distributed plugin.** From the
live OpenAPI `securitySchemes` (<https://api.brevo.com/v3/swagger_definition_v3.yml>,
fetched 2026-08-23): `in: header, name: api-key, type: apiKey`.
<https://developers.brevo.com/docs/api-key-authentication>
OAuth 2 exists but is explicitly scoped to *"Private integrations within your
organisation"*, set up via the Brevo CLI
(<https://developers.brevo.com/docs/authentication-schemes>). Not a distribution
path, and not needed.

**The subscribe call — one call, and it list-assigns too.**

```http
POST https://api.brevo.com/v3/contacts
api-key: <key>
Content-Type: application/json

{ "email": "a@b.com",
  "attributes": { "FIRSTNAME": "Ada" },
  "listIds": [36],
  "updateEnabled": true }
```

`201` created; **`204` updated** (empty body) when `updateEnabled: true` matches an
existing contact. <https://developers.brevo.com/reference/create-contact>
`POST /v3/contacts/lists/{listId}/contacts/add` exists for already-existing
contacts (max 150 per call, returns `{success: [], failure: []}`) but is not the
hot path.

**Lists.** First-class, integer IDs, discovery via `GET /v3/contacts/lists` —
**`limit` maxes at 50**, so paginate. The response's `totalSubscribers` /
`totalBlacklisted` are being dropped to `0`; don't render counts from it.
<https://developers.brevo.com/reference/get-lists>

**Custom fields — must pre-exist, keys must be UPPERCASE.** *"The attribute's
parameter should be passed in capital letter… Values that don't match the
attribute type … will be ignored. These attributes must be present in your Brevo
account."* Discover via `GET /v3/contacts/attributes`, create via
`POST /v3/contacts/attributes/{category}/{name}`. **Footgun:** an *unknown*
attribute errors, but a **type mismatch on a known attribute is silently
dropped** with a `201` — a badly formatted date just vanishes.

**Rate limits — the most generous of the shortlist.** Contacts endpoints:
**10 RPS / 36,000 RPH** on the General tier (all plans); 20/72,000 Advanced;
60 RPS Extended. Headers on every response: `x-sib-ratelimit-limit`,
`x-sib-ratelimit-remaining`, `x-sib-ratelimit-reset`. No `Retry-After`.
<https://developers.brevo.com/docs/api-limits>, <https://developers.brevo.com/docs/limit-headers>

**Double opt-in — a wholly separate endpoint, and the most expensive to support.**

```http
POST https://api.brevo.com/v3/contacts/doubleOptinConfirmation
{ "email": "a@b.com", "includeListIds": [36],
  "redirectionUrl": "https://site.test/thanks", "templateId": 2 }
```

All four fields are `required`. `201` created / `204` updated, **both with empty
bodies** — no contact id comes back.
<https://developers.brevo.com/reference/create-doi-contact>
Consequences: a second code path, a **DOI template the user must create in Brevo
first**, a `redirectionUrl` field in the settings UI, and a template that must
contain the `{{ params.DOIurl }}` merge tag or the confirmation email ships with
no confirm link. Validate both at settings-save time, not at first submit.

**Idempotency.** Default is an **error**: `updateEnabled` defaults to `false`, and
a duplicate then returns `400` with
`{"code":"duplicate_parameter","message":"email is already associated with another Contact","metadata":{"duplicate_identifiers":["email"]}}`.
Always send `updateEnabled: true`. Do **not** enable `forceMerge` — it deletes the
losing contact.

**Errors.** A real, documented enum. `contactErrorModel.code` ∈
`invalid_parameter, missing_parameter, document_not_found, account_in_process,
duplicate_parameter, method_not_allowed, out_of_range`. Invalid email → `400`
`invalid_parameter`. Already subscribed → `400` `duplicate_parameter` (or `204`
with `updateEnabled`). **Suppressed → no error at all**: a blocklisted contact is
created/updated and added to the list, returns success, and receives nothing;
`emailBlacklisted` is a state, not a rejection. `425 Too Early` is present in the
OpenAPI on `POST /v3/contacts` — treat as retryable.

**WordPress-native path.** `getbrevo/brevo-php` v5.0.2 (2026-08-10) is actively
maintained and PSR-18 based (Guzzle is dev-only), but it requires **PHP ^8.1** —
Brevo's own `mailin` plugin requires only PHP 5.6 — and pulls
`php-http/discovery`, with the same runtime-discovery-vs-scoper hazard as
MailerLite's. Four endpoints. Hand-roll.

---

### 3.4 Kit (formerly ConvertKit) — API `4.0`

**WP evidence.** `convertkit` — **40,000** active installs, updated 2026-08-19,
author `profiles.wordpress.org/convertkit` (official, now branded *Kit*). Read
2026-08-23. Lower raw installs than Klaviyo/Brevo/MailerLite, but Kit/ConvertKit
appears in **all five** competitor lists in §2.2 — the widest coverage of any
candidate except Mailchimp — and it is the natural ESP for the *Deliver a lead
magnet* Goal.

**Auth — API key works, but Kit disclaims supporting it for public integrations.**
V4 offers exactly two mechanisms: OAuth 2.0 *"for apps available for all creators
in the Kit App Store"* and API keys *"for automating simple tools and integrations
for your own account"*, header `X-Kit-Api-Key`. Verbatim: *"We do not offer any
official support for apps or public integrations that rely upon API keys for
authentication - for apps, please follow the OAuth guide."*
<https://developers.kit.com/api-reference/authentication>
OAuth needs a registered app **and Kit's approval** — *"developers have to request
access on behalf of a creator to us to approve"*
(<https://developers.kit.com/kit-app-store/building-apps>). V3
(`api.convertkit.com/v3`, `api_key` query param) is deprecated, *"no longer in
active development"*, with no sunset date, and *"We no longer support the creation
of new integration keys for V3"*
(<https://developers.kit.com/api-reference/v3/authentication>).
**This is a real risk to book, not a footnote** — see §7.

**The subscribe call — two calls, always.** Every form/tag/sequence subscribe
endpoint carries the same warning: *"The subscriber being added to the form must
already exist."*
<https://developers.kit.com/api-reference/forms/add-subscriber-to-form-by-email-address>
This is a behavioural break from V3, where the form endpoint created the
subscriber inline.

```http
POST https://api.kit.com/v4/subscribers
X-Kit-Api-Key: <key>
{ "email_address": "a@b.com", "first_name": "Ada",
  "state": "active", "fields": { "last_name": "Lovelace" } }
-- 201 created / 200 updated (upsert)

POST https://api.kit.com/v4/forms/{form_id}/subscribers
X-Kit-Api-Key: <key>
{ "email_address": "a@b.com", "referrer": "https://site.test/page" }
-- 201 added / 200 already added
```

The form endpoint's request body accepts **only** `email_address` and `referrer` —
`first_name` and `fields` are response-only, so names and custom fields must be
set on the first call. Tagging is a third call:
`POST /v4/tags/{tag_id}/subscribers` with `{"email_address": "..."}`.

**No lists — forms, tags and sequences.** One flat subscriber pool; acquisition is
by form, segmentation by tag. Discovery: `GET /v4/forms` (filter `type=embed|hosted`,
`status` default `active`, cursor paging, `per_page` default 500), `GET /v4/tags`,
`GET /v4/sequences`.

**Custom fields — must exist, and are keyed by `key` not label.** *"If you include
a custom field key that does not exist on your account, the request returns an
error."* `GET /v4/custom_fields` returns three identifiers per field: `label`
(`Last name`), `key` (`last_name` — **this is what goes in `fields`**), and `name`
(`ck_field_1_last_name`). `POST /v4/custom_fields` creates one. Max 140 fields per
request; **`state` cannot be updated through this endpoint.**
<https://developers.kit.com/api-reference/subscribers/create-a-subscriber>

**Rate limits — the tightest on the shortlist.** *"When using API Keys, no more
than **120 requests over a rolling 60 second period** for a given API Key"*;
600/60s under OAuth. No `Retry-After` and no rate-limit headers documented.
<https://developers.kit.com/api-reference/response-codes>
At two calls per lead that is a **~60 leads/minute ceiling** before any discovery
traffic — the hardest numeric argument for queuing in this report.

**Double opt-in — owned by the form, not the call.** Form settings are *"Send
confirmation email"* and *"Auto-confirm new subscribers"*; *"Disabling the
confirmation email will also disable double opt-in"*
(<https://help.kit.com/en/articles/2502655-the-incentive-email>). The subscriber
`state` enum is `active`, `cancelled`, `bounced`, `complained`, `inactive`, where
`inactive` is the unconfirmed-DOI state
(<https://help.kit.com/en/articles/4008773-why-do-i-have-unconfirmed-subscribers>).
**Critical asymmetry:** `POST /v4/subscribers` accepts `state` defaulting to
`active`, so creating a bare subscriber **bypasses consent entirely** — the
confirmation belongs to form enrollment. WConvert must always route through a
form, never stop at subscriber creation.
⚠️ Kit documents incentive-email triggering only on the **bulk** forms endpoint
(*"Adding subscribers to double opt-in forms will trigger sending an Incentive
Email"* — <https://developers.kit.com/api-reference/forms/bulk-add-subscribers-to-forms>);
the single endpoint's page does not repeat it. Strong inference, **not documented** —
verify in a sandbox before shipping a consent claim.

**Idempotency.** Everything upserts. `201` new / `200` existing on all three
endpoints, so the whole flow is safely retryable. Caveat: the upsert will not
change an existing subscriber's `state`, so a `cancelled` subscriber cannot be
resurrected this way.

**Errors — thin, and there is no published error-body schema.** Documented codes:
`401` (bad auth, wrong auth *type*, **or a lapsed/free account losing app access**),
`413` too many bulk requests, `422` bad data / missing required field, `429`,
`500`. Per-endpoint: `404` unknown form/tag/sequence. *Already subscribed* is not
an error (`200`). *Invalid email* → `422`. **Suppressed → no documented behaviour
at all**; the nearest signal is the `state` field on the response.

**WordPress-native path.** The SDK `convertkit/convertkitapi` 2.6 (2026-07-28) is
actively maintained but requires PHP ≥8.0 and pulls **Guzzle 7 + Monolog** — the
two most collision-prone packages in the WP ecosystem. **Kit's own WP plugin does
not use it**: it uses `Kit/convertkit-wordpress-libraries`, whose `require` block
is empty (zero runtime Composer dependencies) and which talks to the API over
`wp_remote_*`. That is the precedent to follow.

---

### 3.5 Klaviyo — revision `2026-07-15`

**WP evidence.** `klaviyo` — **100,000** active installs, updated 2026-08-17,
author `profiles.wordpress.org/klaviyo` (official). Read 2026-08-23. **But the
install count overstates WConvert-relevant demand**: the plugin is a WooCommerce +
onsite-tracking integration ("for non-WooCommerce WordPress installations, the
plugin offers reduced functionality"), and Klaviyo appears in **only 1 of the 5**
competitor form/optin plugin lists surveyed (WPForms). Its 2.8/5 rating also
suggests the installs are Woo-driven rather than form-driven. This is the clearest
case in the report of *general* market share diverging from *WordPress lead-capture*
market share.

**Auth — private key is easy; OAuth is the hardest on the shortlist.**
`Authorization: Klaviyo-API-Key pk_…` (note: **not** `Bearer`), plus a **required
`revision` header**. A bad key returns `400`, not `401`.
<https://developers.klaviyo.com/en/reference/api_overview>
OAuth needs a registered app, **mandatory PKCE**, 1-hour access tokens, exact-match
redirect allowlisting (hostile to arbitrary WP domains), refresh tokens that are
**revoked after 90 days of non-use**, and App Marketplace review requires 5 active
installs (<https://developers.klaviyo.com/en/docs/set_up_oauth>). Private key only.

**The subscribe call.**

```http
POST https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs
Authorization: Klaviyo-API-Key pk_...
revision: 2026-07-15
Content-Type: application/vnd.api+json

{ "data": { "type": "profile-subscription-bulk-create-job",
  "attributes": { "profiles": { "data": [ { "type": "profile", "attributes": {
      "email": "a@b.com",
      "subscriptions": { "email": { "marketing": { "consent": "SUBSCRIBED" } } } } } ] },
    "custom_source": "wconvert" },
  "relationships": { "list": { "data": { "type": "list", "id": "Y6nRLr" } } } } }
```

Returns **`202 Accepted`** — an async job. Scopes `lists:write`, `profiles:write`,
`subscriptions:write`. Content-Type must be `application/vnd.api+json`, not
`application/json`, or you get `415`. Max 1000 profiles.
Never use `POST /api/profiles` in a capture flow — it is the only one that can `409`.
The upsert is `POST /api/profile-import` (201 created / 200 updated).

**List ID is optional.** *"If a list is not provided, the opt-in process used will
be determined by the account-level default opt-in setting."*
<https://developers.klaviyo.com/en/docs/collect_email_and_sms_consent_via_api>
Discovery is `GET /api/lists` — **max 10 results per page**, cursor paginated.
Lists ≠ segments; you cannot subscribe into a segment. Klaviyo *tags* label
resources (lists, flows), **not contacts** — the Mailchimp-tag equivalent is a
custom `properties` key.

**Custom fields — send blind.** `properties` is free-form; unknown keys are stored
and become segmentable, no error, no discovery, no mapping UI required. This is
the best custom-field story of any candidate. Avoid `$`-prefixed keys (reserved).
Payload cap 100 KB.

**Rate limits.** Per-endpoint. The three profile-write endpoints document
**75/s burst, 750/m steady**; `POST /api/lists/{id}/relationships/profiles` is only
10/s ÷ 150/m. On a `429`, `RateLimit-*` headers are **replaced** by `Retry-After`
(seconds); Klaviyo asks for exponential backoff **with jitter**.
<https://developers.klaviyo.com/en/docs/rate_limits_and_error_handling>

**Double opt-in — entirely Klaviyo's.** You send `consent: "SUBSCRIBED"` and
Klaviyo decides: *"If the provided list has double opt-in enabled, profiles will
receive a message requiring their confirmation before subscribing. Otherwise,
profiles will be immediately subscribed."* There is no `pending` you can send.
Precedence is list `opt_in_process` → account default.
⚠️ Two compliance landmines: `historical_import: true` *"bypasses double opt-in
emails"* — **never set it from a live form**; and the subscribe endpoint
*"will remove any `UNSUBSCRIBE`, `SPAM_REPORT` or `USER_SUPPRESSED` suppressions
from the provided profiles"* — the exact opposite of Mailchimp, and it means a
form submission silently un-unsubscribes someone.

**Idempotency.** The subscribe job is idempotent; re-submitting re-asserts consent,
`202` every time.

**Errors — the cleanest structure of any candidate.** JSON:API envelope, `errors[]`
each requiring `id`, `code`, `title`, `detail`, plus optional `source.pointer`.
Invalid email → `400` `code: "invalid"` with a pointer. Already subscribed → not an
error. **Suppressed/hard-bounced → no signal at all**; you get `202` and the profile
silently receives nothing. `410 Gone` means your pinned `revision` was retired —
a hard, dated break that no other candidate has.

**WordPress-native path.** `klaviyo/api` 20.0.0 (2026-07-15) is MIT, genuinely
maintained, and versioned **one major per API revision, quarterly** — bundling it
couples WConvert's release cadence to Klaviyo's. It is ~3.4 MB of generated code
requiring **PHP ^8.1** plus Guzzle 7 + PSR-7, for two endpoints. Do not bundle.

---

### 3.6 ActiveCampaign — API `v3`

**WP evidence.** `activecampaign-subscription-forms` — **40,000** active installs,
author `profiles.wordpress.org/activecampaign` (official), but **last updated
2025-11-14** and flagged by wp.org as *"hasn't been tested with the latest 3 major
releases of WordPress"*. Read 2026-08-23. Appears in 4 of 5 competitor lists.

**Auth — `Api-Token` header, and the user must paste a full per-account base URL.**
`https://<account>.api-us1.com/api/3/…`. ActiveCampaign's own docs warn third-party
developers explicitly: *"always use the API URL found in the User's 'Developer'
tab… It is explicitly not a guarantee that `api-us1.com` is always a supported API
Base URL for all current and future users… Allowing users to input just an account
name instead of the full URL may result in invalid API URLs for some users,
particularly users located outside of the United States."*
<https://developers.activecampaign.com/reference/url>
**There is no OAuth into the ActiveCampaign API.** The OAuth documented at
`developers.activecampaign.com/docs/auth` is the App Studio `auth` object, which
configures how a CX App you build authenticates **outward to a third-party
service** — ActiveCampaign is the OAuth *client* there, not the provider.

**The subscribe call — one call, as of the 2026-08-15 doc revision.** The
long-standing "create the contact, then add it to the list" two-call model is now
optional: `POST /api/3/contacts` and `POST /api/3/contact/sync` both accept an
inline `lists` array.

```http
POST https://<account>.api-us1.com/api/3/contact/sync
Api-Token: <key>
Content-Type: application/json

{ "contact": { "email": "a@b.com", "firstName": "Ada",
    "fieldValues": [ { "field": "6", "value": "2008-01-20" } ],
    "tags": ["newsletter"],
    "lists": [ { "list": 3 } ] } }
```

`contact/sync` is the upsert (*"looks for an existing contact, updates it when one
is found, and creates it otherwise"*, lookup order id → whatsapp_id → email →
phone). <https://developers.activecampaign.com/reference/sync-a-contacts-data>
The `lists` array is validated before the write, so *"a malformed entry, a list
that does not exist … fails the whole request rather than leaving the contact
written with part of the memberships applied"* — atomic, which is good. It is also
strictly single-opt-in: *"a contact write subscribes, so the membership status is
not the caller's to choose"*, and a named list *"becomes an active membership,
including a membership that was unconfirmed or unsubscribed before"*.
<https://developers.activecampaign.com/reference/create-a-new-contact>

**Lists and tags.** Lists need discovery: `GET /api/3/lists` (**`limit` defaults to
20** — paginate). Tags do **not**: the inline `tags` array takes **names**, and
*"a name that does not exist yet is created automatically as a contact tag"*.
Tagging is additive and idempotent, and the attached tags are **not echoed in the
response**.

**Custom fields — numeric IDs are mandatory. This is the mapping-UI blocker.**
*"When writing to a Contact's custom data, the `field` must be the `id` of a
previously-created custom field, not the custom field's name/title."* There is no
name fallback. `GET /api/3/fields` (`limit` defaults to 100) supplies the id↔title
map; `POST /api/3/fields` creates one.
Field IDs are per-account, so a mapping exported from staging breaks in production —
store the title alongside the ID and re-resolve on mismatch.

**Rate limits — 5 requests/second, *per account*.** *"Our API has a rate limit of 5
requests per second per account… 429 Too Many Requests… `Retry-After: 30` … and
additional headers `RateLimit-Limit: 5` and `RateLimit-Remaining: 3`."*
<https://developers.activecampaign.com/reference/rate-limits>
Note the header names are **un-prefixed**, unlike MailerLite's `X-`-prefixed ones.
The killer detail is *per account*: the customer's CRM sync, their Zapier zaps and
WConvert all share one bucket, so WConvert cannot reserve headroom and a
synchronous push will 429 through no fault of its own.

**Double opt-in — not writable on v3.** `POST /api/3/contactLists` documents exactly
two `status` values: *"Set to \"1\" to subscribe… Set to \"2\" to unsubscribe."*
There is no `enum` in the OpenAPI and no documented unconfirmed value. The
unconfirmed *state* demonstrably exists (the `lists` description references
resurrecting *"a membership that was unconfirmed"*) but no documented v3 write path
produces it. The deprecated v1 `instantresponders` flag controls autoresponders,
not opt-in confirmation.
⚠️ Whether an API-created contact triggers ActiveCampaign's own confirmation email
could not be confirmed — `help.activecampaign.com` returns HTTP 403 to automated
fetches. **Unverified.**

**Idempotency.** `POST /api/3/contacts` on an existing email → **`422`** with
`{"errors":[{"title":"Email address already exists in the system","code":"duplicate","source":{"pointer":"/data/attributes/email"}}]}`.
`contact/sync` upserts. Use `contact/sync` exclusively.

**Errors — two different envelopes.** Most v3 errors are `errors[]` with
`title`/`detail`/`code`/`source.pointer` (match on **`code`**, not the prose
`title`). But a not-found returns a bare `{"message":"No Result found for
Subscriber with id 1"}`. `429` carries `Retry-After`. Suppressed/bounced shapes are
**not documented**; the only related documented fact is that resurrecting an
unsubscribed membership requires the `pg_subscriber_resubscribe` permission.

**WordPress-native path.** `activecampaign/api-php` targets **API v1**, its latest
stable is **v2.0.3 (2017-04-26)** and its last commit was 2021 — dead. Worse, the
official WP plugin **vendors it unscoped**: `activecampaign-api-php/` in its SVN
trunk contains global, un-namespaced classes (`class ActiveCampaign extends
AC_Connector`,
<https://plugins.svn.wordpress.org/activecampaign-subscription-forms/trunk/>), so
any plugin bundling the same wrapper collides with it on a shared site. There is
**no official v3 PHP SDK**. Raw `wp_remote_request()` is the only sane path.

---

### 3.7 HubSpot — CRM `v3` / `2026-03`, and the Forms endpoint

**WP evidence.** `leadin` (*HubSpot All-In-One Marketing*) — **200,000** active
installs, updated 2026-08-13, author `profiles.wordpress.org/hubspotdev`
(official). Read 2026-08-23. Second only to Mailchimp on raw installs, and 4 of 5
competitor lists. **But `leadin` is not a connector** — it ships HubSpot's own
forms, popups, live chat and analytics. A site running it already has a popup
builder, so its install count is as much a competitive collision signal as a
demand signal.

**Auth — API keys are gone.** HubSpot halted new API-key creation on
**2022-07-15** and began deprecating existing keys **after 2022-11-30**
(<https://developers.hubspot.com/changelog/upcoming-api-key-sunset>). Two paths
remain:

- **Private app access token** — `Authorization: Bearer <token>`. The customer
  must be a **super admin**, navigate Development → Legacy apps → Create legacy
  app → Private, select scopes, and copy the token. Capped at 20 private apps per
  portal. <https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview>
- **OAuth 2.0** — *"Any app designed for installation by multiple HubSpot accounts
  or listing on the HubSpot Marketplace must use OAuth."*
  <https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/oauth/working-with-oauth>
  Access tokens expire in **30 minutes**; refresh tokens rotate on each exchange
  (<https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/oauth/oauth-quickstart-guide>).
  Marketplace **listing** is optional but if pursued is manually reviewed, requires
  OAuth as the sole auth method and **at least three active unique installs**,
  with review taking up to 60 days
  (<https://developers.hubspot.com/docs/apps/developer-platform/list-apps/listing-your-app/app-marketplace-listing-requirements>).
  A self-hosted WordPress plugin cannot do OAuth alone — it needs a
  WConvert-operated redirect endpoint and token broker.

**The cheap path — the unauthenticated Forms submission endpoint.**

```http
POST https://api.hsforms.com/submissions/v3/integration/submit/{portalId}/{formGuid}
Content-Type: application/json

{ "submittedAt": 1755900000000,
  "fields": [ { "objectTypeId": "0-1", "name": "email", "value": "a@b.com" } ],
  "context": { "pageUri": "https://site.test/x", "pageName": "X", "hutk": "…" },
  "legalConsentOptions": { "consent": {
      "consentToProcess": true, "text": "I agree…",
      "communications": [ { "value": true, "subscriptionTypeId": 999, "text": "…" } ] } } }
```

The published OpenAPI declares **`security: []`** — literally no auth. `fields`
is required, max 1000 items; `objectTypeId` `0-1` = contacts. Rate limit
**50 requests / 10 seconds**.
<https://developers.hubspot.com/docs/api-reference/legacy/marketing/forms/v3-legacy/submit-data-unauthenticated>,
<https://developers.hubspot.com/changelog/announcing-forms-submission-rate-limits>
This collapses HubSpot onboarding from "super admin creates a scoped private app"
to "paste a Portal ID and a Form GUID", and it carries a full GDPR consent block.
Costs: it is filed under `/legacy/` in the current docs tree, it gives **no read
access at all** (no list discovery, no property discovery, no dedupe feedback),
and it fails with `FORM_HAS_RECAPTCHA_ENABLED` if the customer turned reCAPTCHA
on. It also requires the customer to already have a HubSpot form.

**The CRM path.** `POST /crm/v3/objects/contacts` with
`{"properties": {"email": "…", "firstname": "…"}}` returns `201` but **does not
upsert**. The idempotent write is the batch endpoint with `idProperty`:
`POST /crm/v3/objects/contacts/batch/upsert` with a one-element `inputs` array
(`{"id": "a@b.com", "idProperty": "email", "properties": {…}}`), which returns
`200`, or **`207` multi-status** on partial batch failure.
<https://developers.hubspot.com/docs/guides/api/crm/objects/contacts>
Note HubSpot now runs two path schemes side by side — the classic `/crm/v3/…` and
the date-versioned `/crm/objects/2026-03/…`.

**Lists take record IDs, not emails.** `PUT /crm/v3/lists/{listId}/memberships/add`
accepts record IDs only, and only on `MANUAL` or `SNAPSHOT` lists — *"DYNAMIC
lists will add and remove records based on the filter criteria set. You cannot use
list membership endpoints to update your list."*
<https://developers.hubspot.com/docs/guides/api/crm/lists/overview>
So the CRM lead flow is upsert-by-email → read the returned `id` → add to list:
two calls, with an ID round-trip in between. (Contact Lists **v1 sunset
2026-04-30**, already past.)

**Properties must pre-exist**, created with `POST /crm/v3/properties/{objectType}`,
and referenced by **internal name**, not display label. From **2026-09-08** —
two weeks after this research — the CRM write API begins enforcing
admin-configured required properties with `400 MISSING_REQUIRED_PROPERTY` /
`MISSING_CONDITIONAL_REQUIRED_PROPERTY`
(<https://developers.hubspot.com/changelog/crm-api-write-validation-enforcement>).
That is a live, dated behaviour change a v1.1 build must account for.

**Rate limits.** Private apps: 100/10 s (Free/Starter), 190/10 s (Pro/Enterprise),
with daily caps of 250,000 / 625,000 / 1,000,000 **per account, shared across every
app**. Public OAuth apps: 110/10 s per installing account. Headers
`X-HubSpot-RateLimit-Max`, `-Remaining`, `-Interval-Milliseconds`,
`-Daily-Remaining`.
<https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines>
These are generous for one site's form volume; latency and retry, not throughput,
are what force queuing here.

**Double opt-in — HubSpot has none.** Subscription statuses are `SUBSCRIBED`,
`UNSUBSCRIBED`, `NOT_SPECIFIED` — there is no pending/confirmation state. Consent
is *asserted* by the submission, via `legalConsentOptions` on the Forms endpoint or
the Communication Preferences API
(`POST /communication-preferences/2026-03/statuses/{subscriberIdString}`).
<https://developers.hubspot.com/docs/api-reference/latest/communication-preferences/guide>
This matters for ticket 10: HubSpot is the one candidate where WConvert would be
recording the consent claim itself rather than handing it to the ESP.

**Errors.** Envelope requires `category`, `correlationId`, `message`, with optional
`subCategory`, `context` and an `errors[]` array
(<https://developers.hubspot.com/docs/api-reference/error-handling>). Documented
statuses include `207`, `401`, `403`, `414`, **`423 Locked`** (*"retry after 2+
seconds"* — retryable), `429`, `502/504`, `503`. The Forms endpoint has a proper
`errorType` enum including `INVALID_EMAIL`, **`BLOCKED_EMAIL`** (suppressed),
`REQUIRED_FIELD`, `FIELD_NOT_IN_FORM_DEFINITION`, `MISSING_PROCESSING_CONSENT` —
the best-typed error vocabulary of any candidate.
**Duplicate → `409`** on the plain create; the exact body
(`category: "CONFLICT"`, `"Contact already exists. Existing ID: …"`) is
**SECONDARY**, attested only in HubSpot Community threads — high confidence on the
status, low on the string. Avoid it entirely via batch/upsert. Writing to an
unsubscribed contact **succeeds**; unsubscribe lives in the preferences layer.

**WordPress-native path.** `hubspot/api-client` 14.1.0 (2026-05-12) is maintained
but requires **PHP ≥ 8.1** (HubSpot's own `leadin` requires 7.2), pulls Guzzle 7 +
PSR-7, and the repo is **~10 MB** of generated code. Do not bundle.

**Verdict: v1.1, on the Forms endpoint.** The demand is real and second only to
Mailchimp, but the cheap path has *no list discovery and no field mapping*, which
is a different Destination shape from the other four. Booking it as v1.1 lets the
contract be designed to allow that shape (see §5.9) without paying for it now.

---

### 3.8 EmailOctopus — API `v2`

**WP evidence.** `emailoctopus` — **3,000** active installs, updated 2026-08-17,
author `profiles.wordpress.org/emailoctopus` (official). Read 2026-08-23. That is
two orders of magnitude below Mailchimp and appears in one of the five competitor
lists (MailOptin's 50-strong catch-all). **Demand does not justify v1.**

**Everything else about it is ideal**, which is why WSMS chose it (§4).
`Authorization: Bearer`, base `https://api.emailoctopus.com`.
`PUT /lists/{list_id}/contacts` is a documented upsert keyed on `email_address`;
`GET /lists` is the discovery call; `fields` is a free-form object keyed by field
tag; `tags` is a plain string array; `status` ∈ `subscribed` | `pending` |
`unsubscribed`. <https://emailoctopus.com/api-documentation/v2>

**Double opt-in is genuinely owned by EmailOctopus and is API-addressable** — send
`"status": "pending"` and EmailOctopus sends the confirmation email:
*"The double opt-in emails are only sent to users added via the API and our forms
and landing pages."* Configured per list.
<https://help.emailoctopus.com/article/36-how-to-edit-double-opt-in>

**Rate limits:** token bucket, *"your bucket holds up to 100 tokens. Tokens are
replenished at a rate of 10 per second"*; exceeding it returns `429` and
*"your connection will be blocked for up to a minute"*
(<https://help.emailoctopus.com/article/91-api-limits>).

**Errors:** RFC 7807 body (`title`, `detail`, `status`, `type`) with a real code
vocabulary — `already-exists`, `conflict`, `not-found`, `out-of-limits`,
`too-many-requests`, … Duplicate on `POST` → `409`; use `PUT` and it never
arises.

**Migration trap worth recording:** v1.6 used uppercase status values
(`SUBSCRIBED`/`PENDING`/`UNSUBSCRIBED`) and passed the key in the JSON body;
v2 uses lowercase and a Bearer header. v1.6 is *"legacy and no longer actively
maintained"* but has **no announced sunset date**
(<https://emailoctopus.com/api-documentation>).

**No official PHP SDK** — *"While we don't yet have an official SDK…"* — and the
community ones are *"unofficial and have not been tested or verified by the team"*
(<https://help.emailoctopus.com/article/93-sdks-and-libraries>). Irrelevant: WSMS
already has a working 227-line client (`src/Integration/EmailOctopus/EmailOctopusApiClient.php`)
whose shape WConvert can copy in an afternoon.

**Verdict: v1.1, and the cheapest item on the whole backlog.**

---

### 3.9 Mailtrap — contacts API

**WP evidence: none.** There is no official Mailtrap plugin in the wp.org
directory (searched `mailtrap` via the plugin query API, 2026-08-23). The closest
is third-party `mailtrap-for-wp` at **300** active installs. Zero competitor
presence.

Mailtrap *does* have a real contacts API — `POST /api/contacts`,
`PATCH /api/contacts/{contact_identifier}` (an upsert returning
`"action": "created" | "updated"`), `GET /api/contacts/lists`, pre-defined contact
fields, bulk import — authenticated with `Api-Token` or Bearer, base
`https://mailtrap.io`.
<https://docs.mailtrap.io/developers/email-marketing/contacts/contacts>
Rate limit: 150 / 10 s per token globally, and **200 / 60 s per account for all
Contacts endpoints combined**
(<https://docs.mailtrap.io/developers/rate-limits>).

**But it is a sending gateway first.** The product is organised around Email
API/SMTP + Sandbox with separate transactional and bulk hosts *to isolate sending
reputation*; the contact `status` field has only two values and is **derived from
the suppression list**, not from a subscription lifecycle; and **there is no
API-addressable pending/confirmation state** — the UI surfaces one, the Contacts
API does not.

**Verdict: out, permanently.** It fails the ranking signal (no WP presence at all)
and it fails the consent story (no double opt-in through the API). Its presence in
WSMS is explained by a mechanism that does not exist in WConvert — see §4.

---

## 4. Why EmailOctopus and Mailtrap in WSMS — and whether it transfers

Both integrations live in **free core**, not premium, and both are registered
unconditionally in `src/Container/IntegrationServiceProvider.php:109-123`.
Neither choice was a market-share bet, and the two were chosen for entirely
different reasons.

### 4.1 EmailOctopus — the cheapest way to exercise every capability interface

`EmailOctopusIntegration` implements **five** capability interfaces at once —
`SupportsContactSync`, `SupportsContactImport`, `SupportsListManagement`,
`SupportsAutomations`, `SupportsSuppressionSync`
(`src/Integration/EmailOctopus/EmailOctopusIntegration.php:24-31`) — from a single
pasted key:

- `getAuthType()` returns `'api_key'` and `getAuthSchema()` declares exactly one
  field (`:80-95`). No OAuth, no callback, no account URL, no version pin.
- The API client is **227 lines total**
  (`src/Integration/EmailOctopus/EmailOctopusApiClient.php`) and gets everything
  from one `Authorization: Bearer` header (`:175`).
- `upsertContact()` is a single `PUT /lists/{id}/contacts` (`:57-73`), and
  `contactId()` is `md5(strtolower(trim($email)))` (`:135-138`) — so
  single-contact reads, updates and deletes need **no lookup call at all**.
- `getLists()` (`:29-32`), `batchContacts()` (`:99-104`) and
  `queueIntoAutomation()` (`:128-133`) cover discovery, bulk and automations.
- It exposes a suppression feed, so `SupportsSuppressionSync` is satisfiable.

In other words EmailOctopus was picked because it is the **reference
implementation**: the lowest-cost provider that can light up every box in
`IntegrationCapability` (`src/Integration/Contracts/IntegrationCapability.php:9-19`)
and thereby prove the registry shape that third parties are meant to extend via
`wsms_register_integrations`. Its 3,000 wp.org installs confirm it was not chosen
for demand.

### 4.2 Mailtrap — a free rider on a credential WSMS already had to hold

Mailtrap is the more interesting case, and the mechanism is explicit in the code.

`MailtrapIntegration::getAuthType()` returns **`'gateway'`** and
`getAuthSchema()` returns `[]`
(`src/Integration/Mailtrap/MailtrapIntegration.php:83-91`). It has no credentials
of its own. `connect()` reads the API token out of the **Mailtrap sending
gateway's** config and throws if it is absent (`:105-108`):

> *"Configure the Mailtrap gateway first. The integration uses the same API token."*

The token comes from `MailtrapApiClient::fromGatewayConfig()`
(`src/Integration/Mailtrap/MailtrapApiClient.php:35-47`), reading the
`wsms_gateway_configs` option. And that gateway exists because
**`MailtrapGateway` is WSMS's only dedicated email sending gateway** — it is the
one premium provider whose `getSupportedChannels()` returns `['email']`
(`premium/modules/premium-gateways/src/Provider/MailtrapGateway.php`); the only
other email-capable gateway in the codebase is `src/Messaging/Gateway/WpMailGateway.php`.
WSMS needs a real transactional email path for OTP, 2FA and notifications;
Mailtrap supplies it.

The integration's own description says the quiet part out loud:

> *"Sync contacts and suppression lists with Mailtrap's promotional platform.
> **Email sending is handled separately by the Mailtrap gateway.**"*

So the marketing integration cost roughly one API client and two flow actions on
top of a credential the product already had to hold. It is a free rider, and its
capability declaration admits the thinness — `TAGS => false ('Mailtrap has no tags
API')`, `AUTOMATIONS => false ('Mailtrap has no automations API')`
(`MailtrapIntegration.php:178-185`).

### 4.3 Does the reasoning transfer?

**Mailtrap's reasoning does not transfer at all.** It exists because WSMS already
held a Mailtrap credential for a different purpose. WConvert sends nothing, holds
no ESP credential for any other purpose, and has no gateway layer — there is no
analogous free rider anywhere in its design. Combined with zero official wp.org
presence and no API-addressable double opt-in, Mailtrap is out.

**EmailOctopus's reasoning transfers as a *method*, not as a shipping decision.**
WSMS could afford a 3,000-install ESP because the integration's job was to prove a
registry that third parties extend. WConvert's third-party ESPs are a **premium
revenue feature** — the buyer pays precisely because *their* ESP is on the list, so
a low-demand ESP converts nobody. But "build the cheapest complete one first, to
prove the contract before committing to the expensive ones" is exactly right, and
in WConvert that role is played by two things: the **generic Webhook** (no auth, no
discovery, no field mapping — proves the contract can express a Destination with
nothing to configure) and **MailerLite** (one key, one call, and the only clean
caller-chosen double opt-in in the v1 set).

**What transfers structurally, and should be borrowed by ticket 03:**

| WSMS thing | Why it transfers |
|---|---|
| `IntegrationInterface` + narrow `Supports*` capability interfaces (`src/Integration/Contracts/`) | Lets a Destination declare what it can do rather than stubbing methods it cannot. HubSpot-via-Forms declares no list management; the Webhook declares no field mapping. |
| `SyncResult` with an explicit **`retryable: bool`** (`src/Integration/Contracts/SyncResult.php:33`) and `success`/`failure`/`skipped`/`batch` constructors | The single most important shape in the file. §5.2 is entirely about why `retryable` cannot be derived from the HTTP status. |
| `getAuthType()` / `getAuthSchema()` driving the settings UI (`EmailOctopusIntegration.php:80-95`) | Credential shapes are genuinely not uniform (§5.8). A declarative schema is the only way one settings screen serves all of them. |
| Per-integration token-bucket `RateLimiter` seeded from `getMetadata()['rate_limit']` (`src/Integration/Marketing/RateLimiter.php`, `EmailOctopusIntegration.php:97-103`) | Every vendor publishes a different number; hard-coding one is wrong. `handleRetryAfter()` (`:56-60`) already models the `Retry-After` case. |
| Queued push via Action Scheduler (`OutboundSyncManager::dispatchPushJobs()` → `MarketingPushContactJob` → `ActionSchedulerQueue::dispatch()` → `as_enqueue_async_action`) with `getMaxRetries() = 3`, `getRetryBackoff() = 120` | In-house precedent for the exact sync-vs-async decision in §5.1. `woocommerce/action-scheduler: ^4.0` is already a WSMS composer dependency. |

**What should be dropped.** `SupportsSuppressionSync`, `SupportsContactImport` and
`SupportsEngagementSync` are all *read-back* capabilities. `CONTEXT.md` states data
flow through a Destination is strictly one-way and *"WConvert never reads Contact
state back, so it never has an opinion about who is subscribed."* Half of WSMS's
capability surface is therefore out of scope by definition — which is why the
ticket's instinct that "WConvert's needs are narrower" is right.

**One thing to reconsider rather than copy.** WSMS stores ESP credentials as plain
text inside a single `wp_options` blob, `wsms_integration_configs`
(`EmailOctopusIntegration.php:32,132-137`). `SecretEncryptor` exists in the
codebase (`src/Mfa/SecretEncryptor.php`) but is used only for MFA secrets. Copying
the plaintext-option pattern by default is a decision, not an inheritance — see §7.

---

## 5. Constraints the Destination contract must accommodate

This is the section ticket 03 should read. Each constraint is stated with the
specific vendor behaviour that forces it.

### 5.1 The push must be queued, not synchronous. This is not a preference.

**Recommendation: write the local Lead row synchronously, enqueue one job per
(Lead × Destination), and return to the visitor immediately.**

The evidence is not "async is nicer", it is that a synchronous push is broken for
at least four of the nine candidates:

- **Mailchimp** documents a **120-second** API timeout with **no RPS quota at all —
  only a 10-simultaneous-connection cap**, and warns *"At exceptionally high
  volumes, you may receive an HTTP 429 or 403 without a JSON body."*
  (<https://mailchimp.com/developer/marketing/docs/fundamentals/>) A slow response
  hangs the form POST; a handful of concurrent submissions exhausts the cap.
- **WordPress's own default HTTP timeout is 5 seconds** —
  `'timeout' => apply_filters( 'http_request_timeout', 5, $url )`
  (`wp-includes/class-wp-http.php:181`, WP 7.1 as installed). So the synchronous
  options are: fail fast and lose the lead, or raise the timeout and block the
  visitor. Neither is acceptable.
- **Kit** needs **two calls per lead** (create subscriber, then add to form)
  against **120 requests per rolling 60 seconds** on an API key — a ~60
  leads/minute ceiling before any discovery traffic.
- **ActiveCampaign**'s **5 requests/second is per customer account**, shared with
  their CRM sync, their Zapier zaps and anything else they run. WConvert cannot
  reserve headroom, so it will be rate-limited through no fault of its own.
- **Every** candidate signals backoff in a way a synchronous request cannot honour:
  `Retry-After` (Klaviyo, ActiveCampaign, MailerLite, EmailOctopus),
  `x-sib-ratelimit-reset` (Brevo), `425 Too Early` (Brevo), `423 Locked` with
  *"retry after 2+ seconds"* (HubSpot).

Only Brevo (10 RPS / 36,000 RPH on every plan) and HubSpot (100–190 per 10 s) have
limits comfortable enough for a synchronous push, and both still fail the latency
argument. **One queued path for all Destinations, no synchronous mode, no
per-destination exception.**

Ticket 04 already fixed the write order — *"local Lead row first, always; WSMS push
second, as a post-write side effect; a failed push is a flag on the local row,
never a failed capture."* The same order applies to every Destination, which makes
the local Lead log the dead-letter store and removes any need for a separate one.

WSMS's mechanism is the one to copy: `as_enqueue_async_action()` via
`ActionSchedulerQueue`, with `getMaxRetries()` and `getRetryBackoff()` on the job
and `JobProcessor::handleFailure()` re-scheduling with backoff
(`src/Queue/JobProcessor.php:54-72`). `woocommerce/action-scheduler: ^4.0` is
already a WSMS composer dependency.

### 5.2 `retryable` is a first-class return value, and it cannot be derived from the HTTP status

Borrow `SyncResult`'s explicit `retryable: bool`
(`src/Integration/Contracts/SyncResult.php:33`). It must be set by the Destination,
because the mapping from status code to retryability is vendor-specific and
frequently perverse:

| Vendor | Trap |
|---|---|
| Mailchimp | **`400` carries at least four distinct terminal conditions** — `Member Exists`, invalid/"fake" email, merge-field validation, and compliance state — and **three of the four are undocumented**. Meanwhile a **`403` without a JSON body is a soft rate limit** and *is* retryable. |
| Klaviyo | A bad API key returns **`400`, not `401`**. `410 Gone` means the pinned `revision` was retired — terminal, and must alert loudly rather than retry. `415` means the wrong `Content-Type`. |
| ActiveCampaign | Two different error envelopes: `errors[]` with `code`/`source.pointer` for most failures, but a bare `{"message": "No Result found for …"}` on not-found. Match on `code`, never the prose `title`. |
| Brevo | `425 Too Early` is present in the OpenAPI but absent from the prose docs — retryable. |
| HubSpot | `423 Locked` is retryable after 2+ seconds; `207` is a *partial* success on batch upsert and must be unpacked per item. |
| MailerLite | Two distinct `429` bodies — `"Too Many Attempts."` (global, 120/min) and `"You're being rate limited on import creation."` (5/min). A `401` body has `message` but **no `errors` key at all**. |
| Kit | `401` fires not only on bad auth but *"an account no longer has access to apps (due to their trial lapsing, being on a free account, failed account payment)"* — trivially misdiagnosed as a bad key. |

Practical rules for the contract:
- Default to **terminal** on any `4xx` a Destination does not explicitly classify,
  with the documented retryable exceptions (`408`, `423`, `425`, `429`, and
  Mailchimp's bodyless `403`).
- Where classification depends on string matching (Mailchimp's three undocumented
  cases), the fallback must be "terminal `400`", never "retry".
- A `SyncResult` should carry the raw provider message so the admin UI can show it
  — WSMS does this and it is the only reason its Mailchimp-class failures are
  diagnosable at all.

### 5.3 Every push must be idempotent by construction, because retries are guaranteed

**No candidate offers an `Idempotency-Key` header.** In every case the email
address *is* the idempotency key, and every candidate has an email-keyed upsert
that must be used in preference to the plain create:

| Vendor | The idempotent call | What the plain create does instead |
|---|---|---|
| Mailchimp | `PUT /lists/{id}/members/{md5(strtolower(email))}` with `status_if_new` | `POST` → `400 Member Exists` |
| MailerLite | `POST /api/subscribers` — upsert by default, `201` new / `200` existing | n/a |
| Brevo | `POST /v3/contacts` with **`updateEnabled: true`** → `201` / `204` | without the flag → `400 duplicate_parameter` |
| Kit | `POST /v4/subscribers` — *"Behaves as an upsert"*, `201` / `200` | n/a |
| ActiveCampaign | `POST /api/3/contact/sync` | `POST /api/3/contacts` → `422 code:"duplicate"` |
| Klaviyo | the subscribe job (`202` always) or `POST /api/profile-import` (`201`/`200`) | `POST /api/profiles` → `409` |
| HubSpot | `POST /crm/v3/objects/contacts/batch/upsert` with `idProperty: "email"` | `POST …/contacts` → `409` (undocumented body) |
| EmailOctopus | `PUT /lists/{id}/contacts` | `POST` → `409 conflict` |

The contract should make this a stated obligation of every Destination: *a
`push()` that runs twice must produce the same end state.* Note the `status_if_new`
subtlety — a naive Mailchimp upsert sending `status` rather than `status_if_new`
will **overwrite an existing member's subscription state on every re-submit**.

### 5.4 `push()` is not one HTTP call — multi-step pushes must be expressible

- **Kit needs two calls minimum, three with tags**: `POST /v4/subscribers`, then
  `POST /v4/forms/{id}/subscribers`, then `POST /v4/tags/{id}/subscribers`. The
  form endpoint's request body accepts **only** `email_address` and `referrer`, so
  names and custom fields *must* be set on the first call.
- **HubSpot's CRM path needs an ID round-trip**: upsert by email → read the
  returned record `id` → `PUT /crm/v3/lists/{listId}/memberships/add`, because
  list membership takes record IDs, not emails.
- **Mailchimp needs a second call for tags on the upsert path** — `tags` is in the
  `POST` schema but absent from the `PUT` schema.

So partial failure *inside a single Destination* is real and must be
representable: "subscriber created but form enrollment failed" is a different
outcome from "nothing happened", and retrying it must not duplicate step one
(which §5.3 guarantees).

There is one consent landmine hiding in this: **Kit's `POST /v4/subscribers`
bypasses double opt-in entirely** (it accepts `state` defaulting to `active`);
confirmation is a property of *form enrollment*. A Kit push that succeeds at step
one and fails at step two has created a subscriber who never consented. The
contract must treat the multi-step push as one unit of work, not as fire-and-forget
steps.

### 5.5 List/audience discovery is a separate authenticated call, and pagination differs wildly

Every candidate except Klaviyo requires a list/group/form ID discovered ahead of
time, and none of them is a plain unpaginated GET:

| Vendor | Discovery call | Paging quirk |
|---|---|---|
| Mailchimp | `GET /lists` | `count`/`offset` |
| Brevo | `GET /v3/contacts/lists` | **`limit` maxes at 50**; `totalSubscribers` is being zeroed out — do not render counts |
| MailerLite | `GET /api/groups` | `limit`/`page`; **group IDs exceed 2^53 — keep them as strings** |
| Kit | `GET /v4/forms`, `GET /v4/tags` | cursor `after`/`before`, `per_page` default 500 |
| ActiveCampaign | `GET /api/3/lists` | **`limit` defaults to 20** |
| Klaviyo | `GET /api/lists` | **max 10 results per page**, cursor |
| HubSpot | lists API | membership takes record IDs, not emails |
| Webhook / HubSpot-Forms | **none** | — |

Contract needs `getLists(config): array` (WSMS's `SupportsListManagement` shape),
a cache with explicit invalidation, and — critically — it must be **optional**.
The Webhook Destination and HubSpot-via-Forms have nothing to discover.

### 5.6 Custom-field mapping: the identifier type is different in every vendor, and two of them are not portable

| Vendor | Field key you send | Must pre-exist? | Portable across accounts? |
|---|---|---|---|
| Klaviyo | anything — free-form `properties` | **no, send blind** | yes |
| Mailchimp | merge tag, e.g. `FNAME` | yes (`FNAME`/`LNAME`/`ADDRESS`/`PHONE` are default) | yes |
| Brevo | attribute name, **UPPERCASE** | yes | yes |
| Kit | the field's **`key`** (`last_name`) — *not* its `label` or its `name` | yes — unknown key is an error | yes |
| MailerLite | the field's **`name`** on write, but responses come back keyed by **`key`** (a field named `ZIP` reads back as `z_i_p`) | yes | yes |
| ActiveCampaign | a **numeric field ID** | yes | **no — IDs are per-account** |
| HubSpot | property **internal name**, not display label | yes | yes |

Three consequences:

1. The mapping store must hold **both** a stable identifier and a human label, and
   re-resolve when the identifier no longer exists — otherwise an ActiveCampaign
   mapping exported from staging silently writes to the wrong fields in
   production.
2. A field-mapping UI needs a **discovery call** behind it for six of seven
   vendors, and must be *skippable* for Klaviyo (and absent entirely for the
   Webhook).
3. Silent-drop behaviour must be surfaced, not hidden. Brevo: *"Values that don't
   match the attribute type … will be ignored"* — a badly formatted date vanishes
   with a `201`. MailerLite's unknown-key behaviour is **undocumented** (see §7).

### 5.7 Double opt-in has three incompatible shapes. It cannot be one boolean.

This bears directly on ticket 10 (*Consent, privacy and retention*), so it is worth
stating precisely. There are three, not two:

**(a) The caller chooses, on the same call.** The Destination sends a status value
and the ESP sends the confirmation email.
- Mailchimp: `status_if_new: "pending"` vs `"subscribed"`. `pending` is *"waiting
  for user action to confirm the double opt-in"*; sending `subscribed` **bypasses
  the audience's own `double_optin` setting**.
- MailerLite: `"status": "unconfirmed"`. **But** it is gated on an account toggle
  (*"Double opt-in for API and integrations"*) that is **not readable from the
  API** — the same call yields single or double opt-in depending on config
  WConvert cannot see.
- EmailOctopus: `"status": "pending"`.

**(b) A separate endpoint with its own required configuration.**
- Brevo: `POST /v3/contacts/doubleOptinConfirmation` requires all four of `email`,
  `includeListIds`, `redirectionUrl` and **`templateId`** — a DOI template the
  customer must create in Brevo first, containing the `{{ params.DOIurl }}` merge
  tag or the confirmation email ships with no confirm link. Returns `201`/`204`
  with **empty bodies** — no contact ID. This is a second code path *and* two extra
  settings fields, validated at save time.

**(c) Not the caller's choice at all.**
- Klaviyo: you send `consent: "SUBSCRIBED"` and *"If the provided list has double
  opt-in enabled, profiles will receive a message requiring their confirmation…
  Otherwise, profiles will be immediately subscribed."* Precedence is list
  `opt_in_process` → account default.
- Kit: owned by the **form**, not the call. Subscriber `state` is `inactive` until
  confirmed. (And see §5.4 — the bare subscriber-create call bypasses it.)
- ActiveCampaign: **no documented v3 write path produces an unconfirmed
  membership.** `status` is documented as `"1"` (subscribe) or `"2"`
  (unsubscribe) only, and the `lists` array description states *"a contact write
  subscribes, so the membership status is not the caller's to choose."*
- HubSpot: **no pending state exists**; consent is asserted by the submission via
  `legalConsentOptions`.

So the contract needs a per-Destination declaration with (at least) three values —
`caller_chooses` / `destination_owned` / `unsupported` — plus optional extra
config (Brevo's `templateId` + `redirectionUrl`). And the admin UI must be honest:
for (b) and (c), WConvert cannot promise double opt-in, it can only say who owns
it. **Do not ship a single "Require double opt-in" checkbox across all
Destinations.**

### 5.8 Credential shapes are not uniform, and one Destination has no secret at all

| Destination | Credential |
|---|---|
| Mailchimp | one API key; the datacenter is `explode('-', $key)` |
| MailerLite | one bearer token **+ a pinned `X-Version`** |
| Brevo | one `api-key` |
| Kit | one `X-Kit-Api-Key` |
| EmailOctopus | one bearer token |
| Klaviyo | one `pk_` key **+ a pinned `revision` string** |
| ActiveCampaign | key **+ a full base URL the user pastes verbatim** — AC's docs warn *"It is explicitly not a guarantee that `api-us1.com` is always a supported API Base URL… particularly users located outside of the United States"*. **Never reconstruct it from an account name.** |
| HubSpot (Forms) | a Portal ID and a Form GUID. **No secret.** |
| Webhook | a URL, and an *optional* shared secret |

WSMS's declarative `getAuthType(): string` + `getAuthSchema(): array` is the right
shape (`EmailOctopusIntegration.php:80-95`), with one addition: the schema must
allow **zero required secrets**, or HubSpot-via-Forms and the Webhook cannot be
expressed.

### 5.9 The contract must permit a Destination with no lists, no fields and no discovery

The Webhook has no list picker and no field mapping. HubSpot-via-Forms has neither
either. Klaviyo has no required list. Kit has no lists at all (forms, tags and
sequences instead), so a "choose a list" UI is actively wrong for it.

Capability interfaces solve this — a Destination implements
`SupportsListManagement` only if it has lists — which is why WSMS's narrow-interface
approach is worth borrowing even though WConvert needs only about a third of its
capability set (§4.3).

### 5.10 OAuth is not needed in v1, but must not be precluded

No v1 Destination uses OAuth. That is a deliberate cost saving, and it is worth
recording what it saves, because HubSpot and Klaviyo are the v1.1 queue:

- **A WConvert-operated redirect endpoint.** Klaviyo requires the redirect URI to
  **exactly match** an allowlisted URL, which is hostile to arbitrary WordPress
  domains; HubSpot public apps need a broker the plugin cannot host itself.
- **Token refresh, on a clock.** HubSpot access tokens expire in **30 minutes** with
  rotating refresh tokens. Klaviyo's expire in **1 hour**, mandate **PKCE**, and the
  refresh token is **revoked after 90 days of non-use** — a site that goes quiet
  breaks silently.
- **An app-review path.** Kit's OAuth requires Kit's approval per creator
  (*"developers have to request access on behalf of a creator to us to approve"*).
  HubSpot marketplace listing is optional but, if pursued, is manually reviewed,
  requires ≥3 active installs and takes up to 60 days.

The contract implication is narrow but real: **stored credentials must be mutable
by the Destination at runtime**, not a write-once settings blob, so a refreshed
token can be persisted from inside a queued job. Design that in now; it costs
nothing today.

### 5.11 Version pinning is a per-Destination concern with a dated expiry

Klaviyo's `revision` header is **required**, and a retired revision returns
**`410 Gone`** — a hard, dated break no other candidate has. MailerLite's
`X-Version` is optional but *"All requests use the latest version"* without it.
Mailchimp, Brevo, Kit and ActiveCampaign version in the path and are stable.

The contract needs somewhere to hold a pinned version string per Destination, and
`410` must be classified as terminal-and-alert, never retryable.

### 5.12 "Success" from a Destination is not proof of anything

Five of the candidates accept a suppressed, bounced or blocklisted address and
return success:

- **Brevo**: the contact is created, added to the list, returns `201`/`204`, and
  `emailBlacklisted` stays `true`. It receives nothing.
- **Klaviyo**: `202` regardless; `HARD_BOUNCE`/`INVALID_EMAIL` suppressions persist
  silently.
- **Kit**: no documented suppressed-contact error; the only signal is the `state`
  field on the response.
- **MailerLite**: no documented error shape; governed by `resubscribe`, not a code.
- **HubSpot**: writing to an unsubscribed contact succeeds — unsubscribe lives in
  the preferences layer.

**Mailchimp is the only one that hard-fails** (the compliance-state `400`).

This is not a bug to fix — it is a limit to respect. `CONTEXT.md` says WConvert
never reads Contact state back and *"never has an opinion about who is
subscribed."* The contract must therefore be explicit that a successful `push()`
means *the Destination accepted the payload*, nothing more, and the admin UI must
not present it as "subscribed".

### 5.13 Never auto-clear a suppression

Three candidates will silently resurrect an opt-out if you let them:

- **Klaviyo**'s subscribe endpoint *"will remove any `UNSUBSCRIBE`, `SPAM_REPORT` or
  `USER_SUPPRESSED` suppressions from the provided profiles."* Unavoidable on that
  endpoint.
- **ActiveCampaign**'s inline `lists` array makes a named list *"an active
  membership, **including a membership that was unconfirmed or unsubscribed
  before**"*.
- **MailerLite**'s `resubscribe: true` and **Brevo**'s `emailBlacklisted: false` do
  it on request.

Where WConvert has the choice (MailerLite, Brevo) the default must be **not to
resurrect**, and any resubscribe affordance must be an explicit admin decision,
never an implicit consequence of a form submission. Where it has no choice
(Klaviyo, ActiveCampaign) that behaviour should be documented on the Destination,
because it is a compliance fact the site owner is responsible for.

Two adjacent landmines to prohibit outright: Klaviyo's `historical_import: true`
(*"bypass double opt-in emails"*) and Brevo's `forceMerge` (deletes the losing
contact).

### 5.14 One job per (Lead × Destination)

Rate limits are per-vendor and per-customer-account. If a single job pushed to
every Destination in sequence, an ActiveCampaign `429` would delay the Mailchimp
push behind it and a Kit failure would retry the Mailchimp write. Independent jobs
give independent backoff, independent retry budgets and clean partial-failure
semantics for the multi-destination question ticket 03 raises.

### 5.15 A connection test is cheap and should be mandatory

Every candidate has a cheap authenticated GET that validates a credential —
Mailchimp `GET /lists`, Brevo `GET /v3/account`, Kit `GET /v4/forms`, MailerLite
`GET /api/groups`, ActiveCampaign `GET /api/3/users/me`, EmailOctopus
`GET /account`, Klaviyo `GET /api/lists`. WSMS's `connect(array $credentials):
array` — validate, throw `\RuntimeException` on failure, return the normalised
credential set — is the right shape, and it is where ActiveCampaign's base-URL
validation and MailerLite's "this looks like a Classic key" message belong.

---

## 6. Generic webhook

### 6.1 What it should be

An **outbound** HTTP POST of a JSON envelope to a user-supplied URL, on the same
queue and with the same retry classification as every other Destination.

Note this is *not* the WSMS `WebhookIntegration`, which is inbound only —
`getActions()` returns `[]` and its single trigger is `InboundWebhookTrigger`
(`src/Integration/Webhook/WebhookIntegration.php:53-68`). No code transfers, but
its secret-storage pattern does (`SECRETS_OPTION = 'wsms_webhook_secrets'`, `:12`),
as does the Mailtrap gateway's *"32-character hex HMAC key for webhook signature
verification"* config field.

**Configuration:** a URL, an optional shared secret, and nothing else. **No list
picker. No field mapping.** That absence is the point — it is what proves the
contract can express a Destination with nothing to discover (§5.9).

**Envelope** — stable, versioned, and flat enough to consume in Zapier's UI:

```json
{
  "event": "lead.captured",
  "version": 1,
  "sent_at": "2026-08-23T10:14:00Z",
  "site": { "url": "https://site.test", "wconvert_version": "1.0.0" },
  "optin": { "id": 12, "name": "Homepage lead magnet", "goal": "lead_magnet",
             "display_type": "popup" },
  "lead":  { "id": 4471, "submitted_at": "2026-08-23T10:13:58Z",
             "fields": { "email": "a@b.com", "first_name": "Ada" },
             "page_url": "https://site.test/pricing", "referrer": "https://google.com/" }
}
```

**Signing:** if a secret is set, send `X-WConvert-Signature: sha256=<hmac>` over
the raw body plus a `X-WConvert-Timestamp` header so the receiver can reject
replays. Optional, because Zapier and Make do not verify signatures and requiring
one would make the common case harder.

**Retry classification** (§5.2 applies unchanged): `2xx` success; `408`, `425`,
`429`, `5xx`, connection error and timeout retryable; every other `4xx` terminal.
Send `Retry-After` respect if present.

**Delivery log:** the queued job's outcome is already recorded on the local Lead
row (§5.1), so a webhook that 404s for a week is visible without a new table.

### 6.2 What it buys

**It is what makes deferring five ESPs survivable.** Every one of HubSpot,
Klaviyo, ActiveCampaign, EmailOctopus, GetResponse, AWeber, Constant Contact,
Campaign Monitor, Drip and Omnisend is reachable through Zapier, Make, n8n or
Pabbly from a plain webhook. That turns "we don't support your ESP" from a lost
sale into a documentation link, and it converts an unbounded integration backlog
into a bounded one. Every competitor surveyed ships one for exactly this reason.

**It is also the cheapest correctness proof for the contract.** Building it first
forces the contract to handle a Destination with no auth schema, no discovery and
no field mapping — the same shape HubSpot-via-Forms will need in v1.1. If the
contract cannot express the webhook, it is wrong.

**Gating.** Premium, consistent with the decided "third-party ESPs are premium"
line — a free webhook would let any free install reach every ESP via Zapier and
would hollow out the premium tier entirely. Recorded as an open question in §7.2
because the counter-argument (a free webhook is a strong differentiator against
OptinMonster's free tier) is not worthless, just outweighed.

---

## 7. Open questions and risks

### 7.1 Vendor risks to book

1. **Kit disclaims supporting API keys for public integrations.** Verbatim:
   *"We do not offer any official support for apps or public integrations that rely
   upon API keys for authentication - for apps, please follow the OAuth guide."*
   The header works today; Kit could gate it or decline support tomorrow. The
   fallback is OAuth, which needs Kit's per-creator approval — an L-sized build
   plus an external dependency on Kit's approval queue. **This is the single
   biggest risk in the recommended v1 set.** Mitigation: ship it, and treat the
   Kit Destination as the one most likely to need rework.
2. **Kit's double-opt-in behaviour on the single-subscriber endpoint is
   undocumented.** Kit states incentive-email triggering only on the *bulk* forms
   endpoint. Verify `POST /v4/forms/{id}/subscribers` against a DOI-enabled form in
   a sandbox account **before** ticket 10 makes any consent claim about Kit.
3. **MailerLite's unknown-custom-field failure mode is undocumented** — 422, silent
   drop, or auto-create. Test before building the mapping UI.
4. **Mailchimp's three most important error strings are undocumented** and can
   change without notice. Any string matching must degrade to "terminal 400", never
   to "retry" (§5.2).
5. **ActiveCampaign's confirmation-email behaviour on API-created contacts is
   unverified** — `help.activecampaign.com` returns HTTP 403 to automated fetches.
   Relevant only when AC lands in v1.1.
6. **HubSpot begins enforcing required-property validation on 2026-09-08** — two
   weeks after this research. A v1.1 HubSpot CRM path must handle
   `MISSING_REQUIRED_PROPERTY`. The Forms endpoint path is unaffected.
7. **Klaviyo's `revision` pin creates a standing maintenance obligation** with a
   `410 Gone` cliff, and its PHP SDK ships one major per API revision, quarterly.
   Another reason it is v1.1, not v1.

### 7.2 Decisions this research does not make

1. **Is the generic Webhook free or premium?** Recommended premium (§6.2), but the
   free-tier-differentiator argument deserves an explicit ruling from ticket 13.
2. **Where are ESP credentials stored, and are they encrypted?** WSMS keeps them in
   a plaintext `wp_options` blob (`wsms_integration_configs`) while `SecretEncryptor`
   sits unused outside MFA. Copying that is a decision, not an inheritance —
   especially since a leaked Mailchimp key exposes the customer's whole audience.
   Belongs to ticket 01 / ticket 10.
3. **Four ESPs at launch — is that the right number for support load?** Each one is
   a settings screen, a discovery cache, a mapping UI, a set of error strings and a
   support surface. Three (dropping Kit, the riskiest) is defensible; five (adding
   EmailOctopus, the cheapest) is nearly free. Four is the recommendation, not a
   constraint.
4. **What the admin sees when a queued push fails permanently.** The Lead is safe
   (§5.1), but a per-Destination failure view and a manual "retry this lead" action
   are not specified here. Ticket 03.
5. **Does the double-opt-in *preference* live on the Optin or on the Destination?**
   §5.7 says it cannot be one global boolean. Whether the three-state capability is
   surfaced per Optin or per configured Destination is a UI decision for tickets 03
   and 10 jointly.
6. **Multiple Destinations per Optin in v1.** §5.14 says one job each if it ships;
   whether it ships in v1 is still ticket 03's call.

### 7.3 One thing worth re-testing before build

The whole recommendation rests on wp.org `active_installs` figures read on
2026-08-23. They are rounded to one significant figure and they move. Nothing here
is close enough to a boundary that a normal month's drift would flip it — Mailchimp
leads by 10×, and the Klaviyo-vs-Kit call is decided by competitor presence (1/5
vs 5/5), not by the 100k-vs-40k gap — but re-read them if the build slips a
quarter.
