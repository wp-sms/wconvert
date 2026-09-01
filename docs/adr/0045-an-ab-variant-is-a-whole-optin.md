# An A/B variant is a whole Optin, linked by `parent_id` and nested in the UI

A/B testing is a [[Pro]] feature that has not been built. What is decided here
is the **shape it will arrive in**, because the alternative shape needs a change
to the COUNTERS and every saved Optin makes that change more expensive.

**A variant is an [[Optin]] in its own right**, with its own id, its own row in
`wconvert_optins`, and its own counters. It names its parent in a column of that
row. The Optins list shows parentless Optins only, so a test appears as one
campaign with two children rather than as two campaigns.

```
STORAGE                             UI — Optins list
  01HA "Welcome"      parent_id NULL   ▸ Welcome        A/B · live · 412
  01HB "Welcome (B)"                      └ A  Welcome       206 · 4.2%
       parent_id = 01HA                   └ B  Welcome (B)   206 · 5.1%
```

*The title and this section said `config.parent`, and the link is
`wconvert_optins.parent_id` — see the correction under Consequences, which is
where the argument for the change is. The half this ADR spends most of its words
on is unaffected: **the counters need nothing**, because a variant that IS an
Optin already has its own `(optin_id, stat_date, kind)` rows.*

## The primary key already does the work

`wconvert_stats` is keyed `(optin_id, stat_date, kind)`, and
[`Schema`](../../src/Database/Schema.php) says of it: *"the primary key is the
mechanism, not decoration"* — it is what makes
`INSERT ... ON DUPLICATE KEY UPDATE count = count + 1` atomic at the database,
with no increment lost and no read-modify-write race.

That key takes an `optin_id`. A variant that **is** an Optin therefore gets
per-variant impressions, conversions and dismissals with **no change to the
counters at all** — no `variant_id` column, no widened key, no second counter
table.

*Amended: this said "no schema change at all", and it is right about
`wconvert_stats` and was wrong about `wconvert_optins`, where the LINK needed a
column and therefore a sign-off ([`parent_id`](../../src/Database/Schema.php),
and the correction under Consequences). The distinction is worth keeping
straight, because it is the one that decided the design: this section's argument
is that the hottest write in the system is untouched, and it stays untouched.*

The alternative — a variant as a shape *inside* one Optin's `config`, the way
its Template and rules are — cannot count. Two designs behind one `optin_id`
produce one row per day per kind, and the whole point of the test is to tell
them apart. Repairing that means adding `variant` to the primary key, which
widens the hottest write in the system and rewrites the arithmetic in
[`Dashboard`](../../src/Stats/Dashboard.php) and
[`GoalReport`](../../src/Goal/GoalReport.php) for every install, including the
ones running no test.

It is also how OptinMonster does it: a split test **duplicates the campaign**.
Their variant is a campaign with a parent, and their reporting is per-campaign.

## Storage does not constrain the UI, and this is the case that proves it

The obvious objection is that a merchant with three tests would see six rows in
a list of campaigns, which is a worse screen than the one they have.

That is a **query condition, not a screen the storage forced**. The list filters
to Optins with no parent, and each parent draws its variants nested beneath it.
The merchant never meets "Welcome" and "Welcome (B)" as separate things, and the
per-variant numbers appear exactly where the comparison is being made.

*Amended: "a query condition, not a schema decision". Both, as it turns out —
and the reason is the one thing this ADR did not check. A query condition has to
be expressible in a query, and the list's projection deliberately reads neither
LONGTEXT column ([ADR 0001](0001-custom-tables-not-custom-post-types.md)), so
`config.parent` could not be filtered on without undoing that. The claim this
section is actually making survives intact — storage does not dictate the screen
— but it cost a column to keep, which is the opposite of what "not a schema
decision" implied.*

Naming follows the same rule. A variant is not asked for a name; it takes its
parent's with a suffix, so a merchant is never asked to name a thing they think
of as *the other one*.

## The interaction that has to be respected

[ADR 0020](0020-conversions-are-interpreted-at-read.md) forbids hard-deleting an
Optin: *"a removed row makes every count referencing it uninterpretable."*

So **ending a test cannot delete the losing variant.** Whatever "declare a
winner" does — promote the winner's design onto the parent, stop serving the
loser, mark the test finished — the losing row stays, soft-deleted at most, and
its counters stay interpretable. A future implementation that reaches for
`DELETE` is deleting a month of the merchant's own history to tidy a list.

The same ADR's other rule falls out of this for free: soft-deleted Optins keep
their counts in per-[[Goal]] totals and drop out of the per-Optin list. A
finished test's loser behaves exactly like any other tidied-away Optin, with no
special case.

## What this does not decide

Everything about how a test *runs*: how traffic splits, whether the split is
sticky per visitor, when a winner is declared, and whether any of that is
automatic. Those are open, and one of them is constrained by a decision already
made — **WConvert mints no visitor identifier**
([ADR 0017](0017-no-visitor-identifier.md)), so "this visitor always sees B"
cannot be keyed to a visitor id. It would have to be the record itself, in the
same per-Optin client state that already holds impressions and dismissals, or it
does not exist.

