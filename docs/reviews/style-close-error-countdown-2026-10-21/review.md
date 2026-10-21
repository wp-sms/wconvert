# Designs style the close control, error and countdown (ADR 0159)

Five designs opt into the new close and error tokens; every other setup was
carried by `templates:visual-diff` as pixel-identical with the close control, a
refused field and a painted countdown drawn (152 setups, 9 Collections; see
`docs/reviews/visual-diff-2026-10-21/`).

Changed designs, judged from a contact sheet of every dark and photo design
with the shipping close control and a refusal drawn:

- **changelog** (release-notes-signup): bare square × in the text colour; error
  light red on a dark red-tinted ground (8.6:1). The white circle and pink box
  read as pasted onto a terminal card.
- **ticker-line**: the same for the bar; the × keeps its centred bar position.
- **deadline-panel**: bare square × on the black card; no field.
- **last-call** (final-hours-sale): bare square ×, dark error, and the countdown
  drawn as boxes. The Playbook supplies the four unit words through the new
  `countdown_units` Role, translatable. Days hide at zero.
- **lookbook** (early-access-launch): a soft dark disc with a white × (the
  photograph sits under it on a phone); error unchanged on the light card.

Setups re-reviewed:

- final-hours-sale: boxes read as the clock at 320 and 1440; × and error fit the
  black card; journey unchanged.
- early-access-launch: disc visible over the photograph and on the cream panel.
- release-notes-signup: terminal look now consistent through the × and error.

Evidence: `results.json` (setup checks, 6/6), `<id>-320.png` / `<id>-1440.png`,
`designs/` (real WordPress, all five designs at 320 and 1280: × styled, visible
and closes; error coloured with a matching invalid ring; boxes tick),
`close-reserve.json` (every bar and slide-in, 0 overlaps, 0 overflows).
