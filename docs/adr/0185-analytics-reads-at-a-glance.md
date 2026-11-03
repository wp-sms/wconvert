# 0185: Analytics reads at a glance

Accepted 2026-11-03. Amends [0132](0132-every-screen-answers-its-first-question.md)
decision 25.

## Context

The overview and the single goal and campaign reports held the right facts but
made a merchant hunt for them. A problem looked like every other card.

## Decisions

1. **A problem card has an amber header.** Needs attention and Sending needs
   attention, including Sending's failed read, take `tone="attention"`: the
   header strip is `--warning-surface`, the card edge and icon well are
   `--warning`, and the rows stay white. The whole card is not tinted, because
   tinting a card that holds several tables and buttons says nothing more than
   the header does and costs the reading of everything in it.
