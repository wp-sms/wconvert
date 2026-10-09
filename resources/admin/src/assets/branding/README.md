# VeronaLabs branding

`veronalabs.svg` is the official logo from https://veronalabs.com/:
https://veronalabs.com/wp-content/themes/veronalabs.com/images/logo.svg

Retrieved 2026-09-19 for the product owner's requested footer attribution.
The source artwork is unchanged. CSS renders it in a muted monochrome treatment on the dark footer.

The Mailchimp and Brevo marks moved to `pro/modules/destinations/admin/`, with
the module that registers those destination types.

# WConvert mark

`wconvert-mark.svg` (espresso tile, cream W, citron dot) and
`wconvert-mark-inverse.svg` (cream tile, espresso W) are copied unchanged from
the wconvert.io site repository, `public/images/brands/`, on 2026-10-09 (ADR 0130).
`shell/Brand.tsx` renders the same paths inline as JSX, and
`src/Admin/AdminMenu.php` derives the monochrome menu icon from them. If the
artwork changes, update all three together.
