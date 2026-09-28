# First twelve: implementation verification

The pilot is an internal editorial collection, not a conversion benchmark or a
released library of 400 campaigns. Run `npm run templates:pilot` and open
`tools/design-library/out/pilot.html` over HTTP.

## Implemented

- Twelve campaign setups across three audiences and five formats.
- Six new Free designs, five revised existing designs and one reused design.
- Eight new Playbooks and four revised Playbooks; the inventory now contains 66
  designs and 39 Playbooks. Existing saved campaigns are not rewritten.
- Actual registered Playbooks pass through shipping Prefill, including default
  privacy guidance, then through the shipping Free/Pro renderer.
- Metadata records purpose, composition difference, suggested setup,
  prerequisites and the appropriate measurement.
- Structural/style fingerprints flag reuse, colour variants and nearest
  neighbours across all modules. Similarity remains a human review prompt.
- Local review notes are versioned against the prepared campaign and renderer;
  the UI provides a JSON export. No shared review database is added.

## Evidence

- `composer verify:templates`: all 66 source designs survive registration intact.
- `composer verify:source`: passed.
- `composer test`: 2,184 tests, 11,877 assertions passed.
- `npm test -- --maxWorkers=2`: all 178 files and 3,283 tests passed. The initial
  default-worker run had eight editor timing failures; the affected files passed
  with two workers, followed by this complete successful run.
- `npm run test:template-studio`: five inventory, similarity and Prefill checks passed.
- ESLint passed for the changed build modules and new inventory test.
- WordPress Playground on PHP 8.1, loading Free and Pro through normal boot hooks:
  all twelve Playbooks prepared successfully using the real service container.
  The local WP-CLI connection could not reach Local's database, so Playground was
  used for this check.
- Browser review: audience filtering; mobile form acknowledgement; the balcony
  recommendation skips the garden question; nearest-design comparison; review
  notes survive closing and reopening a campaign.
- Built-in layout checks: 208 screen cases, four widths and both directions,
  zero horizontal overflow, control-height or input-font findings.
- First screens visually reviewed in the gallery; representative mobile forms
  and result screens inspected. A full editorial/accessibility review of every
  branch and result is still required before release.

## Limits and follow-up

The studio simulates submissions locally. This verification did not deliver
email/SMS, redeem a coupon, place an order or confirm a booking. Merchant links,
products, offers and destinations must be configured and tested. Cleared coupon
values display a documented `YOUR CODE` placeholder in the studio only.

Browser export needs a manual download check; automated browser download waiting
was inconclusive. Review data stays local to the browser until exported.

Artwork is original bundled SVG, with provenance under `pilot/assets/`.
Downloaded pack assets and catalog scaling remain separate engineering work.
The 48-campaign batch and 400-campaign allocation remain the expansion plan.
