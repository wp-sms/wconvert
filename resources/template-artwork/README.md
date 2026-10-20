# Bundled sample photographs

The two JPEG files in this directory are byte-identical copies of `tools/design-library/pilot/assets/citrus-sunrise.jpg` and `trail-window.jpg`. Their names are SHA-256 hashes of their bytes. See that directory's README for generation prompts and provenance. They depict fictional sample objects and a fictional landscape.

`BundledTemplates` substitutes a matching, verified JPEG data URI with this installation's plugin URL when a site loads its bundled library. This keeps binary photos out of campaign JSON and lets the browser cache them. Portable studio and hosted-package exports retain the source bytes; hosted publishing continues through its reviewed asset-binding workflow. Missing or altered files are not substituted. No file is generated and no external request is made during registration.

Retain content-addressed files when updating artwork: existing campaign snapshots may still reference an earlier filename. Use the existing import/media workflow for merchant-owned replacements. The photographs remain public sample artwork, not premium downloadable originals.
