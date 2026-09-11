# Template library curation — 11 September 2026

The review started with 57 designs, including the three recently updated
flagships. We improved 47, retired 10 and added two adaptations from the supplied
static collection. The library now contains 49 designs: 36 Free and 13 Basic,
with 29 popups, 12 inline designs, four floating bars and four slide-ins.

“One-line signup” is retired. Its rounded pill constrained a complete popup
form; **Bold ask** is the compact single-field replacement. The creation flow
“One idea, one field” now selects it. The article-ending flow uses **Inline rule**.
The existing inline phone design now asks for a callback with one field; its SMS
playbook supplies its own text-update wording and consent purpose.

## What changed

- Fields use 16px text, clear labels and explicit optional labels. Secondary body
  copy and fine print are around 14px; compact labels and eyebrows retain their
  existing smaller scale. Controls measured at least 44.8px tall.
- Narrow padding, display headlines, form-column space and decorative images
  were adjusted to avoid crowded phones. Split layouts use the editor's current
  pane structure and form basis; stable leaf IDs were retained.
- Coupon success screens reveal a code and enable the new copy action. Resource
  templates include an optional hidden success link for a merchant-supplied file
  or page. No second conversion is counted by that link.
- Sample wording now describes the request actually captured. Unverified reader
  counts, ratings, delivery promises and arbitrary countdowns were removed or
  clearly labelled as sample proof. Dedicated countdown designs retain their
  schedule-driven clock. Newsletter schedules agree across both screens.
- Field/background and CTA contrast were improved. Placeholder contrast was
  checked separately; several tinted inputs became white. Downloaded font names
  were replaced with system/Georgia fallbacks.
- **A useful little guide** adapts the static Practica composition; **Ready for
  launch** adapts Signal. Both use editable typography and colour blocks. Existing
  pictures remain code-native placeholders. No AI images or new raster assets
  were created.

The source is the supplied local `opt-in-collection.html`. Layouts were authored
in WConvert's closed template vocabulary so their blocks remain editable.

## Verification

Every original design was inspected at 320px, form and success where present.
Every current design was visually inspected at phone and desktop sizes. The
full-library review uses the shipping renderer and models the available width
of each display container before scaling its on-screen preview.

The current library passed **1,376 rendered cases**: 320, 390, 768 and 1440px,
LTR and RTL, normal and longer copy with consent, and every screen. There were
zero flagged cases for horizontal overflow, text-field/select/CTA height below
44px, input text below 16px, or low solid-colour text/placeholder contrast.
The initial 57-design size pass had 196 flagged cases; placeholder contrast was
added during the review, so this is not a like-for-like accessibility score.

Real WordPress QA confirmed the 29-popup picker contents, removal of One-line
signup, both new designs, sample-content application, phone/desktop views,
editable fields, field-edit undo, success structure and hidden resource controls.
The existing **Editor UX check** draft was used without saving; undo returned it
to its original state with Save draft disabled. This initial editor pass
published no campaign, submitted no lead and rewrote no saved campaign copy or
layout. The subsequent isolated visitor pass is recorded below.

Validation completed:

- `composer test`: 1,831 tests, 8,091 assertions passed.
- `npm test -- --reporter=dot --maxWorkers=4`: 2,300 tests in 94 files passed.
- `composer verify:templates`: all 49 designs survive registration intact.
- `composer verify:source`: source contract clean.
- Existing per-design compressed byte limits pass without increasing any limit.
- Design cards, gallery, bench, vocabulary and both review pages rebuilt.

Tests that depend on a particular nested row now use a stable editor fixture.
Library registration, facets, byte limits and playbook compatibility still run
against the actual current library.

## Visitor journeys and picker follow-up

Four temporary Optins were published on isolated local WordPress pages, with
fictional contact details and no delivery destinations. Each successful journey
saved exactly one lead and recorded exactly one conversion:

| Journey | Visitor behavior and saved evidence |
| --- | --- |
| Newsletter / Centred card | Empty and malformed email and missing consent were blocked without saving a lead. A valid submission showed the Friday-reads acknowledgement and stored its consent wording. |
| Coupon / Code on success | Submission revealed the configured test code. Two copy attempts left the conversion count at one. Local HTTP denied clipboard access; the visible manual-copy fallback worked. |
| Resource / A useful little guide | Missing consent was blocked. Success exposed the configured link, which opened a real local checklist page without another conversion. |
| Callback / Callback notes | Missing or incomplete phone numbers were blocked. The valid request saved a normalized international number, name, topic value and label, and consent text. Success acknowledged a callback request without promising an appointment. |

