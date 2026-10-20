# Published design-only gallery — 20 October 2026

The user approved the bundled-only contract and publication in this chat.
**Published on 20 October 2026 at 11:45:34 UTC (15:45:34 Asia/Muscat).**
The website has not been changed.
[Website implementation handoff](WEBSITE-HANDOFF.md).

Published release:
`e03c91ed1bcff606d305e0a796eb750ef8f5f9f97fd308768620b0d9bf6fc68d`.
Private local release directory: `/private/tmp/wconvert-design-only-v1-20261020`.
Do not serve this directory: it has separate public and protected pack objects.

Previous public release, retained unchanged:
`9f070cdd52e29a96240261c3041a91c32269121f235efc51e682a6c8a0646f49`.

## Sources and approval audit

The starting checkout contains an older six-pack plan and 108 bundled designs.
It alone cannot reproduce the live eight-pack release. The complete reviewed
source was found in the clean checkout
`/Users/navidkashani/.codex/worktrees/template-library-refresh/wconvert`,
branch `codex/template-gallery-integration`, commit
`12db4f1b32d610c5297a72db38b63e04b0506676`.
Its sources contain 124 designs and 148 setups; 56 setups have current approvals.
Approval checks were rebuilt against that renderer and hashed review evidence.
No review record was created, weakened or relabelled by this work.

The previous catalogue had 32 designs. Of the 92 absent source designs, 18 have
current setup-bound approval and are included; the other 74 remain unpublished.
The [inventory report](inventory.json) enumerates both groups and exact approved
setup references.

| Format | Previous release | Published release |
| --- | ---: | ---: |
| Floating bar | 1 | 2 |
| Fullscreen | 0 | 2 |
| Inline | 13 | 19 |
| Popup | 15 | 22 |
| Slide-in | 3 | 5 |
| Total designs | 32 | 50 |

The candidate contains 90 screens/outcomes and 50 immutable JPEG thumbnails.
All 32 live design IDs remain. All eight delivery packs retain their exact
hashes, access tiers and bytes. There are still 35 installable setups and six
installation collections.

The 18 additions are `after-hours`, `bar-countdown`, `bloom-postcard`,
`citrus-sunrise`, `collection-poster`, `colour-atlas`, `conversation-note`,
`exhibition-wall`, `gift-orbit`, `measurement-map`, `night-observatory`,
`programme-board`, `project-workboard`, `recipe-clipping`, `room-checklist`,
`supper-menu`, `trail-window` and `weekend-broadsheet`.
They are bundled-only catalogue entries, not new downloadable packs.

## Contract and presentation

[Full contract and migration instructions](../../../tools/template-server/GALLERY-CONTRACT.md).
[Website consumer example](../../../tools/template-server/examples/design-only-consumer.mjs).
[Complete published public response](catalogue-example.json).
The response's production URLs are now published.

- Existing `designs`, full viewers and focused viewers retain their meanings.
- Approved `extensions.schema: 1` adds a separate `bundled_designs` array and
  exact collection membership. Bundle-only entries have `packs: []`, no
  `pack_id`, and accurate tier/prerequisites; they never create public source
  JSON or an artificial installation pack.
- New consumers combine the two arrays and check stable ID uniqueness.
  Existing consumers can still use the 32 pack designs unchanged.
- The original release-ID calculation is preserved. Each packed design carries
  an additive digest committing to the extensions; new validators check it.
  The pre-extension validator from the clean source checkout also accepts the
  final release's original 32-design projection.
- `design_only_embed.version: 1` advertises its own immutable URL, supported
  device values and per-screen URLs. It removes service chrome entirely.
  The website owns the modal, disclosure, screen and device controls.
- Slash-containing screen/result IDs remain opaque URL-encoded fragment values.
  Fragment-only device changes retain the selected screen.
- Transparent canvas, constrained horizontal overflow and vertical/keyboard
  scrolling; disabled sample actions; no parent DOM access or messaging API.
- Exact frame ancestor allowlist: production root, www and
  `https://dev.wconvert-website.pages.dev`. All other restrictions remain.
  A read-only live HEAD check confirms all three are already permitted by the
  deployed service. The local configuration now retains that exact live list.

## Collections and dates

Nine gallery collections are included. Existing six public collections retain
their membership; sale-planning, launch-a-collection and black-friday-2026 are
added to the gallery projection.

Black Friday uses precisely:

| Setup | Design | Stage |
| --- | --- | --- |
| edition-early-access | edition-pass | before |
| first-order-receipt | offer-receipt | during |
| sale-deadline | bar-countdown | during |
| homeware-care-notes | product-shelf | after |

The event family remains `black-friday`. Feature dates are
`2026-10-16` through `2026-12-01` exclusive; event dates are `2026-11-27`
through `2026-12-01` exclusive. These are existing **site-calendar dates** in
the configured WordPress timezone, not UTC instants. A website must explicitly
choose/disclose its own calendar timezone for featuring. No offer, coupon,
countdown deadline or campaign schedule is automatically configured.

## Verification

- 18 publisher, catalogue, preview and website-example tests pass, including
  deduplication, unavailable previews, slash IDs, invalid/missing fragments,
  extension integrity, exact membership and snapshot fallback.
- 46 Worker/service tests pass. The expanded three-origin Worker test also
  passes; malformed origin configuration still fails closed.
- Worker types and TypeScript checks, Wrangler dry-run build, PHP syntax and
  diff whitespace checks pass.
