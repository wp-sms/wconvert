# A Conversion is interpreted at read, never frozen at write

A row in `wconvert_stats` is `(optin_id, kind, stat_date, count)`. It carries
**no `goal`, no `had_email`, no `had_phone`, and no display type.** Everything
needed to interpret it is read from `wconvert_optins` at report time.

*Extended to money by [ADR 0046](0046-wconvert-stores-no-money.md): **it carries
no amount either, and never will.** If revenue is ever reported, WConvert tags
the WooCommerce order with the Optin that earned it and sums real orders at read
— the same rule this document argues, applied to a second question. A stored
amount would be the frozen-at-write shape rejected below, with the same defect,
and it would survive the order's own deletion, which makes it a claim rather
than a record.*

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

  > *Reached by a merchant for the first time in
  > [ADR 0059](0059-the-converting-act-belongs-to-the-design.md), which gives
  > the builder a **Change goal** control — a Goal was chosen in a wizard that
  > could not be re-entered, so "changing an Optin's Goal" was a scripted call
  > until then. The dialog says this sentence in the merchant's own words
  > before the click. Under [ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md), a Goal remains an immediately saved
  > column: success starts a new local draft history, so Undo cannot silently
  > restate reporting through another Goal save.*
  >
  > ***And the same restatement now arrives through a second door.*** *Switching
  > an Optin to a design that converts the other way is no longer refused, so
  > 100 form submissions can be read as 100 click-throughs. The COUNT is
  > untouched — a Conversion happened either way — which is this document's
  > principle rather than an exception to it; the design picker marks the
  > change before the click.*
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
- **One Optin has exactly one converting act, ~~fixed by its Goal~~ fixed by
  its DESIGN**, and the renderer wires the beacon to that node alone.

  > *Amended by
  > [ADR 0059](0059-the-converting-act-belongs-to-the-design.md): this
  > originally read "fixed by its Goal". The act is **the design's**, and the
  > Goal declares only the counted kind. The registration-time refusal below is
  > what always made it true — a registered [[Template]] offers exactly one act
  > — and `Goal::convertingAct()` was a second declaration of the same fact,
  > which is why every act-shaped refusal in the product existed: two sources
  > can disagree. Nothing about interpret-at-read changes; what moves is where
  > the act is READ FROM. The final sentence of this bullet still holds and
  > lands somewhere else: there is still no per-Optin "what counts as a
  > conversion" setting, because the design is the setting.* A [[Template]] offering both a
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
  since an Optin that cannot be converted reports zero forever. ~~The pairing is
  checked one layer up too: a [[Playbook]] whose default Template is metered by
  the other act from the [[Goal]] it serves is refused, because that Optin
  reports nothing at all.~~*

  > *The Playbook check is **deleted** by
  > [ADR 0059](0059-the-converting-act-belongs-to-the-design.md), along with
  > `RejectionReason::MetricMismatch`. There is no pairing to check once a Goal
  > declares no act — and refusing an entry that files a capture design under a
  > Goal whose bundled Playbooks link away would drop a legitimate start from
  > the gallery with nothing in any log. The two refusals in this paragraph, at
  > the Template's own registration, are untouched and are now the whole of it.*
