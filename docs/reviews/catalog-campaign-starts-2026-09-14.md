# Downloadable campaign starting points — 14 September 2026

## Requested outcome

Extend downloadable packs from designs/sample content to designs plus campaign
wording and suggested settings. Reuse the built-in starting-point flow. Continue
using the local sample catalog, placeholders and mainly code-based verification.
Do not publish campaigns or change existing drafts.

## Implemented flow

Choose a goal, browse template packs, preview and install a collection, then
choose one of its starting points. Installation returns to the existing creation
gallery through an explicit action. Collection filtering distinguishes bundled
and downloaded starts. Cards show the actual Prefill composition, effective
rules, setup notes and source. Customize creates a draft; publishing remains a
separate editor action. Packs without matching starts explain the selected-goal
mismatch. Design-only packs still work in the editor.

The three 1.1.0 collections include ten unchanged reviewed Playbooks. Namespaced
identities prevent bundled collisions. Updates replace future starting choices,
retain old design baselines and never rewrite existing campaign snapshots.
Strict JSON grammar precedes shared registration validation; bound copy is also
checked against the pack's placeholder-only template contract.

## Verification

- PHP: complete suite, 1,867 tests passed. Focused catalog integration exercises
  all ten generated starting points and compares their Prefill output with the
  bundled source. Tests cover version replacement, removed starts, retained
  snapshots, and unsafe/unsupported import refusal.
- JavaScript: complete suite, 2,322 tests across 95 files passed. New tests cover
  creation from an installed source, collection filtering, the install-to-chooser
  handoff without creation, and refusal of a mismatched-goal action.
- Final UI follow-ups: all 39 focused creation/pack tests passed, followed by
  TypeScript, ESLint and both admin builds. Closing the pack browser restores
  keyboard focus; available packs explain a goal mismatch before installation.
- TypeScript, ESLint, PHPStan, source contract, all 50 template registrations,
  and Free/Pro admin builds passed. No visitor-renderer changes were made.
- Real local WordPress REST: downloaded/installed all three 1.1.0 packs, listed
  all ten starts by goal, compared card composition with Prefill, created ten
  temporary drafts, saved/read back edits, and removed the temporary drafts.
  All six original Optins remained unchanged. No publication, Leads, external
  delivery, table or column changes.

- One combined browser pass verified goal selection, opening an installed pack,
  and returning to the collection-filtered chooser. Both Store starts for the
  email-list goal displayed their real wording and 8/12-second setup summaries.
  No draft was created during browser verification.

Architecture and supported import values are in ADR 0083. Production catalog
hosting, paid packs, assets and further new compositions remain outside scope.

## Review

- Standards: bounded read-only review of remote Playbook validation, registration
  and lifecycle against the project guidance and relevant ADRs found no material
  actionable issues. Runtime verification is recorded above separately.
- Specification: review identified the missing goal-mismatch explanation before
  installation. Fixed in 53a6783 with regression coverage; no other concrete
  specification issues were found.
