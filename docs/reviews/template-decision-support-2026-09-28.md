# Decision-support batch review — 2026-09-28

The next 24 campaign setups are implemented and editorially reviewed. The curated
library now contains 72 setups using 44 distinct designs, with 78 designs and 97
Playbooks in the full bundled inventory. These counts do not claim measured
conversion improvement or production release approval.

## What was added

Six anonymous finders cover gifts, available space, growing experience, services,
project stage and reading depth. Two Free comparison designs cover materials and
service options. Sixteen additional setups intentionally reuse existing designs:
sample, bulk-gift and personalisation enquiries; collection preferences; furniture
fit guidance; pickup, basket-help and returns information; service-area guidance;
repair and team-training enquiries; consultation preparation; an open day;
editorial enquiries, series navigation and reading-format preferences.

Every brief records its visitor need, comparison with existing designs, placement,
prerequisites, honest outcome metric and acceptance checks. New-design structural
comparisons show no identical design/structure matches. Personalisation uses an
existing inline choice form instead of introducing a cosmetic slide-in duplicate.
The completed briefs are archived; the next-batch queue has no unbuilt entries.

## Visual and interaction review

- The final browser audit covered 1,272 screen/result/width/direction cases across
  the complete 72-campaign collection: 320, 390, 768 and 1440px, LTR and RTL, zero
  findings. It measures overflow, 44px control targets, 16px inputs, badge alignment
  and compact-bar hierarchy; it is not a complete accessibility certification.
- Inspected 68 paired desktop/320px proofs: all 66 screen/result variants in the
  new batch, plus both screens of the updated product-care guide. Eighteen RTL
  captures cover input and ending layouts for all eight new designs and an
  existing select form (the single-screen comparisons occur twice). English copy
  was direction-flipped; this is not linguistic review of translated content.
- Fixed a real 390px overflow in the service finder by replacing a narrow grid
  with wrapping split panels. Rebuilt, recaptured and reran the audit afterward.
- Reviewed typography, whitespace, long headings, choice labels, comparison
  stacking, select arrows, buttons and acknowledgements. Reading-result summaries
  now use clear prose; their destination pages contain the ordered exercises.
- All 11 new capture campaigns reject blank required fields, accept representative
  values/choices, retain the form on simulated failure and reach the appropriate
  acknowledgement on retry in the 320px studio. Preview tests create no Leads.
- Twenty-five shipping-loader tests cover all 24 valid finder answer combinations
  and a Back/branch-change regression. They verify the intended result, required
  answers, anonymous completion, no capture request, and clearing a hidden answer
  before revisiting its branch. The complete bundled graph-round-trip suite also
  includes every new design.

Paired proofs use the actual renderer and prepared campaign copy; unconfigured
result buttons are label previews, and product data is tested separately in
WordPress. The proof viewer now has a screen/result picker so every variant can
be inspected without relying on a stitched screenshot of a very tall page.
Representative captures are retained in [the proof folder](decision-support-2026-09-28/).
All raw screenshots can be regenerated with the proof viewer; the review JSON
records their hashes and the final prepared-campaign revisions.

## Real WordPress checks

All 72 campaigns publish and pass the guarded WordPress/MySQL verifier. Checks
include required fields, saved choices, canonical phones where present, retry
idempotence, one Lead per capture journey, configured result/product destinations
and visible acknowledgement links. Eight requested resources each generate one
local queue-to-wp_mail handoff containing a working content link. No external mail
or SMS is sent.

Four additional WooCommerce fixtures have prices, materials and dimensions that
match the new finder choices. Gift prices are asserted against the chosen budget.
Fallbacks lead to the shop, service guidance/enquiry or a directory of four useful
reading paths. Materials, pickup, returns, service-area, open-day and service-scope
pages contain relevant fictional content. Seeding now updates a demo only when
its prepared campaign or fixture revision changes.

Native browser checks additionally confirmed:

- Gift finder: keyboard selection of growing + up to £30, both question screens,
  loaded £24 product card, and navigation to the real product with dimensions and
  care guidance. The campaign also opens correctly in the real editor with its
  questions, result dependencies and Published status.
- Sample request: keyboard entry, correctly centred select arrow, selecting Fabric,
  submitting and reaching the truthful enquiry acknowledgement. The actual saved
  Lead retains `interest=fabric` and `interest_label=Fabric`.
- Consultation checklist: native form submission, acknowledgement with an enabled
  resource button, and successful navigation to the promised photographs,
  measurements/access and question checklist. The real Lead was verified.

The shared resource-index design adds a hidden-by-default resource follow-up.
It becomes visible only after a destination is configured. The old product-care
campaign was rebuilt and both screens were reviewed again, with its new revision
superseding the earlier approval.

## Local validation and limits

PHP: 2,272 tests / 13,211 assertions. JavaScript: 3,348 tests / 180 files. After the
last copy changes, the 135 relevant Goal-screen, finder and graph-round-trip tests
passed again. Studio/review tooling: 12 tests. Template registration: all 78 pass.
TypeScript and source-contract checks pass. Two unsupported Testing Library
`exact` options in an existing test were removed; string names already match
exactly. PHPStan and ESLint outcomes are recorded in the paired JSON report.

Six paid design cards intentionally have no marketing preview URL until real
public preview pages exist, following the fullscreen-card precedent. No premium
trees are included in Free metadata and no dead marketing links were invented.
Publishing those external pages remains a launch follow-up.

CI and real email/SMS delivery remain skipped as requested. Responsive proofs are
container-width tests, not physical-phone testing. No real-merchant conversion
study, payment, appointment, order, subscription delivery or public release is
claimed. Merchant-specific offers, prices, product selection, resource content,
consent wording and destinations still require configured-site release review.
