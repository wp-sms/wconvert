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
completion before starting the next. WConvert has one eraser over one table and
no such dependency. Copy the caveat only if a second eraser ever appears.

## Consequences

- **The export includes the [[Consent Record]]** — the consent text exactly as it
  was shown when the visitor submitted. A consent record that does not travel
  with the data it justifies is useless to the merchant at the moment they need
  it most.
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
- Client-side visitor state is untouched by erasure, and correctly so — after
  [ADR 0017](0017-no-visitor-identifier.md) it contains no personal data.
