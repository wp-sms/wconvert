# Winter prototype fidelity review — 2026-10-23

The approved prototype on port 5194 was compared with the actual native/public-preview generator: all 40 entry screens and 15 acknowledgements at 320 and 1000px. Paired boards show prototype left and native right. The final 25 adjacent-width pairs were inspected for reading order, grouping and word wrapping (transitions.json and seven transition boards). Spec and standards reviews completed with no remaining substantive findings.

## Scope and intentional adaptations

Layouts, image proportions, typography, palettes, framing, form spacing and coupon presentation were corrected in native editable trees. Shared controls add heading leading/style, image height/background sizing, countdown size, close inset, grid basis and inline code presentation. No arbitrary CSS or uneditable text was added to templates. Public previews embed licensed local copies of the declared fonts and use the native fullscreen decoration and dismiss control. Merchant remote-font delivery still requires the existing site acknowledgement; fallback stacks remain supported.

Native accessibility sizing, required-field markers and working acknowledgement actions are retained. Prototype-only disclaimers, demo Back links and simulated collection navigation are not shipped: Continue browsing dismisses the completed signup. Consent defaults off by product policy (ADR 0032), while the WordPress checks explicitly enable and enforce it. The public comparison therefore has less consent text than the prototype. Countdown examples differ from the prototype's frozen digits; real deadlines are checked separately. Native close controls and minimum readable timer labels are deliberately retained. This is a composition/fidelity correction, not a claim of pixel identity.

## Verification

- 86 real WordPress route checks passed at 320/1280px, covering all 40 winter designs plus three affected existing designs; all recorded revisions match the final native inventory.
- 32 real countdown cases passed: deadlines, ticking, refresh, hidden zero-day units, expiry, and completion of an already-open signup.
- Normal and longer-copy audits each passed 880 design and 880 filled-setup cases, including RTL and eight widths. Numeric stress changes dates/years instead of appending prose to a date.
- PHP suite: 3,728 tests / 21,829 assertions passed. JS suite: 5,150 passed with one stale grid assertion; the corrected assertion verifies both absence of the removed columns parameter and isolation of the default grid basis, and its 29-test file passes. Targeted shared controls: 230 passed. Studio suite, lint, typecheck, template registration and source split checked separately.

## Composition judgments

