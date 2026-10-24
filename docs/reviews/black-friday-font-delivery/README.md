# Local font delivery evidence

These four captures tested the real visitor payload on the disposable WordPress
at `http://127.0.0.1:9462`, with Google Fonts disabled and without injected
catalogue fonts. `visitor-fonts.json` records actual loaded FontFace entries,
node styles, successful local responses and absence of Google requests.

This is delivery evidence captured before the final visual refinements, not the
final composition review. In particular, Private Preview initially requested
Cormorant. Inspecting the approved prototype revealed an invalid unquoted
`Serif` font-face name; its actual letters were the browser's Times fallback.
The four corresponding designs now explicitly request Times to match that
approved rendering. The local Cormorant family remains available in the editor.

The final desktop and phone comparisons are under
`../black-friday-wordpress/`. See ADR 0169 for the font contract and licenses.

`admin-fonts.json` separately proves that the ordinary admin document declares the
local faces and loaded its DM Sans variable face. Its setup preview was still
loading at capture time, so it does not prove a completed heading render.

The later local `wconvert.local` setup-picker review visibly completed both
Extra-Ten Coupon and Savings Receipt previews. Their screenshots are
`../black-friday-wordpress/local-shoe-mobile.png` and
`../black-friday-wordpress/local-receipt-mobile.png`. The local admin document
also declared all four faces from this plugin's `resources/template-fonts/`
directory. These UI screenshots establish completed local preview appearance;
the loaded-FontFace and HTTP delivery measurements remain in the visitor evidence.

After installing the final reviewed catalogue, the local setup picker also
completed Private Preview with the final VIP backing and local typography.
`../black-friday-wordpress/local-installed-preview.png` records that preview.
The all-50 installed/source comparison is recorded separately in
`../black-friday-wordpress/local-installed-check.json`.
