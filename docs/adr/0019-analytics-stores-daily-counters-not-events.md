# Analytics stores daily counters, not events

[#12](https://github.com/navidkashani/wconvert/issues/12) was framed around an
event table with a scheduled rollup on top of it, and named its own problem in
the framing: *"raw event rows grow without bound."* **We store only the rollup.**
There is no event table, and `wconvert_stats` holds one row per
`(optin_id, kind, stat_date)` with a `count`.

The row was already almost a counter.
[ADR 0020](0020-conversions-are-interpreted-at-read.md) strips every dimension
off a recorded act except which [[Optin]] it happened on and what kind it was, so
the only thing a raw row carries that a daily counter does not is the intra-day
timestamp.

## The arithmetic

A modest site — 10k pageviews a day, one popup sitewide — writes **~3.65M raw
rows a year**. The same site as daily counters, at 20 active Optins across four
kinds, writes **~29k rows a year**, and the index stays in the buffer pool
permanently.

That gap is why the conventional design loses here. It is not a close call at any
site size a wp.org plugin will meet.

## What the shape buys beyond size

The write is `INSERT … ON DUPLICATE KEY UPDATE count = count + 1`, **atomic at
the database**. No increment is ever lost, there is no read-modify-write race to
reason about, and there is no rollup job — the Action Scheduler dependency
[ADR 0007](0007-destinations-are-outbound-and-fallible.md) makes available is
simply not needed here.

The primary key is the mechanism, not decoration: `(optin_id, stat_date, kind)`
is what makes the upsert atomic, and it serves the dashboard's only query shape —
an id set, a date range, grouped by kind — with no secondary index and no
surrogate `id`.

## Table-free alternatives, rejected

- **A WP option.** `update_option` is a read-modify-write with no row lock.
  [ADR 0008](0008-delivery-state-is-destination-health-not-per-lead.md) accepted
  exactly this race for Destination health *because health is advisory*. A
  conversion count is not, and the race eats the most increments on the busiest
  sites — it would undercount worst precisely where the numbers matter most.
- **A transient.** The same race, plus an object-cache-backed transient can be
  evicted at any moment.
- **An existing table.** `wconvert_leads` cannot hold impressions, dismissals, or
  the click-through conversions that have no [[Lead]] behind them, and
  [ADR 0018](0018-erasure-deletes-rather-than-anonymises.md) deletes its rows on
  erasure. Counter columns on `wconvert_optins` would need one per kind per day,
  which is a table wearing a trench coat.
- **Computing on read.** An impression leaves no trace anywhere else in the
  system. There is nothing to compute from.

## Consequences

- **You can never recompute.** If a counting bug ships, there is no raw data to
  repair the numbers from — they are wrong for that period, permanently. This is
  the price of the shape and it was taken knowingly.
- **There is no hour-of-day breakdown, ever.** "Today so far" works, because the
  day's row updates live; an intra-day curve does not and cannot be added
  retroactively.
- **Retention is keep-forever with no pruning**, which is where
  [#11](https://github.com/navidkashani/wconvert/issues/11) put [[Lead]]s — but
  arrived at by a different route: at ~29k rows a year there is nothing to prune.
  Analytics needs no retention setting of its own.
- **`kind` is a closed set of four** — `impression`, `conversion`, `dismiss`,
  `lead_magnet_delivered` — validated in PHP, with no filter and no registry. An
  open registry means unbounded `kind` cardinality on a table whose entire
  justification is a bounded row count, and it would be the fourth
  hand-maintained cross-cutting list this map has refused
  ([0005](0005-the-rule-model-is-three-flat-closed-axes.md),
  [0012](0012-degradation-substitutes-triggers-and-drops-conditions.md),
  [0015](0015-enforcement-is-by-non-registration.md)).
- **`stat_date` is a `DATE` in the site's timezone**, not UTC. The dashboard is
  the only consumer and it says "Today", which has to mean the merchant's today.
  A merchant who later changes their site timezone does not retro-fix old rows;
  that seam is preferable to every merchant east of London reading their day
  split across two rows forever.
- **`count` is `INT UNSIGNED`.** 4.29 billion of one kind on one Optin in one day
  is not a number to plan for.
- **The beacon endpoint is hardened lightly and deliberately.** It validates
  `optin_id` against the published set and reuses #11's IP-hashed transient rate
  limit, and stops there. It is public and unauthenticated by necessity — a nonce
  baked into a cached page is the same nonce for every visitor for the cache's
  lifetime, so it authenticates nothing. The loss from abuse is a wrong number on
  one merchant's dashboard, not data loss and not a breach.
