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

> **Amended by [#30](https://github.com/navidkashani/wconvert/issues/30): two
> more fields, `skipped_captures` and `last_skipped_at`.** The four above cover
> a Destination that was *tried*. They cannot describe the third thing that
> goes wrong, which #4 named and this ADR did not carry over: a Destination
> whose TYPE is not `ready` — a deactivated WSMS, a lapsed licence — is
> "skipped and recorded, never enqueued", because an Action Scheduler job whose
> handler is unregistered retries against nothing forever.
>
> Nothing was attempted, so it is not an outage and must not touch
> `consecutive_failures` — that would be the same inversion this ADR exists to
> prevent, one state over. And it cannot go in the terminal-failure ring
> either: one entry per capture fills 200 slots in an afternoon and buries
> every genuine terminal failure under it.
>
> So it is a counter, in the same option, with the same advisory semantics and
> the same tolerable race. It clears on a successful landing, because the Leads
> behind it are recovered by a bulk re-push rather than by the number — the
> number is only ever the prompt to run one.

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
- **The lead-magnet Goal's metric is not read from delivery state.** #2 worded it
  as "Leads where the delivery fired", which has nothing per-Lead left to read
  once health is the whole record. *Resolved by
  [ADR 0020](0020-conversions-are-interpreted-at-read.md): it becomes its own
  `kind` — `lead_magnet_delivered` — in `wconvert_stats`, written by the Action
  Scheduler job once per Lead on first successful delivery.
  `conversions − lead_magnet_delivered` is then the delivery failure count, and
  it is the analytical half of the operational/analytical split this ADR draws.*
- If a per-Lead record is ever genuinely needed, it arrives as a table with its
  own sign-off. It is not a column added to `wconvert_leads` — that would give a
  Lead a lifecycle, which ADR-0002 exists to prevent.
