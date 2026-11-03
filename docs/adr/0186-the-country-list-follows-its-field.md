# 0186: The country list follows its field

Accepted 2026-11-03.

`lite-phone-input` positions its country list once, against the trigger, assuming a 300px list. It closes the list on any window scroll or resize. In a Campaign that left the selected country off-view on open, because the field's font is applied after the library scrolls to the row. The list was also narrower than the field, ran off short windows, and closed itself when the wheel reached the page.

## Decision

The phone adapter corrects this in `opened()` (`resources/phone/src/enhance.ts`), with no library release:

- **Placement.** Outside the library's fullscreen mode, the list takes the left edge and width of the `.wc-phone` field, with a 280px minimum, and moves left only if it would pass the window's right edge. Fullscreen starts at 500px wide, so 280px always fits.
- **Height.** The list is capped at 300px or the space on the side it opened, less 8px.
- **Above the field.** The list anchors with an inline `bottom`, replacing the `--wc-phone-anchor-bottom` variable and its `!important` rule.
- **Selected row.** It is scrolled into view again once the font is applied.
- **Wheel.** `.lpi__list` has `overscroll-behavior: contain`, and a non-passive listener blocks the wheel outside the list or when the list cannot scroll. `contain` alone does not hold on a list too short to scroll.

The Pro phone page's combined base goes up 96 B, from 30,720 B to 30,816 B, approved by the user (`bin/check-phone.mjs`). Until now that base only followed the Pro loader budget, most recently in [ADR 0184](0184-right-to-left-needs-more-than-logical-properties.md); this is the first rise for the phone asset itself. The fix costs about 170 B on the phone asset and `main` had 84 B spare on Pro. Free's ceiling and the 16 KB phone budget are unchanged.

## Consequences

Pro has about 9 B spare, so the next change to the phone asset or the Pro loader will probably need its own decision.

Country search stays with the library: [lite-phone-input#3](https://github.com/wp-sms/lite-phone-input/issues/3).

On the editor's canvas the country picker does not open, and a press selects the field like any other (`resources/admin/src/builder/Preview.tsx`). The canvas scales its design, so the list's fixed position resolves against the stage, which clips it, and the library's scroll to the selected row moved the stage's page and left a gap. The picker is a thing to try in the preview, not to edit on the canvas.

In the editor's preview, the list sits about 80px right and 45px down from the field. Its `top` is the library's own value, which this ADR does not change, so the offset predates it. It matches the corner of the preview's dialog, which suggests the dialog is what `position: fixed` resolves against. Not fixed here.
