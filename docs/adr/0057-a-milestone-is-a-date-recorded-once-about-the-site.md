# A milestone is a date recorded once, about the site

The [[Goal]] and [[Playbook]] catalogue is **market-derived**: 462 Shopify
listings and 670 reviews classified into 25 market Goals and cut down to five
first-class ones. Every research document in the workspace carries the same
caution — the priorities remain recommendations until challenged by product
usage — and [#94](https://github.com/navidkashani/wconvert/issues/94) is what
does the challenging.

Five milestones instrument activation through first conversion. Four of them
are **a date, recorded once**, and the fifth is a state that already had a
store. There is no event table, no second analytics surface and **nothing that
leaves the site**.

## Two of the five are derived, and that is the better answer

`wconvert_stats` already holds one row per `(optin_id, stat_date, kind)`, is
never pruned and has no delete path at all
([ADR 0019](0019-analytics-stores-daily-counters-not-events.md)). So the first
[[Impression]] and the first [[Conversion]] are
[`StatsRepository::firstDays()`](../../src/Stats/StatsRepository.php) —
`SELECT kind, MIN(stat_date) … GROUP BY kind` — and nothing is written to
support them.

**A `MIN` cannot move forwards**, so "recorded once" is a property of the
arithmetic rather than a guard somebody has to remember, and a derived date
cannot disagree with the counters it comes from. That reasoning does not
generalise: it rests on erasure deleting [[Lead]] rows and never a counter
([ADR 0018](0018-erasure-deletes-rather-than-anonymises.md)), and on an Optin
being soft-deleted so its counters outlive it
([ADR 0020](0020-conversions-are-interpreted-at-read.md)).

It is a **second read** on that table, not a mode on the first.
`Dashboard` answers for a window a merchant chose, and a first conversion that
moved when somebody switched from 30 days to 7 would not be a milestone — so
the two reads stay apart and
[`MilestoneController`](../../src/Rest/MilestoneController.php) declares no
arguments at all.

## The fifth needed no store either

[[Destination]] success and failure are already recorded per Destination in
[`HealthStore`](../../src/Destination/HealthStore.php) and already drawn on the
Destinations screen
([ADR 0008](0008-delivery-state-is-destination-health-not-per-lead.md)).
[`Milestones`](../../src/Milestone/Milestones.php) **reads** that store and
restates nothing from it: what travels is three booleans — configured, landed,
failing — and no error text and no counts. A number copied here would be a
second, staler spelling of an outage on a screen with no way to act on it.

**This one is a state and not a *first*, and the difference is load-bearing.**
`HealthStore::forget()` drops a Destination's health when the Destination is
deleted, so a site that delivered through one it has since removed reads
`landed` false. That looks like the reset this document rejects
`MIN(published_at)` for and is not the same thing: the four dates claim
something happened *once, ever*, and this claims something about the
Destinations the merchant has *now*. The copy is worded to that claim — *"your
destinations have received nothing"*, never *"nothing has ever arrived"* — and
`MilestonesTest` pins both halves of the swap.

## Two of them could not be derived, and the near-misses both look derivable

- **The first publish is not `MIN(published_at)`.**
  [`OptinRepository::unpublish()`](../../src/Optin/OptinRepository.php) sets
  that column back to `NULL`, so the minimum over it moves **forwards** the day
  a merchant takes their oldest Optin down — which is the milestone resetting
  itself, and is exactly what *"deactivating and reactivating does not reset a
  milestone that already happened"* forbids. `published_config` survives an
  unpublish and would answer *whether* a site has ever published, but it
  carries no date.
- **The first edit has no home at all.** Nothing anywhere records that a config
  changed; `wconvert_optins` has no `updated_at` and is not getting one
  ([ADR 0001](0001-custom-tables-not-custom-post-types.md)).

So there is **one new non-autoloaded option**, `wconvert_milestones`, holding
both. The other table-free shapes were considered and lost: a **transient** can
be evicted by an object cache, and a milestone that vanishes is not a
milestone; **an existing option** means `wconvert_published_set`, which is
rebuilt whole on every publish
([ADR 0003](0003-published-set-projection-no-second-cache.md)) and would
destroy anything riding along on the second publish; **an existing table** means
a column, which the ticket rules out and which would need sign-off besides.

`update_option` is a read-modify-write with no row lock, which ADR 0019 refused
for counters and ADR 0008 accepted for health. **This is the accepting case,
and more comfortably than health is**: there is nothing here to increment, both
writes are guarded on the value being absent, and two racing first-publishes
are writing the same day. The worst a lost write can do is leave a milestone
unrecorded until the next publish or the next edit.

The record-once rule lives in
[`MilestoneStore`](../../src/Milestone/MilestoneStore.php) and not at either
call site — the same arrangement `OptinRepository` uses for the published-set
rebuild, so there is no record-anyway path to reach for by mistake. And the
activation stamp is written inside `publish()` itself, because that method **is**
the event: a milestone written from the REST controller would be one a WP-CLI
command or a bulk action silently misses.

**The first edit does not follow that rule, and the exemption is the point
rather than an oversight.** The mirror of it would put the diff in
`saveDraft()`, which holds both states and would catch a second caller for
free. What stops it is what the diff needs: working out which suggestion was
overridden means reading a [[Template]]'s words by [[Slot Role]], so it needs
[`TemplateVocabulary`](../../src/Template/TemplateVocabulary.php) — a whole
design grammar handed to a class whose job is projections and columns, to serve
one date. `OptinRepository` deliberately knows what a *rule* is and not what a
*design* is, and widening that to stamp a milestone is the wrong way round.

So the risk `publish()` was placed to avoid is real here, and it is **guarded
rather than promised**: `TheRouteIsTheOnlyEditorTest` walks the shipped source
and fails on a second caller of `saveDraft()` — and fails, from the other side,
the day `OptinRepository` learns to read a design, because that is the day this
argument expires and the milestone should move down beside the activation one.

## The first edit reads the taxonomy directly, so its granularity is the argument

*What a merchant changes first, and in which Playbook*, is the sharpest
available evidence that a Goal's defaults are wrong. That only works if "which
part" means something specific.

**The easy granularity is the top-level `config` key that differs**, and it
conflates the one distinction that matters: `template` holds both the design
and the words, and every merchant changes the words. A Playbook's copy is
generic by construction, so a milestone that reported *copy* on every install
would carry no information at all.

So a part is **one of the things
[`Prefill::fromPlaybook()`](../../src/Playbook/Prefill.php) actually writes** —
the Goal, the design, the words, the rules, the targeting — because an override
is only evidence where there was an opinion to override. The design/words split
reuses the seam that already exists rather than inventing one:
[`SlotRoles::copyFrom()`](../../src/Template/SlotRoles.php) is the inverse of
the binder prefill used, and
[`TemplateVocabulary::withoutCopy()`](../../src/Template/TemplateVocabulary.php)
is the same strip a snapshot takes. Switching [[Template]] therefore reads as
*design* and not as the merchant having rewritten anything.

`PrefillPartsParityTest` holds the definition to the code: it changes every key
of a really-prefilled config, for every bundled Playbook, and fails on one no
part notices. It declares no list of keys anywhere, which is the point — a
declared list would pass against a part that named a key and then failed to
read it.

**Three things are deliberately not parts.** The name, because renaming
*"Welcome discount"* to *"Spring sale"* labels the merchant's own thing rather
than rejecting an idea about converting — and it is the cheapest edit in the
builder, so counting it would let the most trivial act on the screen swamp the
signal. [[Destination]]s, [[Frequency]], the [[Schedule]] and `priority`,
because prefill writes none of them: *"prefill never binds a Destination
invisibly"* (CONTEXT.md, Playbook), so the first Destination a merchant binds is
them filling a blank the Playbook left for them, which is the Playbook working
rather than failing.

**One save can change several**, because the builder saves the whole draft — so
the order of `EditedPart`'s cases is the tie-break, sharpest indictment first,
with copy last for the reason above.

## Nothing leaves the site, and nothing names a visitor

`readme.txt` promises no licence key, no analytics sent anywhere and no visitor
identifier. This must not put an asterisk on that sentence.

What is stored is **two days, a Playbook id and one of five words**. There is no
visitor id because WConvert mints none
([ADR 0017](0017-no-visitor-identifier.md)); there is no Optin id and no user id
because neither is a fact about the site, and *"record once"* is not a reason to
start.

The assertion is written the way
[`bin/verify-stats.php`](../../bin/verify-stats.php) writes this class of claim,
and the shape is the point: that script does not assert a sender was idle — it
plants two addresses in a request, drives the real path, and reads the options
table back looking for them, key or value. `NothingLeavesTheSiteTest` plants
every identifying thing a WordPress request carries, records the milestones, and
searches what was stored. **It asserts a presence too**, because an absence-only
check passes just as happily against a store that recorded nothing — the same
fail-closed posture the source contract takes
([ADR 0029](0029-the-free-contract-is-proven-at-the-source.md)).

## The screen draws the step that is stuck, and nothing once none is

Five dates in a list is the screen
[ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md)
rule 2 exists to stop: *"does knowing this change what they do?"* — and **a
milestone that has been reached never does**. *"First shown on 4 March"* is
true, permanent, and attached to no action.

What does change what a merchant does next is the first step they have **not**
reached, because each has a different cause and a different door. The most
valuable is *published and never shown*, because it is the only state on this
admin that looks completely correct from every other screen: the Optin exists,
the list says published, and a caching or optimisation plugin has quietly
removed the loader
([ADR 0004](0004-the-loader-survives-optimizers-not-just-caches.md)).

So the region draws **at most one step**. Amended by [ADR 0068](0068-reading-pages-put-results-and-routes-before-occasional-settings.md): it follows
the Goal reports so routine results come first. Once every step is met, the
recorded-dates disclosure remains (corrected by ADR 0060). Later impressions or
conversions rule out an earlier unmet step even when its recorded date is
missing; missing dates are never invented.

**A failing Destination is not one of the steps**, though it is on the payload.
It is the one state on this funnel that already has a screen of its own, with
the error text and the re-push beside it, so a step here would be the second and
staler spelling of an outage that rule 2 refuses — and the merchant would meet
it on a screen with nothing to press. It is read in the disclosure, which is
where the *"or did not"* half of the fifth milestone belongs.

**A failed READ is drawn**, which is the one asymmetry worth stating: a met
milestone is silent because it changes nothing, but a read that failed silently
makes the values unreadable with nothing on screen saying so — worse than the
checklist, because the merchant cannot tell there was anything to see.

**The dates are still readable, behind a disclosure whose real content is its
last sentence.** *"The values are readable on an admin screen"* is an acceptance
criterion, and the honest way to satisfy it is not a panel of facts nobody acts
on: it is the `readme.txt` promise made checkable on the merchant's own screen,
with the whole of what was recorded as its evidence. That is what earns it a
place under rule 2 — the dates change nothing a merchant does, and a merchant
deciding whether to believe the privacy claim behaves differently depending on
whether they can see it. Closed by default, so it costs one line a visit.

## Consequences

- **There are nine options now, not eight**, and `uninstall.php` names the
  ninth. `tests/unit/Database/UninstallTest.php` reads every `const OPTION` in
  both trees and asserts the count, so this could not have been forgotten.
- **A site that never used a Playbook records no first edit, ever.** That is
  correct rather than a gap: a first edit with no Playbook behind it cannot say
  which Goal's defaults it is evidence about, which is the whole of what the
  milestone is for. It is also information of its own — a merchant who rejected
  the whole catalogue at step one — and reading it needs a different fact.
- **`EditedPart` is a sixth closed set**, alongside the four ADR 0019 names and
  the [[Goal]] enum. The argument is the same one and a sharper version of it:
  an open set means a screen that cannot say what the value it is drawing means,
  and this one is read by a human trying to decide whether five Goals were the
  right five.
- **A milestone is stamped on the site's day, never UTC's** — but by two
  different readings of that clock, and the difference is deliberate. The first
  edit uses [`StatDay::today()`](../../src/Stats/StatDay.php), the same call
  every counter is stamped from, so an edit and a beacon agree about which day
  it was. The first publish instead **cuts the day off the `current_time()`
  timestamp `publish()` has just written**, so the milestone and that row's
  `published_at` cannot disagree — including across a midnight the method
  happens to straddle. Both are the site's clock; neither is UTC's. A merchant
  who changes their site timezone does not retro-fix them, which is the seam
  ADR 0019 already booked.
- **No bundled Playbook constrains where its Optin shows**, so
  `EditedPart::Targeting` is reachable only by a merchant *adding* targeting.
  That is asserted rather than exempted, and the day a bundled Playbook ships
  some, the test that says so fails.
