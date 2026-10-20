# Expressive directions — 20 October 2026

Six additional original compositions, preserving the ten Creative editions designs. Three Free designs (Citrus sunrise, Trail window, Night observatory); three Pro designs (After hours, Gift orbit, Bloom postcard). Eleven authored screens; fourteen visual states including all four gift results. No section numbers in visitor-facing copy. No hosted release, remote upload, CI or external message delivery performed.

## Visual judgement

All fourteen states were visually inspected at studio container widths 320, 390, 768 and 1440 and in actual local WordPress at viewport widths 320 and 1280. Studio screenshots display every authored screen and every result variant. Native screenshots use a tall phone viewport to expose the complete content; separate 320 × 568 checks exercise scroll containers and keyboard reachability. The fullscreen dismiss button lives outside its content root; inline designs deliberately have no dismiss chrome.

- Citrus sunrise: circular still life, large stacked headline and a separate curved cobalt signup strip. The photo now remains circular when longer adjacent text stretches the split pane. A stack wrapper prevents the renderer's lone-image stretch rule from distorting its mask. Clean input and action corners are separate from the decorative panel shape. Success uses a quiet yellow receipt.
- After hours: vinyl graphic, acid-yellow typography and a pink perforated event ticket. Headline/body spacing remains clear at phone widths. Long copy stacks naturally; the ticket action wraps within its pane. Native fullscreen scrolling keeps the action and dismissal usable. The highlighted heading in keyboard captures is the intentional focus indicator.
- Trail window: original arched landscape above editorial type; invitation, separate request and matching receipt. Button contrast was corrected from 4.40:1 to above 4.5:1. Inputs no longer inherit the arch. The fictional scene does not claim a real walking route.
- Gift orbit: original orbiting gifts and a single useful interest question. The fourth answer gives uncertain visitors a real path to the fallback. Smaller nested phone padding prevents narrow choice cards. All four result texts were inspected and reached natively; Back permits changing answers. No email is requested. Empty result destinations intentionally show ideas without an action; merchants must configure the actual collection URLs before using them as product handoffs.
- Night observatory: wide illustrated horizon, large serif headline and a separate editorial/signup band. The phone view reads in one column; labels and white input text remain readable against the dark form. The moon is decorative, not an observing forecast. Receipt retains the night palette.
- Bloom postcard: compact arched floral illustration and a single workshop-information handoff. The small slide-in retains legible text, a useful CTA and comfortable dismissal on a short phone.

All eleven GUIDELINES conversion heuristics were considered: clear visitor relevance/value, one primary next action, a field only when required, accurate promise/receipt wording, no invented urgency or proof, visible labels and consent, appropriate interruption format, legible hierarchy, reversible navigation, accessible contrast/targets and responsive grouping. These are design/use-case judgements, not conversion-rate evidence. Merchants still provide real offers, delivery configuration, destinations, event facts and appropriate imagery.

## Evidence and behaviour

- `layout.json`: 448 rendered cases, zero findings, eight widths (320, 390, 508, 536, 560, 592, 768, 1440), LTR/RTL, normal/long copy, all screens/results. Checks cover overflow, contrast, field boundaries, input size, touch targets and detached announcement controls.
- `*-long-*.png`: transition-width captures for the three split compositions, with expanded headline/body/action copy. Reading order and grouping stay intact; long headlines may create taller layouts rather than clipping. The circular-image defect found during this inspection was fixed and recaptured.
- `*-rtl-long-320.png`: long-copy phone RTL visual inspection. Dismissal mirrors correctly. This uses direction stress with English copy, not a linguistic translation review.
- `simulated-journeys.json`: all six journeys complete. Capture flows block invalid/required omissions, preserve answers through simulated failure, and reach acknowledgement after retry. No real email is sent.
- `native-results.json`: actual WordPress local capture for all three forms, every authored screen and all four gift routes at both widths. Each save was awaited through its visible receipt. Gift continuation without a choice is blocked; Back/change-answer works.
- `native-links.json`: event and flower-workshop links open the configured site-local destination. These test handoffs, not bookings.
- `short-phone.json`, `*-short-phone*.png`: 320 × 568 scrolling, loaded images and no page-width overflow. Overlay actions can be reached by keyboard/scroll.
- `proof.json`: hashes and per-screen/result coverage. Completeness is not a substitute for the visual judgements above.

## Photo delivery and review scope

The two Free raster sources would have exceeded existing campaign payload budgets. Their exact JPEG bytes now also ship as content-addressed files in `resources/template-artwork/`. The bundled library replaces only byte-verified matches with the current installation's plugin URL. Studio/portable exports retain embedded sources; hosted publishing still requires its normal asset declarations, rights evidence and export checks. No payload limit was raised. Missing, altered or unrecognised files are not substituted. URLs from merchant images are untouched. Existing hash-named files must be retained when adding newer artwork.

The shared renderer, phone library and loader are unchanged. Regression tests assert every other Free bundled entry remains byte-for-byte equivalent after the new source adaptation; Pro source loading is unchanged. The conservative review-scope planner flags source/asset changes broadly, but this review only approves these six setups. It is not a blanket reapproval of the library or a claim that unrelated stale reviews are current.

## Local validation

`composer verify:source`, `composer verify:templates`, the complete PHP and JavaScript test suites, and `npm run test:template-studio` pass. The review import is performed through `templates:review`; no approval ledger is edited manually. The previous approved designs remain unchanged. New photographs/illustrations have provenance in the asset README. Hosted pack preparation and publication are separate follow-up work.
