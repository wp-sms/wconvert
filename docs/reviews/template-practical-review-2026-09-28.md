# Practical campaign and control review, 2026-09-28

The review covers all 24 prepared campaign setups in the internal studio, with
actual visitor actions through forms, questions, results and acknowledgements.
It supplements the first two batches' visual reviews. It is not a claim that
merchant destinations, WooCommerce stores or message delivery are configured.

## Changes

- Select arrows have a consistent logical-end inset and reserved text space.
  The native select remains keyboard-operable. The decorative arrow has empty
  alternative content; RTL puts it on the left. No template tree changes.
- Both review tools use the shipping `lite-phone-input` adapter. GB is explicitly
  labelled as the studio's sample site country; shipping settings are unchanged.
  International-number placeholders become country-aware examples when enhanced,
  avoiding a duplicated dial code. Authored non-number placeholder text remains.
- Preview values retain the selected country and canonical E.164 number across
  screen, width and direction changes. Accepted fields lock on review, including
  the phone country picker. Widgets are disposed when their hosts are replaced or
  the preview closes. Restart clears the simulation.
- The studio can simulate one failed submission, retaining details for a retry.
  Required multi-choice groups are validated without requiring every option.
- Missing service/event destinations, result URLs and live shop dependencies
  appear as setup notices. Demo handoffs stay local and create no Leads.
- A practical review gate is documented at
  `tools/design-library/pilot/PRACTICAL-REVIEW.md`. Layout checks now also flag
  field wrappers without an input, preventing incomplete renders from looking
  like successful measurements.

Small equivalent DOM-construction simplifications keep the renderer inside the
existing loader budgets. No budget was increased and the phone library remains
in the optional phone asset, not the base visitor loader.

## Visitor checks

All 24 campaigns were opened and their available primary routes exercised. All
form acknowledgements were read for accuracy: enquiry acceptance does not claim a
booking, course reservation or trade-account approval. Link-only campaigns do not
invent a form submission. The audit also covered:

- Email accepted before optional SMS; reviewing locked email; finishing without
  SMS; independently accepting SMS.
- Country picker search and Canada selection; canonical number preservation;
  failure then retry; 320px review; accepted phone/country locking; reset to GB.
- Product-finder garden/sun result and balcony branch (which skips the garden
  question); result fallback inspection. Guide result before optional email,
  declining signup, returning and submitting it.
- Select choice and value preservation across width/RTL changes; desktop and
  320px RTL arrow inspection. Phone examples no longer repeat the dial code.
- Final mobile SMS acknowledgement and final desktop phone control screenshots.

The raw local interaction record is generated
`tools/design-library/out/practical-journey-checks.json` (24 unique setups).
Screenshots include `controls-select-desktop.png`,
`controls-select-mobile-rtl.png`, `controls-phone-desktop.png` and
`controls-phone-acknowledgement.png` in the same ignored output directory.

## Verification

- 3,306 JavaScript tests across 179 files passed. After the final country-example
  adjustment, the 36 relevant phone/readiness/renderer tests passed again.
- TypeScript and changed-source ESLint passed; six studio contract tests passed.
- All 70 designs survive registration; source-contract verification passes.
- Free and Pro admin builds, every visitor-loader build and the optional phone
  build passed. Loader and combined phone-page size caps remain unchanged.
- Real WordPress Playground normal boot with Free and Pro: all 24 campaigns
  prepared through the application's Prefill service.
- Final studio layout run: 360 cases, zero findings, including actual phone fields.
  Complete library measurements: 2,128 cases, zero findings, across 70 designs, four widths,
  both directions and longer copy. These measurements supplement visual review;
  they do not certify accessibility conformance or conversion performance.

## Before publication

Configure and test the real coupon/offer, deadlines, guide links and delivery,
service and event URLs, products/fallbacks, cart eligibility/URLs and provider
opt-out behaviour on the merchant's site. Product and guide recommendation
screens currently need their result destinations supplied; the studio states this
explicitly. Editorial design approval must not be treated as campaign readiness.
