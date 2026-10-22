# The shopping weekend — throwaway visual prototype

Question: which Black Friday and Cyber Monday compositions should become WConvert library designs?

Fifteen distinct concepts across all five supported display formats, on one review route with a URL-driven switcher. This is a visual exploration under the existing visitor-design tooling, excluded from plugin distributions by `/tools` in `.distignore`. It deliberately does not register designs, publish collections, create Playbooks, change the renderer, or save submissions.

## Open it

```sh
npm run prototype:commerce
```

Open http://127.0.0.1:5193/ for the gallery. Examples:

- `/?variant=01` — Midnight atelier.
- `/?variant=09&width=390` — Chrome hour at phone width.
- `/?variant=03&width=320&screen=ack` — early-list acknowledgement.

Filter by occasion or format. Click a design to inspect it against a neutral merchant storefront. Use the fixed previous/next switcher or left/right arrow keys. Width choices are desktop, 390px and 320px. The iframe's border can reduce its content width by 2px; direct render routes were also checked at exact viewport widths. Use Signup/Acknowledgement to compare form states, or submit a valid demo email with the visible consent box checked. Reset reopens the initial design. No form data leaves the frame or persists. Copy buttons copy the sample code to the clipboard; offer buttons display a local demo notice.

All discounts, codes and offers are examples. The night-shift timer is frozen sample data, not a live deadline or an evergreen countdown. No availability or sales-performance claims are implied.

## What the Halloween collection taught this exploration

Read `CONTEXT.md`, the design-a-template skill, regenerated `out/VOCABULARY.md`, conversion guidelines, the Halloween JSON structure and `docs/reviews/halloween-library-2026-10-21/README.md`; inspected the actual Halloween contact sheet.

The useful precedent is composition variety: an engraved frame around calm copy, a monster around the form, cinematic imagery around a separate offer, and a compact bar. These concepts preserve that separation of illustration and legible actions, one converting act, phone reading order, and acknowledgements that describe capture rather than provider subscription or delivery.

## The concepts

| ID | Design | Occasion | Format | Action |
| --- | --- | --- | --- | --- |
| 01 | Midnight atelier | Black Friday | Popup | Offer |
| 02 | Acid markdown | Black Friday | Popup | Offer |
| 03 | The early list | Black Friday | Popup | Email |
| 04 | Your good-deal receipt | Black Friday | Slide-in | Offer |
| 05 | The blackout strip | Black Friday | Floating bar | Offer |
| 06 | The weekend edition | Black Friday | Inline | Offer |
| 07 | Behind the velvet rope | Black Friday | Fullscreen | Email |
| 08 | A little black gift | Black Friday | Slide-in | Offer |
| 09 | Chrome hour | Cyber Monday | Popup | Offer |
| 10 | System upgrade | Cyber Monday | Popup | Offer |
| 11 | Command + save | Cyber Monday | Floating bar | Offer |
| 12 | Pixel drop | Cyber Monday | Slide-in | Email |
| 13 | The electric aisle | Cyber Monday | Inline | Offer |
| 14 | The night shift | Cyber Monday | Floating bar | Offer |
| 15 | The cyber club | Cyber Monday | Inline | Email |

The gallery data includes the intent and vocabulary mapping for each design. The four email compositions each have a matching-palette acknowledgement with their visible sample code.

## Scope and promotion

This HTML/CSS is throwaway, not importable Template JSON. The exploration includes original static SVG gift/pixel illustrations, a CSS receipt edge, keycaps, a decorative seal and original raster artwork. Some decorative treatments need to become static image assets when re-authored in the closed vocabulary; they are not proposed renderer features. Selection does not authorize a new database table, renderer capability, catalogue release or offer activation.

On selection, re-author the chosen trees with stable IDs and roles, palette tokens, local artwork and real screen contracts. Respect existing paid format boundaries (bars, slide-ins and fullscreen are Pro), separate font-delivery permission, hidden template consent capability with campaign-purpose defaults, real campaign deadlines, image rights records, revisions, registration checks and actual WordPress verification. Production artwork must pass publishing/export requirements. The prototype never enables Google font delivery; fonts are local copies of the existing editor prototype assets.

