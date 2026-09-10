# A scheduled Optin stays in the published set, and the browser decides

An [[Optin]] can carry a start, an end, both, or neither. Free ships the
*Promote a sale or offer* [[Goal]], and a sale has an end date; without this,
announcing one means remembering to switch the Optin off by hand, and
forgetting is precisely the *"it keeps popping up"* complaint the WordPress
support corpus records in merchants' own words.

Two decisions carry the whole feature, and one of them is easy to get exactly
backwards.

## The one that is easy to get backwards

**A scheduled Optin is IN the published set before its window opens, and stays
in it after the window closes.**

Excluding a not-yet-started Optin is the obvious implementation and passes
every unit test that does not assert this. It is wrong because
[ADR 0003](0003-published-set-projection-no-second-cache.md)'s projection is
**rebuilt on write and never on a timer**. Nothing runs at the moment a window
opens. An Optin left out of the projection is left out of every page a
full-page cache serves until somebody happens to republish — which may be days
after the sale began, and the merchant's evidence is a campaign that simply
never appeared.

So the Optin ships, carrying its window, and the **browser** decides.

The far end is the same argument in reverse and is worth stating separately,
because "drop it once it is over" sounds harmless. A page cached *while the
window was open* still holds the payload and its loader still runs; the only
way that page can work out that the window has shut is from a fact it was
given. An Optin leaves the set when the merchant **unpublishes** it, which is
the act that means *stop*.

### Why this is not [ADR 0027](0027-a-load-bearing-condition-suspends-rather-than-drops.md)'s shape

A [[Suspended]] Optin *is* excluded from the payload, and 0027 had to catch the
stale-cache case a second time at the beacon
([`PublishedOptin::servableIdsIn()`](../../src/Optin/PublishedOptin.php)). The
difference is what the payload can carry: suspension is computed against a live
rule registry, which a cached page cannot hold, so the page cannot answer for
itself. A window is two numbers. They travel, and every page holding them —
including one cached before the window closed — answers correctly on its own.

**Nothing about scheduling asks a second question at the beacon**, and nothing
needs to: an Optin outside its window is never shown, so no presenter reports,
so no counter ever receives a row. That is 0027's *"no rows, not zero-valued
ones"* reading arrived at by the payload rather than by a filter, and for its
reason — a campaign contributing zeroes against a live denominator makes two
periods incomparable, and [ADR 0019](0019-analytics-stores-daily-counters-not-events.md)'s
counters cannot be recomputed afterwards.

## The instant is resolved once, on the server

The merchant authors a **local wall time** — `2026-11-27 09:00`, with no zone
on it — because that is the only thing they can reason about. What reaches the
browser is **one absolute instant in milliseconds**, and
[`schedule.ts`](../../resources/loader/src/schedule.ts) compares it to
`Date.now()` and does no timezone arithmetic of any kind.

The visitor's clock is not the site's clock. A payload carrying a wall time
would mean a different moment in every browser that read it, which is not a
schedule; and an admin's browser resolving it at authoring time would resolve
it against the *editor's* zone, so a site with two editors in two countries
would have two meanings for one campaign.

