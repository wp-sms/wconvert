# 0134: One Edit tab: look, screen, element

Date: 2026-10-09. Status: accepted; built in phases.
Amends [0039](0039-a-screen-is-regions-and-scope-decides-placement.md) (the tab
count), [0065](0065-the-editor-is-the-scope-editor-now.md) (where the theme
picker lives), [0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md)
(the element panel, its breadcrumbs, Layers),
[0107](0107-forward-journey-paths-and-flow-editor.md) (the Journey tab),
[0108](0108-explicit-journey-graph-and-legacy-migration.md) (its words) and
[0131](0131-one-way-to-show-each-thing-in-the-admin.md) §5 (the tab names).
Plan: [docs/plans/editor-ux-2026-10-09.md](../plans/editor-ux-2026-10-09.md).

A UX review of the campaign editor found that clicking an element stacked seven
panel layers, that the same words were editable in three places, and that the
editor's words were its own ("Everyone else", "save point", "Quiet text",
"Custom routing…") rather than a merchant's. The approved prototype answers
with one Edit tab — a left tree, the canvas, and one side panel that is the
Look, a screen or an element.

## Decisions so far

### Plain words (D6)

One word list, in `CONTEXT.md`: **Look · Screen · Path · Follow-up question ·
Show only if… · Form · All other answers · Then**. In the journey sense,
connection, branch and route are **path** — Connection stays the credentials
term. "Everyone else" is **All other answers**; "save point" and "Saved with"
are **Form** and **Saved by**; a path's priority is its **top-to-bottom
order**. Labels read Lighter text, Image box, Button color, Center and
Start/End; strings are US English. The admin tests read their label fixtures
from `TemplateLabels::all()` (`tests/fixtures/template-labels.json`, pinned by
`TemplateLabelsFixtureTest`), so a renamed label cannot leave a test behind.

### The element panel is the whole panel (D2)

When an element is open, the side panel shows that element only: "← <screen>",
its icon and name, then Content | Style. Breadcrumbs remain only for layout
boxes nested inside the screen. Questions get the element panel too. The
screen panel names its screen inline, keeps Duplicate · Move up · Move down ·
Delete in one ⋯ menu (a delete confirms in a dialog that says what stays), and
says "When submitted · Save the lead" on a form screen. Which form a submit
button saves is chosen on that button's own panel.

### One Edit tab (D1, D4, D5)

The builder has three tabs: **Edit · Display rules · Destinations**. Screens and
Design were one campaign drawn twice — a list you could not see and a canvas
you could not reorder — so Edit is one left tree, the canvas and one side panel.

- **The tree** (`EditTree`). A pinned **Look** row first, with the palette's
  dots and "Colors, fonts, <format> position". Then the screens, each with its
  "Only if …" and its issue count from the one list (ADR 0133); the open screen
  unfolds into its elements, with the move, copy, delete and add controls the
  Design tab's Layers had (`useBlockEdits`, `ScreenElements`). "Reopen button"
  and "Locked content preview" are rows of the tree, not entries in a screen
  dropdown. **+ Add screen** is one menu: Message · Question (locked on Free) ·
  Follow-up question · Optional signup, and "Let answers choose the next
  screen" — the old Add screen dialog and "More screen options" folded in. The
  Free seven-screen cap holds.
- **The panel is one of three**, in this order: the Look while it is open; the
  element while one is selected; otherwise the screen. Clicking the empty stage
  around the design opens the Look. Narrow (≤1000px), the three columns are
  three panes — Screens · Preview · Edit — and a tree row moves to the pane that
  shows what it opened.
- **The Look** (`DesignSettings`): ready-made looks, the design's colors and
  fonts, format and position, the reopen button, then the design's name and
  "Browse designs and formats". An inline or content-lock campaign states
  "Where on the page: …" and links to Display rules, which owns placement.
- **The screen panel is what only a screen can answer** (`ScreenPanel`). Its
  issues; **Then →** — read-only on Free and for a screen whose answers decide
  ("Depends on the answer · Edit paths on the question"), a select on Pro that
  rewrites the screen's default edge, upgrading a straight campaign to a graph
  the first time one screen chooses its own next; on the first screen, "When it
  opens", linking to Display rules; **Show only if…** on any other; the
  **Form** section on a form screen — each field a link to its element with a
  Required box, "When submitted · Save the lead" and "Where leads go"; and
  "On this screen", its elements as chips. The column of text boxes repeating
  every word on the screen, "What happens to answers here?", "Next: …" and
  "Open Design" are gone: the element panel and the Look already hold them.
- **A question's paths live on the question.** The question element's panel is
  its settings plus "Where visitors go next" (send some answers down another
  path, per-choice "Goes to", "+ Follow-up question"). The journey editor owns
  the dialogs those open, so it provides that panel by context
  (`QuestionPanelContext`) and the element inspector draws it.
- **Flow only where there is more than one way through** (D4).
  `hasManyWaysThrough` is true for an answer or hidden edge, a screen with a
  condition, a v2 screen with more than one path, or a screen with more than one
  result. A v3 graph that is still a straight line is false: upgrading is not
  branching. Only then does the canvas bar offer Canvas | Flow, and a Flow view
  falls back to Canvas the moment the last branch goes.
- **One Preview**, a menu of the one dialog's modes: As a visitor · This screen
  · Try answers (when there is a question), plus **Test a visit**, which moved
  out of Display rules. "Preview & test" and "Check the design" are gone.
- **The goal sits under the campaign name** and opens Change goal; Campaign
  details keeps analytics and developer tools.
- The canvas bar holds the device switch, fit and fullscreen, with the hint
  "Click anything on the <format> to edit it". Its "Desktop" label repeated the
  switch beside it and is gone.

Two items of the plan landed differently. Add screen has no separate **Form**
and **Offer** entries: a form is the Optional signup or a Message with fields
added, and an offer is a Message with a link button, so two more entries would
be the same screens under other names. The theme palette is still drawn inside
the Tokens section rather than as its own section ahead of format and
position; phase 3's plain style pass reorders Tokens anyway.

### Still to land

Plain style controls with exact values under Advanced, and the fitted Flow map
(phase 3). It extends this ADR when it lands.
