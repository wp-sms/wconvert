# Dark designs get a close X and error that fit them (ADR 0159 follow-up)

Five dark designs kept the default white circle X and pink error box after
PR #315. Each now uses the bare X in its own text colour (pointing at `fg`,
so it follows a theme) and, where it has a field, a light-red error on a
dark ground tinted from its background (8.1–8.4:1).

- **quieter-frequency** (maker-notes): bare round X; error `#ffb1a8` on `#3a2533`.
- **after-hours** (listening-night-invitation): bare square X in the neon text
  colour, matching the square design; no field.
- **bar-code**: bare X on the indigo bar; error on `#33204a`.
- **ribbon-tag**: bare X on the green bar; error on `#352525`.
- **slide-in-nudge** (seasonal-service-link, return-policy-guide,
  series-start): bare X on navy; no field.

Setups re-reviewed: each one's only change is the X (and the error where it
has a field); words, layout and journey are unchanged. The X reads clearly on
every screen at 320 and 1440.

Collection **useful-store-details** holds maker-notes; its design pin moved to
the new quieter-frequency file. Items, order and words are unchanged.

Evidence: `results.json` (setup checks, 10/10), `<id>-320.png` /
`<id>-1440.png`, `designs/` (real WordPress, all five designs at 320 and 1280:
X styled, visible and closes; error coloured with a matching ring),
`close-reserve.json` (bar-code, ribbon-tag, slide-in-nudge: 0 overlaps,
0 overflows).
