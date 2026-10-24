# 0169: Approved campaign fonts are local assets

Accepted 2026-10-24. Amends 0055 and 0160.

## The design must use the same face in review and on the site

The Black Friday prototype had local font files. Catalogue review embedded those
files, but actual WordPress delivery respected the default-off Google setting and
fell back to system fonts. Computed family names and overflow tests did not reveal
that a different face was drawing the letters. In particular, Impact replaced
Bebas Neue and changed the weight and line breaks of 31 designs.

A second mismatch affected four serif designs: the prototype named its font face
`Serif` without quotes, a reserved CSS generic family. Browsers ignored those two
face declarations and displayed their system serif. These designs now explicitly
use `"Times New Roman", Times, serif` to preserve the approved appearance, rather
than substituting Cormorant or inventing a heavier weight.

WConvert now ships the prototype’s DM Sans variable, Bebas Neue and Cormorant
Garamond variable normal/italic WOFF2 files under `resources/template-fonts/`,
with their SIL Open Font Licenses. Their combined binary size is 122,656 bytes.
These are original, unmodified licensed files, not downloaded at runtime. The
closed `BundledFonts` registry names their local paths and verified axis ranges;
a design supplies no font URL or CSS.

The admin prints their `@font-face` rules at document level, so both the editor
and setup previews resolve the same faces. Visitor payload markup declares only
bundled families requested by the designs on that page. The browser fetches font
files only when text uses them. Rules are outside the shadow roots, where faces
actually work. No JavaScript loader bytes or database storage are added.

The theme API distinguishes `bundled_fonts` from theme fonts. The picker labels
these Included fonts; missing-font notices and remote requests omit them. Theme
stacks and manually entered stacks remain available. Existing campaign snapshots
keep their original stack and requirement values.

## Remote permission remains independent

This does not turn on Google Fonts, alter its acknowledgment, or authorize remote
requests. The payload removes bundled families from the remote list even when
Google delivery is enabled. Other declared families still require the existing
site permission or a font installed through WordPress. A design with no bundled
requirements adds no local face markup. The plugin still has no upload manager,
font cache, external URL registry or remote font download service.

## Verification

Coverage checks packaged files and licenses, normal and italic declarations,
local delivery with remote permission off, remote-list exclusion with permission
on, and rejection of arbitrary family names. Real WordPress review must check
loaded `FontFace` entries and successful local asset responses, without injecting
catalogue preview fonts or the disposable theme-font fixture. A CSS family string
or `document.fonts.check()` alone is not proof that the intended face loaded.
