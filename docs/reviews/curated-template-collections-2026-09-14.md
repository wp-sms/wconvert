# First curated catalog collections

## Scope

PR #153 merged the local pack installer. The next authorised step packages
existing reviewed designs into store, publisher and service collections, using
placeholders and mainly code-based verification. No new templates, renderer
changes, UI changes, paid entitlement or hosted deployment are included.

The collection membership is defined once in
`tools/template-catalog/collections.json`: three store designs, four publisher
designs and three service designs. All ten are Free and are copied unchanged
from the current bundled JSON. Source fingerprints require explicit review when
a source changes; versioned outputs cannot overwrite an existing release with
different bytes. Builds validate all packs before writing and switch the index
only after package files exist.

Photo offer is excluded because it embeds an SVG image, which v1's empty-media
contract rejects. Cart setup is not represented as a downloadable design feature.
The original installer sample stops appearing in a freshly built index, but its
existing installed copy and source baselines remain available. Bundled designs
remain available too; installing a collection adds independent versioned copies.
This release packages designs, not the associated Playbook targeting/setup.

## Verification

The build and integration tests exercise all three generated packages through
the shipping catalog, validator and installed library. All ten preserve source
JSON, normalized copy, layout, leaf identities, tokens and mobile overrides;
editor snapshot preparation matches the bundled original. Tests also cover
hashes, preview without installation, offline installed access, deterministic
rebuilds and refusal to replace a conflicting release before changing the index.

Real local WordPress verification used WP CLI and the authenticated REST routes:
refresh over HTTP, preview/install all collections, retrieve every picker tree,
prepare ten drafts, save a style edit and read it back for each. All temporary
drafts were removed. All six original Optins remained unchanged; no campaigns
were published and no leads or external messages were created. The three
collections remain installed locally for user review.

Packaging preserves the exact designs covered by the earlier responsive review;
no new browser walkthrough was needed. This is source/layout parity evidence,
not a fresh visual or accessibility audit, and later artwork needs its own review.

Full local results: 1,863 PHP tests / 8,812 assertions, 2,314 JavaScript tests
across 95 files, PHPStan, all 50 bundled template registrations and the source
contract passed. GitHub Actions remains subject to the account billing block.

Two Luna Extra High reviews identified missing index-limit/unique-ID guards and
partial-file recovery in the build tool. These are addressed: definitions are
checked before output, and both packages and index are atomically renamed from
temporary files. The final three focused release tests / 88 assertions and
PHPStan pass; the generated package bytes are unchanged by these build fixes.

## Next

Review and merge the collection build, then upload its generated static JSON to
the chosen HTTPS catalog host when available. Keep the local source meanwhile.
Paid packs, media installation and downloadable campaign setups remain separate
slices. Add new compositions only when a useful gap is identified.

## Pack-panel scrolling follow-up

The live dialog clipped the second row of packs and ignored wheel scrolling:
its outer flex layout hides overflow, while the pack section had no scrolling
container. Give that section a zero minimum height, automatic vertical scrolling
and contained overscroll. The header/source tabs remain fixed; both the list and
preview actions use the same scroll area.

The original wheel-scroll reproduction failed before the fix and reached the
last two pack cards afterward. A long Fieldwork preview also scrolled to its
bottom action. This narrow live browser check changed no draft. Pack/picker tests,
TypeScript, ESLint and both Free/Pro admin builds passed. JSDOM does not perform
layout, so a class-name assertion would not test this regression; the recorded
before/after interaction is the layout verification.