| Prototype | Native design | Final judgment |
|---|---|---|
| 01 The ribbon room | winter-ribbon-room | Ribbon illustration restored as the left pane beside the large serif offer; the phone stack retains the ribbon before the code. |
| 02 A little gift | winter-little-gift | Compact pale gift card retains the oversized offer and simple coupon hierarchy without adding an image panel. |
| 03 Winter windows | winter-winter-windows | Full viewport winter landscape and centered stacked offer restored; phone panorama stays readable above the action. |
| 04 The ornament edit | winter-ornament-edit | Ornament artwork remains separate from editable offer and countdown; the pale card and dark timer retain contrast. |
| 05 Paper & pine | winter-paper-pine | Paper-and-pine illustration and warm paper palette restored with the large serif headline. |
| 06 The candle club | winter-candle-club | Candles fit inside the image band without cutting the flames; maroon signup and acknowledgement preserve the same visual identity. |
| 07 Wrapped in colour | winter-wrapped-in-colour | Three coloured gift panels restored on desktop; ordered mobile stacking keeps the offer adjacent to its action. |
| 08 The thoughtful list | winter-thoughtful-list | Envelope image and cream signup panel restored; the acknowledgement retains the envelope and intact coupon. |
| 09 A ribbon reminder | winter-ribbon-reminder | Red wrapping reminder keeps copy, clock and action grouped; the bar wraps into a deliberate phone stack. |
| 10 The gift atelier | winter-gift-atelier | Cream botanical column fills fullscreen height; the offer remains legible at 767/768px and the narrow clock fits. |
| 11 Dear December | winter-dear-december | Letter styling restored with red rule, serif headline and signature; acknowledgement retains the letter palette. |
| 12 Postcards from winter | winter-winter-postcards | Snowy cabin panel retains its blue ground and complete illustration beside the cream signup; mobile image stays above the form. |
| 13 The snowglobe society | winter-snowglobe-society | Snowglobe image uses contained proportions; the editable signup remains distinct from decorative motion. |
| 14 A small kindness | winter-small-kindness | Quiet illustration and small-kindness offer restored; wider split basis prevents crushed intermediate columns. |
| 15 After-hours at the atelier | winter-after-hours-atelier | Dark atelier palette and display serif restored without placing editable copy in the artwork. |
| 16 First light access | winter-first-light-access | First-light landscape and early-access offer retain their hierarchy around the functional deadline countdown. |
| 17 The advent letter | winter-advent-letter | Advent layout keeps its date artwork separate from text and form; transition widths no longer leave an isolated narrow column. |
| 18 The winter reading room | winter-winter-reading-room | Book artwork sits on a matching green pane; the reading-room headline and signup remain editable. |
| 19 The last sleigh | winter-last-sleigh | Last-sleigh illustration and urgent offer restored; countdown and action remain clear at phone width. |
| 20 Before the bow | winter-before-the-bow | Bow artwork stays fully visible; cream dismiss background keeps the close control readable over the art. |
| 21 The dispatch desk | winter-dispatch-desk | Dispatch date and explanatory copy stay grouped in the bar; darker date ground satisfies contrast and longer dates stay numeric. |
| 22 The digital gift | winter-digital-gift | Digital-gift card keeps a clear benefit, deadline and action without implying a physical delivery cutoff. |
| 23 Still time for something | winter-still-time | Still-time notice retains its compact hierarchy and readable mobile countdown. |
| 24 The pickup window | winter-pickup-window | Pickup notice keeps location/action intent together and its clock clear at both desktop and phone sizes. |
| 25 A final little sparkle | winter-final-sparkle | Final-sparkle image and large timer restored; split transition and fluid timer size avoid squeezed columns. |
| 26 A softer beginning | winter-softer-beginning | Soft landscape and calm new-year signup restored with matching acknowledgement colours. |
| 27 Hello, tomorrow | winter-hello-tomorrow | Hello-tomorrow typography restored as editable text; fluid heading and later stacking avoid broken display words. |
| 28 The midnight garden | winter-midnight-garden | Midnight garden retains its dark illustration and countdown; year stress changes preserve numeric grouping. |
| 29 A bright new chapter | winter-bright-new-chapter | Bright star artwork and lavender signup restored; acknowledgement repeats the art and readable offer code. |
| 30 The first page | winter-first-page | First-page date and offer remain grouped with the countdown; mobile keeps a sensible reading order. |
| 31 Fresh start club | winter-fresh-start-club | Fresh-start illustration and green signup restored within the design budget; acknowledgement retains the full code. |
| 32 The shop is sleeping | winter-shop-is-sleeping | Shop-closure notice uses replaceable moon artwork with dates and practical reopening information. |
| 33 See you by the fire | winter-by-the-fire | Fire illustration and warm closure message retain their original visual balance without decorative text baked into the image. |
| 34 Holiday post | winter-holiday-post | Holiday post uses its warm paper palette and clear copy/action grouping through the bar transition. |
| 35 Winter hours | winter-winter-hours | Winter-hours notice keeps the dismiss control inset from the frame and the schedule readable. |
| 36 Tied with a little joy | winter-tied-with-joy | Gift card framing, ribbon artwork and original colours restored; the cream close control remains visible and the clock readable. |
| 37 All wrapped up | winter-all-wrapped-up | Cat gift artwork is contained and replaceable; the original playful composition remains sparse around the editable offer. |
| 38 The Christmas express | winter-christmas-express | Christmas train art retains its postcard treatment; deadline and action remain editable and readable on phone. |
| 39 A letter from Santa | winter-santa-letter | Santa letter framing and italic Georgia headline restored on entry and acknowledgement; copy control wraps before splitting MERRY15. |
| 40 Hello, twenty twenty-seven | winter-hello-2027 | New-year greeting-card artwork and display typography restored with a functional countdown and clear action. |

## Shared renderer impact

- collection-discovery: Reviewed shared-renderer before/after at 375 and 1200px: fullscreen children now fill their available height; collection heading, image and action remain balanced. Real WordPress resource action passes at 320/1280px.
- halloween-treat-signup: Reviewed shared-renderer before/after: image/text wrapping remains balanced and the treat signup retains its hierarchy. WordPress validation, consent, failure/retry and acknowledgement pass at both widths.
- halloween-after-dark-offer: Reviewed shared-renderer before/after: fullscreen art and offer retain their original hierarchy with safe word wrapping. WordPress coupon/action route passes at both widths.

Other unchanged setups were rendered before/after by visual-diff and only pixel-identical decisions were carried. Existing revise decisions remain revise.

## Collection

Christmas & New Year retains all 40 members in the approved order, 30 Pro and 10 hosted-only Free. Updated source hashes point to the corrected trees and setup copy. No installation filter, entitlement, membership or collection-navigation behavior changes in this correction. Halloween and Launch a collection also retain their membership and copy; their dependency revisions move with the three reviewed shared-renderer cases.
