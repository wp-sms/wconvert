# A test ends when the merchant says so, and the winner becomes the campaign

[ADR 0045](0045-an-ab-variant-is-a-whole-optin.md) decided the SHAPE of an A/B
test — a [[Variant]] is a whole [[Optin]], linked by `parent_id`, nested in the
list — and named three things it deliberately did not decide: **how traffic
splits, when a winner is declared, and whether declaring one is automatic.**
[#93](https://github.com/navidkashani/wconvert/issues/93) built the feature, so
this is those three, plus the two the ticket did not know it was leaving open:
**what the payload has to carry** and **which rung ships it**.

None of them needed a storage decision. `wconvert_stats` is untouched — four
columns, no secondary index, no `variant_id` — and `wconvert_optins` gained
nothing: `parent_id` was already there, added by the pre-release audit while
nothing wrote it.

## The split is even, and there is no ratio to set

Traffic is split **uniformly across the published arms**, drawn once per
browser, with no control anywhere to change it.

A ratio is not one setting. It is a stored field on a row that already has two
LONGTEXT columns, a control in the builder, and — the part that decides it — a
story about what happens when a merchant moves it mid-test. Every browser
already holding an arm keeps it, so a 90/10 typed on day three does not produce
90/10 traffic; it produces whatever the first two days drew, drifting toward the
new number at a rate nobody can read off the screen. The honest way to report
that is a second denominator per day, which the counters cannot express
([ADR 0019](0019-analytics-stores-daily-counters-not-events.md): daily totals,
never events, and **you can never recompute**).

An even split needs none of that and is what "A/B test" means to the merchant
who asked for one.

**`Math.random()` is the generator**, and
[ADR 0017](0017-no-visitor-identifier.md) is what says that is fine in as many
words: *"the objection is to the identifier, not to its entropy."* An arm names
one experiment and nothing about a device, so there is nothing here for a
stronger generator to protect.

## Declaring a winner is a decision, never a calculation

**A merchant ends a test by pressing a button, and WConvert never ends one on
its own.** There is no significance test, no confidence interval, no "this arm
is winning" banner, and no automatic promotion.

This is the honest position rather than the cautious one, and the reason is
arithmetic the product itself already refuses to fake:

- **There are no events to test.** `wconvert_stats` holds one row per
  `(optin_id, stat_date, kind)`, so the finest grain available is a day's total
  per arm. A p-value computed on day-grain totals is a precise number over a
  distribution nobody measured.
- **The denominator is not people.** The split unit is the browser record
  (below), and `CONTEXT.md` already says there is no honest count of people
  anywhere in WConvert. A statistical claim about visitors, computed over
  browsers, is a claim about a population the product cannot see.

So the screen reports the two numbers and says what they are counting, and the
merchant decides. A product that cannot honestly compute significance and shows
a winner badge anyway is worse than one that shows neither.

## The winner becomes the campaign; nothing is copied onto the parent

ADR 0045 sketches this as *"promote the winner's design onto the parent"*, and
that is the one shape it must not be.

Copying arm B's design onto arm A's row leaves one row whose counters are arm
A's history followed by arm B's future, under a conversion rate that is the
average of two different designs. That is exactly the frozen-at-write blend
[ADR 0020](0020-conversions-are-interpreted-at-read.md) exists to prevent,
arriving through a `config` copy instead of through a column — and it destroys
the comparison in the one row a merchant would go back to read it from.

**So nothing is copied. The winning row stops having a parent** and takes the
campaign's name:

```
BEFORE                                  AFTER declaring B
  01HA "Welcome"      parent NULL         01HA "Welcome"      deleted_at set
  01HB "Welcome (B)"  parent 01HA         01HB "Welcome"      parent NULL
```

**And the losing arms are re-parented onto the winner**, which is not
tidiness. The whole test's history has to follow the campaign that won, or the
promoted row has no children and the next variant of it is named `(B)` again
beside a soft-deleted `(B)` that is a different design — two designs under one
label in the [[Lead]] log, where the name is the only provenance a Lead has
(ADR 0002). It also makes the shape honest to read from either end: a finished
test is one parentless campaign with every arm it ever ran beneath it,
whichever arm won.

Every row's counters mean exactly one design for the whole of its life. The
losing arm is **soft-deleted at most** — ADR 0020 forbids removing it, and
`Connection` has no `delete()` to call — at which point it behaves like any
other tidied-away Optin, keeping its counts in the per-[[Goal]] total and
dropping out of the per-Optin list, with no special case anywhere.

Taking the parent's NAME is the naming rule read backwards. A variant is never
asked for a name because it is *the other one*; the one that wins is simply the
campaign, and leaving a merchant reading *"Welcome (B)"* forever would be the
suffix outliving the thing it distinguished.

**And there is no `finished` flag.** A test is running exactly while a
parentless Optin has published arms beneath it, so ending one is the absence of
the rows rather than the presence of a marker — which is what makes it
impossible to have a test the payload describes and the screen does not, or the
other way round.

## The payload gap ADR 0045 did not know it had

This is the one thing the ticket found rather than inherited.
`OptinRepository::PROJECTION_COLUMNS` did not read `parent_id`, and
`PublishedProjection` emitted `{id, goal, targeting, payload}` with no parent
anywhere. So **the published set could not express "these two entries are arms
of one test"**, and two published arms reached the browser as two independent
Optins — which `decide.ts`'s `arbitrate()` reads as two campaigns competing for
one screen, not as a choice.

The set now carries one key on an arm and nothing on anything else:

```
"variant": ["<experiment id>", <this arm>, <how many arms>]
```

All three fields are needed and none is derivable on the page:

- **The experiment id** is what the drawn arm is remembered against —
  `wcv1[parentId].v`, the parent's own record.
- **The index** is which arm this entry is.
- **The count** is the one a reader assumes can be counted off the page and
  cannot. An arm is dropped from a page it does not target and from one where
  it is [[Suspended]], so a browser whose first page carries one arm of two
  would draw from a set of one and always meet arm A — and be counted against
  the split as though it had been offered a choice.

It is **computed once per rebuild**, not per request, which is
[ADR 0003](0003-published-set-projection-no-second-cache.md)'s rule applied to
the first payload key that is a fact about the whole SET rather than about one
row. It is absent from every Optin running no test, so an install running none
ships byte-for-byte the payload it shipped before, and it disappears again the
moment a test ends — because the winner is then alone in its group, on the
rebuild that same write performs.

**A second key, `anchor`, rides beside it and is generic on purpose.** `inline`
is the one [[Display Type]] that needs somewhere on the page to go, found by
querying `[data-wconvert-optin="<id>"]`, and a merchant placed exactly one
block naming the campaign — so without it an inline arm B renders nowhere at
all, silently, for half the traffic. The block names the campaign, which is
what a test is, so the arm renders at the campaign's anchor. It is its own key
rather than `variant[0]` read by the presenter, because free's presenter must
not learn to spell an experiment field to do its own job: what it needs is
*"this Optin renders at another id's anchor"*, and that is all the key says.

## The arm is drawn in Pro, before the engine is asked anything

`assignArms()` runs **once, between reading the payload and starting the
shell**, and removes every arm this browser is not on. What `decide()` receives
is a list it has no idea was ever narrowed: there is no arm branch in it, no
seventh `Standing`, and no rule type.

**It is not a rule**, and that was the tempting shape. Filing an arm as a
premium [[Condition]] would have fitted the existing seam perfectly — the
manifest files types by tier, `Degradation` strips unentitled ones,
`SuppliedRules` gates them — and it is wrong twice. It would put *"which
variant is this"* in the builder's rule rows for a merchant to add, edit and
delete by hand; and on a free install the type would be unsupplied, so every
arm of every test would answer `ineligible` and the whole campaign would leave
the site the day somebody deactivated Pro.

So free's `boot()` gained a third composition parameter beside the presenter it
already takes — decided in source, in the entry file, one script, nothing on
the page to reorder. That is not the registration seam
[ADR 0014](0014-pro-replaces-the-loader.md) refuses; it is the same shape that
ADR's own `presenter` argument already has.

**What a build without the module does is not nothing.** Free's loader and a
Basic build's carry no narrowing, so both arms reach `decide()` — and
`arbitrate()` shows exactly one overlay, deterministically: priority first,
then id, and a variant copies its parent's priority, so the PARENT wins on its
lower ULID. An inline arm renders at its parent's anchor, which the parent is
already claiming. The test therefore **freezes on arm A** rather than breaking:
counters stay interpretable, nothing is destroyed, and it splits again the
moment Pro is back. A merchant who deactivates Pro mid-test loses the split,
not the campaign.

## The split unit is the browser record, and the screen says so

ADR 0045 settled this and it is restated here because it is the thing the
result screen is obliged to carry. The drawn arm is `wcv1[parentId].v` — a
fifth field on the parent's existing record, beside `i`, `l`, `d` and `c`,
through the same `localStorage → cookie → in-memory` ladder, failing open like
them.

**What is stored is the INDEX and not the arm's id**: one small integer, no more
precision than the question needs, joining to nothing, expiring with the
record. It is written **on the draw** rather than on the impression, because
the draw is the moment the browser met the test — an arm that is capped, out of
its window or never triggered still has to be the arm this browser meets on the
next page, or the split is not a split.

So one visitor on a phone and a laptop can meet both arms and be counted twice,
and a visitor who clears storage re-draws. The Optins list says so where it
reports the numbers, once per screen and only where a test is running.

## Consequences

- **A/B is the `pro` rung's module**, therefore `elite`'s too, and Basic ships
  it not at all ([ADR 0056](0056-the-tier-ladder-is-a-manifest.md) — every rung
  names its modules and there is no wildcard). Basic is the DESIGN rung: it
  ships containers and designs and nothing that decides who sees what. A/B is a
  decision about who sees what, which is what the middle rung already is —
  *"the premium Triggers and the advanced targeting Conditions"* — and Elite is
  the rung about other systems, WooCommerce and outbound Destinations, neither
  of which a test needs. Filing it at Elite would also leave the middle rung
  promising optimisation while withholding the only tool that measures it.
- **The tier gate could not see this module, and now it can.**
  `bin/check-loader.mjs` and `bin/verify-artifact-contract.sh` both read their
  identifier list out of the RULE manifest, so they can only see a module whose
  contribution is a rule. `ab-testing` is the first that ships loader code and
  declares no rule type at all — so a Basic bundle carrying the whole
  arm-drawing routine would have passed every check there is, which is the
  byte-identical-JavaScript failure ADR 0056 measures WSMS by, reached through
  a gap in the scan instead of through a flag. A module may now declare a
  `bundle_marker` in its own `module.json`, beside the slug that already names
  it, and both programs scan for it exactly as they scan for a rule
  identifier. Recorded inline in ADR 0056 and
  [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md).

  **A module that declares none is NAMED beside the tick, never folded into
  it.** Only `ab-testing` declares one today, so free's loader prints
  *"display-types, premium-triggers, cart-recovery declare no marker and were
  not scanned for"* — and that line is the point of it. `premium-triggers` and
  `cart-recovery` are covered by the identifier scan, because their
  contribution IS rules. **`display-types` is covered by neither**: it ships
  the popover container and a presenter and declares no rule type, which is
  precisely this module's shape. Naming it is what stops the next reader
  believing the tick covered it, and it is the same thing this feature had to
  be looked for to find.
- **The Optins list is the result screen.** There is no new admin screen and
  `PRO_SCREENS` is still empty, so Pro's admin bundle is still one build for
  all three rungs and `pro/tests/js/admin-entry.test.ts`'s tripwire has not
  fired. The two actions are gated the way every other premium capability is —
  free's admin renders a `locked` state as DATA
  ([ADR 0015](0015-enforcement-is-by-non-registration.md)) — and the actual
  enforcement is that the routes do not exist on a build without the module.
- **Free's PHP writes the arm triple, and free's loader never reads it.** That
  is the same standing `goal` already has one level up: a sibling the front end
  needs and the browser does not. Free's loader source carries no experiment
  code at all, which `bash bin/verify-source-contract.sh` and
  `npm run check:loader` are what prove.
- **Free's `loadState` tolerates a `v` it never wrote**, and that is asserted in
  free's own suite because it is free's promise. A merchant who deactivates Pro
  leaves records carrying the field, and an impression free records against the
  same Optin must not take it with them — otherwise reactivating Pro re-draws
  every browser on the site.
- **The [[Lead]] log flattens what the Optins list nests.** The route answers
  parentless Optins with their arms beneath them, which is the shape the Optins
  screen is about — and it is the wrong shape for the one screen that labels
  each Lead with the Optin that captured it. An arm captures Leads like any
  other Optin, so leaving it nested would put a raw ULID in the Optin column
  and no filter entry, for exactly the Leads whose provenance is hardest to
  recover. The name is the only provenance a Lead has (ADR 0002, ADR 0020), and
  the arms are already on the wire, so this is a flatten rather than a second
  read.
- **A variant of a variant is refused.** Arms are a flat set under one parent:
  the payload's triple names one experiment, and a grandchild would name a
  parent that is itself an arm of something else. There is no test that shape
  describes, so the route refuses it and the list does not offer it.
- **A letter is never handed out twice.** The suffix is counted over ALL of a
  parent's children including the soft-deleted ones, so a merchant who ended one
  test and started another never gets two rows called *"Welcome (B)"* — which
  would be two different designs under one label in the [[Lead]] log, where the
  name is the only provenance a Lead has.
