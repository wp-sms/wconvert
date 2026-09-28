# Editor style contracts audit — 28 September 2026

## Findings and repairs

1. **Route cards lost their CSS after a visibility wrapper was added.**
   `.wconvert-journey-routes > ol` no longer matched the real DOM. WordPress/browser
   decimal markers appeared alongside custom priority badges; row borders,
   spacing and padding disappeared. Both graph and legacy route lists now own an
   explicit `.wconvert-journey-routes__list` class. Priority remains visible once,
   with an unnumbered fallback. List semantics are retained explicitly for WebKit.
2. **Native button defaults were stronger than component styles.** The
   `.wconvert-journey-settings button:not(...)` reset removed borders and padding
   from “Used by” navigation cards and next-screen controls. The element portion
   now uses `:where()` so component geometry wins. “Used by” title/context is grid
   stacked, with long-word wrapping.
3. **Disclosure geometry was inconsistent.** Route and contact-field cards now
   use the same 16px chevron; route headers have a fixed badge column, a flexible
   wrapping label and a fixed indicator. Expanded route content has its own
   inset and divider; actions are separated from the final row.
4. **Some card interactions still lacked feedback.** Add-screen type cards and
   grouped follow-up rows now have hover/focus treatment. Result-card feedback
   also differs from its expanded state. Existing disabled and destructive
   treatment stays in place.

Updated `tools/design-system/GUIDELINES.md` §21 and the editor presentation
contract in ADR 0108. Rules cover component-owned selectors, low-specificity
native defaults, semantic lists, spacing, type roles, disclosure icons, reflow,
interaction states and real-browser evidence. This is a clarification of the
existing shared design system, not a new visual direction.

## Browser evidence

Separate audit tab; no campaign saved or published. Temporary long-label edits
were discarded. Existing user tabs/drafts were not refreshed or changed.

- Original reproduction: list computed as `block` with decimal markers; both
  rows had 0px border and padding. Fixed: grid, no markers, 12px gap; 1px card
  borders and 12px summary padding.
- Branch + fallback, expanded condition editor, and single continuation checked.
  At 320px, route rows were 269px wide with equal scrollWidth; page width and
  scrollWidth were both 320px. Enter collapsed the disclosure and retained a
  visible 2px keyboard outline.
- “Used by” computed padding restored to 8px 10px and border to 1px; title and
  context occupy separate grid rows. Result summaries retain 12px padding.
- A contact label containing a 108-character unbroken word wrapped inside a
  267px card; scrollWidth remained 267px and chevron remained 16px.
- Display rules (schedule/limits and summary) fit 320px without horizontal
  overflow. Add destination modal was 286px wide with equal scrollWidth.
- Add screen modal was also 286px; all four type cards fit its 232px inner
  width. Keyboard focus showed the accent background and a 2px outline.
- Theme & layout mobile settings sheet was 294px wide with equal scrollWidth.
- Demo 04 grouped follow-ups and its custom-routing disclosure were also checked.
  The revealed route list retained its grid/no-marker styling inside the wrapper,
  with width and scrollWidth both 341px.

## Verification and limits

TypeScript and touched-file ESLint passed. Existing stylesheet contracts,
journey editor, simplification and repair suites: **600 tests passed**. Free and
Pro admin builds passed with the existing bundle-size warnings. `git diff
--check` passed. No new shallow source assertions were added: the reported
cascade/layout defect was verified in actual WordPress, which jsdom cannot
measure.

This samples the affected shared components; it is not a claim that every
campaign, translation, viewport or third-party admin stylesheet was audited.
VoiceOver and a live RTL browser pass remain unverified. GitHub CI was not run.
