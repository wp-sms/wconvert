# A Lead has exactly one origin

Every row in `wconvert_leads` is written by **one visitor submitting one form, in
one request, while they are still on the page**. There is no second way a Lead
comes into existence: no admin "add lead" screen, no CSV import, no competitor
import, no ingestion API.

This is not a feature that has yet to be built. It is a property the rest of the
model already assumes, and writing it down is what makes three earlier decisions
complete rather than approximately true.

## The decisions that were quietly resting on it

[ADR 0021](0021-lead-identity-is-computed-not-stored.md) rejects an
unnormalizable phone **at submit**, and justifies it on the visitor being present
to correct the typo. That argument is total only if every phone number arrives
that way. One import path and the rule acquires a second case it never answered —
which is exactly the gap
[#18](https://github.com/navidkashani/wconvert/issues/18) opened before it was
closed, and the reason this ADR exists.

[ADR 0002](0002-leads-are-immutable-by-schema.md) removed `status` and
`updated_at` so that a [[Lead]] acquiring a lifecycle requires a migration a
reviewer will see. A bulk-write path is the other way in: rows that arrive
already carrying a history are a lifecycle whether or not a column names one.

[ADR 0018](0018-erasure-deletes-rather-than-anonymises.md) and the
[[Consent Record]] together make the submission the *only* moment consent exists.
Which is the clause that decides this.

## Consent evidence cannot be back-filled

A Consent Record is the consent wording **exactly as it was shown to that person
at that instant**, snapshotted onto the Lead. Its whole purpose is to be evidence
of a specific moment.

An imported row has no such moment. It was not shown anything by this system, on
any page, in any [[Optin]]. Writing a Lead for it means either leaving the
consent evidence empty — a Lead the schema says was consented, with nothing
behind it — or **synthesising** wording nobody was ever shown.

The second is not a shortcut, it is manufacturing evidence. And the first is
worse than it looks: the consent field is not decoration, it is the artefact the
merchant hands a regulator.

So a Lead cannot be imported. Not "should not" on cost or taste — the record
required to make one honest describes an event that did not happen.

## What was on the table

Three requests, all of which will arrive:

**Import my old list from OptinMonster / Thrive Leads.** The competitor's list is
a set of contacts, not a set of capture events. It has no Optin, no page, no
impression, and no consent wording. Where the merchant genuinely wants those
people reachable, the destination is WSMS or the ESP — systems that own
[[Contact]]s and have a lifecycle to receive them. WConvert declining is not a
missing feature; it is the [[Destination]] boundary working.

**CSV import, as the mirror of CSV export.** The symmetry is false and worth
naming, because it looks so reasonable. Export is a manual admin action that
copies a log *out*. Import would write log entries asserting events this system
never observed. A log you can append to by hand is not a log.

**An admin "add lead" button**, for the phone order or the trade-show card. Same
defect in miniature, and the honest answer is that this person is a Contact —
they belong in WSMS, entered through the surface that asks about consent
properly.

## Consequences

- ADR 0021's rejection rule needs no qualifier and covers 100% of Lead creation.
  Its unhandled case does not exist.
- The three requests above have one answer, given once here rather than
  re-litigated each time.
- `CONTEXT.md`'s [[Lead]] and [[Consent Record]] gain the origin clause, since
  the definition was carrying it silently.
- Reversing this is not a schema change. It is a redefinition of what a Lead is,
  and the migration is unwritable: the field that would need back-filling records
  something that never occurred.
