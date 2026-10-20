# Shared close and dropdown controls — 20 October 2026

## Diagnosis

The user’s off-centre close mark reproduced in the studio with the shipping
`closeButton`: a 32×32px grid button contained the text `×` at 20px/20px. The grid
centred the line box, not the glyph's ink. The shared select used `▾` at the
inherited 16px body size, positioned 12px above the entire field's bottom. The
visible triangle was tiny. The phone library independently used a text triangle
at 0.6em and 0.6 opacity.

Ranked hypotheses were font metrics, inherited template styles, and shared
positioning. Source and DOM inspection established the shared glyph/positioning
issue: the same code supplies all template containers. Per-template offsets
would only mask it. Vector paths now centre the ink; the observed native close
button centre and path centre differ by **0px on both axes**.

## Change

- One shared stroked SVG constructor, reused by vocabulary icons and controls.
- Close uses a decorative SVG inside the same accessible native button.
- Select uses a 20px chevron, centred in a grid against the input itself, with
  logical end spacing and room reserved for its text. Labels, native validation,
  keyboard semantics and submitted values remain native.
- The phone adapter uses the identical chevron while retaining lite-phone-input.
- Fine-pointer/coarse-pointer close targets remain 32px/44px respectively.

## Checks and actual output

`geometry.json` covers the current **108 designs + 155 registered setups**, every
screen and result, four widths (320,390,768,1440) and LTR/RTL. **4,192 cases;
2,760 close buttons, 408 selects and 128 phone selectors; zero control failures.**
The check uses current renderer code and current discovered inputs. It checks ink
centre, indicator size, input containment, text clearance and pointer pass-through.
It does not claim that every design is aesthetically approved.

Actual WordPress 7.1.3, rebuilt Free/Pro loaders and phone asset:

- Gift guide: inspected desktop and 320px input; close click dismissed the popup.
  Desktop Enter dismissed the popup. Real local submission reached Received;
  inspected its close and dismissed with Enter.
- Earlier appointment: inspected desktop, 320px, and narrow RTL; selected
  Weekdays, submitted a local enquiry and reached Enquiry received. Read-only
  fixture result confirmed `weekday_saved: true`. No external messages sent.
- Renovation callback: inspected desktop and 320px with both selectors together;
  opened country picker, searched Oman and selected +968. The arrow persisted and
  the phone input kept adequate room. Search/picker behaviour stays with the library.

Saved PNGs are unmodified browser screenshots; RTL uses viewport captures because
the browser's full-page capture clipped that direction despite correct DOM bounds.
`source-and-evidence.json` pins renderer/source and screenshot hashes.

Regression tests first reproduced the text-glyph/no-indicator failure. New tests
cover accessible close dispatch, native select validation/FormData, and chevron
persistence through actual phone-library country changes. Existing phone tests
also check canonical number preservation, readonly state and invalid numbers.

See `checks.txt` for the final local test results and measured payload sizes.
The small loader budget adjustment is recorded in ADR 0155; optional phone and
combined phone-page ceilings are unchanged and pass.

## Scope limits

This is focused shared-control verification, not renewed editorial approval. No
shared review records were changed. The renderer revision change correctly makes
all 132 curated setup reviews stale, including collection dependencies; collection
publication still refuses stale reviews. Prior dated approvals remain historical.
No merge, hosted release or R2 upload was performed. Physical devices and separate
Firefox/Safari engines were not tested. Existing screenshots and historical
review evidence were preserved.

Reproduce with `npm run templates:controls:proof`, serve `tools/design-library/out`,
open `control-proof.html` and press Run checks. Inspect representative real
WordPress controls as well; measurement alone is not visual review.
