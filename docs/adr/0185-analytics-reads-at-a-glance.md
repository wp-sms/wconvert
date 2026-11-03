# 0185: Analytics reads at a glance

Accepted 2026-11-03. Amends [0132](0132-every-screen-answers-its-first-question.md)
decision 25 and [0177](0177-reports-include-today.md) decisions 3 and 4.

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

3. **A fall is red, with an arrow.** This reverses the rule that a fall reads as
   neutral text. A change is one shared `ChangeValue`: Lucide's arrow and the
   number in `--success` or `--destructive`, hidden words for a screen reader,
   and "vs previous period" still muted. No change and "New this period" have no
   direction, so they stay neutral with no arrow, and so does a change that
   rounds to 0%. A fall does not mean anything is broken, which is why it stays
   on the figure and does not spread to the card, and it is never amber (§14).
   The Rate tile gains its own change in percentage points, and shows nothing
   when either rate is missing.

4. **"Includes today so far" is removed from every report.** It stood above each
   period ending today, which is nearly every period, and so it said nothing on
   any of them. The fact moves to a "Today" entry in "How these numbers work";
   the chart's dashed last segment stays, and its hover and table still say
   "Today so far".

5. **The chart draws in real pixels and reads one day at a time.** It was a fixed
   960-wide drawing scaled to a 190px-tall box, so a wider panel left empty space
   on both sides and a phone shrank its text. A `ResizeObserver` now measures the
   plot, the line and gridlines reach both of its edges, and the text keeps its
   size. A pointer snaps to the nearest day (`nearestDay`) and shows a hairline, a
   dot on each line and a tooltip with the date and value, the previous date and
   value when comparing, and "Today so far" on the running day. A tap does the
   same and `touch-action: pan-y` leaves scrolling to the browser. About five dates
   run under a wide plot and three under a narrow one, each at its day's pixel.
   The chart block is `dir="ltr"`, because its date row flipped in right-to-left
   while the line did not, which put the dates on the wrong ends (§15). The drawing
   and tooltip stay hidden from assistive technology: the exact-numbers table is
   that route.
