# Halloween library review · 21 October 2026

All five approved prototype compositions now have bundled designs in PR #317.
The reference was this thread's Halloween prototype A–E, including E's revised
small pumpkin. The artwork is the project's original imagery, not Depicter's.

| Prototype | Library design | Placement and decision |
| --- | --- | --- |
| A | Halloween midnight print | Free popup. Orange engraved frame, cream offer card, bold heading, code and one action. |
| B | Halloween treat with teeth | Free popup. Purple monster framing a lime email offer, plus a matching acknowledgement with a visible code. |
| C | Halloween after dark | Free popup. Cinematic forest with editorial heading and a separate dark offer panel. |
| D | Halloween midnight flight | Free popup. The forest composition with a reserved upper area for three built-in moving bats. |
| E | Halloween drop countdown | Pro floating bar. Small pumpkin, Halloween badge, offer/code, compact fixed-width timer and one shop action. |

## Final visual judgment

`designs-01.png` and `designs-02.png` show all six screens with their system
fallbacks at phone and desktop widths. Individual `*-320-*.png` and
`*-1440-*.png` files show the real WordPress output with permitted Google Fonts,
settled opening motion and native dismiss controls. The monster's visible
consent was deliberately enabled on the disposable site to test the larger form;
it ships hidden, with always-visible privacy wording and a policy-link slot.

The engraved border stays distinct from its calm content area. Monster's eyes
and teeth remain outside the readable text/form region; its acknowledgement
retains the same illustration and presents the actual code. The forest panels
keep the offer grouped, with the scenery visible around them. Flight reserves
space for the bats instead of letting them overlap the text. The bar keeps the
pumpkin at 48px; its timer and short action share the second phone row and the
whole composition forms one row on desktop. Actual mounted heights with Google
Fonts: 143px at 320px, 154px at 390px and 85px at 768/1440px.

Transition boards inspect the exact widths before/after each wrapping change
with sample copy and “Explore Halloween offers” as a longer action. Forest and
flight change at 655/656px: title before offer vertically, then title beside
offer horizontally, retaining clear grouping in both arrangements. The bar's
sample changes at 682/683px. A longer action can take its own line on small
phones; it is never squeezed or clipped. These boards use the studio renderer;
real WordPress checks additionally exercise Pro's dismiss-space reservation.

## Eleven authoring checks

1. One ask: each offer has one shop link; monster asks only for email.
2. Specific reward: percentages and visible sample codes explain the offer.
3. Minimal data: one labelled required email field; optional consent is authored hidden.
4. Honest urgency: timer uses the configured end time; sample dates/codes require merchant configuration. No resetting timer or invented stock count.
5. Complete acknowledgement: monster confirms receipt and displays TREAT25; it does not claim delivery or provider subscription.
6. Phone-first: 320px reviewed first, then 390–1440px in both directions; controls remain usable and no content overflows.
7. Correct shape: E is a compact floating bar, while the four popups retain their distinct framing and hierarchy.
8. Contrast: automated copy, control, close-overlap and field-placeholder checks passed; imagery was also visually inspected behind the actual text.
9. Privacy: visible data-use wording remains complete without a configured policy URL; the policy link has a label and no shipped destination.
10. Reusable design: words, code, image backgrounds, palette and deadline remain merchant-editable; no coupon or destination is created by a design.
11. Roles: stable leaf IDs and declared content roles survive normalization intact.

## Verification

- `composer verify:templates`: 141 designs survive registration intact.
- Full PHPUnit: 3,572 tests, 20,736 assertions passed.
- Full Vitest: 4,622 tests across 257 files passed; 43 targeted feature/Pro presenter checks passed after the final compact-size adjustment.
- Template studio: 64 checks passed. TypeScript, ESLint and PHPStan passed.
- Loader contract: Free 16,937 / Pro 30,325 gzip bytes, both within existing limits.
- Catalogue revision check passed. Normal and long-copy audits each passed 96 cases without findings (192 total); reports are saved here.
- Disposable WordPress mounted both plugins and published each actual library tree. `wordpress.json` records 40 phone/desktop/LTR/RTL cases, no page errors, failed artwork requests or horizontal overflow. Monster submissions returned HTTP 201 at phone and desktop widths and reached the matching acknowledgement. Native required-field validation was exercised before submission.
- Flight has three independent decorations; reduced-motion emulation removes their animation.
- `font-and-width-proof.json` records permitted Google loading, zero Google requests with delivery disabled, equal timer cell widths for 9/99/999, and a working offer destination. Test font delivery was returned to disabled.
- Spec and standards reviews completed; privacy wording and Pro font-permission forwarding findings were fixed and re-reviewed.

The prototype's raster backgrounds became reviewed, hash-named WebP files
(approximately 175KB engraved, 50KB monster, 115KB forest). Exact source matching
keeps those bytes out of published page JSON and serves cacheable plugin assets.
Source prompts, rights records and hashes are in the publishing catalogue and
asset README. No new database storage is introduced.

These are **bundled** library additions. A hosted catalogue release is not
published here: the current hosted pack exporter rejects painted background
assets (“unsupported style content”). Its asset-binding schema was not expanded
for this request. No catalogue revision numbers were manually authored.
