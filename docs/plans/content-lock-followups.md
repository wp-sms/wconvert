# Remaining content-lock and placement work

20 September 2026. Follow-up plan after the reviewed divider/sidebar changes.
The reviewed divider/sidebar changes were merged in PR #182. The subsequent
user request authorized the guide, writing-workflow checks and accessibility/
compatibility review using Sol (high) and Luna (xhigh). Release publication and
parked features remain separate work.
See [the merged validation report](../reviews/2026-09-20-content-lock-followup.md) and
[the original plan](165-inline-content-locking.md) for completed behavior.
This follow-up records [browser QA](../reviews/2026-09-20-content-lock-browser-qa.md)
and [normal activation compatibility](../reviews/2026-09-20-content-lock-compatibility.md).

## Next: documentation and real use

1. **Guide complete:** [Content lock setup](../guides/content-lock.md),
   linked from the README, with one screenshot per block, setup/testing steps,
   supported content and readable-fallback guidance. Validate its clarity with a
   content writer using the session below. Reuse it on the future website; add
   a public help link only once that page exists.
2. **Author feedback deferred at the user’s request.** If revisited, observe
   authors using real articles. Cover an existing long article, a new
   article, and a bonus followed by a public conclusion. Ask an editor to select
   a Campaign, move the boundary, change the selection and remove the lock. Record
   hesitation, errors and unexpected public/locked content. Turn observed problems
   into focused fixes; do not add a new block based only on hypothetical demand.
   The [human-check script](../reviews/content-lock-human-checks.md) provides
   tasks and success criteria. Automated article scenarios do not complete an
   observed session with a content writer.

## Before release: accessibility and supported versions

3. **Complete manual accessibility and device checks.** Test keyboard focus after
   Change/Clear/Cancel, screen-reader labels and reveal announcements, 200% zoom,
   RTL, a physical phone, long Campaign names and repair warnings. Include both
   the article editor and visitor form. Automated 420px keyboard and browser tests
   already pass. This follow-up fixed focus loss when Change/Clear/Cancel or a
   selection replaces a picker control, and moves focus into settings when
   Choose Campaign opens the sidebar or expands a collapsed settings panel.
   The human-check script retains actual
   screen-reader, browser zoom and physical-device checks; automated semantics
   and emulation do not establish those outcomes.
4. **WordPress minimum aligned to 6.8.** Free, Pro and readme metadata
   now match the bundled Action Scheduler requirement. A packaging guard catches
   future dependency/header mismatches. See the
   [compatibility review](../reviews/2026-09-20-content-lock-compatibility.md).
   Committed directly to local `main` at the user’s request; release publication
   is separate.
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

Review the guide and automated findings, complete the remaining manual
accessibility checks and publish the WordPress minimum correction,
then prepare a release when requested.
Revisit parked features only after those steps provide evidence for them.
