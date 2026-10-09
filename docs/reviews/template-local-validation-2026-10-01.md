# Final local validation — 2026-10-01

- Full PHP suite: 2,404 tests / 14,491 assertions pass.
- Full JavaScript suite: 194 files / 3,516 tests pass.
- Studio/publisher suite: 32 tests pass, including public result variants and unchanged-pack reuse when previews change.
- PHPStan (1 GiB), TypeScript, ESLint, Free/Pro admin builds and whitespace checks pass.
- 93 designs survive registration unchanged. Five runtime collections match current approved source/reviews.
- Browser studio audit: 1,784 screen cases, zero layout findings. See useful-differences-layout-2026-10-01.txt. This is a geometry check, not a substitute for accessibility/user research.
- New design base-palette contrast: specification-sheet text 14.59:1, muted 6.20:1, button 11.40:1, input border 3.79:1; excerpt-window text 11.96:1, muted 7.22:1, button 8.97:1, input border 3.83:1. Both designs' complete screens inspected at 768/320px and RTL. Original review candidates remain outside hosted release selection.
- Actual wconvert.local: excerpt empty-required-email/failure/retry/acknowledgement checked with simulated answers; comparison setup mobile/details checked; temporary occasion saved, Find ideas opened the matching reader collection, then temporary occasion removed. No campaigns or Leads created. Existing settings retained. The site uses +00:00 and correctly receives no country guess.
- Browser testing exposed and fixed HTTP-incompatible randomUUID and date input submission losing uncommitted native values; submit now reads named form controls. A separate shadow-host width issue was caught in the public showcase; a wrapper now enforces the 320px mobile frame.
- Public showcase Free/Pro screens and mobile controls inspected. Countdown is explicitly illustrative, never a live campaign deadline.
- Native WordPress 7.1 / PHP 8.5.8: isolated release preview/install/offline lookup passed (10 designs, 13 setups, 2 collections). Bounded HTTP media import, integrity, immutable archive and offline reuse passed with intercepted requests and disposable files.
- Local release `218b78faaf715b975da5f2105c6aac595b5c05faff6ad6ded1a5d85e6aeb734e`; repeat publication creates 0 objects / reuses 8. Unchanged pack JSON is reused. No production hosting or licence adapter configured.

Real provider delivery, CI, production hosting and real licence-manager integration remain deferred by the user. Source SVG conversion/rights and site-specific link support still gate three previously deferred release selections. The two new designs are available for local review; they have not been promoted into the approved hosted selection.
