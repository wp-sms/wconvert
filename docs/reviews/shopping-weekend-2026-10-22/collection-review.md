# Black Friday & Cyber Monday collection — 22 October 2026

The catalogue-only collection groups the twenty approved shopping-weekend designs in prototype order. All source hashes match the current setups and designs, including the field/background fidelity corrections. Its metadata and references stay out of both ZIPs; the existing fifteen Pro designs remain in Pro and the five Free designs remain hosted-only.

Four signup setups use the before stage; sixteen offer setups use during. There is no invented after-sale stage. Six offers contain a real countdown tied to the merchant's campaign end date. The description asks the merchant to configure their own discount, coupon, shop link and end date.

Inspected the final collection card in the collection studio: the two-line title, short explanation and configuration reminder remain readable without clipping. `collection.png` records that candidate before approval. `collection-discovery.json` records the shipping discovery model: twenty members with Pro, five usable Free members, featured from 16 October through 30 November inclusive, absent from the featured shelf on 15 October and 1 December. The event runs 27–30 November; it does not schedule a campaign.

Member-level WordPress and visual evidence remains current: `results.json` covers all twenty designs at desktop and phone widths, `journeys.json` covers their routes, `countdowns.json` covers all six clocks, and the alignment review covers the latest five corrections. Collection membership changes none of those rendered sources. Native hosted discovery and the live release are checked separately after publication.

The publisher now supports `catalogue_only` editorial metadata so this mixed Free/Pro collection is served as a complete online collection rather than bundled as a partial list. Collection tests cover exclusion from bundled snapshots, preservation of hosted membership and rejection of accidental bundled copies. Existing collection checks and reviews remain current.

Validation: all 90 design-library tool tests passed, including hosted delivery and stale approval regressions. All eleven collections have current approvals. Catalogue revision and source-contract checks passed. Both final ZIP artifact contracts passed; `collection-packaging.json` confirms fifteen designs in Pro, none of these twenty in Free, and no bundled collection snapshot.

## Live publication

Published release `26b88f20bbe723dfe7e023d50a847399b728bed1cee1617582db7991f932d903` to `https://templates.wconvert.io`. The previous release remains retained. An initial R2 read failure left its pointer untouched; after inspecting status, immutable files were read twice with bounded parallelism and publication resumed through the repository's unchanged conditional publisher. The final pointer was read back successfully.

`server-release.json` records byte-exact live HTTPS checks for 569 public files, all twenty new design/setup entries, ten Free design/setup downloads, and thirty anonymous Pro refusals with private responses. No live design was removed or downgraded. Existing catalogue entries were retained.

`collection-wordpress.json` records a real WordPress catalogue refresh from the live HTTPS server (91 designs, no skipped entries) and successful installation of all five Free setups. The native picker returns the collection with those five installed setup references; no campaign was created or changed. **Historical verification, superseded by the collection-discovery fix below:** the then-existing hosted-collection behavior listed installed online setups, not every remote member or a matching bundled Playbook. Thus the live catalogue/website has all twenty members, while the editor's collection grows as its online setups are installed. That installed-only behavior was subsequently corrected; see the collection-discovery review. Licensed Pro downloads were not exercised; their anonymous protection and the fifteen native Pro designs were checked separately.

Inspected `collection-wordpress-desktop.png` and `collection-wordpress-phone.png`: the title, description, dates and matching-setup count fit the native card at 1440px and 390px. The phone shelf scrolls horizontally as designed and its controls remain reachable. Opening the card in the offer goal lists the three installed Free offers; the other two installed members belong to email signup. Counts reflect the chosen goal, not all catalogue members.

## Collection discovery follow-up

The installed-only and selected-Goal restrictions above are superseded by [the full collection discovery review](../collection-discovery-2026-10-22/review.md). Hosted collections now expose all published members before installation, with Free/Pro labels and separate Install/Use actions. The published server release already contains all twenty members; this follow-up changes the plugin reader and browser.
