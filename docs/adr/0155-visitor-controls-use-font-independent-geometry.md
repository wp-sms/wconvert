# Visitor controls use font-independent geometry

The shared close button used a multiplication character. Grid centred its line
box, but the font's ink sat below the centre of the circular button. The select
indicator was a small text triangle positioned from the field wrapper's bottom;
the phone library supplied another tiny, translucent text triangle. These are
shared controls, so changing template padding cannot reliably fix them.

Use renderer-owned, decorative SVG geometry for close and chevron controls,
sharing the existing stroked-icon constructor. The 20px drawing box is independent
of font metrics. Close remains a labelled native button. Select remains a labelled
native select with native validation and form serialization. A grid wrapper
centres the chevron against the input, with logical end spacing for RTL. Pointer
events pass through the drawing. The phone adapter replaces the library's arrow
using the same helper; country selection and validation stay with the library.

The close target stays 32px for fine pointers and 44px for coarse pointers. No
per-template offsets or font-specific corrections are introduced. Templates
remain configuration and cannot supply SVG markup or arbitrary paths.

## Payload cost

Node 22.23.2 gzip-9 measures the updated loaders at 14,852 B Free and 27,840 B Pro.
These exceed the previous 14,768 / 27,712 B ceilings. Allocate 128 B more to Free
and 160 B more to Pro: **14,896 / 27,872 B**, retaining the hard, flagless gate.
The same Pro base applies to analytics/commerce combined checks. The optional
phone asset and phone-page ceilings do not increase. This pays for a common
rendering correction, with no new dependency or network request.

## Evidence and prevention

`control-proof.mjs` generates a browser check using the current renderer and all
designs/registered setups, every screen/result, four widths and both directions.
It checks actual icon geometry, select text clearance, phone arrow geometry and
pointer behaviour. Unit tests cover accessible actions, native select validation
and serialized values, plus phone country changes. See the dated control review
under `docs/reviews/shared-control-icons-2026-10-20/` for screenshots and results.

This focused check does not approve entire campaigns or renew stale editorial
reviews. The existing shared-renderer revision check remains conservative.
