# Leads are immutable by schema

`CONTEXT.md` warns that any feature giving a Lead a lifecycle is the signal
WConvert is drifting into being a second contact database. A comment cannot
enforce that, so the schema does: `wconvert_leads` has **no `status` column and
no `updated_at` column**. A row with no mutable state cannot acquire a lifecycle
without a migration a reviewer will see. `created_at` alone also makes retention
pruning a range delete.

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
- Deleting an Optin **soft-deletes** it (`deleted_at`) rather than cascading.
  Leads are never destroyed by an Optin delete, and the Optin's name survives
  for CSV export without denormalising it onto every Lead row.
  *Completed by [ADR 0020](0020-conversions-are-interpreted-at-read.md): the soft
  delete is load-bearing for analytics as well. A Conversion is interpreted by
  joining `wconvert_optins` at report time, so a hard-deleted Optin makes every
  count referencing it uninterpretable — an Optin must never be hard-deleted.*