Newsletter and coupon forms and success screens were checked at 320×568.
Resource and callback flows were exercised at 390×844, with additional 320×568
checks. The taller resource popup scrolls; keyboard navigation brought its
action and then its close button into view. Close and Escape dismissal worked.
These are desktop-browser viewport checks, not physical-device keyboard tests.
Successful clipboard writing is covered by the renderer tests; this HTTP visitor
pass verified the failure path only. No email or SMS delivery was attempted.

All four temporary Optins, their leads and statistics, five test pages, and the
request-scoped test isolation helper were removed. Hash comparisons confirmed
that all six original saved Optins were unchanged.

The picker now puts reviewed starting points first within each display type.
Unranked extension designs retain their existing order, and search, action,
field, layout and availability filters continue to operate on the same entries.
WordPress confirmed Fieldwork, Sunday marginalia, A useful little guide, Ready
for launch, Punched ticket and The summer archive first; the link-action filter
returned six designs and searching for “summer” returned one. Save draft and
Undo remained disabled throughout this read-only check. A focused GPT-5.6 Luna
Extra High review informed this small ordering change.

Final validation: **2,303 JavaScript tests in 94 files**, **1,831 PHP tests with
8,091 assertions**, TypeScript, ESLint, PHPStan, template registration and source
contracts passed. Both admin bundles and all four loader tiers built. Gzipped
loaders measured 10,402 / 11,133 / 12,099 / 12,285 bytes (Free / Basic / Pro /
Elite) under CI's Node 22.23.2, within the unchanged 12,288-byte limit. Elite
has only three bytes of headroom. The first CI run exposed a gzip difference
from local Node 24; merging scoped token bags once, reusing existing DOM
helpers, fully removing unused editor metadata reads, and two additional
compression passes brought the same behavior within budget on CI's runtime.
The review pages were rebuilt after the newsletter consent copy was aligned
with its Friday-reads purpose.

## Review limits and using the result

A subsequent focused compatibility review used GPT-5.6 Luna with Extra High
reasoning. It found that an unavailable library entry was treated as an empty
reset baseline, offering misleading resets on saved styling. The editor now
suppresses design resets when the original is unavailable, while preserving
editing and scoped resets. A regression test reproduced the old behavior;
113 focused editor tests, type checking, targeted lint and the admin build pass.
WordPress verification confirmed that an available design still resets to its
library value and Undo restores the saved draft; no save was performed. The
retired-entry condition is covered by the regression test.

Some editorial and multi-field designs need vertical scrolling on a short
320×568 phone. That is reported separately from horizontal overflow; content
is not truncated to force a single screen. The review's expanded cards show all
content, while the shipping popup provides a scrollable viewport.

Solid-colour checks are not an accessibility certification. Picture/gradient
backgrounds need visual review, and translated or merchant-written copy can
still change wrapping. The two resource designs need an actual resource URL or
configured delivery route before they can deliver a checklist; sample offer
terms, links and schedules remain merchant configuration.

Open `tools/design-library/out/library-review.html` through the local site to
compare all designs, inspect one at a larger size, or rerun measurements.
The Before view uses the pre-curation snapshot supplied during this build.
Generated review files and that optional baseline are not shipping plugin data.

The decision ledger below is a snapshot of
`tools/design-library/review/library-decisions.json`. Retiring a library entry
removes it from new choices and its locked stub, not from saved Optin snapshots.

## Decisions for every template

