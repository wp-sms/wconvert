# Everyday, extraordinary — 50-template prototype

Status: implemented as native templates and reviewed on WordPress. The local catalogue release is validated; the live template server has not been updated.

## Run and review

From the plugin root, run `npm run prototype:fresh50`, then open
<http://127.0.0.1:5195/>. The existing prototype on 5193 is untouched.

Open a card for paired desktop and mobile previews. Switch between 390px and
320px mobile widths, inspect the acknowledgement, or submit example details.
The bottom selector and arrow keys move between all 50 concepts.
Countdown designs also have a **Preview expiry** control.

Direct routes: `?variant=01` for the comparison view,
`?render=01` for the standalone native view, and `?variant=01&screen=ack`
for its acknowledgement. Use the gallery filters for theme, format, plan or clock.

## Design direction

The question: can 50 evergreen concepts offer useful variety without depending
on custom layout CSS, uneditable typography, or fake product capabilities?

The collection spans bakery notes, furniture previews, local guides, studio
enquiries, books, learning resources, independent shops, travel and everyday
wellbeing. It combines editorial spreads, graphic posters, a book shelf, a
workshop calendar, a care label, menu panels, a voucher and expressive characters.
The strongest departures from the previous seasonal batch include 02, 13, 14,
22, 28, 30, 35 and 50. Smaller formats deliberately have quieter compositions.

- 17 popups, 14 inline designs, 6 slide-ins, 5 floating bars, 8 fullscreens.
- 38 form designs with an acknowledgement; 12 direct content/offer designs.
- 10 countdown designs, tied to one fixed demonstration end date rather than
  resetting whenever a visitor reloads.
- Commercial split: 35 Pro / 15 Free.
- Collection: **Everyday, extraordinary**, with all 50 discoverable before
  installation. Free entries are hosted individually, not bundled.

The gallery's different themes are filters within this collection. Its source,
member revisions and approval record are included in the native handoff.

## Editor fidelity

`designs.mjs` creates native v2 trees. The preview imports the shipping renderer
and its stylesheet directly, including the fullscreen surface decorator.
There is no design-specific CSS replacing the editor's layouts. The surrounding
gallery, mock website, display-type placement, thumbnail scaling and demo
interactions are prototype code and should not be shipped with the templates.

All headlines, offer copy, labels, consent text and codes are native editable
nodes. The 17 artwork files are replaceable images, with no baked-in campaign
text. Subject illustrations use contain sizing; the travel panorama intentionally
crops as a background-like editorial strip. Narrow token bags provide explicit
spacing and typography adjustments. Consent aligns with the first text line.

The native handoff registers these trees with hosted artwork, matching setups,
final tiers and a collection. Editor and visitor rendering were verified in
WordPress. Merchants still configure their destinations, URLs, coupons and
deadlines. The prototype alone does not establish subscription or delivery.

## Interaction boundaries

Forms validate required fields and visible marketing consent, then show a local
acknowledgement. Nothing is submitted, saved or sent. Codes copy real sample text
to the clipboard. Enquiry acknowledgements do not claim a confirmed booking.
Resource actions open a clearly marked local sample dialog; they do not deliver
a complete guide. Shop/event links show their intended action without navigation.

All clocks use **31 October 2026, 20:00 UTC** as an explicit example deadline.
Expiry clamps to zero and disables offer/signup actions; close remains available.
Refresh does not reset the deadline. Real offers, terms, dates, resources and
destination URLs must be configured for each campaign before use.

## Review evidence

`review/` contains the inventory, browser captures and review records:

- Native registration verifier: all 50 trees survive registration intact.
- Entry and acknowledgement layout measurements at 1000px and 320px: 176 states,
  with no detected horizontal overflow or missing images. Screen-reader-only
  1px labels are intentionally excluded from visible-text overflow checks.
- All 38 forms exercised through submit to acknowledgement in the browser.
- All 10 countdowns exercised through expiry in both comparison frames.
  Inline design 38 intentionally has no overlay close button.
- Coupon copy checked against the clipboard; resource dialog, gallery filters
  and screen switching checked through the browser.
- Computed foreground/background text contrast checked on all 50 entry layouts.
  This is a focused check, not a claim of complete accessibility certification.
- The standalone Vite build passes; artwork is included in its output.

The prototype itself is the primary review surface. Contact sheets are secondary
visual evidence and may not capture live ticking clocks or every interaction.

## Spacing refinement review

Selected coloured split columns now use native media blocks so their background
fills the pane. Intentionally inset book covers and calendar cards retain their
frames. Single-image sides use the available height with contain fitting;
fullscreen artwork in 02, 28, 35 and 41 uses natural image height to avoid tall
empty frames at both 320px and 390px phone widths.

Countdowns use centred native stacks and, where they wrap inside bars, centred
rows. No countdown leaf styles or prototype-only template CSS were added.

`review/spacing-audit.json` records 126 revised entry/acknowledgement states at
1000px, 390px and 320px across the 25 affected designs. No horizontal overflow
was detected, and the media backgrounds match their pane height. Native
registration still passes for all 50 designs. Wrapped countdown expiry was
rechecked in both desktop and mobile comparison frames. Captures are kept
locally in the ignored `review/spacing/` folder.

## Inspiration and assets

Creative research considered [newsletter popup explorations](https://dribbble.com/tags/newsletter-popup)
and [editorial typography](https://www.awwwards.com/inspiration/typography-longfellow).
Form-label decisions follow the [W3C form-label tutorial](https://www.w3.org/WAI/tutorials/forms/labels/).
No reference artwork or layout was copied into the prototype.

Twelve original AI-generated bitmap assets were created for this exploration;
five original geometric artworks were drawn programmatically. Provenance and
subject prompts are in `assets/provenance.json`; the geometric source is in
`artwork-geometric.py`. Font files are reused from the design library's existing
local font assets. No remote fonts are needed at runtime.

## Handoff

Keep `designs.mjs` as the design source during review. Carry these same trees and
tokens into implementation after review; do not re-create the screens from
screenshots. This folder is a throwaway exploration under `/tools`, excluded
from distribution. No production plugin source was changed for this prototype.

## Native implementation

The approved batch is implemented as `everyday-*` templates and matching
Playbooks, with 35 Pro / 15 hosted Free entries in the catalogue-only
`everyday-extraordinary` collection. See `docs/reviews/everyday-2026-10-24` for
all screens, the exact handoff comparison, WordPress checks and the explicit
configuration/colour-baseline decisions.

`implement.mjs` and `implement-playbooks.php` are one-time handoff tools. They
replace the generated native files; do not rerun over subsequent editor work.
`check-handoff.mjs` checks the retained prototype/native layout, copy and tier
contract and records its result. Production URLs, consent visibility, resource
visibility and coupon/deadline configuration remain site-owned.
