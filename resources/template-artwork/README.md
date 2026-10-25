# Bundled Free photographs

Every photograph Free's designs show, stored once (ADR 0172). A design names one
as `artwork:<sha256>.webp` — an image's `src`, or a background's
`url("artwork:<sha256>.webp")` — and the file here is named by the SHA-256 of
its bytes. `BundledTemplates` resolves each name to this installation's plugin URL
(`BundledArtwork`), so a campaign carries a cacheable URL rather than the
photo; creating or saving one copies it into the Media Library (ADR 0161).

Files are written by `tools/design-library/build/extract-artwork.mjs`, which
re-saves a pasted photo as WebP at the same pixel size, rewrites the design and
deletes any file no design names. Do not edit or add files by hand:
`BundledArtworkFilesTest` checks that every named file exists and is what its
name says, that none is orphaned, and that each has a rights record in
`tools/design-library/publishing/catalog.json` → `image_rights`, keyed by the
same hash. Provenance and generation prompts are in
`tools/design-library/pilot/assets/`.
