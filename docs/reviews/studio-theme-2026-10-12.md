# Internal studio interface — 12 October 2026

The internal tools now read the shipping admin palette directly: espresso
structure, warm-white canvas, ink-blue/ice selection and citron active navigation.
DM Sans comes from the plugin's licensed assets with hashed filenames. A shared
stylesheet covers Campaigns, Collections, Roadmap, Library review, Gallery,
Workbench, Flagships and Starting points. Native template shadow roots retain
their own varied palettes; no design JSON, renderer or release preview changed.

The browser pass caught and corrected legacy muted-text token collisions,
unequal field heights, pale field borders, missing mobile viewport metadata,
a missing basket-goal label and a clipped desktop-width preview on phones.
The workbench starts at 320 on a phone. Campaign inspection fits the selected
viewport without rewriting its layout width. Only its body scrolls; the header
and Close stay reachable. Escape returns focus to the invoking card.

Verification:

- `node tools/visual-tests/studio-chrome.mjs`: 32 page/viewport checks (eight pages
  at 1440, 768, 390 and 320) and four dialog interaction checks passed. No page
  overflow or browser errors. Screenshots were visually inspected.
- The measurements check light-DOM text contrast, field outline contrast,
  matching toolbar/context field heights, desktop/phone switching and preview
  fit, scrolling, Escape and focus return.
- Computed colours inside rendered template shadow roots match with the studio
  theme enabled and disabled. This tests isolation rather than approving the
  template designs themselves; older stale approvals remain stale.
- All 38 studio/export tests, ESLint for the affected build/browser tools and
  `git diff --check` pass. The commerce editorial gate remains 6/6 current.

The report is `studio-theme-2026-10-12-report.json`. Representative rendered
screens are alongside it with the same prefix (pilot, dialog, collections and
workbench). These checks concern local authoring UI, not hosted release or
external delivery. The existing draft PR remains unmerged, and CI is skipped.