- [Chromium/Workerd acceptance](gallery-acceptance.json): every one of 90
  screens/outcomes at desktop/mobile in the focused viewer (180 checks), plus
  design-only direct selection and fragment-only changes (360 checks).
  Fifteen tall-screen keyboard scroll checks pass.
- Browser-enforced embedding succeeds on all three approved origins and is
  blocked on an unrelated origin. Parent keyboard controls preserve the chosen
  screen. Zero page errors; all HTTPS traffic is intercepted locally.
- Thumbnail hashes and actual decoded dimensions verified for all 50 designs.
  Representative screenshots for popup, slide-in, bar, fullscreen and quiz
  previews were captured; fullscreen mobile, quiz desktop and illustrated
  popup mobile were visually inspected.
- Shipping PHP catalogue/pack readers accept the complete generated release.
  A disposable WordPress 7.1.3 / PHP 8.1.34 with WooCommerce installs all eight
  unchanged packs: 32 designs, 35 setups and six installation collections.
  Illustrated updates reuse artwork and preserve original snapshots;
  installed designs remain available offline. Premium uses local fixtures,
  not new live licensed requests. No persistent site settings/campaigns changed.
- The existing remote publication CLI's dry run accepts the candidate: 168
  public objects, four protected objects. It makes no network writes.

The native installation check used the earlier candidate with identical pack
bytes; the final change only preserved the legacy catalogue integrity algorithm.
Browser and inventory evidence refer to the final release above.

## Reproduction and publication boundary

Use the complete reviewed source checkout; the older current source is
deliberately refused by the new gallery plan when approvals/designs are absent.

```sh
node tools/design-library/build/publish-local.mjs \
  --source-directory /Users/navidkashani/.codex/worktrees/template-library-refresh/wconvert \
  --gallery-plan tools/design-library/publishing/gallery.json \
  --directory /private/tmp/wconvert-design-only-v1-20261020 \
  --origin https://templates.wconvert.io \
  --expected e03c91ed1bcff606d305e0a796eb750ef8f5f9f97fd308768620b0d9bf6fc68d

node tools/template-server/scripts/verify-gallery.mjs \
  /private/tmp/wconvert-design-only-v1-20261020 \
  docs/reviews/design-only-gallery-2026-10-20
```

For a new empty output directory, use `--expected none`. The expected value above
is the **local directory's** pointer, not the live release.

## Publication

The user approved the exact candidate and bundled-only contract. A fresh
[prepublication audit](prepublish-inventory.json) confirmed the previous live
release still matched the baseline and the candidate still preserved all eight
pack hashes and all existing IDs.

A read-only backup of all six retained releases was saved outside the web root:
`/Users/navidkashani/.local/share/wconvert/backups/before-design-only-2026-10-20`.
It contains 112 public and four protected objects, 5,520,070 bytes, with restricted
filesystem permissions. It excludes licences, grants and Worker secrets.

The [publication result](publication.json) records conditional promotion and
exact manifest read-back: 129 public objects created, 39 reused, four protected
objects verified. Existing releases and assets were retained. No Worker was
redeployed; no licence configuration, privileges or website code were changed.

## Live verification

[Boundary evidence](live-boundaries.json) records 14 real HTTPS checks:
anonymous GET/HEAD for every protected pack/image returns 401 with
`private, no-store`; the public premium-image alias and private/source paths
remain unavailable; unsupported queries return 400. The exact three-origin CSP,
scripts-only sandbox, blocked forms and disabled connections remain intact.
The previous sidecar's parsed content is unchanged, and a previous focused
preview still matches its content hash.

[Live browser/service evidence](live/gallery-acceptance.json), completed at
11:49:58 UTC, confirms 50 designs, all five formats, nine gallery collections,
50 decoded thumbnails and every immutable dependency's hash, cache and HTTP
validator behaviour. All 180 focused screen/device checks and 360 design-only
selection/fragment checks passed, with 15 keyboard-scroll checks and zero
preview page errors. Browser enforcement admitted all three approved parent
origins and blocked an unrelated origin.

The browser also fetched the **actual staging website** (HTTP 200), inserted a
temporary iframe only in that disposable browser, and loaded the live coffee
quiz outcome `match/explore`. Mobile/desktop changes retained that outcome;
parent access to the preview DOM remained blocked. The
[staging screenshot](live/live-staging-embed.png) was visually inspected.
This verifies the deployed website's ability to embed the live service; it does
not deploy or implement the website modal migration. The other parent-origin
checks use synthetic parent documents with real live service responses.

[Native HTTPS evidence](live-wordpress.txt): disposable WordPress 7.1.3 /
PHP 8.1.34 installed all five Free packs from the published release: 22 designs,
25 setups and two verified images. All three premium packs refused unlicensed
access. Offline recovery passed. No persistent site settings or campaigns were
changed. This is a real HTTPS-to-WordPress check, without a live licence; it
does not claim a new licensed premium installation.

[Final manifest check](live/final-manifest.json) confirms the approved release
remained current after verification. No backend contract/publication approval
is outstanding for this release.

Website migration is now the remaining consumer task. Use the
[handoff](WEBSITE-HANDOFF.md). Keep reviewed snapshots on every host until the
website migration is deployed; afterwards retain them for unavailable-service
fallback. Without a matching reviewed snapshot or usable design-only preview,
keep the catalogue page and show preview preparation. Never substitute the old
green focused viewer.

The 74 remaining unapproved designs need their normal editorial/visual/journey/
WordPress reviews before any later publication.
