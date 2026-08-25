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

*Corrected by [ADR 0007](0007-destinations-are-outbound-and-fallible.md), whose
own inline note names this document; the back-reference was missing until
[#26](https://github.com/navidkashani/wconvert/issues/26) added it. The sentence
above reads as though 0007 had already bundled Action Scheduler. It has not, and
nothing yet has — WConvert has no runtime Composer dependency at all, and the
queue arrives with the Destination dispatch in
[#30](https://github.com/navidkashani/wconvert/issues/30). The conclusion here
is unaffected, because what this ADR needs from that dependency is nothing:
there is no rollup job.*

*Built by [#26](https://github.com/navidkashani/wconvert/issues/26), which is
also where the atomicity stopped being a claim.
[`Connection::upsert()`](../../src/Database/Connection.php) is the one method
that can express this statement, guarded so it refuses SQL that does not begin
`INSERT INTO %i` — the second widening of an interface that deliberately offers
no raw `query()`, on the same pattern as `delete()`. And because "the database
does it" is a claim about MySQL rather than about PHP,
[`bin/verify-stats.php`](../../bin/verify-stats.php) fires two increments
concurrently on two connections, with the second blocking on the row lock the
first holds, and asserts the count is two — then runs the same two increments as
a read-modify-write, **which loses one**, so the check is known to be able to
fail.*

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
  *Completed by [#26](https://github.com/navidkashani/wconvert/issues/26) as a
  PHP `enum` ([`StatKind`](../../src/Stats/StatKind.php)) over a `VARCHAR(32)`
  column rather than a database `ENUM`: adding a case should be a code change a
  reviewer reads, not a migration. And the beacon accepts **three of the four**.
  `lead_magnet_delivered` records an act a browser cannot have watched, so an
  endpoint that is public by necessity must not take its word for it — otherwise
  `conversions − lead_magnet_delivered`, the delivery failure count
  [ADR 0020](0020-conversions-are-interpreted-at-read.md) names, is a number
  anybody can set.*
- **`stat_date` is a `DATE` in the site's timezone**, not UTC. The dashboard is
  the only consumer and it says "Today", which has to mean the merchant's today.
  A merchant who later changes their site timezone does not retro-fix old rows;
  that seam is preferable to every merchant east of London reading their day
  split across two rows forever.
  *Completed by [#26](https://github.com/navidkashani/wconvert/issues/26) as a
  **boundary rather than a stub**. The arithmetic is
  [`StatDay::of()`](../../src/Stats/StatDay.php) — pure, taking the zone as an
  argument — and the day is computed once per request and passed down, so the
  repository has no clock and no timezone. That shape was forced by the test
  suite: `tests/bootstrap.php` answers `current_time()` and `get_date_from_gmt()`
  as though the site were on UTC, deliberately and consistently with each other,
  so a seam built on those stubs could not tell the site's day from UTC's and
  would pass just as happily against code that got this wrong. The one line that
  asks WordPress which zone the site is on is proven where a real
  `timezone_string` can be set, in
  [`bin/verify-stats.php`](../../bin/verify-stats.php).*
- **`count` is `INT UNSIGNED`.** 4.29 billion of one kind on one Optin in one day
  is not a number to plan for.
- **The beacon endpoint is hardened lightly and deliberately.** It validates
  `optin_id` against the published set and reuses #11's IP-hashed transient rate
  limit, and stops there. It is public and unauthenticated by necessity — a nonce
  baked into a cached page is the same nonce for every visitor for the cache's
  lifetime, so it authenticates nothing. The loss from abuse is a wrong number on
  one merchant's dashboard, not data loss and not a breach.
  *Corrected by [#26](https://github.com/navidkashani/wconvert/issues/26): there
  was nothing to reuse. #11 described the shape — hash the IP into a short-lived
  transient, never persist it, the way core does comment flood control — and #24
  shipped the capture endpoint without one, so #26 BUILT it
  ([`RateLimit`](../../src/Rest/RateLimit.php), over a new
  [`TransientStore`](../../src/Storage/TransientStore.php) seam beside
  `OptionStore`). It limits the beacon and **not** the capture endpoint, on
  purpose: a beacon fires on every page view a published Optin matches while a
  capture is one act a person performs rarely and cares about a great deal, and
  one shared window would let ordinary beacon volume refuse the submission a
  visitor was still on the page to fix.*
  *And the ceiling is sized against LEGITIMATE traffic rather than against
  abuse, because the two failures are not symmetric. A refused abusive beacon
  costs what this ADR already books — a wrong number. A refused legitimate one
  costs an act that really happened and, if it is an Impression, removes a
  denominator: conversion rate then reads too HIGH, permanently. A page view is
  not one request — every Impression flushes immediately and an `inline` Optin
  reports its own on entering the viewport — so the ceiling is set where a
  building behind one NAT cannot reach it.*
  *Extended by the same ticket with the filtering this ADR did not name:
  `Sec-Purpose`, bot user agent and `document.prerendering`, with **no
  heuristics** — there is no identifier left on a stateless beacon to score a
  suspicious request against, so a scoring pass would be a guess wearing a
  number — which is also why a request with NO user agent is COUNTED. "Every
  browser sends one, so a request without one is a script" is exactly such a
  guess, and it fails in the expensive direction: a visitor behind a
  UA-stripping extension is a real person, and their missing Impression flatters
  the numbers forever. The prerender half is a HOLD rather than a drop: nothing
  leaves while
  `document.prerendering` is true, and the held events flush on
  `prerenderingchange`, because a prerender the visitor goes on to open is a
  page they looked at and an Impression by every definition the glossary offers.
  Dropping it would undercount the denominator of conversion rate on every site
  running speculation rules — which is the direction of error that flatters us.*