- **An Optin must never be hard-deleted.** #2's soft delete was argued on
  preserving the Optin's name for CSV export; it is now load-bearing for
  analytics as well, because a removed row makes every count referencing it
  uninterpretable.
  *Given a second caller by
  [ADR 0045](0045-an-ab-variant-is-a-whole-optin.md), which is the one most
  likely to look like an exception: **an A/B variant is a whole Optin**, so
  ending a test and declaring a winner must not delete the loser. It is a row
  with a month of counters behind it, and "tidy up the finished test" reads as
  housekeeping right up to the moment it deletes the comparison the test was
  run to produce. Soft-deleted at most — at which point it behaves like any
  other tidied Optin, keeping its counts in the per-Goal total and dropping out
  of the per-Optin list, with no special case anywhere.*
  *Built by [#93](https://github.com/navidkashani/wconvert/issues/93), and the
  rule held twice over. `OptinRepository::declareWinner()` stamps `deleted_at`
  on every arm but the winner and issues no `DELETE` — which
  {@see \WConvert\Database\Connection} could not do for it anyway, having
  none — and `tests/unit/Optin/OptinRepositoryTest.php` asserts both the
  surviving row and the empty delete log. **The other half of this bullet is
  what stopped the obvious implementation.**
  [ADR 0058](0058-a-test-ends-when-the-merchant-says-so.md) refuses ADR 0045's
  own sketch of "promote the winner's design onto the parent": copying arm B's
  design onto arm A's row leaves one row whose counters are A's history
  followed by B's future, under a rate that is the average of two designs —
  which is this document's frozen-at-write shape arriving through a `config`
  copy instead of through a column. The winning ROW is promoted instead, so
  every row's counters mean exactly one design for the whole of its life.*
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
- **`conversions − lead_magnet_delivered` is a same-period event comparison** —
  the analytical half of the operational/analytical split
  [ADR 0008](0008-delivery-state-is-destination-health-not-per-lead.md) drew.
  **Corrected by [0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md):
  the original "delivery failure count" and later "Conversions with no delivery
  yet" wording both overstated what aggregate counters establish.** They count
  events on their own dates, not a cohort of captured Leads awaiting delivery.
  *Qualified by [#28](https://github.com/navidkashani/wconvert/issues/28), which
  drew the card that would report it. **It is withheld while nothing writes the
  kind**, because the arithmetic against an unwritten counter reports every
  Conversion as a failed delivery — which is a worse lie than the 0 it was meant
  to explain. So the lead-magnet card shows 0 deliveries, no failure count, and
  a sentence saying the job that records them has not shipped.
  `StatKind::hasWriter()` is the one flag behind both, and it is one line to
  delete when [#31](https://github.com/navidkashani/wconvert/issues/31) lands.*
  *So the failure count itself is **not on the dashboard payload at all**, and
  that is the second half of the same decision. A field that is `null` in every
  branch this build can reach is a render path nothing can exercise and a
  translatable string nobody can read — and `conversions − deliveries` is the
  same arithmetic-over-two-numbers-already-shown shape the "left without
  converting" figure is refused for. It belongs to the ticket that ships the
  job, which is where the number first becomes true.*

  > **Completed by [#31](https://github.com/navidkashani/wconvert/issues/31),
  > and the two paragraphs above are now history rather than state.**
  >
  > The kind has a writer:
  > [`DeliveryCount`](../../src/Destination/LeadMagnet/DeliveryCount.php) writes
  > it when a queued push to the lead-magnet email Destination succeeds.
  > `StatKind::hasWriter()` **is gone**, along with the card's `note` and the
  > sentence it carried — a screen that apologises for a feature that exists is
  > worse than one that says nothing.
  >
  > `undelivered_conversions` **is on the payload**, as
  > `max(0, conversions − lead_magnet_delivered)` on the lead-magnet card and
  > `null` on every other Goal. Null rather than absent, because
  > `GoalParityTest::testNoGoalIsSpelledInTheAdminBundle` fails on any Goal id
  > appearing under `resources/admin/src` — so the admin can never branch on
  > which Goal a card is, and a server-nulled field is the only shape
  > available. It is on the card and never on an Optin row: one figure for the
  > Goal, not a second metric per row.
  >
  > *It shipped under the name `delivery_failures` and was renamed before the
  > first release. The old name contradicted the copy directly beneath it —
  > "Conversions with no delivery yet" — and collided with
  > [`DeliveryFailures`](../../src/Destination/DeliveryFailures.php), the
  > bounded ring of ~200 **terminal** failures, which is the opposite
  > population. Nothing about the figure changed; only what it is called.*
  >
  > **The second argument above does not survive, and it was checked rather
  > than assumed.** `conversions` is not a field on the payload at all —
  > `Dashboard::numbers()` emits `headline`, `impressions`, `dismissals`,
  > `conversion_rate` and `by_day`, and on a lead-magnet card `headline` is
  > *deliveries*. So one operand is the headline and the other is nowhere on
  > screen. That is not the "left without converting" shape, whose three
  > operands — `impressions`, `conversions`, `dismissals` — are all on the
  > card. (`conversions` is loosely recoverable from
  > `conversion_rate × impressions`, rounded to 4dp and never displayed, which
  > is not a number on screen either.) The first argument was sound and is what
  > actually held the field back.
  >
  > The clamp is not defensive padding. A Conversion at 23:58 and its delivery
  > at 00:01 land on different `stat_date`s, so a one-day window would print a
  > negative number most mornings without it. It also absorbs the two replay
  > seams [ADR 0008](0008-delivery-state-is-destination-health-not-per-lead.md)
  > accepts.

  > **The wording is completed by
  > [0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md).**
  > A clamped same-period difference cannot identify pending Leads: today's one
  > queued capture and a delivery from yesterday produce zero, even though that
  > capture remains queued. The report now names the excess of submissions over
  > recorded deliveries in the period and links to Destinations for delays or
  > errors. The formula, stored counters and replay behavior are unchanged.
  > Focused Optin reports do not inherit a whole Goal's gap. Editor/capture links
  > retain the accepted report period even when a requested refresh fails.
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
