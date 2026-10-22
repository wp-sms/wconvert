# Bundled sample photographs

The two JPEG files in this directory are byte-identical copies of `tools/design-library/pilot/assets/citrus-sunrise.jpg` and `trail-window.jpg`. Their names are SHA-256 hashes of their bytes. See that directory's README for generation prompts and provenance. They depict fictional sample objects and a fictional landscape.

`BundledTemplates` substitutes a matching, verified JPEG data URI with this installation's plugin URL when a site loads its bundled library. This keeps binary photos out of campaign JSON and lets the browser cache them. Portable studio and hosted-package exports retain the source bytes; hosted publishing continues through its reviewed asset-binding workflow. Missing or altered files are not substituted. No file is generated and no external request is made during registration.

Retain content-addressed files when updating artwork: existing campaign snapshots may still reference an earlier filename. Use the existing import/media workflow for merchant-owned replacements. The photographs remain public sample artwork, not premium downloadable originals.

## Halloween backgrounds

Three WebP files are exact derivatives of the original Halloween prototype
artwork (`halloween-engraved.webp`, `halloween-monster.webp`,
`halloween-forest.webp` in the design-library asset folder). The forest is shared
by After dark and Midnight flight. `BundledArtwork` also resolves exact raster
`url(...)` values in root, layout and narrow `bg-image` bags. This keeps the
main picture editable in its existing scope and out of visitor JSON; unknown
bytes, gradients and merchant URLs remain untouched. The small pumpkin is an
original inline SVG in the Pro bar, not a remote asset.

Shopping-weekend additions: exact WebP copies of the reviewed shopping still
life and chrome sculpture used by Midnight atelier, Chrome hour and Electric
aisle. Provenance and full prompts are recorded in the catalogue rights map;
source derivatives are under `tools/design-library/pilot/assets/commerce/`.
