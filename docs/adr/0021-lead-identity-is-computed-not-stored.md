# Lead identity is computed at read, never stored

WConvert records no notion of *person*. Two submissions from one human are two
[[Lead]] rows, and the fact that they are one human is produced by a `GROUP BY`
over the identifier those rows already carry — in the lead log's presentation
only. **No person key, no person table, no column.**

*Amended for planned progressive capture by
[ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md): separate
journeys still create separate Leads. Multiple accepted submissions within one
journey contribute to one Lead, without identifying a person across visits or
merging rows by email or phone. The immutable-Lead references below describe
the current implementation; the accepted exception is limited to that journey.*

For that grouping to mean anything, `email` and `phone` are stored in
**canonical form**: email lowercased, phone in E.164. An identifier that cannot be
canonicalised is **rejected at submit**, synchronously.

*Extended by [ADR 0076](0076-an-enquiry-captures-one-optional-choice-before-handoff.md):
an `interest` answer is qualification content, never an identifier. Its stable
value and the label from the published choice definition are stored in the
existing immutable Lead JSON and exported together. Email or phone remains
necessary for capture; neither interest nor name creates another grouping key
or a person entity. Option validation happens synchronously against that
published form, on the same side of the queue as canonicalisation.*

## The need is real; the entity is not

A [[Lead]] is an event, so two submissions being two rows is correct and not a
defect to fix. But an admin reading a lead log does want to know it is one person,
and "43 leads" reading as 43 people when it is 38 is a genuine misreport.

Three shapes were available. **Store nothing** leaves that misreport standing.
**Store identity** — a person key on the Lead, or a `wconvert_people` table —
serves it and destroys the boundary. **Compute it on read** serves it and cannot.

## Why stored identity fails, specifically

`CONTEXT.md` names the drift signal: *any feature that wants to give a Lead a
lifecycle is a signal that WConvert is drifting into being a second contact
database.* A person key does not add a lifecycle. It adds **the row a lifecycle
attaches to**, which is one request away: the day Sarah is an entity, someone asks
whether Sarah is unsubscribed, and there is finally somewhere to put the answer.

That matters because of how the guard was built.
[ADR 0002](0002-leads-are-immutable-by-schema.md) removed `status` and
`updated_at` from `wconvert_leads` so that acquiring a lifecycle requires a
migration a reviewer will see. A person key **satisfies the letter of that guard
while routing around it** — the Lead stays immutable, and the mutable thing lives
next to it. It is the more dangerous option precisely because it looks compliant.

## Why computing it is nearly free

[#2](https://github.com/navidkashani/wconvert/issues/2) already made `email` and
`phone` real indexed columns, on the reasoning that they are the identity keys.
So the grouping is an indexed aggregate over a table that already exists: no new
storage, no sign-off under the database rule, and no new concept in the model.

*Completed by [ADR 0033](0033-the-lead-log-reads-without-a-new-index.md): "an
indexed aggregate" is true only of the right spelling. `GROUP BY COALESCE(email,
phone)` is a function over two columns and uses neither index, so the query is
**two aggregates unioned** — one over the rows with an email, one over the rows
without — and each half is answered from its own index, `MAX(id)` included,
because InnoDB appends the primary key to every secondary index. The cost is
recorded there too: a Lead with only an email and a Lead with only a phone are
two groups, which is safe precisely because of the boundary below.*

And it is **structurally incapable** of becoming the stored version. A result set
has nothing to attach a status to.

## Two boundaries, both load-bearing

**Grouping is presentation, never the count.** The headline number stays
submissions. A toggle collapses Sarah's two rows into one reading "2 submissions";
it never changes what the dashboard reports.

*Completed by [#25](https://github.com/navidkashani/wconvert/issues/25), which
built it: the boundary is now structural rather than observed. `WConvert\Lead\LeadLog`
reads the total before it looks at the toggle and returns one payload shape with
one total in it, so there is no wiring in which a group count could reach the
headline and no second number for a screen to mistake for one. The lead log is
one REST route with a `grouped` parameter for the same reason — a second route
is a second resource, and the resource a `/leads/people` would name is the one
this ADR says cannot honestly exist.*

**It never reaches analytics.**
[ADR 0019](0019-analytics-stores-daily-counters-not-events.md) leaves
`wconvert_stats` at `(optin_id, kind, stat_date, count)` with no per-person
dimension, and [ADR 0017](0017-no-visitor-identifier.md) removed the visitor
identifier. **"Unique leads" is not a number this system can honestly produce**,
and the lead log must not imply that it can.

## Canonical form is a precondition, not a detail

`GROUP BY email` is a lie the moment one row reads `Sarah@Example.com` and the
next reads `sarah@example.com`. Canonicalisation is what makes this ADR true
rather than approximately true, so it belongs to the decision rather than beside
it.

It is also forced from the other side. WSMS's `ContactRepository::create()`
lowercases email and runs `PhoneValidator::assertE164()` on the way in
(`src/Contact/ContactRepository.php:32-33`). An un-canonicalised WConvert row
therefore **cannot find the Contact it created itself** on the next submission.

Normalising on read was rejected: it is a function call over the index it then
cannot use. Storing both raw and canonical was rejected: nothing needs to know how
the visitor capitalised their address.

## Rejecting an unnormalizable phone at submit

`assertE164()` **throws** (`src/Support/PhoneValidator.php:66-78`), and
[#4](https://github.com/navidkashani/wconvert/issues/4) queues every push. So a
phone WConvert accepts but cannot canonicalise becomes an exception inside an
Action Scheduler job minutes later, with the visitor gone and nothing on screen
having failed. The capture *looks* successful to everyone involved.

Refusing it in the form is the only place the visitor can fix it. That makes E.164
a front-end contract rather than a storage concern.

*Completed by [ADR 0031](0031-a-lead-has-exactly-one-origin.md): this rule is
**total**, not merely the visitor-present case. It rests on every identifier
arriving from a visitor who is still on the page, which holds because a [[Lead]]
has exactly one origin — no admin entry screen, no CSV import, no competitor
import, no ingestion API. The import case
[#18](https://github.com/navidkashani/wconvert/issues/18) opened does not exist,
so the rule needs no second branch.*

## Consequences

- The lead log gains a grouping view; nothing else in the product gains a person.
- E.164 is enforced on a [[Standalone]] install where WSMS is absent — **a
  WConvert-side rule that exists because WSMS has one.** Cheap, real, and recorded
  here rather than discovered later.
- Two Leads sharing no identifier value are two strangers, permanently. See
  [ADR 0022](0022-the-wsms-push-fills-blanks-and-never-mutates-state.md).
- Reversing this is a migration plus a backfill that cannot recover what was never
  written.
