# Leads are immutable by schema

`CONTEXT.md` warns that any feature giving a Lead a lifecycle is the signal
WConvert is drifting into being a second contact database. A comment cannot
enforce that, so the schema does: `wconvert_leads` has **no `status` column and
no `updated_at` column**. A row with no mutable state cannot acquire a lifecycle
without a migration a reviewer will see. `created_at` alone also makes retention
pruning a range delete.

*Amended for progressive capture by
[ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md): the user chose
one Lead per capture journey, saved at the first submission and extended by
later explicit submissions in that same journey. Absolute immutability no
longer defines the boundary; general profile editing and Contact
lifecycle changes remain outside it. Only the journey capture and handoff writers may update accepted Lead JSON;
storage and continuation authorization are specified in the companion
[plan](../plans/184-progressive-capture/storage.md).*

*Amended by [ADR 0033](0033-the-lead-log-reads-without-a-new-index.md): the
range delete is real but it is **not over `created_at`**. A [[Lead]]'s id is a
ULID whose leading 48 bits are the millisecond it was minted in, stamped in the
same statement, so `id < :boundary` names exactly the rows `created_at <
:cutoff` does — over the primary key, which the table already has, rather than
over an `idx_created` that would have cost a third write per capture for a job
that runs once a day. `created_at` keeps its place regardless: it is the
[[Consent Record]]'s timestamp, to the same second, and there is no second
one (ADR 0032).*

*The consent-time claim is amended by
[ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md): a later SMS
acceptance needs its own evidence and acceptance time, distinct from the first
email capture. Retention remains anchored to the first capture; later additions do not renew it.*

*Completed by [ADR 0031](0031-a-lead-has-exactly-one-origin.md): the guard also
assumes every row arrives one submission at a time. A bulk-write path — a CSV
import, an admin "add lead" screen, a competitor import — is the other way in,
because rows that arrive already carrying a history are a lifecycle whether or
not a column names one. 0031 forecloses all three.*

This collides with the WSMS integration research, which settled that "a failed
push is a flag on the local row" — a flag is an update. We keep the Lead
immutable and put delivery state elsewhere, which is correct on its own terms:
delivery is per-(Lead × Destination), the grain the ESP research already fixed
for Action Scheduler jobs.

## Consequences

- **Do not "fix" the missing `status`/`updated_at` columns.** Their absence is
  the enforcement mechanism, not an oversight.
- Reading delivery state from Action Scheduler instead of storing it was
  considered and rejected: AS prunes completed actions on a retention period,
  and querying it by args is a `LIKE` against a serialized blob.
- `email` and `phone` are real indexed columns because they are the identity
  keys dedupe pivots on and `ContactRepositoryInterface::create()` hard-requires
  one of them. Everything else the Optin captured goes in one `fields` JSON.
  *Completed by [ADR 0021](0021-lead-identity-is-computed-not-stored.md): both
  are stored in **canonical form** — email lowercased, phone in E.164 — and an
  identifier that cannot be canonicalised is rejected at submit. Grouping the log
  by identifier is a lie otherwise, and WSMS's `create()` normalises on the way
  in, so an un-canonicalised row cannot find the Contact it created itself.*
- **Removing a [[Lead]] is a `DELETE`, and that is not an exception to this
  ADR.** `WConvert\Database\Connection` gained a `delete()` for the personal-data
  eraser and the retention prune, and it refuses any SQL that does not begin
  `DELETE FROM %i` — so the operation this ADR forbids, an `UPDATE` against a
  table with no update path, still cannot be expressed through it.
  `tests/unit/Lead/NoLeadIsEverUpdatedTest.php` reads both plugin trees and
  fails on an `update()` that names `wconvert_leads`, because `update()` cannot
  simply be removed: an Optin's soft delete IS an update. See
  [ADR 0018](0018-erasure-deletes-rather-than-anonymises.md) for why erasure
  deletes rather than anonymises.
  *Amended by [ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md):
  implementing same-journey additions must replace this blanket source test
  with tests that permit only the authorized continuation path and still
  prohibit general anonymous Lead editing. No such path is implemented yet.*
- Deleting an Optin **soft-deletes** it (`deleted_at`) rather than cascading.
  Leads are never destroyed by an Optin delete, and the Optin's name survives
  for CSV export without denormalising it onto every Lead row.
  *Completed by [ADR 0020](0020-conversions-are-interpreted-at-read.md): the soft
  delete is load-bearing for analytics as well. A Conversion is interpreted by
  joining `wconvert_optins` at report time, so a hard-deleted Optin makes every
  count referencing it uninterpretable — an Optin must never be hard-deleted.*