That is a real design question and it belongs to the ticket that builds the
feature. It is named here so nobody reads this document as having answered it.

*Sticky assignment is now decided, and the answer is the one this paragraph
predicted: **it is the record itself.** Assignment is a field on the existing
per-Optin client record — `wcv1[parentId].v`, holding the variant it drew —
written through the same `localStorage → cookie → in-memory` ladder as `i`, `l`,
`d` and `c`, and it fails open like them. It is a new FIELD on a record that
already exists, not a new key and not a new store.*

*Corrected: this said `wc_o_<parentId>.v`, notation inherited from
[ADR 0047](0047-site-wide-frequency-is-the-same-shape-at-a-second-scope.md)'s
diagram and sharpened here into something more precise and therefore more
wrong. The loader has **one** persistent key,
[`STATE_KEY = 'wcv1'`](../../resources/loader/src/state.ts), holding a map of
Optin id to record; there is no `wc_o_` key and never has been. The arm is a
fifth field on the parent's entry in that map, beside `i`, `l`, `d` and `c` —
which is what the sentence above already claimed, spelled in a notation that
denied it.*

*It is not the identifier this ADR's own constraint forbids, and the three
properties [ADR 0047](0047-site-wide-frequency-is-the-same-shape-at-a-second-scope.md)
checks one at a time for the site-wide slot hold here too. It is not an identifier — it
names an arm of one experiment, not a device. It carries no more precision than
the question needs — one variant per parent Optin, and nothing about when it was
drawn. And it joins to nothing: it is scoped to a single parent, it is
meaningless outside that test, and it expires when the record does.*

*The consequence is stated rather than hidden. **The split unit is the browser
record, not the person.** One visitor on a phone and a laptop can draw different
arms and count twice; a visitor who clears storage re-draws. That is not a
defect to be repaired later by minting an id — it is the price of
[ADR 0017](0017-no-visitor-identifier.md), and it is the same price
`CONTEXT.md` already names when it says there is no honest count of people
anywhere in WConvert. A test that needs person-level assignment to be valid is a
test WConvert cannot run, and the honest move is to say so on the screen that
reports the result rather than to buy validity with a cookie.*

*What stays open is the split itself — the ratio, when a winner is declared, and
whether declaring one is automatic. Those need no storage decision and are still
the building ticket's.*

## Consequences

- **No change to the COUNTERS, now or when it ships.** `wconvert_stats` is
  untouched: no `variant_id`, no widened key, no second table. *Amended: this
  said "no schema change" and named `SchemaTest` passing untouched as the
  check. The counters half holds; the LINK needed a column, for the reason
  spelled out two bullets down, and `SchemaTest` was edited deliberately to
  take `parent_id` and to spend back the index budget `idx_goal` was wasting.
  The check for the counters is the assertion that `wconvert_stats` still
  carries four columns and no secondary index, which it does.*
- **`parent_id` is the link**, holding a ULID, and it is the only new stored
  fact *on the server*. *Amended: there is now one on the client too —
  `wcv1[parentId].v`, the drawn arm, argued in "What this does not decide"
  above. It is a field on an existing record rather than a key, and it changes
  no schema.*

  *Corrected, and this is the one place this ADR was wrong about storage rather
  than about notation. It said `config.parent`, on the argument that the link
  is provenance and belongs where `template_id` and `playbook_id` live. The
  argument is good and the placement does not work: **the Optins list cannot
  see `config`.** `OptinRepository::SUMMARY_COLUMNS` excludes both LONGTEXT
  columns because dragging config blobs through a list is what exhausted PHP's
  memory at a few hundred rows ([ADR 0001](0001-custom-tables-not-custom-post-types.md)),
  so "the list filters to parentless Optins" — the next bullet, and the entire
  UI half of this decision — had exactly two implementations: put `config` back
  into the list projection, which ADR 0001 forbids by name, or a column. It is
  now `wconvert_optins.parent_id CHAR(26) NULL`, signed off in the pre-release
  audit and added while **nothing writes it**, so there are zero rows to
  backfill; adding it after this feature ships would mean reading every
  `config` to populate it, in a data step `dbDelta` has nowhere to put.*

  *The "no schema change" claim above is about `wconvert_stats`, and **there it
  is untouched and still right**: a Variant that IS an Optin gets its counters
  out of the existing `(optin_id, stat_date, kind)` key. That is the half this
  ADR was actually arguing, and it stands.*
- **The Optins list gains a parentless filter**, which is where the entire UI
  half of this decision lives. *Built, ahead of the feature:
  `OptinRepository::summaries()` filters `parent_id IS NULL` today, over a
  table where every row is parentless — which is what makes it a filter nobody
  has to remember to add on the day the first variant is written.*
- **Ending a test never deletes a row.** ADR 0020 carries the inline note,
  because its no-hard-delete rule was argued from analytics and now has a second
  caller that would look like an exception.
- `CONTEXT.md` gains [[Variant]], because "an Optin that is also a variant" is
  precisely the kind of term that acquires two meanings if it is not written
  down once.
