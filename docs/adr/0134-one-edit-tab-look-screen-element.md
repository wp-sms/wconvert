# 0134: One Edit tab: look, screen, element

Date: 2026-10-09. Status: accepted; built in phases.
Amends [0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md)
(the element panel and its breadcrumbs) and
[0108](0108-explicit-journey-graph-and-legacy-migration.md) (its words).
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

### Still to land

The single Edit tab, the left tree with its pinned Look row, the screen panel's
**Then →**, the Look panel and one Preview button (phase 2); plain style
controls with exact values under Advanced, and the fitted Flow map (phase 3).
Each extends this ADR when it lands.
