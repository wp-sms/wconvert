# An A/B variant is a whole Optin, linked in `config` and nested in the UI

A/B testing is a [[Pro]] feature that has not been built. What is decided here
is the **shape it will arrive in**, because the alternative shape needs a schema
change and every saved Optin makes that change more expensive.

**A variant is an [[Optin]] in its own right**, with its own id, its own row in
`wconvert_optins`, and its own counters. It names its parent inside its own
`config`. The Optins list shows parentless Optins only, so a test appears as one
campaign with two children rather than as two campaigns.

```
STORAGE                             UI — Optins list
  01HA "Welcome"      parentless      ▸ Welcome        A/B · live · 412
  01HB "Welcome (B)"                     └ A  Welcome       206 · 4.2%
       config.parent = 01HA              └ B  Welcome (B)   206 · 5.1%
```

## The primary key already does the work

`wconvert_stats` is keyed `(optin_id, stat_date, kind)`, and
[`Schema`](../../src/Database/Schema.php) says of it: *"the primary key is the
mechanism, not decoration"* — it is what makes
`INSERT ... ON DUPLICATE KEY UPDATE count = count + 1` atomic at the database,
with no increment lost and no read-modify-write race.

That key takes an `optin_id`. A variant that **is** an Optin therefore gets
per-variant impressions, conversions and dismissals with **no schema change at
all** — no `variant_id` column, no widened key, no second counter table, and no
sign-off, because there is nothing new to sign off.

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

That is a **query condition, not a schema decision**. The list filters to Optins
with no parent, and each parent draws its variants nested beneath it. The
merchant never meets "Welcome" and "Welcome (B)" as separate things, and the
per-variant numbers appear exactly where the comparison is being made.

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

## Consequences

- **No schema change, now or when it ships.** `tests/unit/Database/SchemaTest.php`
  passing untouched is the check that this stayed true.
- **`config.parent` is the link**, holding a ULID, and it is the only new stored
  fact. It lives in `config` rather than in a column because it is a property of
  how an Optin was authored — the same place `template_id` and `playbook_id`
  live, and provenance is what all three are.
- **The Optins list gains a parentless filter**, which is where the entire UI
  half of this decision lives.
- **Ending a test never deletes a row.** ADR 0020 carries the inline note,
  because its no-hard-delete rule was argued from analytics and now has a second
  caller that would look like an exception.
- `CONTEXT.md` gains [[Variant]], because "an Optin that is also a variant" is
  precisely the kind of term that acquires two meanings if it is not written
  down once.
