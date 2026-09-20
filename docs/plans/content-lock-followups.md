# Remaining content-lock and placement work

20 September 2026. Follow-up plan after the reviewed divider/sidebar changes.
This document records work to schedule; it does not authorize implementing every
item or publishing a release. The user authorized merging the reviewed changes.
See [the validation report](../reviews/2026-09-20-content-lock-followup.md) and
[the original plan](165-inline-content-locking.md) for completed behavior.

## Next: documentation and real use

1. **Write the short user guide in `docs/guides/content-lock.md`.** Link it from
   the README. Explain when to choose Lock from here versus Content lock, how to
   publish/select a Campaign, where to write, and how to test in a private window.
   Include one screenshot per block, the static-block compatibility limits and
   the readable-fallback behavior. Keep technical implementation details out of
   setup steps. Reuse the guide on the future website; add a public help link only
   once that page exists. Done when a new author can complete setup from the guide.
2. **Observe authors using real articles.** Cover an existing long article, a new
   article, and a bonus followed by a public conclusion. Ask an editor to select
   a Campaign, move the boundary, change the selection and remove the lock. Record
   hesitation, errors and unexpected public/locked content. Turn observed problems
   into focused fixes; do not add a new block based only on hypothetical demand.

## Before release: accessibility and supported versions

3. **Complete manual accessibility and device checks.** Test keyboard focus after
   Change/Clear/Cancel, screen-reader labels and reveal announcements, 200% zoom,
   RTL, a physical phone, long Campaign names and repair warnings. Include both
   the article editor and visitor form. Automated 420px keyboard and browser tests
   already pass; these manual checks cover what those tests do not establish.
4. **Resolve the minimum WordPress version claim.** Reproduce the existing
   WordPress 6.2 activation/dependency limitation recorded in ADR 0100, decide
   the supported floor, and align dependency versions, metadata and documentation.
   Verify activation and authoring on the chosen minimum and current WordPress.
   Do not broaden the compatibility promise from newer-version tests alone.
5. **Run release checks when a release is requested.** Exercise all packaged Pro
   tiers and readable behavior without Pro, then verify published-page caching
   and the chosen delivery providers with explicitly authorized test recipients.
   The current PR merge is separate from publishing plugin releases.

## Parked until evidence justifies them

| Candidate | Revisit when | Decision needed before implementation |
|---|---|---|
| Optional end marker | Authors repeatedly need a public conclusion and struggle with the bounded section | Whether to consolidate the two workflows; define missing, duplicate, moved and nested marker behavior |
| Automatic article-remainder locking | Publishers need the same boundary across many posts | Paragraph-count semantics, exclusions, preview/inspection and a safe article-only boundary |
| Groups, Columns, synced patterns and third-party blocks | Real content requires specific unsupported blocks | Validate each complete subtree and its dynamic behavior before extending the shared compatibility schema |
| Unlocking unrelated Campaigns or across devices | A defined account/library use case exists | Identity, consent, access scope and expiry; the current browser/Campaign receipt stays unchanged |
| Scroll mat/page push, toast, tab or badge | Merchant evidence establishes a gap in the existing formats | Evaluate a preset/placement first; specify a new Display Type only if needed |

The last row is the remaining unchecked category on roadmap issue #165. Its
fullscreen, automatic inline placement, widget placement, reopen-button and
initial content-lock tasks are already merged. Do not reopen those implementations
or start all lower-priority formats together.

## Recommended order

User guide, observed author sessions, focused fixes from those sessions, manual
accessibility/version validation, then release preparation when requested.
Revisit parked features only after those steps provide evidence for them.
