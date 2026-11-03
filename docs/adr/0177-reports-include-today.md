# 0177: Reports include today

Accepted 2026-11-01. Amends [0089](0089-analytics-starts-with-impact-and-keeps-history-inspectable.md)
(complete windows), [0092](0092-campaigns-use-a-design-led-workspace-and-compact-masthead.md)
(Campaigns' complete days and "Through yesterday"),
[0132](0132-every-screen-answers-its-first-question.md) decisions 5, 22 and 24,
and [0176](0176-a-new-site-is-guided-to-its-first-lead.md) §4 (the weekly
email's link).

## Context

A tester published a first campaign, saw views on the site, and found Analytics
empty: it opened on the last 30 *complete* days, which end yesterday. Today was
a separate, opt-in choice. "Last 7 days" also meant different days on
different screens: Leads and the editor counted today, Campaigns and Analytics
did not.

## Decisions

1. **Every window includes today, except Yesterday.** Today, This month and
   Last 7/30/90 days run through today so far, on Analytics, the Campaigns
   cards, an Occasion's presets and every report route (`ReportWindow`). The
   admin sends `complete=0`; one day that is not Today is Yesterday, which
   still asks for `complete=1`. This month ends today
   (`StatRange::calendarMonth(…, $throughToday)`), so it is never empty and
   Export CSV is never refused on the 1st. Last month and custom dates that end
   before today are complete, as before. Monthly targets keep reading complete
   days, so pace is never set against a day still running.
2. **"Last %s days", never "complete days".** The labels say the length only.
3. **Every window but Today keeps its comparison** with the same number of days
   before it. The current window holds a partial day, so its change reads a
   little low (at most 1/7 for seven days, about 3% for thirty). One muted line,
   "Includes today so far", sits with the comparison. *(Amended by
   [0185](0185-analytics-reads-at-a-glance.md): the line is gone; "How these
   numbers work" carries the fact, and the chart still marks the running day.)*
   Today alone still has no comparison. A site with nothing earlier shows "Nothing to compare in …", not
   a change.
4. **The chart marks the running day.** Its last segment is dashed and its last
   point hollow, so a partial day does not read as a drop; the point and the
   daily table say "Today so far". *(Amended by
   [0185](0185-analytics-reads-at-a-glance.md): so does the chart's hover.)*
5. **"Today's activity appears tomorrow. Choose Today to see it so far." is
   retired**, with "No complete days yet" and "No complete days yet this
   month". An empty window says "Nothing was shown in this period."
6. **The weekly email still reports 7 complete days**, and its Open WConvert
   button now opens Analytics at that email's exact dates
   (`#analytics?from=…&to=…`), so the numbers match.

## Consequences

- An export taken today grows if it is taken again later today. The file names
  its dates.
- Old links such as `#analytics?days=30` now include today.
- No server cost: the daily counters are written live, with no rollup or cache
  ([0019](0019-analytics-stores-daily-counters-not-events.md)). The site still
  decides which day is today (`StatDay::today()`).
- A/B experiment views read the window selected on Analytics, as before
  (ADR 0089); they have no window of their own.
