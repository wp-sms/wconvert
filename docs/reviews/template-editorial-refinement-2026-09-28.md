# Membership and maker-note editorial refinement

The membership inline card mixed shopping icons with publication benefits and let
individual icon/text rows wrap differently. The maker-note popup retained a star
and clock after their companion copy was cleared. These passed structural checks
but failed editorial review. This review addresses the actual prepared campaigns.

## Changes

- `inline-benefits`: consistent, text-only benefit panels, start-aligned heading,
  quieter fine print, and a content-width CTA. The three desktop panels stack at
  320px; long benefits wrap inside their own panel. Membership remains an inline
  information campaign, with pricing and terms on its destination page.
- `quieter-frequency`: removed decorative stars, the detached clock, divider and
  optional empty wordmark/body slots. The popup opens directly with its eyebrow,
  headline and value proposition, followed by email, consent and submit. The
  acknowledgement now has one concise stack with a meaningful check, confirmation
  copy and fine print. The check follows text direction rather than using a
  left-anchored illustration. Retained leaves keep their IDs; capture field and
  consent IDs and submission references are unchanged.
- Authoring guidelines now explicitly check icon relevance, empty slots, unequal
  benefit lengths, consistent alignment and CTA width after real campaign copy
  has been applied. Automated geometry checks cannot establish editorial quality.

## Depicter reference review

Reviewed on 2026-09-28. These are observations and design ideas, not conversion
results. No competitor artwork, text or template source was imported.

| Reference | Observed pattern | Application to WConvert |
| --- | --- | --- |
| [Horizontal Signup Form with Image](https://depicter.com/template/horizontal-signup-form-with-image/10587/) — live desktop preview | A focused message and short form balanced against a deliberate image panel; clear close control. | Use artwork when it explains the offer. Text-only editorial popups should be equally complete and omit ornamental rows. Keep visible field labels. |
| [Slide-in gallery](https://depicter.com/templates/#/slide-ins) — Minimal Slide-in and Simple Abandonment thumbnails | Compact signup with adjacent field/button, or one short offer and a single CTA; visible dismiss controls. | Reserve slide-ins for a small contextual request. Compare the purpose and structure against existing designs before adding another. A gift icon should accompany an actual offer. |
| [Early Cyber Week Notification Bar](https://depicter.com/template/early-cyber-week-notification-bar/11002/) — live desktop preview | Shallow horizontal composition separates headline, offer detail, CTA and dismiss. | Keep bars short, with one action and an explicit phone wrap. Do not imitate conflicting sample discount claims or invent urgency. |

The Minimal Slide-in and Join Email List detail previews stalled, so slide-in
observations use the gallery thumbnails. This was a visual reference review,
not a test of Depicter's forms, delivery or mobile behaviour.

For future batches, compare an image-led popup, a compact contextual-help
slide-in and a restrained announcement bar against the existing inventory before
creating any new design. A colour change, decorative icon or industry label alone
is not a new composition. This refinement adds no campaigns or designs.

## Verification

- Visually inspected the two affected campaigns' desktop and 320px renderings,
  including the maker acknowledgement and RTL. Removed empty spacing exposed by
  the first render pass and corrected the acknowledgement icon's RTL alignment.
- Studio maker flow: fictional email and consent, simulated failed submission,
  details retained, retry reaches acknowledgement. No provider request.
- Disposable WordPress: refreshed only changed demo snapshots. Membership CTA
  opened page 106, with actual sample benefits, price, renewal and cancellation
  details. Maker email submission reached the final acknowledgement; keyboard
  focus moved to its heading. Pages 97 and 63 show the revised designs.
- Real WordPress verifier passed all 72 campaigns and local resource handoffs.
  This is local capture/queue evidence, not external inbox delivery.
- Final browser layout audit: 1,272 screen cases, zero layout findings.
- PHP: 2,272 tests, 13,200 assertions. JavaScript: 3,348 tests, 180 files.
  The first full JS run had four 5-second timeouts in builder suites; a full
  rerun with two workers passed. No timeout threshold or test code was changed.
- All 78 designs survive registration; all 12 studio/review-tool tests pass.
- Twelve other campaign revisions changed only because their nearest-design
  comparison metadata changed. Their own source/configuration was not edited.
  Re-inspected their 22 desktop/320px screens; retained earlier practical-flow
  evidence and refreshed the local WordPress verifier evidence. The review
  records explicitly distinguish this from new end-to-end browser testing.

Screenshots are retained under `tools/design-library/out/editorial-refinement/`.
The JSON evidence records their hashes, exact campaign revisions and the native
verifier output. Screenshot output remains a local development artifact.

The library remains 72 setups using 44 designs, with 78 designs in the full
inventory. No CI or real email/SMS delivery was run, as requested. No conversion
performance or physical-device coverage is claimed.
