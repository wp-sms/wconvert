# The lead log reads without a new index

[#24](https://github.com/navidkashani/wconvert/issues/24) shipped
`wconvert_leads` with `idx_email` and `idx_phone` and nothing else, and said so
out loud: the covering indexes a per-Optin listing and a retention prune would
want belong to the ticket that writes those queries, and to the sign-off that
ticket gets. This is that sign-off, and the answer is **neither index**.

Two were on the table. `idx_optin_created (optin_id, created_at)` for the log
filtered to one Optin, and `idx_created (created_at)` for the retention prune.

It **amends [ADR 0002](0002-leads-are-immutable-by-schema.md)**, whose closing
line reads "`created_at` alone also makes retention pruning a range delete" —
true of the range, wrong about the column it runs over. It **completes
[ADR 0018](0018-erasure-deletes-rather-than-anonymises.md)**, which specified
the prune without saying what it would cost, and **completes
[ADR 0021](0021-lead-identity-is-computed-not-stored.md)**, whose "indexed
aggregate over a table that already exists" is true only of the query below and
not of the obvious one. Both are noted inline in those files.

## Why the prune needs none

The prune is a range delete: *remove everything captured before a cutoff*. On
`created_at` that is a full table scan without `idx_created`.

But a [[Lead]]'s id is a ULID, and its **leading 48 bits are the millisecond it
was minted in** — stamped in the same statement as `created_at`, by the same
`record()` call, which is why this codebase already treats `ORDER BY id` as
`ORDER BY created_at` in three other places. So the same rows are named by

```sql
DELETE FROM wconvert_leads WHERE id < :boundary
```

where `:boundary` is the smallest ULID of the cutoff millisecond
(`Ulid::floorAt()`). That is a range over the **primary key** — the best access
path the table has, and one it already carries.

`idx_created` would have been a third write per capture, on the plugin's
hottest table, bought for a job that runs once a day and could use the primary
key instead.

## Why the listing needs none either

`WHERE optin_id = ? ORDER BY id DESC LIMIT 50` walks the primary key backwards
and stops once it has fifty matching rows. For an Optin that is capturing, that
is fifty rows read. For a long-dead Optin on a large log it degrades towards a
full backwards scan.

That is a real cost, and it is the right one to accept for now: it is an
**admin screen**, read on demand by one person, while an index is paid on
**every capture** by every visitor. The escalation is available and cheap —
add `idx_optin_created` — and it should be taken when someone can show the
scan actually hurting, not before.

## Why grouping needs none

Grouping is `GROUP BY` over the identifier, and
[ADR 0021](0021-lead-identity-is-computed-not-stored.md) justified making
`email` and `phone` indexed columns partly on the grounds that the grouping
would then be "an indexed aggregate over a table that already exists".

The obvious spelling does not deliver that. `GROUP BY COALESCE(email, phone)`
is a function over two columns and can use neither index. So the query is
**two aggregates, unioned** — one over `email IS NOT NULL`, one over the rows
with no email — and each half is answered from its own index. InnoDB appends
the primary key to every secondary index, so `idx_email` covers `(email, id)`
and even the `MAX(id)` each group reports comes out of the index without
touching a row.

The group's "last submitted" is read off that ULID rather than fetched as a
`MAX(created_at)`, for the same reason: adding `created_at` to the aggregate
would force a row lookup per row and lose the covering read.

## What this costs

**A Lead carrying only an email and a Lead carrying only a phone are two
groups, even where a human knows they are one person.** The two halves
partition on `email IS NULL`, so a phone shared with an email-bearing Lead does
not pull them together.

That is safe **only** because of the boundary
[ADR 0021](0021-lead-identity-is-computed-not-stored.md) already drew: the
headline is submissions, grouping is presentation, and no screen reports a
count of people. Under-grouping cannot produce a wrong number when no number of
people is produced at all. Were the group count ever promoted to a metric, this
trade would have to be re-opened first — which is one more reason it must not
be.

## Consequences

- **`wconvert_leads` still ships exactly two indexes**, and
  `tests/unit/Database/SchemaTest.php` still fails on a third.
- The prune's correctness now rests on the ULID timestamp being the capture
  time. `tests/unit/Support/UlidTest.php` decodes a hand-computed value rather
  than round-tripping the encoder, so the two halves cannot agree with each
  other while both being wrong.
- Adding `idx_optin_created` later needs no code change — the query is already
  the one that would use it.