*Extended, and bounded, by [#92](https://github.com/navidkashani/wconvert/issues/92)'s
`time_of_day` [[Condition]] — which is what this section is NOT. A schedule is
a campaign's lifetime and its boundaries happen at most once each, so they can
be resolved to instants on the server and the loader can compare two numbers
and name no zone. A recurring daily window cannot be resolved that way at all:
there is no finite set of instants, and the offset a named zone is on moves
twice a year, so an instant baked in at publish would be an hour wrong for half
of it on a page a cache may serve for weeks. What travels for that rule is the
**zone**, on the payload tag, and the browser's own tzdata answers — which
keeps a page cached before a transition right after one. Both are the site's
clock and never the visitor's; they differ only in whether the arithmetic can
happen once.*

**The wall time is what is stored, and the instant is recomputed on every
rebuild.** [`Schedule`](../../src/Optin/Schedule.php) resolves it against
`wp_timezone()` inside `PublishedProjection`, so a merchant who corrects their
site timezone corrects every schedule with it. Freezing the instant at publish
would leave them all an hour out with nothing on any screen to say why — the
same reasoning [`StatDay`](../../src/Stats/StatDay.php) applies to the site's
day, and `Schedule::resolve()` is pure and takes the zone as an argument for
`StatDay::of()`'s stated reason: a seam built on the bootstrap's UTC stubs
proves nothing about timezones.

Two wall times a zone cannot answer cleanly use PHP's own resolution. A skipped
local time advances across the gap; a repeated hour uses the occurrence PHP
selects for that timezone. **Corrected by
[ADR 0072](0072-setup-choices-state-their-effect-and-scope.md):** this previously
claimed the first occurrence always wins. Direct PHP checks show the first in
New York but the second in London and Berlin. The runtime remains unchanged;
there is no portable first-occurrence promise.

The admin now names the actual WordPress site zone beside its date controls.
Readable labels preserve the authored wall components through an admin-local DST
gap. The ended-status advisory compares in the explicit site zone, not the admin
browser's zone. At ambiguous or skipped boundaries it waits for the latest
plausible instant; a missing or unreadable zone stays neutral. PHP's published
instant remains authoritative, so the advisory may stay neutral briefly after
the actual end during a repeated hour. This changes neither the stored wall time
nor the loader's half-open comparison.

## No new `Standing`, and no new column

**`capped`.** `Standing` is `ready | waiting | inert | ineligible | blocked |
capped | shown` and the vocabulary is closed on purpose. `capped` already means
*the allowance is spent, and this cannot change on this page view*, which is
exactly what being outside a scheduled window is — including its consequence,
that the page is not held live and every listener comes off.
[ADR 0047](0047-site-wide-frequency-is-the-same-shape-at-a-second-scope.md)
argues at length against widening the vocabulary to carry a distinction the
inspector can render as a sentence beside the word it already uses, and this is
the second time that argument has been made about the same word.

The distinction the merchant needs is a **gate in the funnel**, which is
inspector vocabulary and not the engine's: `schedule` sits between `payload`
and `frequency`, so the sequence a merchant reads is *published, not suspended,
allowed on this page, it reached the browser — and then it has not started
yet*. The order is this ADR's first section, readable off a screen. The
sentence is `Scheduled. It starts in %s.`, and the `%s` is
`human_time_diff()`'s word: the panel carries no `@wordpress/i18n`
([ADR 0048](0048-the-eligibility-inspector-runs-on-the-real-page.md)) so it
cannot spell a plural, and **the magnitude is minted in PHP while the direction
is the browser's** — taken on the same clock reading as the verdict, so the two
halves cannot disagree.

**No column.** `starts_at` and `ends_at` live in the `config` blob beside
`frequency` and `priority`. `parent_id` is a column because the Optins list
FILTERS on it ([ADR 0001](0001-custom-tables-not-custom-post-types.md)); no
screen filters or sorts on a schedule, and the Optins list deliberately reads
neither LONGTEXT column, so a schedule shown there would be a new column and a
new decision. If one is ever wanted, that is the conversation to have.

## The normaliser is a file, and it refuses

[`Schedule`](../../src/Optin/Schedule.php) sits beside
[`Frequency`](../../src/Optin/Frequency.php), pure, with no WordPress in it.
ADR 0047's amendment records what the alternative cost: `frequency` and
`priority` went through the REST controller as unvalidated passthrough out of
the config blob, every merchant Optin shipped uncapped and unprioritised, and
nobody noticed until the rules panel landed. A schedule is the same shape of
value and has the same second, non-REST author coming — a wall time is
authored, and nothing about authoring one is HTTP.

It has **two doors, and the difference is the point**:

- `fromArray()` is the AUTHOR's, and it **throws** `InvalidSchedule`. Refused
  rather than repaired, which is where this departs from `Frequency`'s "drop
  the nonsense to null": dropping an end would publish a sale that never
  finishes — the complaint this feature exists to answer — and dropping a start
  would publish one that can never show. Neither is a decision the merchant
  made, and `Frequency`'s reasoning does not transfer because there a dropped
  value and a stored one mean the same thing to the engine, and here they do
  not.

  **There are therefore two refusals, and they are the same harm reached two
  ways**: a boundary that was *supplied and cannot be read*, and a pair that
  cannot both be true. The exception carries which, because they send a
  merchant to different places; the route owns the two sentences and the rule
  stays in the normaliser. An **absent** boundary is neither — an emptied box
  is how a merchant says "no boundary", which is a thing they mean.

- `windowIn()` is the READER's, and it is **total**. A rebuild walks every
  published row, and one hand-edited blob must not fatal the option every page
  view reads.

  **It fails shut.** An impossible stored pair is shipped verbatim rather than
  dropped: the window is half-open, so a window ending before it starts
  contains no instant and the Optin never shows. Dropping it would read as
  *never scheduled* and show a finished sale forever, which is the failure this
  ADR exists to prevent — the same fail-shut rule `decide.ts` gives a rule that
  cannot answer. The one case that still widens is a stored boundary that
  cannot be READ, and only because there is nothing honest to ship in its
  place; the write refuses one, so it cannot arise through any supported
  route.

*A start with no end and an end with no start are both valid* — "from Friday,
forever" and "from now until Friday" are things merchants mean. A window is
half-open, `starts_at <= now < ends_at`: authoring 09:00 to 17:00 means live at
nine and over at five, and an end that included its own instant would leave two
adjacent windows both live for a millisecond.

## Consequences

- **`PublishedProjection::build()` takes a `\DateTimeZone`**, which is what
  makes "changing the site timezone re-resolves on the next rebuild" structural
  rather than a claim. It is the same arrangement it already has with the rule
  vocabulary: the impure reading is the caller's, the arithmetic is pure.
- **A timezone change rebuilds the set**, on `update_option_timezone_string`
  and `update_option_gmt_offset`. Without it the sentence above is true and
  useless: the set is rebuilt on write and a timezone change is not a write to
  any Optin, so a merchant correcting a wrong zone would wait for the next
  unrelated publish — which may never come. It is the second and last event
  other than an Optin write that changes what the projection would produce, and
  it gets its own name on the repository (`rebuildForTimezoneChange()`) so that
  calling either rebuild on READ still reads wrong.
- **`starts_at` and `ends_at` are the one payload pair that is not a copy.**
  `PublishedProjection::SHIPPED` is a copy list and they are not on it; they
  are projected beside it, where the resolution is visible. That inline note
  replaces the docblock's earlier *"absent because nothing puts them here"*.
- **`Decision` gains `now` beside `day`, and the two precisions are
  deliberate.** `day` is whole days since the epoch because that is all a
  cooldown asks and it is what gets WRITTEN to the visitor's device
  ([ADR 0017](0017-no-visitor-identifier.md)); `now` is compared against a
  number the server authored and is stored nowhere. One clock reading produces
  both, so a decision can never straddle midnight.
- **The loader costs 48 bytes gzipped** — 5951 to 5999 against free's 8192 B
  budget ([ADR 0014](0014-pro-replaces-the-loader.md), `npm run check:loader`).
- **"No Impression" is pinned rather than argued.** It falls out of the
  presenter never being reached, which is a chain of reasoning and not a
  branch — so `tests/js/loader-shell.test.ts` drives the real shell over a
  payload holding all three cases and asserts one beacon for the one inside its
  window and none for the other two. A negative with no positive beside it
  passes just as happily on a page that reports nothing at all.
- **The funnel gains an eleventh gate**, which is a label and not a `Standing`.
  `tests/js/inspector-panel.test.ts` counts them, so adding one is a decision
  somebody has to write down.
- **CONTEXT.md gains [[Schedule]] as a term**, because a word that means a wall
  time on one side of a boundary and an instant on the other is one nobody will
  spell the same way twice.
- ***Extended by
  [ADR 0052](0052-a-countdown-counts-to-the-optins-own-schedule-end.md): the
  instant this projects is also what a countdown counts to.*** *A `countdown`
  node carries no deadline of its own, so there is nowhere for a timer and a
  schedule to disagree — and the wall-time/instant split above is what makes the
  display cache-proof, because there is no seconds-remaining value to bake into
  a cached page. It also gives `ends_at` a visible consequence: the same instant
  that stops the Optin is the one the visitor watches run out.*
