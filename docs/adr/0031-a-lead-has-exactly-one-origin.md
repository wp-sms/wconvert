# A Lead has exactly one origin

Every row in `wconvert_leads` is written by **one visitor submitting one form, in
one request, while they are still on the page**. There is no second way a Lead
comes into existence: no admin "add lead" screen, no CSV import, no competitor
import, no ingestion API.

*Amended for planned progressive capture by
[ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md): visitor
submission remains the only origin. One capture journey can now contribute
multiple explicit submissions to one Lead, with one Conversion at the first
accepted capture. Each later consent acceptance must have its own evidence;
it cannot be invented from the first submission. This is accepted product
behavior, not yet implemented.*

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

> **Collected by the test send, and this is where the rule stopped being free.**
>
> A merchant configuring a [[Destination]] wants to press *Send a test* and see
> whether their credentials work. The obvious implementation writes a Lead and
> pushes it — and that Lead carries consent wording nobody was shown, which is
> the manufactured evidence this document refuses. A `[TEST]` prefix does not
> help: the row is in `wconvert_leads`, it exports to CSV, it answers a personal
> data request, and it is counted by nothing only because somebody remembered.
>
> The signature is what forced it.
> [`DestinationType::push()`](../../src/Destination/DestinationType.php) took a
> `Lead`, so **every push was keyed by a row**. That is now
> [`PushSubject`](../../src/Destination/PushSubject.php) — the canonical values,
> plus whether there is a row behind them — and the two entrances sit together
> on [`PushDispatcher`](../../src/Destination/PushDispatcher.php): `dispatch()`
> for a capture (queued, retried, counted) and `test()` for a merchant
> (immediate, unqueued, counted nowhere).
>
> **It is done BEFORE the four ESP adapters exist**
> ([#35](https://github.com/navidkashani/wconvert/issues/35)), which is the only
> reason it is cheap. Written around `leadId` first, all four would be reworked
> the day the button arrived.
>
> Three properties are load-bearing and each is asserted in
> `tests/unit/Destination/TestSendTest.php`, with the no-row claim asserted
> against a real table in `bin/verify-destinations.php` — because "nothing was
> written" is a thing only a database can be watched not doing:
>
> - **No row.** `test()` takes values and builds its own subject, so there is no
>   argument a caller can pass that routes a capture through it or a test
>   through the queue.
> - **No counter.** Not health, not the failure ring, not a delivery count. A
>   failed test is not an outage — a merchant pressing the button four times
>   while pasting an API key must not end up with a Destination reading four
>   consecutive outages, and the ring is keyed by a Lead id that does not exist.
> - **Synchronous**, the same posture `testConnection()` already has. A queued
>   test would report success the moment it was queued, which is not the
>   question the button asks — and it would put the merchant's address in
>   `actionscheduler_actions`, which is the rule
>   [`PushJob`](../../src/Destination/PushJob.php) exists to keep absolute.

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
