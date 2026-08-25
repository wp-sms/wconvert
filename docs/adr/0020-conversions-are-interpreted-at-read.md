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

## It also answers the question #2 deferred here

#2 left open *"whether historical events re-attribute on a Goal change"*,
noting it could only be paid for in this table. Interpreting at read settles it:
**they re-attribute.** Correcting a mis-set Goal makes an Optin's whole history
right rather than splitting it permanently in two — and since #2 made Goal freely
editable on purpose, the frozen alternative means a permanent split every time
someone fixes a typo.

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
- **One Optin has exactly one converting act, fixed by its Goal**, and the
  renderer wires the beacon to that node alone. A [[Template]] offering both a
  form and a click-through CTA is caught as a **registration-time validation
  error** — the pattern
  [0012](0012-degradation-substitutes-triggers-and-drops-conditions.md) and
  [0010](0010-templates-are-configuration-not-documents.md) already established —
  not a runtime ambiguity, and not a per-Optin "what counts as a conversion"
  setting, which is the configuration that making a Goal declare its own metric
  exists to delete.
- **An Optin must never be hard-deleted.** #2's soft delete was argued on
  preserving the Optin's name for CSV export; it is now load-bearing for
  analytics as well, because a removed row makes every count referencing it
  uninterpretable.
- **Soft-deleted Optins keep their counts in per-Goal totals** and drop out of
  the per-Optin list. A merchant tidying up in March must not watch February's
  goal total fall.
- **`conversions − lead_magnet_delivered` is the delivery failure count**, with
  no second metric — the analytical half of the operational/analytical split
  [ADR 0008](0008-delivery-state-is-destination-health-not-per-lead.md) drew.
- **Never join `wconvert_leads` to produce a count.** That is the derivation
  #11 asked not to be built, and ADR 0018 depends on it not existing.
