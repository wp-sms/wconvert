# New designs batch: seven setups

Agent review, 21 October 2026. The designs were approved by the owner in the
preview artifact (version 4) before authoring. Machine checks: `results.json`
(six capture setups, 320 and 1280 px, all passed) and
`finish-the-set-commerce.json` (WooCommerce product page). Contact sheets:
`<id>-320.png` and `<id>-1440.png`. Standing limits are in
`tools/design-library/review/README.md` and are not repeated here.

The two hosted setups (`release-notes-signup`, `bakery-first-loaf`) ship in
neither ZIP (ADR 0157). On the disposable site, `tools/visual-tests/mu/hosted.php`
composes them into the libraries as an installed catalogue setup would be; the
release check installs them for real.

- **final-hours-sale**: the countdown reads first at both widths and the code
  only appears after signup. The countdown is empty until the merchant sets the
  real end date, and the notes say so. Exit intent is a Pro rule, which matches
  the design's tier.
- **early-access-launch**: on desktop the wordmark aligns with the top of the
  photograph and the button with its foot; at 320 the headline holds two lines.
  The acknowledgement claims a request, not access.
- **monthly-planting-letter**: the plate and the form are matched cards on
  desktop; at 320 the plate comes first and the form follows without crowding.
  The success card spreads its message to match the plate's height.
- **new-batch-first-look**: the close control sits in its own band above the
  print at every width. The caption and the acknowledgement fit their lines at
  288 px.
- **finish-the-set**: on a real product page it showed the fixture's products,
  added one to the basket (server-confirmed, basket count 1) and did not
  overflow at 320. It needs a main product and the merchant's picks before
  publishing, which `FreshSetupTest` lists as an expected merchant choice.
- **release-notes-signup**: monospace headline and list keep their lines at 288
  after the phone retune; fine print reads as comments without losing
  contrast. One email per release, and the words do not promise more.
- **bakery-first-loaf**: the photograph leads on phone and fills its pane on
  desktop; the code screen keeps the photograph so the success step reads as
  the same card. The notes ask where the code works.
