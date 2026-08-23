# Delivery state is Destination health, not a per-Lead record

The storage decision made Leads immutable by schema and deferred delivery state
here, explicitly declining to spend a third table on our behalf. The obvious
design is a `wconvert_lead_deliveries` table at the per-(Lead × Destination)
grain — the grain the queue already uses. We did not build it.

The argument that decides it is **idempotency**. The ESP research found that no
vendor offers an idempotency header, so every push must use the vendor's
email-keyed upsert. That makes `push()` idempotent by construction — a
requirement the contract now states outright, because retries re-run a sequence
that may be two or three HTTP calls. Once re-pushing a Lead that already landed
is *harmless*, exact per-Lead delivery state buys efficiency, not correctness.

So we store what is actually needed to recover, at the coarsest grain that
supports it: **per-Destination health** — `last_success_at`, `last_error`,
`last_error_at`, `consecutive_failures`. Bulk recovery is "re-push every Lead
for Optins bound to this Destination since `last_success_at`". That answers the
real support case (an expired API key silently dropping three days of leads)
with no new table.

Action Scheduler was reconsidered as the store and rejected again, for the reason
already recorded: it prunes completed actions on a retention period and cannot be
queried by argument content. It gives durable *attempts*, never durable
*outcomes*. Its admin UI does cover the recent window, which is why the gap is
narrower than it first looks — but it closes entirely at retention.

## Consequences

- **A Lead that fails for a Lead-specific terminal reason is invisible to
  health.** A malformed address or a compliance rejection is not an outage, so
  `consecutive_failures` stays at zero. This is the cost, and it is covered by a
  **bounded ring buffer of the last ~200 terminal failures** — failures after
  retries are exhausted, or with `retryable = false`. It degrades correctly:
  during a real outage it fills with redundant entries while health already tells
  the story.
- **Health lives in its own non-autoloaded option**, separate from Destination
  configuration. Two jobs completing at once will lose an increment —
  `update_option` is a read-modify-write with no row lock. That race is tolerable
  for the same reason the whole design works: health is advisory, and a
  `last_success_at` that moves backwards only widens a re-push that is already
  idempotent. Keeping it out of the config option is what stops the same race
  eating an admin's edit, which would not be tolerable.
- **Queue jobs carry a Lead id and a Destination id, never Lead data.** Personal
  data would otherwise sit in `actionscheduler_actions` for the whole AS
  retention period, outliving any retention policy WConvert sets for itself.
- **No rate limiter class in v1.** Organic capture cannot approach any vendor's
  limit; only bulk re-push can. A Destination type declares a sustained
  jobs-per-minute figure and bulk re-push staggers `QueueInterface::schedule()`
  accordingly. Immediate dispatch stays immediate.
- If a per-Lead record is ever genuinely needed, it arrives as a table with its
  own sign-off. It is not a column added to `wconvert_leads` — that would give a
  Lead a lifecycle, which ADR-0002 exists to prevent.
