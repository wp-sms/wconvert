# Bundled Pro photographs

Byte-identical copies of the photographs embedded in Pro's designs: the WebP
pictures in `lookbook`, `field-guide` and `polaroid`, generated with gpt-image-2
through Codex (prompt and rights record in
`tools/design-library/publishing/catalog.json` → `image_rights`, keyed by the
same hash), and the JPEG in `exhibition-wall`. Each file is named by the
SHA-256 of its bytes.

`ProTemplates` substitutes a matching, verified data URI with this installation's
Pro plugin URL when a site loads Pro's designs (`BundledArtwork`), so a campaign
carries a cacheable URL instead of the photo. Missing or altered files are not
substituted. Keep content-addressed files when artwork changes: saved campaigns
may still reference an earlier filename.
