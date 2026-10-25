# 0172: Bundled photos are stored once, as files

Accepted 2026-10-25. Amends 0156 §13 and 0161.

## Context

A bundled design carried each photo as a base64 data URI. 55 Pro and 6 Free
designs did, and so a Pro design reached 880 KB, one step 2 preview request
for three cards weighed 1.5 MB, and the Pro templates folder was 9.9 MB.
`BundledArtwork` swapped a data URI for a plugin URL when a file with the same
bytes existed, but only 13 of the 57 photos had one, so most photos were
stored twice or not as files at all.

## Decision

1. **A bundled design names its photo; it does not hold it.** An `image`
   node's `src` is `artwork:<sha256>.webp`, and a background is
   `url("artwork:<sha256>.webp")` — the `url()` stays, so `DesignImages`
   still sees a picture in its own scope. The name is the file's SHA-256.
   SVG decorations stay inline: they are drawing, not photos.
2. **The bytes live once, in the ZIP that ships the design**:
   `resources/template-artwork/` for Free and
   `pro/resources/template-artwork/` for Pro, the folders `TemplateMedia`
   already trusts (ADR 0161).
3. **`BundledArtwork` resolves the name.** `forSite()` makes it the plugin
   URL; `inlined()` (and `forSite()` with no plugin URL) writes the file back
   as a data URI, so the studio, the exporter and every CLI tool draw exactly
   what they drew before. A missing file throws, and `BundledTemplates` and
   `ProTemplates` leave that one design out, as they do an unreadable file;
   the rest of the library still lists. The bytes are checked against their
   name wherever they are read — `inlined()`, and `TemplateMedia` when a
   campaign adopts or exports a photo — rather than hashing every photo on
   every request that lists designs. A broken ZIP is never a picture to
   guess. `tools/design-library/build/artwork-files.mjs` is the JavaScript
   twin; studio tools that draw designs read them with `pictures: true`.
4. **Photos are optimised once, at authoring time.**
   `tools/design-library/build/extract-artwork.mjs` finds every raster data
   URI in a Free or Pro design, re-saves it with `cwebp -q 75 -m 6` at the same
   pixel size (a PNG is a drawing, so lossless or `-q 90`, whichever is
   smaller, since its smooth gradients band at 75; a WebP kept as it was where
   re-encoding would not shrink it), writes the file, rewrites the
   reference, moves the `image_rights` record (and any `artwork_exports`
   declaration bound to that slot) to the new hash and deletes the artwork
   files nothing names. Everything is encoded before anything is written, and
   a GIF or AVIF stops the run with a message to re-save it. An author pastes
   a photo, runs it, and commits. The first run took 57 photos from 4.0 MB to
   1.9 MB.
5. **Hosted designs are out of scope.** They never ship in a ZIP, and the
   exporter already sends their pictures as separate catalogue assets.
6. **`BundledArtworkFilesTest` guards it**: no bundled design holds a raster
   data URI, every named file exists in its own ZIP and is what its name
   says, no artwork file is orphaned, and every photo has a rights record.

## Consequences

- New bytes are new asset ids, so every design that shows a photo, and every
  setup and Collection that uses one, has a new catalogue revision. Their
  approvals were carried, not re-decided, after every screen was compared with
  `main` (`docs/reviews/artwork-files-2026-10-25/`). The next catalogue
  release re-renders their thumbnails; the server keeps every old asset.
- A campaign created before this keeps working only if it was saved after
  ADR 0161, which copies its photos into the Media Library. One that still
  points at a deleted artwork file shows a broken image until it is saved
  again. Pre-release, so nothing migrates it.
- `LibraryLintTest` measures a design as a site gets it: a URL where the photo
  was, which a page payload no longer pays for.
- Export reads a bundled photo through `TemplateMedia`, so an unsaved draft on
  a Pro photo design exports its bytes; it could reach only Free's folder.
- Four photos had no rights record. Three were recorded from
  `pilot/assets/README.md`; the checker strip in
  `campaign-black-friday-fast-lane` has no written provenance, so its record
  does not assert redistribution and that design stays out of the catalogue
  until a person records where it came from.