No WordPress boot claim is made: this is an isolated browser prototype. A real WordPress run belongs to the subsequent production-template work.

## Editor fidelity and coupon flows

The image panes in 01, 07 and 09 contain no overlaid wording. System upgrade (10) keeps its real dismiss control inside the title row at phone and desktop widths; the title says Cyber Monday and there are no unexplained status identifiers.

The text in 03 and 15 should remain editable when promoted. The exact rotated circular stamps are prototype CSS, not native editor controls: rounded panels and text are supported, arbitrary rotation and fixed panel aspect ratios are not. Prefer a simplified editable panel/badge rather than baking the discount into an image. In 08, the gift illustration is artwork; headline, offer and code remain editable. The ⌘ S motif in 11 is decorative and does not install a keyboard shortcut or replace the browser’s Save command.

The current editor supports a required email/SMS form followed by an acknowledgement containing a Discount code with Copy button → Code and copy button. Start from a capture design for Grow my email list or Grow my SMS list; require its matching field, edit the submit label, and put the valid store coupon only on the acknowledgement. An optional introductory Message screen can precede the form. Test the complete route before publishing. Adding a Message screen to a click-only offer does not itself create the required primary form/submission; signup versions of these offer compositions must be authored deliberately. A second optional channel must not withhold a reward already earned by the first required signup.

Checked against `JourneyEditor.tsx`, `structure/catalogue.ts`, `SlotFields.tsx`, `TemplateLabels.php` and the shipping renderer CSS. These are existing product capabilities, not a claim that the prototype gallery is installed in WordPress.

## Decision

Pending visual selection. Choose IDs, combinations or changes in the review conversation. After the direction is agreed, absorb the chosen design intent into library sources and delete the throwaway implementation.

## Review evidence

`preview.png` is the final gallery overview. Local detailed captures and the browser audit report are in `../out/commerce-review/` (generated, not committed). Review covers 320, 390, 768 and 1440px, LTR/RTL initial screens, all four acknowledgements, form validation and the gallery's demo interactions. `review.json` records 136 layout cases and 138 interaction checks, with no page errors, external requests, horizontal overflow or close-control overlaps. Desktop and phone contact sheets and all four acknowledgement screens were visually inspected. The final visual pass corrected the pixel acknowledgement’s narrow heading wrap; form, code and action now remain balanced. Scoped ESLint and a Vite build passed. This is prototype verification rather than production template approval.

## Original artwork

Generated for this exploration with the built-in imagegen tool on 22 October 2026. No reference image or third-party brand was supplied. Originals were copied into this project; no remote artwork dependency remains.

- `assets/chrome-orbit.png`: original generated chrome sculpture, used by Chrome hour and The electric aisle.
- `assets/midnight-shopping.png`: original generated still life, used by Midnight atelier and Behind the velvet rope.

Final prompt, chrome artwork:

> Create a premium campaign artwork background for a Cyber Monday digital shopping popup. Portrait 2:3 composition. A single sculptural inflated chrome silver ribbon loop like an impossible orbital knot floats centered in the UPPER HALF, with glossy reflections of electric cobalt blue and pale lavender, highly polished liquid metal, clean studio product photography style, absolutely no text, no letters, no logos, no watermark. Rich electric ultramarine blue background with subtle light falloff. Lower 40 percent mostly empty cobalt blue for separately rendered typography. Dramatic but refined, collectible design object, sharp highlights, exceptional material realism.

Final prompt, Black Friday artwork:

> Original premium Black Friday campaign still life photography, portrait 2:3 ratio. Two beautifully tactile matte black shopping bags with black rope handles and one small gift box on sculptural black stone plinths, a narrow ivory satin ribbon draped across the lower plinth, moody warm studio light from upper left, charcoal black background, subtle fine film grain, extreme luxury fashion editorial, elegant and restrained, high contrast but readable bags. Subjects centered with comfortable room around them, no text, no logos, no typography, no watermark, no price labels, no people. Background artwork to sit in one pane beside live promotional text.
