# Complete hosted collection discovery — 22 October 2026

The installed-only restriction was real: the catalogue reader removed uninstalled
members, and the creation browser then intersected collections with local setups
for the selected Goal. The reader now returns public metadata for every published
member, including locked Pro designs. Hosted collections open with all stages,
Goals and formats represented. The local setup gallery and bundled collections
retain their existing matching behavior.

Cards show a public preview, format, Free/Pro badge and campaign Goal. Install adds
the exact setup and pinned design; Use creates an unpublished draft for that
member's Goal. Bundled usable copies offer Use immediately. Locked Pro cards link
to the public design page and never fetch a Pro tree. Installation does not change
membership. Failures stay beside the card with a retry, and ambiguous draft
creation directs the merchant to check campaigns rather than silently repeating it.

## Real WordPress evidence

Verified on a disposable WordPress 6.8.3 / PHP 8.1 site, with the actual Free and
Pro admin builds. The normal harness boots the plugins; the hosted-template
fixture was deliberately excluded, so no hosted design was injected as installed.
The catalogue came from the live HTTPS server. No merchant site was changed.

- `fresh-free.json`: before any installation, all 20 members were present: 5
  installable Free and 15 locked Pro, with no local setup identities.
- The Free test installed Acid markdown and created an offer draft after entering
  from the email Goal. A final browser assertion initially used the wrong editor
  URL, then the wrong list field for draft state; these were test-harness errors.
  The final run additionally installed The early list, verified that installation
  created no campaign and kept all 20 cards, then explicitly created an email draft.
  `free.json` records the final run (Acid markdown was already installed).
- `pro.json`: all 15 Pro members resolve to their existing bundled Playbooks and
  offer Use without another download. Using Midnight atelier from the email Goal
  created an unpublished offer draft. The two Free setups installed during the
  earlier checks remain usable; the other three remain downloadable.
- Inspected `free-desktop.png`, `free-phone.png`, `pro-desktop.png` and
  `pro-phone.png`. The collection shows 20 cards; all preview images loaded.
  At 390px, the dialog content is 356px wide with no horizontal overflow. Search,
  wrapping format controls, single-column cards and the footer remain reachable.
  Desktop uses a three-column grid at 1440px. No browser errors occurred.

Licensed Pro object downloads were not needed or tested: these 15 designs already
ship in Pro. The existing server release
`26b88f20bbe723dfe7e023d50a847399b728bed1cee1617582db7991f932d903`
already contains all 20; no server republish or storage change was needed.

## Automated checks

- Full PHP suite: 3,633 tests / 21,014 assertions passed. The subsequently added
  bundled-copy regression also passed; final catalogue run: 26 tests / 109 assertions.
- Full JavaScript suite: 259 files / 4,669 tests passed. Final discovery/creation
  regressions, including refresh before install: 67 tests passed.
- TypeScript, targeted ESLint and PHPStan passed; both admin builds, admin bundle checks and the source contract passed.
- Regression coverage includes discovery without downloads, unchanged membership
  after install, Pro metadata without trees, withdrawal, local bundled reuse,
  all 20 across Goals, download failure/retry, explicit draft creation using the
  selected member's Goal, and catalogue refresh exposing collections before install.

The earlier installed-only review in
`../shopping-weekend-2026-10-22/collection-review.md` is superseded for discovery.

## Pre-merge review follow-up

The two-axis review found no spec mismatch and two standards issues, both fixed:
the runtime expiry statement in ADR 0104 now distinguishes captures from offers,
and collection browsing respects the server's Pro-hint opt-out/capability decision.
Normal Free administrators and active Pro sites retain all 20 members; restricted
or opted-out Free users see Free and already usable entries with matching counts.
The focused discovery/creation suite now passes 68 tests; TypeScript, ESLint and
both admin builds passed. `pro-hints.json` records the actual WordPress check for
normal Free (20), opted-out Free (5), and active Pro (20).
