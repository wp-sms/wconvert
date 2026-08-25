# A Conversion is interpreted at read, never frozen at write

A row in `wconvert_stats` is `(optin_id, kind, stat_date, count)`. It carries
**no `goal`, no `had_email`, no `had_phone`, and no display type.** Everything
needed to interpret it is read from `wconvert_optins` at report time.

## The collision that forced the question

[#2](https://github.com/navidkashani/wconvert/issues/2) fixed the per-[[Goal]]
metrics as *"Leads with an email"*, *"Leads with a phone"* and *"Leads where the
delivery fired"*. All three read `wconvert_leads`.

[ADR 0018](0018-erasure-deletes-rather-than-anonymises.md) then made erasure a
row `DELETE`, **explicitly on the reasoning that #12 counts conversions from its
own table** rather than out of the residue of anonymised Leads. Those two cannot
both stand: if the email-list metric derives from `wconvert_leads`, a single
erasure request silently rewrites a merchant's history.

## Why the fix is not to copy the discriminators onto the row

The obvious repair is to stamp `had_email` and `had_phone` onto each recorded
conversion. It is wrong twice.

**It is ceremony at the highest-volume grain in the system.** Whether a
conversion carried an email is a property of the [[Optin]]'s *form*, not of the
moment — an Optin whose Goal is "grow my email list" requires an email on every
submission, so the value is constant across every row that Optin will ever
produce.

**And the join interpretation actually needs is to `wconvert_optins`, which is
never erased** and is soft-deleted rather than removed
([ADR 0001](0001-custom-tables-not-custom-post-types.md), #2). #11's prohibition
is specifically on deriving counts from `wconvert_leads`. It does not touch this.

*Amended by [ADR 0034](0034-the-dashboard-joins-in-php.md) on one word: "join"
here is the interpretation, not a SQL `JOIN`. #28 reads the two tables with
**two statements and joins them in PHP** — a Goal is tens of rows of fact, and a
`JOIN` would denormalise it onto thousands of counters while costing
[`Connection`](../../src/Database/Connection.php) a third widening. Everything
this document argues about WHERE the interpretation comes from is unchanged;
only the engine that performs it is named.*

## It also answers the question #2 deferred here

#2 left open *"whether historical events re-attribute on a Goal change"*,
noting it could only be paid for in this table. Interpreting at read settles it:
**they re-attribute.** Correcting a mis-set Goal makes an Optin's whole history
right rather than splitting it permanently in two — and since #2 made Goal freely
editable on purpose, the frozen alternative means a permanent split every time
someone fixes a typo.

*Open, and noted by [#28](https://github.com/navidkashani/wconvert/issues/28)
rather than settled by it: `wconvert_optins.goal` is **one column with no
draft/published split**, so `saveDraft()` writes it live and re-attribution
fires on a draft edit that is never published. That follows from a Goal being
"kept on the Optin for its whole life" rather than being part of `config`
(CONTEXT.md, Goal) — but it means a merchant can change a live Optin's reported
metric while the site still serves the old converting act. Closing the gap needs
a `published_goal`, which is a schema change and therefore its own sign-off; it
belongs to the builder ticket that lets a merchant edit a Goal at all.*

## The one exception

`lead_magnet_delivered` is its own `kind` rather than something derived. It
records an act that happens *after* the conversion, from a different process, and
that can fail on its own — routed here by
[ADR 0007](0007-destinations-are-outbound-and-fallible.md) precisely because
delivery state is per-Destination health and has nothing per-Lead to read. It is
written by PHP from the Action Scheduler job, once per [[Lead]] on first
successful delivery, and only on Optins whose Goal is the lead-magnet one.

*Enforced by [#26](https://github.com/navidkashani/wconvert/issues/26): the
beacon accepts three of the four kinds and refuses this one
([`StatKind::fromBeacon()`](../../src/Stats/StatKind.php)). "Written by PHP" is
only true if a browser cannot assert it, and the endpoint that would take its
word for it is public and unauthenticated by necessity — so
`conversions − lead_magnet_delivered` would otherwise be a delivery failure
count anybody could set. The job that writes it arrives with
[#30](https://github.com/navidkashani/wconvert/issues/30); the kind and the
refusal exist now. Note also that ADR 0007 bundles no Action Scheduler yet —
see its own inline correction.*

## Consequences

- **The metric wording from #2 changes.** "Leads with an email" becomes
  *conversions on Optins that capture an email*. The number a merchant sees is
  the same; where it comes from is not.
- **Changing an Optin's Goal restates its entire history.** This will look like a
  bug to someone. It is the decision.
  *Built by [#27](https://github.com/navidkashani/wconvert/issues/27), where the
  sentence stopped being a paragraph.
  [`Goal::headlineKind()`](../../src/Goal/Goal.php) is the declaration and
  [`GoalReport`](../../src/Goal/GoalReport.php) is the read that applies it — so
  correcting a Goal moves **every day**, including the ones counted long before
  anybody corrected anything, rather than changing the shape of the series
  halfway along. `tests/unit/Goal/GoalReportTest.php` asserts exactly that. The
  arithmetic takes rows rather than a repository; the join that produces them
  belongs to the screen that draws it.*
  *Completed by [#28](https://github.com/navidkashani/wconvert/issues/28), where
  it stopped being one Optin's arithmetic and became a screen.
  [`Dashboard`](../../src/Stats/Dashboard.php) reads every Optin's current Goal
  and applies it to every counter, so a correction moves a whole CARD rather
  than a number, and the Goal it was corrected away from keeps nothing at all.
  `tests/unit/Stats/DashboardTest.php` asserts that through the payload, and
  `bin/verify-stats.php` asserts it against a real `UPDATE` to a real `goal`
  column — because the claim is that no counter was touched, and only a database
  can be watched not touching one.*
- **One Optin has exactly one converting act, fixed by its Goal**, and the
  renderer wires the beacon to that node alone. A [[Template]] offering both a
  form and a click-through CTA is caught as a **registration-time validation
  error** — the pattern
  [0012](0012-degradation-substitutes-triggers-and-drops-conditions.md) and
  [0010](0010-templates-are-configuration-not-documents.md) already established —
  not a runtime ambiguity, and not a per-Optin "what counts as a conversion"
  setting, which is the configuration that making a Goal declare its own metric
  exists to delete.
  *Built by [#27](https://github.com/navidkashani/wconvert/issues/27) as
  [`ConvertingAct::offeredIn()`](../../src/Template/ConvertingAct.php), applied by
  [`TemplateLibrary`](../../src/Template/TemplateLibrary.php) at registration. The
  walk covers every step and every pane, because a `split`'s far pane is exactly
  where a second converting act hides from a reader. A Template offering
  **neither** is refused by the same check — the same rule read the other way,
  since an Optin that cannot be converted reports zero forever. The pairing is
  checked one layer up too: a [[Playbook]] whose default Template is metered by
  the other act from the [[Goal]] it serves is refused, because that Optin
  reports nothing at all.*
- **An Optin must never be hard-deleted.** #2's soft delete was argued on
  preserving the Optin's name for CSV export; it is now load-bearing for
  analytics as well, because a removed row makes every count referencing it
  uninterpretable.
- **Soft-deleted Optins keep their counts in per-Goal totals** and drop out of
  the per-Optin list. A merchant tidying up in March must not watch February's
  goal total fall.
  *Built by [#28](https://github.com/navidkashani/wconvert/issues/28) as one
  read with two opposite consequences.
  [`OptinRepository::interpretations()`](../../src/Optin/OptinRepository.php)
  has no `WHERE` and no `LIMIT` — the deleted rows are in it on purpose, and a
  cap would silently drop the 501st Optin's counts out of a total nobody can see
  is short — and `Dashboard` is what drops the ROW from the per-Optin list. The
  per-Optin rows live INSIDE their Goal's card, which is also what makes the
  leaderboard this ADR's screen refuses unexpressible rather than merely
  absent.*
- **`conversions − lead_magnet_delivered` is the delivery failure count**, with
  no second metric — the analytical half of the operational/analytical split
  [ADR 0008](0008-delivery-state-is-destination-health-not-per-lead.md) drew.
  *Qualified by [#28](https://github.com/navidkashani/wconvert/issues/28), which
  drew the card that would report it. **It is withheld while nothing writes the
  kind**, because the arithmetic against an unwritten counter reports every
  Conversion as a failed delivery — which is a worse lie than the 0 it was meant
  to explain. So the lead-magnet card shows 0 deliveries, no failure count, and
  a sentence saying the job that records them has not shipped.
  [`StatKind::hasWriter()`](../../src/Stats/StatKind.php) is the one flag behind
  both, and it is one line to delete when
  [#31](https://github.com/navidkashani/wconvert/issues/31) lands.*
  *So the failure count itself is **not on the dashboard payload at all**, and
  that is the second half of the same decision. A field that is `null` in every
  branch this build can reach is a render path nothing can exercise and a
  translatable string nobody can read — and `conversions − deliveries` is the
  same arithmetic-over-two-numbers-already-shown shape the "left without
  converting" figure is refused for. It belongs to the ticket that ships the
  job, which is where the number first becomes true.*
- **Never join `wconvert_leads` to produce a count.** That is the derivation
  #11 asked not to be built, and ADR 0018 depends on it not existing.
  *Enforced by [ADR 0034](0034-the-dashboard-joins-in-php.md) from both ends,
  because a sentence in an ADR is not a thing that fails.
  `tests/unit/Stats/NoCountComesFromTheLeadLogTest.php` walks the reporting
  classes' **dependency closure** — computed from the route and the screen
  rather than listed, so a `LeadRepository` injected into a report is caught on
  the commit that injects it, which is the shape this would actually arrive in.
  And `bin/verify-stats.php` reads the real query log, then writes a [[Lead]]
  and erases it again and asserts that neither act moved a reported number.*
