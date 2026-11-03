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

2. **A switched-off Campaign sales is one closed row.** It starts collapsed when
   tracking is off, including a store that never turned it on, and the period
   has no linked orders. It is the shared `Disclosure`
   ([0131](0131-one-way-to-show-each-thing-in-the-admin.md)) and shows the icon, the
   title, the "Tracking is off" badge and the description. It stays open when
   the period has linked orders, when the site address changed, and when a read
   or save failed; a report too large to total stays open too, because it has
   not said that nothing was linked. A save never swaps the section's shape:
   turning tracking off keeps it open with its confirmation, and turning it on
   from the closed row keeps the row, with focus on the button. A jump opens it
   first (`ReportTarget`'s `onJump`). This holds on the overview and on one
   campaign's report.

   `site_matches` alone cannot mean "the address changed": a store that never
   set up tracking saved no address, so it reads false there as well. Only a
   store with a `since` date counts.
