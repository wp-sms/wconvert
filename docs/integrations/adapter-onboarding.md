# Adding a remote Destination adapter

Use the existing `DestinationType` registry and the shared Connection,
Destination, campaign mapping, queue, health and recent-attempt flows. Remote
provider HTTP code belongs in the Pro destinations module; Free owns the shared
flow and local adapters. Do not add a second integration settings page or a
per-Lead delivery ledger.

1. Register the type in `pro/modules/destinations/` and its internal tier in the
   catalog. Declare prerequisites, supported audience channel and automatic
   contact fields in `requirements()` so setup and capture readiness agree.
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
the release checklist. Provider pagination, retry detail and live behavior are
still open gates for the first two adapters, so this note does not imply they
are production-ready.
