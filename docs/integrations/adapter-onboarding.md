# Adding a remote Destination adapter

Use the existing `DestinationType` registry and the shared Connection,
Destination, campaign mapping, queue, health and recent-attempt flows. Remote
provider HTTP code belongs in the Pro destinations module; Free owns the shared
flow and local adapters. Do not add a second integration settings page or a
per-Lead delivery ledger.

1. Register the type in `pro/modules/destinations/` and its internal tier in the
   catalog. Declare prerequisites, supported audience channel and automatic
   contact fields in `requirements()` so setup and capture readiness agree.
   Add official provider artwork to `pro/modules/destinations/admin/`,
   record its source in that directory's README, and map the type ID in its
   `marks.ts`, which hands it to free's `providerMarks` slot (ADR 0127). Keep
   the provider name visible beside the mark.
2. Expose a credential schema without secret values. `testConnection()` must
   check both authentication and access to the metadata needed for setup.
   Where the provider has a stable account ID, implement `accountIdentity()` so
   key rotation cannot silently change the remote account behind a Connection.
3. Return readable targets in `settingsSchema()` for the selected Connection.
   Return only compatible custom text fields in `mappingFields()` until typed
   value conversion exists. Reserve identity, consent, subscription,
   suppression and lifecycle fields. Metadata is cached for five minutes by
   the shared layer; discovery failures must stay local to that account.
4. Implement `push()` using `PushSubject` and `PushContext`. The subject's
   purpose decides whether a captured enquiry may enter a marketing list.
   Keep and update modes must preserve existing opt-outs, identity and
   suppression. Empty/absent mapped values never clear provider fields.
   Treat a timeout after a possible write as ambiguous; retries and manual
   recovery must be safe for the provider's actual write sequence.
5. Classify provider responses into success, retryable temporary failure,
   repair-needed configuration/auth failure, terminal record rejection and
   skipped. Never put raw provider responses, addresses, answers, keys or
   unrestricted references in queue args, logs or health options. Respect
   bounded timeouts and provider pagination/rate limits.
6. Add mocked HTTP contract tests for new, existing, race, ambiguous timeout,
   revoked key, incompatible field, rate limit and both write policies. Then
   verify a labelled test account in real WordPress with the negotiated
   Action Scheduler version and provider console evidence. Record what a
   successful response proves, including any confirmation or automation
   effect; it does not prove inbox delivery.

The [integration foundation plan](../plans/integration-foundation.md) and
[verification matrix](../plans/integration-foundation-verification.md) remain
the release checklist. The first two adapters were checked against their
published API references on 2026-09-29, and Mailtrap on 2026-10-06:

| Provider | Contract checked | References |
| --- | --- | --- |
| Mailchimp | API-key Basic auth with key suffix as data center; `/ping`, account root, paged audiences and merge fields; `POST` member with `pending` for marketing or `transactional` for enquiries; duplicate member followed by merge-only `PATCH` when requested. | [Quick start](https://mailchimp.com/developer/marketing/guides/quick-start/), [API reference](https://mailchimp.com/developer/marketing/api/), [merge fields](https://mailchimp.com/developer/marketing/docs/merge-fields/), [transactional member status](https://mailchimp.com/developer/release-notes/added-transactional-accepted-status-for-batch-subscribe/) |
| Brevo | `api-key` auth; `/account`, paged contact lists and text attributes; `POST /contacts` with `updateEnabled: false`; `PUT /contacts/{email}` for selected fields and list only, or add-existing-to-list for keep mode; `425` and `429` retry; check per-address failure in list-add response. | [Account](https://developers.brevo.com/reference/get-account), [create contact](https://developers.brevo.com/reference/create-contact), [update contact](https://developers.brevo.com/reference/update-contact), [lists](https://developers.brevo.com/reference/get-lists), [attributes](https://developers.brevo.com/reference/get-attributes), [add to list](https://developers.brevo.com/reference/add-contact-to-list) |
| Mailtrap | `Api-Token` auth on the account-free paths (the spec dropped `accounts/{account_id}` in May 2026; the SDKs still use it); `GET /accounts` must return exactly one account; unpaged `/contacts/lists` (at most 50) and `/contacts/fields`, text types only, keyed by `merge_tag`. No built-in name field, so the Destination carries a "Name goes to" select. `PATCH /contacts/{email}` is the only write: an upsert answering `created` or `updated`. Keep mode sends a bare `PATCH` first and adds fields only on `created`; update mode is one `PATCH`. Never sends `unsubscribed` or `list_ids_excluded`. 200 requests per 60 s; `429` and `5xx` retry. No tags and no API double opt-in, so marketing Contacts land subscribed, as with Brevo. | [Contacts spec at `31a0f64`](https://github.com/mailtrap/mailtrap-openapi/blob/31a0f64/specs/contacts.openapi.yml), [accounts](https://docs.mailtrap.io/developers/account-management/accounts/list-account-s-you-have-access-to), [lists](https://docs.mailtrap.io/developers/email-marketing/contacts/contact-lists/get-all-contact-lists), [update contact](https://docs.mailtrap.io/developers/email-marketing/contacts/contacts/update-contact), [custom fields](https://docs.mailtrap.io/email-marketing/contacts/custom-fields), [rate limits](https://docs.mailtrap.io/developers/rate-limits) |

The API review checks documented shapes and behavior, not a live provider
account. Live confirmation, existing-contact, suppression and automation checks
in the verification matrix are still release gates for these adapters.
