# 0187: The way back and a section title read with their page

Accepted 2026-11-03.

On an Analytics report the back link sat about 9px right of the page title and stood 48px tall. "Submissions" read loosely too: a 20px title, a description, then about 45px of empty space before the table.

The link's slot was inside `.wconvert-page-actions`, so the heading's toolbar rules reached it. Their `padding-inline: 18px !important` defeated `PageBack`'s `-ms-3` and their `min-block-size` overrode its height.

## Decision

**The way back is outside the toolbar.** The Shell's slot for `PageBack` is above `.wconvert-page-actions`, so a heading's date picker and Export centre on the title block alone. `.wconvert-page-back` offsets the link's 12px padding and the 3px inside the arrow glyph with a logical margin, so the arrow's edge sits on the title's in both directions. `BackLink` in the builder's skeleton is outside the toolbar and keeps its own rule.

**A section title holds a tip, not a description.** On a report the row is `.wa-section-heading` holding `.wa-section-title`: the title and an `InfoTip` side by side, at any width. The title-to-table gap is the heading's 14px. `.wa-campaigns` drops its top margin after a heading, because the two margins would collapse to 18px.

- The Submissions-style report title keeps `impact.note` in the tip, labelled "About Submissions" as the overview's card is.
- The A/B report keeps its eyebrow. "They do not prove a winner" moves to the tip, because the choose-a-winner dialog still says it where the decision is made (`optins/decisionCopy.ts`) and each comparison line says "too early to call" or "still not proof".

**`RegionHeader` takes `tip`.** It wraps the words in an `InfoTip` beside the title, labelled `About <title>`. A title's trigger takes -6px of block margin everywhere, so its 32px target does not make the line taller. This is the rung of [ADR 0136](0136-one-panel-grammar.md)'s ladder for a region.

## Consequences

Nothing outside Analytics uses `RegionHeader`'s `tip` yet. The admin copy pass moves descriptions into it.
