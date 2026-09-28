# First twelve: implementation verification

The pilot is an internal editorial collection, not a conversion benchmark or a
released library of 400 campaigns. Run `npm run templates:pilot` and open
`tools/design-library/out/pilot.html` over HTTP.

## Implemented

- Twelve campaign setups across three audiences and five formats.
- Six new Free designs and six revised existing designs in the pilot. One
  additional fullscreen design received a placeholder-contrast fix.
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

Review JSON downloaded successfully and was parsed from the browser download:
the saved editorial note and all 208 layout cases were preserved. Review data
stays local to the browser until exported.

Artwork is original bundled SVG, with provenance under `pilot/assets/`.
Downloaded pack assets and catalog scaling remain separate engineering work.
The 48-campaign batch and 400-campaign allocation remain the expansion plan.

## Follow-up: output review and typography

The delivery-bar screenshot exposed a vertical alignment problem that the first
automated checks did not cover. Before correction, its badge centre was 13px
above the headline/button centre; its 16px button also overpowered a 12.24px
headline accidentally authored as a subheading. The final design centres the
row, uses a 17px main heading, a 14px button and a quieter 12px badge. Its link
button remains 45.6px high and the bar wraps cleanly at 320px.

The shared renderer now honours button font/size tokens and badge size tokens;
row badges follow the row's vertical alignment. A 34px mobile heading replaces
the fullscreen poster's 56px desktop heading. The existing fullscreen editorial
form now has a white input surface to improve placeholder contrast.

The studio identifies Type explicitly in cards and detail headers and filters
by Popup, Inline form, Floating bar, Slide-in and Fullscreen. The authoring
workflow now explicitly requires rebuilding and visually inspecting the final
output after the final edit; passing measurements alone is not visual approval.

Verification after the fixes:

- The 208 pilot cases pass expanded checks for row-badge alignment and compact-bar
  hierarchy, link-button dimensions and full clickable question labels.
- The full-library audit covers 2,016 rendered cases across all 66 designs, four
  widths, both directions, normal/long copy and all screens: zero overflow,
  undersized controls/inputs or measured solid-colour contrast findings.
- Audit corrections use the actual fullscreen decorator, measure radio-choice
  labels rather than native radio glyphs, and avoid per-case animation-frame
  waits that stall in background tabs.
- Browser inspection included the repaired bar on desktop and a 320px phone,
  the mobile fullscreen heading, progressive email/SMS/acknowledgement screens,
  and mobile form/success pairs for the new designs plus question/result layouts.
  This remains a visual engineering review, not proof of conversion performance
  or a complete accessibility certification.
- All 3,283 JavaScript tests passed; admin/Pro admin builds and the loader/phone
  size and source contracts passed after the renderer changes.
