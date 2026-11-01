# 0180: Display rules and Destinations share one width

Accepted 2026-11-01. Amends [0038](0038-the-admin-holds-different-floors-to-the-loader.md)
(the builder's 90rem cap, for these two tabs).

## Context

The editor's three tabs had three widths: Edit full width, Display rules
centred only above 1440px, Destinations centred at 64rem. Switching tabs moved
the page's edges.

## Decision

**Edit stays full width. Display rules and Destinations are one centred column
at the app's reading measure** (`--wconvert-measure`, 72rem), with the same
padding. The leftover two-pane grid on `.wconvert-workspace__secondary` and the
per-tab overrides are gone; Display rules keeps its menu-and-section grid and
its 68ch sentence. Form fields keep their own widths, so inputs do not stretch.

## Consequences

Destinations is 8rem wider than it was; Display rules is narrower on screens
wider than 1152px plus padding.
