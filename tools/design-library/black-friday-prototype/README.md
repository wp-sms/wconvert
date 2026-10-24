# Black Friday and everyday campaign handoff

Fifty explicitly authored native compositions based on the approved local
prototype revision 7.1: 35 Black Friday and 15 evergreen campaigns. The frozen
reference files retain the approved copy and source provenance; their HTML is
never imported or rendered in the plugin.

`author.mjs` records the initial implementation; do not rerun it over shipped
designs. `node tools/design-library/black-friday-prototype/refine.mjs` applies
the explicit fidelity corrections to that frozen baseline while preserving
existing leaf identities. `artwork.mjs` renders the original decorative vectors. `php tools/design-library/black-friday-prototype/author-playbooks.php`
extracts repeated copy roles through the shipping SlotRoles extractor.

After release, preserve leaf identity when editing an individual tree; do not
renumber its shipped leaves by blindly rerunning the initial authoring script.

Build and inspect with:

    bash tools/design-library/build.sh renderer library-review pilot vocabulary
    node tools/design-library/build/batch-audit.mjs black-friday-and-everyday

Original raster assets are WebP derivatives under `pilot/assets/black-friday/`;
original drawing sources are kept alongside them. Their digest-keyed rights
records are in `publishing/catalog.json`. See `reference/ASSETS.md` for origins.
Bebas Neue and Cormorant Garamond preview fonts include their OFL licences.

The portable native trees, not this tool or its reference HTML, are the product.
Coupon values and shop links must be configured by the merchant. Countdown
setups require a real end date; examples never imply stock or order activity.

Run `FIDELITY_PHASE=after node tools/design-library/black-friday-prototype/compare.mjs`
with the approved prototype at port 8846 to capture all fifty desktop/phone
comparisons. The reference stays unchanged. See ADR 0168 and the fidelity review
for editor adaptations and real WordPress checks.

Run `node tools/design-library/black-friday-prototype/check-cta.mjs` against the
rebuilt studio (port 9458 by default) to check the fifty default button labels
at eight widths in both reading directions. This complements the longer-copy
layout checks; custom merchant labels can still wrap.
