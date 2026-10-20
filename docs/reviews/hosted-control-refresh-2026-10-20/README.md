# Hosted preview refresh — 20 October 2026

Published from merged main commit `959c3f52facc6f4ae119157feca26fa59261f7b1` (PR #300).

## Live release

- Current: `359f655d63d6c070eed1266a7a0fc43a57d80ebb8270745f0920c814051172bb`
- Previous, retained: `7a6c87a5c2b8d70a9e068420dd9b003a0e5f586344e707a874de0c321c687c59`
- Six existing packs, 20 designs, 23 setups, three complete hosted collections.
- All six pack JSON payloads and both image assets are unchanged. Six preview HTML files, a catalogue page and release manifest are new. Pack versions did not need artificial bumps.
- Publisher created eight objects, reused 22 public objects and verified three private objects before conditionally promoting the release. No objects were deleted. No Worker or Nexus configuration was changed.
- Old preview URLs deliberately keep their previous content. New URLs are listed in `release.json`.

## Checks completed

- Local release rehearsal: four Free packs, two anonymous premium refusals, six public previews, one public image, 16 Free setups.
- Disposable WordPress local installation: all six packs, 20 designs, 23 setups; illustrated-pack image reuse, saved snapshots and offline operation passed. Premium packs in this test came from explicit local filesystem fixtures.
- Live HTTPS verification: expected release and hashes, all four Free downloads, six previews and public image passed. Both premium downloads refused anonymous access.
- Disposable WordPress live installation: all four Free packs, 13 designs, 16 setups, image retrieval and offline recovery passed. No persistent user site options or campaigns changed.
- Visually inspected all 36 public screens/results at desktop and phone sizes, including multi-step and quiz result screens. `screens.json` records 72 live screenshots with viewport and page-overflow checks. Desktop viewport was 1280px; phone viewport was 390px with a 320px template preview frame. No clipping, overlaps or horizontal page overflow found in these captures.

## Scope and limits

This publication refreshes the existing hosted packs' previews using the merged renderer. It does not publish additional studio batches or overwrite installed campaigns. Plugin runtime close controls and the phone library require the updated plugin; the static hosted previews intentionally disable form controls and do not render that runtime shell. Commerce previews retain explicit product placeholders until a merchant chooses their products.

No fresh licensed premium success request was sent to Nexus for this publication; anonymous refusal was verified live, and protected payload bytes are unchanged. No real email/SMS delivery or CI was run. The existing wider review backlog was not re-approved by this publication.

The adjacent logs contain the publication, local rehearsal and live installation results. `release.json` maps all previous/new preview links; `screens/` contains the original full-page captures.
