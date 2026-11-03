# 0185: Analytics reads at a glance

Accepted 2026-11-03. Amends [0132](0132-every-screen-answers-its-first-question.md)
decision 25, [0177](0177-reports-include-today.md) decisions 3 and 4, and
[0131](0131-one-way-to-show-each-thing-in-the-admin.md) decision 10.

## Context

The overview and the single goal and campaign reports held the right facts but
made a merchant hunt for them. A problem looked like every other card.

## Decisions

1. **A problem card has an amber header.** Needs attention and Sending needs
   attention, including Sending's failed read, take `tone="attention"`: the
   header strip is `--warning-surface`, the card edge and icon well are
   `--warning`, and the rows stay white. The whole card is not tinted, because
   tinting a card that holds several tables and buttons says nothing more than
   the header does and costs the reading of everything in it. This widens amber
   past "the site is holding this back" (§5, §14) to "look here" on these two
   Analytics cards, and their icon well departs from `--secondary` with it.

2. **A switched-off Campaign sales is one closed row.** It starts collapsed when
   tracking is off, including a store that never turned it on, and the period
   has no linked orders. It is the shared `Disclosure`
   ([0131](0131-one-way-to-show-each-thing-in-the-admin.md)) and shows the icon, the
   title, the "Tracking is off" badge and the description. It stays open when
   the period has linked orders and when the site address changed. A read or save
   that failed draws the open region, with no way to fold it over the failure. A
   report too large to total stays open too, because it has not said that nothing
   was linked. A save does not swap the section's shape: turning tracking off keeps
   it open with its confirmation, and turning it on from the closed row keeps the
   row. Focus returns to the button when the save ends, because a busy button is
   `disabled` and cannot hold it; a store's first setup swaps its steps for the
   report, so that button is gone. Each new period or campaign decides afresh. A
   jump opens it first (`ReportTarget`'s `onJump`). This holds on the overview and
   on one campaign's report.

   The closed row draws the region header's icon, type and padding itself, because
   a `Disclosure`'s `summary` line cannot hold an icon and a badge beside two lines
   of text, and its body has no padding, because the region's body brings its own.

   `site_matches` alone cannot mean "the address changed": a store that never
   set up tracking saved no address, so it reads false there as well. Only a
   store with a `since` date counts.

3. **A fall is red, with an arrow.** This reverses the rule that a fall reads as
   neutral text. A change is one shared `ChangeValue`: Lucide's arrow and the
   number in `--success` or `--destructive`, hidden words for a screen reader,
   and "vs previous period" still muted. No change and "New this period" have no
   direction, so they stay neutral with no arrow, and so does a change that
   rounds to 0%. A fall does not mean anything is broken, which is why it stays
   on the figure and does not spread to the card, and the figure is never amber
   (§14). A Needs attention row about a falling rate sits under an amber header
   because the header says "look here", not because the number is held back.
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
   run under a wide plot and three under a narrow one, each at its day's pixel,
   and one fewer where that divides the period exactly: seven days get four dates,
   because five would leave gaps that visibly differ.
   The chart block is `dir="ltr"`, because its date row flipped in right-to-left
   while the line did not, which put the dates on the wrong ends (§15). Each date
   and the tooltip's words take their own direction back, or a Persian date's
   digits split around its month. The drawing
   and tooltip stay hidden from assistive technology: the exact-numbers table is
   that route.

6. **Jump to is one menu in the page header.** A row of its own took height on
   every report and wrapped on a phone. It is now a quiet "Jump to" button, the first
   item in the page's toolbar, on the existing dropdown menu, and choosing a section moves focus
   to that section. The menu earns its place with sections the row lacked: Results
   by goal and Monthly targets on the overview, Performance and Campaigns on a
   report. It lists what is mounted, in the order it stands on the page, and is
   not offered with fewer than two sections.

## Consequences

- A fall now looks like bad news, though a smaller number is not always a fault.
  It stays on the figure, with its number, so it can be read as a fact.
- The Analytics page holds one more shape of a report: Campaign sales may be a
  closed row, so anything that reaches into it has to open it first, through
  `onJump`.
