# 0181: A loading screen is one static shape

Accepted 2026-11-01. Amends [0060](0060-a-screen-is-four-situations-and-they-are-answered-the-same-way.md)
§1 (the delay, the announcement and the loading column of its table) and
[0039](0039-a-screen-is-regions-and-scope-decides-placement.md) (a loading
state "carries a short delay").

## Context

Splitting the admin by section (#397) put a Suspense fallback in front of every
screen while its code downloads, then the screen's own loading state while its
first read is in flight. An audit drew both against the loaded screen. Most did
not match: Campaigns' skeleton cells sat a column left of their headings, the
builder's header and panes moved about 45px, Leads gained filters above a bare
table, Analytics swapped one region for a card grid, Settings swapped a card for
a rail and a column and remounted on every category, the occasion page grew a
line and two regions, and License read "Loading loading license……". Every bar
pulsed, on a hover colour that vanished on the canvas; first fills waited 160ms
before drawing anything; and status text was visible on some screens and not on
others.

## Decision

1. **One component per screen is both the chunk fallback and the screen's own
   first-load state.** It lives in an eager file outside the chunk, the section
   draws it as its fallback and the screen imports it back. Any CSS it needs is
   eager CSS. `tests/js/loading-handoff.test.tsx` asserts the fallback's markup
   appears in the screen's own loading markup.
2. **Placeholders are static** — no pulse — and one colour, `--skeleton`, a step
   darker than `--surface`. No screen sets its own.
3. **A first fill paints at once; only a re-read waits 160ms.** The delay is the
   caller's `wait` flag (or a `Reread` boundary around a swapped column), off
   by default.
4. **Status is screen-reader only**, one `role="status"` per region naming the
   concern. A skeleton header reserves the loaded header's icon, description
   line and action.
5. **Settings keeps its rail mounted.** Only the group's column is keyed, so a
   category click swaps one column rather than the page.

## Consequences

Leads' and Analytics' filters, toolbar and page actions arrive with the first
read rather than before it. The builder's frame (workspace box, header band,
Edit pane widths as `--editor-tree` / `--editor-panel`) and the analytics
overview's frame moved into eager CSS. The header's notices are cached outside
the component, so a remounted frame keeps its badge.
