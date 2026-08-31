# Destinations are outbound and fallible; the local Lead log is not one

`CONTEXT.md` originally listed "the local Lead log" as a Destination and defined
Standalone as "no Destination configured other than the local Lead log". The
storage and WSMS-integration decisions then made the local row **the capture
itself** — written first and always, before anything else runs. Both statements
could not stand.

Test the local log against every property the word Destination carries:
configured (no — it cannot be turned off), optional (no), one of several (no),
holds credentials (no), has a settings schema (no), can fail without the capture
failing (no — if it fails, capture failed), has delivery state (meaningless).
It satisfies none of them. Keeping it inside the contract would put a member in
the set that violates every invariant the other implementations rely on, and
`DestinationInterface` would grow methods that only ever have one honest
implementation: the null one.

**The glossary was wrong, not the contract.** A Destination is defined by being
**outbound and fallible**. The local Lead log is the *Lead store*.

> **Completed by [ADR 0044](0044-there-is-no-visitor-facing-error-state.md),
> which follows "fallible without the capture failing" all the way to the
> visitor.** Because the local row is the capture and a push is not, **a
> Destination failing is invisible to the visitor by construction** — there is
> no error step in a [[Template]] and there is never going to be one. The only
> thing a visitor-facing error could report here is the local write failing,
> which is an outage rather than a state in their journey. Claspo, the one
> competitor of eighteen that has such a state, has it because in Claspo the ESP
> push *is* the capture — the exact model this ADR rejected.

The criterion was chosen over the obvious alternative — "a Destination is an
external system" — because the lead-magnet delivery email is outbound, per-Lead,
configurable and fallible, but is not external: it goes through `wp_mail`. Under
the external-system criterion it would have had no home, and the *Deliver a lead
magnet* Goal's declared metric ("Leads where the delivery fired") would have had
nothing to read.

## Consequences

- **Standalone is not "no Destination configured at all."** That wording would
  make a lead-magnet install non-Standalone, which inverts the intent. Standalone
  is *no Destination that depends on another system* — no WSMS, no ESP, no
  webhook. Capture, the Lead log, CSV export and the lead-magnet email all work
  with nothing else installed.
- **The local Lead row is never queued, never retried, and never has delivery
  state.** It is the precondition for dispatch, not a participant in it.
- **This ADR bundles no Action Scheduler, and nothing yet does.**
  [ADR 0018](0018-erasure-deletes-rather-than-anonymises.md) and
  [ADR 0019](0019-analytics-stores-daily-counters-not-events.md) both refer to
  "the Action Scheduler dependency ADR 0007 makes available"; that reading was
  never true of this document, and WConvert has no runtime Composer dependency
  at all. The queue arrives with the Destination dispatch in
  [#30](https://github.com/navidkashani/wconvert/issues/30), which is the first
  thing that needs per-(Lead × Destination) durability. Retention pruning, which
  0018 attributed here, is a WP-Cron daily event instead — one site-wide job
  running one statement has no per-item grain to retry.

  > **Completed by #30, and the sentence above is now out of date in one
  > respect: WConvert has exactly one runtime Composer dependency.**
  > `woocommerce/action-scheduler` is required by `composer.json` and loaded
  > from `wconvert.php` itself rather than through the PSR-4 autoloader — it is
  > a WordPress plugin, and its entry file is what defines the `as_*()`
  > functions. It is loaded at plugin-file time rather than on `plugins_loaded`
  > because Action Scheduler version-negotiates at load and the newest copy on
  > the site wins; a copy registering late has already lost that negotiation.
  > It must never be php-scoped, for the same reason.
  >
  > The seam is `WConvert\Queue\Queue`, with **no `cancel()`** — Action
  > Scheduler cannot be queried by argument content, so a cancel here would be
  > a method that lies. Retries are WConvert's own (`PushJob::MAX_ATTEMPTS`,
  > exponential backoff): AS marks a failed action failed and does not retry
  > it, which is the same thing WSMS's `JobProcessor` works around.
  >
  > > **Corrected by [#31](https://github.com/navidkashani/wconvert/issues/31):
  > > AS *can* be queried by argument content**, and has been able to since
  > > 4.1 — `ActionScheduler_DBStore::hash_args()` writes a queryable hash, and
  > > `partial_args_matching` and `as_has_scheduled_action()` are built on it.
  > > **`cancel()` still does not exist**, for the reason the sentence after it
  > > gives on its own: nothing in WConvert is designed to depend on cancelling
  > > or looking up a queued push. What changes is the justification, not the
  > > interface. The same stale claim appeared in
  > > [ADR 0008](0008-delivery-state-is-destination-health-not-per-lead.md) and
  > > in [`Queue`](../../src/Queue/Queue.php)'s docblock and is corrected in
  > > both; in 0008 it sat beside the reason that *does* hold — 31-day
  > > retention, so AS stores durable attempts and never durable outcomes.
  >
  > Retention pruning stays on WP-Cron exactly as this bullet says. Having a
  > scheduler did not change the argument that put it there.
- "Destinations are the only way a Lead leaves WConvert" is now scoped to
  *automatic* pushes. CSV export is a manual admin action and always was a
  counter-example to the unscoped claim.
- **One-way is scoped to Contact state and the capture path**, not to all reads.
  WConvert never reads subscription status, list membership or suppression, and
  reads nothing at all while handling a capture — but it does read a provider's
  *shape* at admin time (audiences, custom fields, connection tests). All four v1
  ESPs require an audience id, and making the merchant paste one by hand is a
  support burden with no privacy benefit: reading the list of audiences reveals
  nothing about any person.
