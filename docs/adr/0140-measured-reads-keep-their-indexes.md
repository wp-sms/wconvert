# 0140: Measured reads keep their indexes

Date: 2026-10-10. Status: accepted.
Corrects [0033](0033-the-lead-log-reads-without-a-new-index.md) (the grouping's
access path), [0034](0034-the-dashboard-joins-in-php.md) (the cost of a stats
index, and which index) and [0019](0019-analytics-stores-daily-counters-not-events.md)
(the same premise, repeated in its correction note).

Those three ADRs refused indexes on reasoning nobody had measured. This one
measured it: scratch copies of `Schema::sql()` on MySQL 8.0.35 with a 128 MB
buffer pool, at 10k, 100k and 1M Leads (30 Optins, one taking 40%, one
0.05%; ~600-byte `fields`; 15% repeat identifiers) and 37k, 421k and 1.32M stats
rows (campaign, screen and product scopes). Each time is the median of five
warm runs, and the same query texts were also run on a real site.

## What was wrong

1. **The grouping is not answered from `idx_email`.** 0033 says each half of
   the union reads its own index. That stopped being true once `LeadQuery`
   bounded every read by its snapshot (`id < %s`). MySQL now ranges the primary
   key, reads each row's `fields`, and groups in a temporary table: 27 ms at 10k,
   0.5–1.2 s at 100k, and 5.8–6.8 s at 1M.
2. **A stats index is not "paid on every beacon".** An increment updates
   `count`, and no secondary index contains `count`. Only a beacon that creates a
   new row writes to the index, which on a live site is about one in a thousand.
   10k upserts at that mix cost 0.0950 ms each without `idx_stat_date` and
   0.0945 ms with it.
3. **`idx_stat_date` is the wrong escalation.** `inRange()` filters
   `scope = ''`, and the date-only index does not contain `scope`. So at
   1.32M rows MySQL ignores it and keeps scanning (311 ms). `(scope, stat_date)`
   is the index the query would use: 323 → 31 ms over 30 days.
4. **"~29k rows a year" no longer describes the table.** Product (0122) and
   screen (0103) scopes made up 23–68% of the rows in these mixes.

## Decisions

1. **The unfiltered grouping names its index.** When the `LeadQuery` has no
   narrowing filter, `LeadRepository::groups()` adds the optimizer hint
   `/*+ INDEX(l idx_email) */` to both halves. This cuts the read from 1.2 s to
   0.14 s at 100k Leads, and from 6.8 s to 2.0 s at 1M, with identical rows. The email half reads only the index; the phone half
   still looks up its `email IS NULL` rows.
   `LeadQuery::narrowed()` decides when the hint applies, reading the same
   predicates the query is built from. Under a narrowing filter the hint was a
   regression where measured: one Lead by id went from 0.1 ms to 142 ms, one
   phone number from 0.1 ms to 2.1 s, and one large Optin gained nothing.
   Purpose and search were not measured, so they keep MySQL's plan too. The hint is a comment, so SQLite, MariaDB and MySQL before 8.0.20
   read the same text and ignore it.
2. **Interests are a primary-key range.** `JourneyStatsController::interests()`
   bounded its window with `created_at`, so for a quiet Optin it walked the
   whole log backwards (1.6 s at 1M). It now uses `id >= floorAt(start) AND
   id < floorAt(end)`, the same trick `LeadQuery`'s date filters already use,
   and the same rows come back in 19 ms. `LeadQuery::dayStart()` and `dayEnd()`
   are the one spelling of a site day as a key bound.
3. **Still no `idx_optin` on `wconvert_leads`.** It would help only rarely-used
   Optins: a page goes from 70 ms to 1 ms and a grouping from 0.7 s to 2 ms
   at 1M. It does nothing for the totals (377 ms) or the unfiltered grouping. Its
   cost:

   | Leads | Table | With `idx_optin` | Insert per capture |
   |---|---|---|---|
   | 10k | 9.6 MB | +1.5 MB (+16%) | 0.13 → 0.14 ms |
   | 100k | 92 MB | +7.5 MB (+8%) | 0.12 → 0.13 ms |
   | 1M | 908 MB | +66 MB (+7%) | 0.12 → 0.17 ms |

4. **Still no index on `wconvert_stats`.** If one is ever needed, it is
   `(scope, stat_date)`, not `idx_stat_date`. At realistic sizes the 30-day
   scan stays under 100 ms (94 ms at 421k rows). The index would cost nearly
   half the table again, because InnoDB copies the four primary-key columns into
   it: +2.6 MB on 5.5 MB, +34 MB on 75 MB, +115 MB on 261 MB. Upserts would not
   slow down, but the product prune would, from 338 to 563 ms per 5,000-row
   batch.

## Consequences

- **The headline totals remain full scans** (`COUNT(*)` on InnoDB): 23 ms at
  100k and 377 ms at 1M. No index on this table can avoid that.
- **The hint is MySQL-only.** On MariaDB the unfiltered grouping keeps the
  slower plan, and it is no worse than before.
- **What would justify an index** is now a measured threshold, not a feeling:
  the rows here are what an escalation has to beat.
