# Native 200% zoom walkthrough

September 26, 2026. Local WordPress, Chrome on macOS, unpublished repair fixture
`01M3EJK75SA40GBH933WRCHBMC`.

This used Chrome's native zoom, not viewport emulation or CSS zoom. The native
toolbar reported **Zoom: 200%**; `devicePixelRatio` changed from 2 to 4 and the
CSS viewport from 1511px wide to 755 × 633px. Page-level shortcut simulation
did not change zoom; native Chrome keyboard input did.

## Finding and fix

At that size, Journey's fixed-height workspace squeezed the map between the
header/context and controls until only a small strip remained. The existing
minimum map height applied below 600px, while the stacked workspace starts at
800px. Aligned the scroll/minimum-height rule with that 800px breakpoint and
allowed the header to wrap. Afterward the map canvas measured 315.8 CSS pixels
high, the workspace scrolled vertically (426px client / 749px content), and
the document had zero horizontal overflow. Guidance remains available.

## Tasks exercised

- Created an offer screen at a selected insertion point through Add screen.
  The insertion dialog and controls remained usable at 200%.
- Cleared its name with keyboard input, opened Review & publish, selected the
  named blocker, and verified focus returned to Screen name. Undid both the
  rename and insertion.
- Used Screens inventory to select How you brew, added a second answer path,
  and activated Higher priority with Enter. Filter moved before Espresso in
  the visible ordered controls. Undid the reorder and temporary path.
- Opened Test journey, chose Espresso, reached its repaired result branch,
  continued to optional email and chose No thanks. The enlarged result and
  diagnostics were usable with their own scrolling. Escape closed the dialog
  and returned focus to Test journey.
- Entered Focus journey, opened a nested Add offer screen dialog, and pressed
  Escape. The dialog closed, Focus journey remained active, and Add screen
  regained focus. A second Escape exited focus mode and returned focus to
  Focus journey.
- Save draft was disabled after Undo restored the saved campaign; no temporary
  zoom edits were saved or published, and Test journey made no real submission.

Chrome was restored to **Zoom: 100%** (`devicePixelRatio: 2`, viewport width
1511px), and the temporary Chrome tab was closed.

This verifies native zoom, the listed interactions and their focus transitions.
It is not a VoiceOver walkthrough or a user study. VoiceOver verification is
pending explicit permission to enable the macOS setting temporarily.
