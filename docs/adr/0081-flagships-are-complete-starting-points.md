# 0081 — Flagships are complete starting points

Date: 2026-09-11

Status: Accepted

The curated design library contains useful compositions, but creation still
prefilled several older generic cards. Changing the template alone leaves blank
copy wherever the new composition repeats a Slot Role. A polished gallery card
is not enough if the resulting draft is incomplete.

The twelve flagships are Playbooks, four recommended for each of stores,
publishers and services. `FlagshipCollection` owns their membership and order.
The consultation starting point is amended by [ADR 0085](0085-goals-have-publish-contracts-and-stable-history.md): it captures a request instead of linking to a booking page. Goal fit is now a publication requirement; the reusable Template still has no Goal tags.
The existing Goal-first gallery puts relevant recommendations first and shows
their audience label. Other bundled and extension Playbooks remain available;
neither audiences nor Goals restrict a reusable Template. The REST response
continues to use the actual `Prefill` result for both preview and setup facts.

Eleven existing designs supply the collection, including a substantial revision
of Inline call to action. Reading slip adds the missing compact editorial link
composition. Every non-authored copy occurrence is filled, including hidden
consent and resource-action labels. Wordmarks, valid codes, URLs, schedules and
destination bindings remain merchant setup. No sample coupon is silently made
real and no capture acknowledgement claims provider delivery or a booking.

The immediate cart Playbook now uses an inline design and page-load eligibility
where the merchant places its block. The other two retain delayed popup
behaviour. This amends the shared `offer-panel` implementation detail in
[ADR 0025](0025-cart-recovery-captures-nothing.md); all three still capture
nothing and rely on the existing cart Goal, availability and URL resolution.

The [collection review](../reviews/flagship-starting-points-2026-09-11.md)
records the mapping, checks and limits. Catalog installation, remote compatibility
and new visitor capabilities remain subsequent work. Existing saved and
published snapshots are unchanged.

## Library expansion, 2026-09-28

The internal review collection now contains 48 campaign setups using 36 distinct
designs, drawn from the full 70-design inventory. This does not change the twelve
flagship recommendations. The latest 24 intentionally reuse existing designs for
new visitor tasks; each brief records comparisons and a reason for reuse. The full
bundled registry now has 73 Playbooks.

Optional validated `business_types` metadata (stores, services, publishers) extends
both bundled and downloaded Playbooks. The server returns translated labels;
Goal-first discovery combines business, format, collection and search. Metadata is
editorial guidance, never capability gating. Older untagged setups remain under
All businesses. Counts keep campaign setups separate from distinct designs.

The studio hashes the prepared campaign and renderer for review decisions. Paired
screen proofs show all screens at desktop and phone widths. A disposable real
WordPress/MySQL/WooCommerce harness verifies published snapshots, native capture,
retries, saved values and local resource-email handoff. Local handoff does not
prove provider or inbox delivery. See the
[48-campaign review](../reviews/template-coverage-2026-09-28.md).

The studio now shares editorial decisions through a repository review ledger,
with reviewer attribution and separate visual, journey and WordPress evidence.
Campaign/renderer revisions and evidence-file hashes invalidate outdated
approvals. Atomic imports reject conflicting reviewer bases; a local gate checks
current approvals independently of CI. Existing matching evidence was reconciled
for all 48 setups. Browser edits remain drafts until imported and committed.
This introduces no database storage or hosted review service. The next 24 briefs
are explicitly planned and excluded from the actual library counts. See the
[shared-review workflow](../../tools/design-library/review/README.md).
