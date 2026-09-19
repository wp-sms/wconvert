# Erasure deletes the Lead row rather than anonymising it

WConvert registers a WordPress personal-data exporter and eraser. The eraser
issues a **`DELETE`**. It never rewrites a [[Lead]] row to blank out the
identifying columns, which is what the WordPress eraser convention usually means.

## Why not anonymise

**Anonymising is an update, and [ADR 0002](0002-leads-are-immutable-by-schema.md)
has no update path.** `wconvert_leads` has no `status` and no `updated_at`
precisely so that a row cannot acquire mutable state without a migration a
reviewer will see. An eraser that writes to Lead rows re-opens that door for the
one caller nobody would think to check. A `DELETE` is not an update, so the ADR
survives with no carve-out.

**And it buys almost nothing.** With the email and phone gone, what remains on
the row is a `created_at`, an `optin_id` and a `fields` blob emptied of anything
identifying. That is a conversion count —
[#12](https://github.com/navidkashani/wconvert/issues/12)'s job, from its own
event table, not something to reconstruct out of the corpses of erased Leads.

## The exporter is not optional

Cheap to write, and its absence is a live wp.org review flag for a plugin that
stores email addresses. WSMS's `src/Container/PrivacyServiceProvider.php` is the
pattern to copy — five exporters, six erasers, and `wp_add_privacy_policy_content()`.

**Its eraser-ordering hazard does not apply here.** WSMS registers its contact
eraser at priority 99 because several of its erasers resolve an email to a phone
number through the contact row first, and WordPress runs each eraser to
completion before starting the next. WConvert registers one eraser and has no
dependency on another eraser. Its later terminal-failure diagnostic cleanup is
part of the same operation, not a second registered eraser. Copy the ordering
caveat only if a second eraser ever appears.

*Completed by [#25](https://github.com/navidkashani/wconvert/issues/25), which
built it: the eraser is keyed on the **email address and nothing else**, which
is what WordPress's privacy tools address it with. Following the identifier link
— erasing every Lead sharing a phone number with one of these — was considered
and left out. That link is one WConvert COMPUTES at read
([ADR 0021](0021-lead-identity-is-computed-not-stored.md)), never one the
merchant asserted, so acting on it would delete rows the requested address never
appears on. The grouping view may under-group with no consequence because
nothing counts people; an eraser has no such latitude in the other direction.
The cost is stated rather than hidden: a Lead carrying only a phone number is
out of the reach of an email-addressed request.*

*Amended by
[ADR 0093](0093-privacy-erasure-is-bound-to-one-explicit-identifier.md): the
WordPress adapter remains email-addressed, but that limitation is no longer the
whole erasure surface. A verified exact phone can now delete every Lead whose
`phone` column directly contains it. The rejected behaviour remains rejected:
neither email nor phone erasure follows the other identifier to additional
rows, so the grouping relationship is still never treated as asserted identity.*

## Consequences

- **The export includes the [[Consent Record]]** — the consent text exactly as it
  was shown when the visitor submitted. A consent record that does not travel
  with the data it justifies is useless to the merchant at the moment they need
  it most.
  *Completed by [#25](https://github.com/navidkashani/wconvert/issues/25): an
  **absent** Consent Record is exported as nothing at all, and never as a
  refusal. `consent_text` is missing where there was no wording to snapshot —
  an Optin that declared no consent node, or one whose `consent_text` Slot Role
  nobody had filled in, since `CaptureForm` declines to store an empty sentence
  ([ADR 0031](0031-a-lead-has-exactly-one-origin.md)). It is never missing
  because consent was withheld: a submission whose Optin declares a consent node
  and whose payload lacks one is rejected at the endpoint
  ([ADR 0032](0032-consent-capture-is-first-class-in-the-template.md)), so an
  un-consented Lead does not exist to export. The CSV's column is named
  `consent_text` for the same reason — a column named `consent` makes an empty
  cell read as a refusal.*
- **CSV export is out of reach and stays that way.** A file the merchant already
  downloaded cannot be recalled, and tracking exports to try would mean logging
  who exported what — more personal data to solve a personal-data problem. The
  privacy-policy text says the merchant is the controller of exported files.
- **The registered privacy-policy text states the configured retention period**,
  so a merchant who sets one gets the disclosure written for them. Retention
  ships as *keep forever* with pruning off: deleting a merchant's Leads because
  the plugin shipped an opinion is a support catastrophe, and may destroy records
  they are required to keep for unrelated reasons. The Action Scheduler job
  bundled by [ADR 0007](0007-destinations-are-outbound-and-fallible.md) exists
  from day one and simply has nothing to do until a period is set.
  *Corrected by [#25](https://github.com/navidkashani/wconvert/issues/25), which
  built it: **[ADR 0007](0007-destinations-are-outbound-and-fallible.md) bundles
  no Action Scheduler**, and nothing else does either — WConvert has no runtime
  Composer dependency at all, and the [[Destination]] pushes that will need
  per-item durability arrive with
  [#30](https://github.com/navidkashani/wconvert/issues/30). The pruner is a
  **WP-Cron daily event**, and the correction is not a downgrade: this is one
  site-wide job running one statement, with no per-item grain to retry and no
  outcome to recover. A missed run is made up by the next one, because the
  boundary is computed from the moment the job runs rather than from the moment
  it was scheduled. The "exists from day one and has nothing to do" half is
  unchanged and is the part that mattered.*
  *Completed by
  [ADR 0094](0094-privacy-guidance-reports-the-current-data-flow.md): retention
  is now one fact in a shared read-only Data Map. The WordPress suggestion also
  names configured destination types and accurately discloses browser-local
  campaign state, conditional Pro browser storage, and the short-lived
  anonymous-count and form-protection hashes. It remains suggested text for the
  merchant to review, never an automatically published policy or a compliance
  claim.*
- **The retention period is one non-autoloaded WordPress option, not a column.**
  It is a single integer for the whole site, read once a day by the pruner and
  once per render by the settings panel — the table-free alternative the
  database rule asks to have considered, and the right one. Zero, negative and
  absent all read as *keep forever*, deliberately: a merchant clearing the field
  is turning retention off, and the reading that empties their log on the next
  cron run is the one this must never take.
  *The admin interaction is made explicit by
  [0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md).
  The option's empty/nonpositive reading remains keep-forever, but clearing a
  number field does not itself write an option. The controls hold a local draft;
  Save retention validates and confirms the exact chosen automatic-deletion
  period before writing, including changes to an existing period. Keeping
  forever is a separate choice followed by Save. Errors preserve the draft and
  the disclosure continues to state the saved policy. Neither selecting a radio
  nor typing/blur commits a suggested period. No existing site's option or daily
  prune behavior changes through this UI revision.*
- Client-side visitor state is untouched by erasure, and correctly so — after
  [ADR 0017](0017-no-visitor-identifier.md) it contains no personal data.
- **WConvert-owned terminal-failure diagnostics are removed with their Leads.**
  [ADR 0093](0093-privacy-erasure-is-bound-to-one-explicit-identifier.md) adds
  the exact-identifier erasure and scrubs bounded ring entries naming directly
  matched Lead IDs. Queued pushes already carry no Lead data and stop when the
  row is absent; external Contacts, exports, logs and backups remain the
  merchant's follow-up rather than a lifecycle WConvert pretends to own.
- **The prune is a range over the primary key, not over `created_at`.** See
  [ADR 0033](0033-the-lead-log-reads-without-a-new-index.md): a ULID's leading
  48 bits are the minting time, so the two name the same rows and only one of
  them is an index `wconvert_leads` already has.
