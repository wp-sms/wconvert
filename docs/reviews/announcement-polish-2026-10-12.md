# Announcement composition correction — 12 October 2026

This follow-up supersedes the **bar composition judgement** in the earlier
[older-essentials review](older-essentials-2026-10-12.md). That review saw the
output and approved an awkward arrangement. Passing overflow/contrast checks
was not evidence of good grouping. The earlier files remain as historical
evidence; this review does not rewrite them.

## Failure and correction

At intermediate widths, the announcement remained in the left pane while the
email field and CTA broke into two rows in the right pane. The title floated
beside a disconnected form. The original source reproduced 58 failures in the
initial 304-case width/direction sweep. A first correction still failed when
longer CTA wording was included, so the final split waits for enough space for
that wording too.

`bar-email-capture` v6 now has three deliberate arrangements: one row on wide
containers, a heading above the inline field/action at intermediate widths, and
a stacked phone form. Field and button heights match when inline. Consent stays
below the form. The white/blue palette, stable leaf IDs, field references and
submission contract are preserved.

The mounted WordPress check also exposed a close button overlapping the CTA.
Both input and acknowledgement now reserve side space on wider screens and a
small dismissal area above the content on phones. This uses supported panel
and narrow tokens; no shipping renderer or merchant snapshot is rewritten.
The bare studio preview omits container dismissal chrome, so its reserved space
must also be judged using the mounted screenshots, not in isolation.

## Final visual judgement

Reviewed both filled setups, `repair-workshop-news` and `local-class-news`.
The heading leads into the form instead of floating beside its second row;
email and submit stay together where space permits. Phone labels remain visible,
inputs retain 16px text, and consent wraps beneath the action with a hanging
checkbox alignment. At 1343/1344px the layout switches as a unit; the longer
CTA remains alongside its field after that switch. The small acknowledgement
uses the same type and dismissal spacing. No decorative icon was introduced.

Saved actual-size views at 320, 390, 640, 808, 960, 1343, 1344 and 1440px,
plus longer-copy views at 320, 808, 1343, 1344 and 1440px. These are in
[the evidence directory](announcement-polish-2026-10-12/). Inspected the phone,
intermediate, transition and wide compositions, long-copy samples, paired
input/acknowledgement proofs, and final native input/acknowledgement screens.
The native phone run uses touch controls. Focus rings in acknowledgement
screenshots are the real post-submit focus state, not authored decoration.

## Repeatable prevention and verification

- The studio's regular layout check and the shared library audit now flag an
  announcement sitting beside a form whose button has wrapped beneath its field.
- `npm run templates:check-announcements` sweeps 84 widths × two filled setups ×
  two directions × actual/longer copy: **672 cases, zero findings**. It asserts
  the rendered width really equals the requested width, inline control alignment,
  overflow and overlap with a close control using the shipping CSS's touch size.
  This guards known geometry, not subjective visual quality.
- [Batch audit](announcement-polish-2026-10-12/older-essentials-2026-10-12-audit.json):
  **128 cases, zero findings**, including both screens, four widths, RTL, longer
  copy, text/outline contrast and control sizes across all four older essentials.
- [Studio journeys](announcement-polish-2026-10-12/journeys.json): four journeys
  cover required fields, simulated failure/retry and completion.
- [Native WordPress journeys](announcement-polish-2026-10-12/older-essentials-2026-10-12-live.json):
  eight runs verify required email, an actual saved Lead ID and acknowledgement.
  The harness now waits for opening motion to finish before taking the input
  screenshot, and checks bar content against viewport and dismiss-control bounds
  on both screens. No external email or SMS is sent.
- All 107 templates survive registration. PHP: 2,819 tests; JavaScript: 4,255
  tests; studio/export: 38 tests. ESLint passes. The final token/panel adjustment
  was then rechecked by registration, all browser audits and native journeys.

The authoring skill and guidelines now require actual/longer copy, screenshots
on both sides of layout transitions, explicit composition judgement and the
mounted dismissal control. A changed source still invalidates its previous
review. Only the two changed announcement setups receive replacement approval;
this does not certify the remaining older library or publish a hosted release.

Reproduce after building and serving the studio on 9452 and the guarded,
disposable WordPress fixture on 9453:

```sh
npm run templates:pilot
node tools/design-library/build/batch-audit.mjs older-essentials
WCONVERT_COMPOSITION_EVIDENCE=/tmp/announcement-review npm run templates:check-announcements
WCONVERT_REVIEW_EVIDENCE=/tmp/announcement-review node tools/visual-tests/older-essentials-visual.mjs
node tools/visual-tests/template-studio-refresh.mjs older-essentials /tmp/announcement-review/journeys.json
WCONVERT_REVIEW_EVIDENCE=/tmp/announcement-review node tools/visual-tests/older-essentials.mjs
```