| Design | Decision | Reason |
|---|---|---|
| Three reasons (`benefit-grid`) | Improve | Keep the three-benefit layout; replace the invented reader count, clarify the weekly reward and enlarge fine print. |
| Bold ask (`bold-ask`) | Improve | Keep the strong typographic invitation; reduce mobile heading and padding, make the reward specific and acknowledge the request clearly. |
| Callback notes (`callback-notes`) | Improve | Keep the new callback structure, optional details and honest acknowledgement; raise secondary text to the library floor. |
| Centred card (`centred-card`) | Improve | Keep as the neutral compact card; use a full-width form column and a specific newsletter reward instead of an undelivered code. |
| Code on success (`code-reveal`) | Improve | Keep the compact coupon; reveal and copy the code on success, remove the email-delivery claim, improve fine print and narrow spacing. |
| Cream coupon (`cream-coupon`) | Improve | Keep the premade coupon treatment; improve orange button contrast, simplify the benefit, resize display type on phones and add code copying. |
| Deadline panel (`deadline-panel`) | Improve | Keep the dedicated countdown design; remove editor instructions from visitor copy and explain terms without inventing a fixed deadline. |
| Fieldwork (`fieldwork`) | Improve | Keep the new premade split, wider form basis and gradient placeholder; raise secondary text to the library floor. |
| Corner flash (`flash-offer`) | Improve | Keep the compact bright sale; move the corner badge into normal flow and replace unsupported urgency with selected-range terms. |
| Ink split (`ink-split`) | Improve | Keep the contrasting split; remove the tall decorative minimum, protect form width and retune oversized mobile headings. |
| Inline bar (`inline-bar`) | Improve | Keep the short single-field inline row; use a specific CTA and grammatical consent. |
| Three across, in the page (`inline-benefits`) | Improve | Keep the three-column shopping benefits; clarify delivery conditions and improve CTA contrast. |
| Choice card (`inline-choice`) | Improve | Keep the structured enquiry with optional name and topic; label optional fields and improve fine-print readability. |
| Inline call to action (`inline-cta`) | Improve | Keep the compact inline click card; use timeless offer copy and clear terms. |
| One line in the page (`inline-one-line`) | Retire | The extra name field breaks the promised one-line layout. Inline bar provides a clearer single-field row. |
| Inline callback (`inline-phone`) | Improve | Keep an inline phone-only request; remove unnecessary name, replace the unsupported instant restock promise with an enquiry and correct consent purpose. |
| Quiet, in the flow (`inline-quiet`) | Improve | Keep the unobtrusive article-flow design; state the reading reward and use a specific CTA. |
| Inline rule (`inline-rule`) | Improve | Keep the editorial divider treatment; improve the invitation, CTA and fine print. |
| Inline signup (`inline-signup`) | Retire | Repeats the neutral inline signup with no distinct structure. Inline rule and Inline bar cover article endings and compact rows. |
| Inline split (`inline-split`) | Improve | Keep the inline resource split; use a landscape placeholder, a wider form basis and honest request wording. |
| Inline tinted (`inline-tinted`) | Improve | Keep the tinted form panel; enlarge body and fine print, protect form width and align the success copy with the tide note. |
| Ledger card (`ledger-card`) | Improve | Keep the ruled benefit cards; enlarge input text, tighten the mobile panels and remove a sample access promise. |
| The maker's index (`makers-index`) | Improve | Keep the premade maker composition; shorten its picture area, improve readable type and adapt restock automation to a product enquiry. |
| Name and email (`name-and-email`) | Improve | Keep for the named-download playbook; make the name optional and offer a specific resource instead of asking for a name as the reward. |
| The number is the invitation (`number-invitation`) | Improve | Keep the premade number-led split; replace the illustrative subscriber count with the real content promise, enlarge text and shorten success decoration. |
| Offer panel (`offer-panel`) | Improve | Keep the simple dark sale card; remove the arbitrary three-day deadline and clarify selected-item terms. |
| One-line signup (`one-line-signup`) | Retire | The fully rounded popup squeezes a complete form into a pill. Bold ask supplies the same small, single-field invitation with a proper column. |
| Photo offer (`photo-offer`) | Improve | Keep the product-range click card used by its playbook; shorten the portrait placeholder and remove invented scarcity. |
| Over a picture (`photo-wash`) | Improve | Keep the full-background signup; use a readable light field, stronger wash and real visitor fine print. |
| Punched ticket (`punched-ticket`) | Improve | Keep the premade ticket; enlarge fields and supporting type, give long headlines a safe scale and reveal/copy the code directly. |
| A quieter frequency (`quieter-frequency`) | Improve | Keep the premade night palette and editorial success; enlarge fields, secondary text and simplify the heading scale on phones. |
| A customer says (`quote-card`) | Retire | Unlabelled invented review, generic offer and large portrait. Reader review is the stronger editorial composition and explicitly labels sample proof. |
| Let a reader say it (`reader-review`) | Improve | Keep the premade editorial proof layout; make the illustrative label prominent, reduce its long mobile quote and enlarge form text. |
| Picture on the side (`side-note`) | Retire | Portrait placeholder dominates a phone and the restock/shipping wording is contradictory. Maker’s index covers a product enquiry more clearly. |
| Split hero (`split-hero`) | Improve | Keep the neutral image split used by existing playbooks; shorten the placeholder, protect form width and remove instant-delivery wording. |
| Stacked signup (`stacked-signup`) | Improve | Keep the phone-only popup; correct the consent to text updates, make the request explicit and improve field/button contrast. |
| The summer archive (`summer-archive`) | Improve | Keep the premade orange sale; enlarge small copy, scale the large headline safely and remove the empty optional countdown from the default composition. |
| Sunday marginalia (`sunday-marginalia`) | Improve | Keep the new editorial structure and honest success; raise small secondary copy to the library floor. |
| Wide banner (`wide-banner`) | Improve | Keep the wider single-field newsletter row; tighten mobile padding and clarify the CTA and frequency. |
| Announcement bar (`bar-announcement`) | Improve | Keep a single offer and CTA; match the button to the delivery offer and remove an arbitrary week limit. |
| Bar that hands over a code (`bar-code`) | Improve | Keep single-field code reveal; raise input text and control height, move consent below the row and add copying. |
| Deadline bar (`bar-countdown`) | Improve | Keep the dedicated deadline bar; retain the schedule-driven clock, readable text and one CTA. |
| Bar with a field (`bar-email-capture`) | Improve | Keep a single-field newsletter bar; use a real reading reward, larger inputs and consent below the row. |
| Bar with the stars (`bar-review`) | Retire | A rounded bar built around an invented review count and rating adds little beyond the announcement bar. |
| Bar that asks twice (`bar-two-field`) | Retire | Two fields make a floating bar too demanding. Use the single-field bar or an inline enquiry form. |
| Cart nudge (`inline-cart-nudge`) | Improve | Keep the basket-link nudge; remove the unverified assertion that every item is saved. |
| Strip that hands over a code (`inline-code-strip`) | Improve | Keep the in-page code reveal; add copying and remove the unsupported page-exclusive claim. |
| Editorial split (`popup-editorial`) | Improve | Keep the distinct serif image split; shorten the placeholder and protect the form’s width. |
| Flash over a picture (`popup-flash`) | Improve | Keep the dramatic sale background; place its badge in normal flow, strengthen contrast and replace fixed-hour/editor wording. |
| Email and phone (`popup-two-channel`) | Retire | Collects email and phone for two marketing purposes with one consent. Retire until channel-specific consent and follow-up are designed. |
| Two-column offer (`popup-two-column`) | Improve | Keep the optional-name form split; shorten the placeholder, replace fabricated ratings with a product-detail line and enlarge inputs. |
| Corner card with reasons (`slide-in-benefits`) | Improve | Keep one compact corner benefit list; make all three benefits explain the newsletter reward and improve contrast. |
| Corner card (`slide-in-card`) | Retire | Repeats Corner card with reasons while adding a cramped benefit grid and inconsistent shopping promises. |
| Corner card with a code (`slide-in-code`) | Improve | Keep the compact coupon corner card; reveal/copy the code and remove email-delivery wording. |
| Corner nudge (`slide-in-nudge`) | Improve | Keep the smallest corner click card; clarify the delivery condition and destination. |
| Corner card with a picture (`slide-in-photo`) | Improve | Keep the bakery corner card; shorten its image, stack intentionally within the narrow container and enlarge input text. |
| Corner testimonial (`slide-in-review`) | Retire | Large portrait and invented testimonial overwhelm a small corner card. Corner nudge covers the compact click offer. |
| A useful little guide (`useful-guide`) | Add | Premade Practica guide: warm paper, typographic book placeholder, seven checks and an honest resource-request success. Optional resource link is ready for the merchant’s file. |
| Ready for launch (`launch-checklist`) | Add | Premade Signal checklist: blue/lime split, twelve-point promise and a protected form column. Optional resource link uses the new success-action structure. |
