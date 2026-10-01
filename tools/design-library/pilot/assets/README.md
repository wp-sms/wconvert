# Original pilot artwork

Both SVG illustrations were authored for WConvert on 28 September 2026. They contain original geometric shapes, no third-party images, fonts or trademarks, and use the repository GPL-2.0-or-later licence. The corresponding design JSON carries the same artwork as an editable image source. Botanical window and Portrait frame supply descriptive alt text. Replace the image in the builder to use merchant photography. These are illustrations, not customer photographs or endorsements.

## Homeware shelf — downloadable pack source

`homeware-shelf.svg` is the original geometric artwork previously embedded in the repository's `product-shelf.json` (before commit 88ab08c). Extracted without changes on 1 October 2026. It contains only original paths, rectangles and ellipses: no external images, fonts, trademarks, scripts or remote references. The repository's GPL-2.0-or-later licence permits redistribution of this source and its raster derivative under that licence.

`homeware-shelf.png` is its 1920 × 500, 8-bit PNG export using resvg-js (no external resources or metadata). The bundled design retains its compact SVG to respect campaign payload budgets. The publishing plan explicitly maps the exact source URI hash to this separately reviewed PNG and its evidence hash; the publisher exports those bytes as an immutable asset. Keep the SVG as the editable source. Do not silently re-export the PNG during builds: a changed image requires a new source/design review and rights hash.

The illustration depicts a terracotta pot, cream vase and green cup. It illustrates care notes, not products offered for purchase or customer endorsements. The Playbook asks merchants to replace it if it misrepresents their collection. Provenance/redistribution approval is keyed to its exact SHA-256 in `publishing/catalog.json`.
