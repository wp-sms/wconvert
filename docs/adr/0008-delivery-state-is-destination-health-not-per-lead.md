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

> **Amended by [#31](https://github.com/navidkashani/wconvert/issues/31): the
> premise holds for every type but one.** `wp_mail()` has no upsert. The
> lead-magnet delivery
> ([`LeadMagnetDestinationType`](../../src/Destination/LeadMagnet/LeadMagnetDestinationType.php))
> is idempotent in the sense this ADR needs — there is no remote object to
> double up, so running it twice leaves the world as it was — but the *send* is
> not undoable. Re-pushing a Lead that already landed re-sends the file and
> re-counts the delivery.
>
> That does not reopen the table decision (see the last bullet below); it
> changes what "harmless" is a claim about. It is a claim about remote STATE,
> not about the recipient's inbox. The consequence is stated where a merchant
> can meet it: bulk re-push on this one Destination genuinely re-sends, and
> `README.md` says so.

So we store what is actually needed to recover, at the coarsest grain that
supports it: **per-Destination health** — `last_success_at`, `last_error`,
`last_error_at`, `consecutive_failures`. Bulk recovery is "re-push every Lead
for Optins bound to this Destination since `last_success_at`". That answers the
real support case (an expired API key silently dropping three days of leads)
with no new table.

*Clarified at the recovery controls by
[0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md):
the binding is read from each Optin's **published configuration**. With no last
success, recovery considers the whole retained matching history. It is not a
retry of only the failure row or skipped count being displayed. Skipped-capture
recovery is now beside its explanation; terminal failures link to the named
Destination and exact capture without adding a delivery ledger.*

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

Action Scheduler was reconsidered as the store and rejected again — **on
retention, which is the reason that actually holds.**
`ActionScheduler_QueueCleaner::$month_in_seconds = 2678400` deletes completed
actions after 31 days, so it gives durable *attempts* and never durable
*outcomes*. Its admin UI does cover the recent window, which is why the gap is
narrower than it first looks — but it closes entirely at retention.

> **Corrected by [#31](https://github.com/navidkashani/wconvert/issues/31).**
> This paragraph used to give a second reason — *"cannot be queried by argument
> content"* — and that stopped being true. AS 4.1 hashes arguments into a
> queryable column: `ActionScheduler_DBStore::hash_args()`, the
> `partial_args_matching` option, and `as_has_scheduled_action()` are all built
> on it. The claim is repeated in two other places and corrected in both —
> [ADR 0007](0007-destinations-are-outbound-and-fallible.md) and
> [`Queue`](../../src/Queue/Queue.php)'s docblock — because a stale reason
> beside a sound one is how the sound one gets discarded with it. Retention was
> always the load-bearing half and it still is.
>
> **The obvious objection, answered where it is formed: this correction
> establishes a dedupe primitive and then declines to use it.** If
> `as_has_scheduled_action()` can ask "has this Lead been pushed to this
> Destination before", why is that not the exactly-once marker #31 wanted?
>
> Because it answers a narrower question than it appears to. AS can tell you
> an action with these arguments **exists or ran within the retention window**;
> it cannot tell you one **succeeded**, and after 31 days it cannot tell you
> anything at all. A marker that silently starts saying "no" on day 32 is worse
> than no marker: the re-count it was meant to prevent comes back, and comes
> back only for the old Leads nobody is watching. Retention is not a smaller
> objection than queryability was — it is the objection.
>
> A marker in one of WConvert's own stores was considered and is not free
> either. An option keyed per Lead grows without bound — the reason
> {@link ../../src/Destination/DeliveryFailures.php `DeliveryFailures`} is a
> ring capped at 200 — and it would hold Lead ids with no expiry, which is the
> personal-data-with-no-expiry problem
> [ADR 0018](0018-erasure-deletes-rather-than-anonymises.md) exists to keep out
> of options. That leaves a table, which is the thing declined above.
>
> **So the honest position is the one recorded in the last bullet: the chain
> reaches Success at most once, the two replay seams are real, and neither the
> queue nor an option can close them without a store that outlives the
> attempt.** The dashboard's clamp keeps the *displayed* number sane; it is not
> a substitute for the marker, and it is not claimed as one.

*Read by a second screen as of
[ADR 0057](0057-a-milestone-is-a-date-recorded-once-about-the-site.md), and
that ADR restates nothing from it. #94's fifth milestone is "the captured data
reached somewhere, or did not", and the answer was already here — so
[`Milestones`](../../src/Milestone/Milestones.php) carries three booleans
(configured, landed, failing) and neither the failure count nor the last error.
The numbers stay on the Destinations screen, where the repair actions are: a
count copied onto a screen that cannot act on it is a second, staler spelling
of an outage, and the beginning of the second store this document exists to
refuse.*

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
- **No Destination-vendor rate limiter class in v1.** Organic capture cannot
  approach any vendor's limit; only bulk re-push can. A Destination type
  declares a sustained jobs-per-minute figure and bulk re-push staggers
  `QueueInterface::schedule()` accordingly. Immediate dispatch stays immediate.
  The public capture endpoint's separate abuse limiter protects local form
  intake and does not meter Destination delivery.
- **The lead-magnet Goal's metric is not read from delivery state.** #2 worded it
  as "Leads where the delivery fired", which has nothing per-Lead left to read
  once health is the whole record. *Resolved by
  [ADR 0020](0020-conversions-are-interpreted-at-read.md): it becomes its own
  `kind` — `lead_magnet_delivered` — in `wconvert_stats`, written by the Action
  Scheduler job once per Lead on first successful delivery.
  `conversions − lead_magnet_delivered` supplies the analytical comparison.*
  **Corrected by [0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md):
  this was called a delivery failure count. It is a same-period difference of
  event totals, clamped at zero, and identifies neither failures nor particular
  Leads still waiting. The operational health/ring remains the place to inspect
  recorded failures.**
- If a per-Lead record is ever genuinely needed, it arrives as a table with its
  own sign-off. It is not a column added to `wconvert_leads` — that would give a
  Lead a lifecycle, which ADR-0002 exists to prevent.
  *Asked and answered **no** by
  [#31](https://github.com/navidkashani/wconvert/issues/31), which is the first
  ticket to want one. "Exactly one `lead_magnet_delivered` per Lead on first
  success" reads like it needs a per-Lead marker. It does not:
  `PushDispatcher` fires once per capture,
  [`PushWorker::record()`](../../src/Destination/PushWorker.php) re-queues
  **only** on a retryable failure, and the chain stops at
  `PushOutcome::Success` — so a chain reaches Success at most once.
  **Exactly-once is a property of the shape, not of a stored flag**, and a
  `wconvert_deliveries` table was declined on those grounds rather than
  deferred.*
  *Two replay seams are **accepted rather than hidden**. `BulkRePush` — a
  button a merchant presses — replays Leads that already landed, and on the
  lead-magnet type that re-sends the file and re-counts (see the amendment at
  the top of this ADR). Action Scheduler resetting a stuck action replays
  identical arguments. Because an over-count is therefore possible,
  [`Dashboard`](../../src/Stats/Dashboard.php) clamps:
  `undelivered_conversions = max(0, conversions − lead_magnet_delivered)`. The
  clamp is load-bearing for a second reason with nothing to do with replay — a
  Conversion at 23:58 and its delivery at 00:01 land on different `stat_date`s,
  so a one-day window would go negative most mornings without it.*
  *That payload field was called `delivery_failures` when #31 landed it, and
  was renamed before the first release: it is **not** this ADR's
  [`DeliveryFailures`](../../src/Destination/DeliveryFailures.php) ring, which
  holds terminal failures only. **[0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md)
  corrects the further claim that a queued Conversion is necessarily "in" the
  dashboard figure.** A delivery from an earlier capture can offset it within
  the selected period. There is no per-Lead pending population to read from
  these counters, and the dashboard now describes their same-period difference.*
  *The earlier claim that no resend warning appears in the UI is narrowed by
  [0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md):
  skipped-capture recovery now explains its broad published-binding scope and
  says it can send an email again. That warning is generic; it requires neither
  a Goal/type branch in TypeScript nor a capability method on `DestinationType`.*

*Test sends are also made explicit by
[0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md):
the merchant reviews the saved route and chooses a sample email before the
real push. The WordPress profile is a displayed suggestion only. The endpoint
requires that email explicitly, creates no Lead and updates no health, queue or
report counter. This does not make a test send a stored delivery event.*
