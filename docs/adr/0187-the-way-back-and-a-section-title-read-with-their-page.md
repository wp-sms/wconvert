# 0187: The way back and a section title read with their page

Accepted 2026-11-03.

On an Analytics report the back link's arrow sat 9px right of the page title, in a 48px box. "Submissions" read loosely too: a 20px title, a description, then about 45px of empty space before the table.

The link's slot was inside `.wconvert-page-actions`, so the heading's toolbar rules reached it. Their `padding-inline: 18px !important` defeated `PageBack`'s `-ms-3`, and their `min-block-size` overrode its height.

## Decision

**The way back is outside the toolbar.** The Shell's slot for `PageBack` is above `.wconvert-page-actions`, so a heading's date picker and Export centre on the title block alone. `.wconvert-page-back` offsets the link's 12px padding and the 3px inside the arrow glyph with a logical margin, so the arrow's edge sits on the title's in both directions. `BackLink` in the builder's skeleton is outside the toolbar and keeps its own rule, so its arrow sits 3px further in.

**A report's title holds a tip, not a description.** `ReportTitle` is `.wa-section-heading` holding `.wa-section-title`: the title and an `InfoTip` side by side, at any width.

- The title is `body` at 600, the look of "Results by goal" on the overview, not `section` at 20px. It introduces one table under a 36px page title.
- The gap to the table is the heading's 14px. `.wa-campaigns` drops its top margin after a heading, because the two margins would collapse to 18px. "Campaign contributions" on a goal's report matches that rule and moves from 18px to 14px too.
- The Submissions-style report keeps `impact.note` in the tip, labelled "About Submissions" as the overview's card is.
- The A/B report keeps its eyebrow. Its whole description moves to the tip: that the results cover the selected dates, including past uses of each design, and that they do not prove a winner. The second fact stays at rest in the comparison line ("too early to call" or "still not proof") and in the choose-a-winner dialog (`optins/decisionCopy.ts`).

**`RegionHeader` takes `tip`.** It wraps the words in an `InfoTip` beside the title, labelled `About <title>`, with the same -6px of block margin. This is the rung of [ADR 0136](0136-one-panel-grammar.md)'s ladder for a region. The builder's panels keep `PanelSection`'s tip and its smaller trigger.

## Consequences

Nothing uses `RegionHeader`'s `tip` yet. The admin copy pass moves descriptions into it.

jsdom cannot see any of this geometry, so a test only pins where the link and the tip are. The sizes were measured on WordPress.
