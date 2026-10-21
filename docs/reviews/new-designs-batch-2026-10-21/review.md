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
  publishing, which `FreshSetupTest` lists as an expected merchant choice. One
  campaign covers one product's page (ADR 0120 product context); the notes say
  so. The fixture supplies two items, so two cards show here.
- **release-notes-signup**: monospace headline and list keep their lines at 288
  after the phone retune; fine print reads as comments without losing
  contrast. One email per release, and the words do not promise more.
- **bakery-first-loaf**: the photograph leads on phone and fills its pane on
  desktop; the code screen keeps the photograph so the success step reads as
  the same card. The notes ask where the code works.

## Fidelity against the approved preview

The preview was drawn by the shipping renderer from the draft trees, so the
repository files reproduce it: 31 of 47 screens were pixel-identical after
authoring. Every difference from the approved version 4 (also listed on the
preview, version 5):

- Split proportions snapped to the vocabulary the catalogue accepts (ratio
  0.35/0.5/0.65, basis 12/16/20rem): lookbook 0.62→0.65, field-guide 0.46→0.5,
  tasting-card 0.48→0.5, big-number 0.38→0.35, glacier 0.42→0.35 and basis
  14→12rem, ticker-line 0.4→0.35, ribbon-tag 0.45→0.5 and basis 22→20rem.
- ticker-line's prompt is `›`: the catalogue refuses `<` and `>` in text.
- lookbook: body "See the new collection a day before everyone else."; 2rem
  phone headline.
- changelog: padding 2rem→1.5rem and a 1.25rem phone headline.
- polaroid: caption "New from the kiln", success "Your first-look request is
  in.", consent "Email me about new batches."
- product-trio: products block targets the product page being viewed; body
  "Add any of them from here."
- The close control is the shipping one (centred on wide bars; on bars and
  slide-ins it gets room only beside the lines it would cover).

## Evidence index

- `results.json`: setup-checks, six capture setups at 320 and 1280 (12/12).
- `finish-the-set-commerce.json` (+ desktop/phone PNGs): real product page,
  addition server-confirmed, close, both widths.
- `designs/results.json` (+ PNGs): every design except product-trio published
  from its library entry on the disposable WordPress at 1280 and 320: renders
  in its real container, close control covers nothing (text-line measure),
  acknowledgement after a real submission, close closes; glacier is inline.
- `close-reserve.json`: `tools/visual-tests/close-reserve.mjs`, every bar at
  320 to 1440 and every slide-in at 288 to 416 px, both directions, own and
  longer copy.
- `catalogue-gates.json`: near-duplicates, contrast against the pixels behind
  each text (photographs included, so the picture and frosted-panel contrast),
  copy lint and literal colours for the twelve designs.
- `release-check.json`: the local release, the hosted designs' objects under
  `public/v3/designs`, and `bin/verify-template-release.php` on a Free-only and
  a Pro with WooCommerce site.
- `collections-carry.md`: why the nine Collections were carried.
