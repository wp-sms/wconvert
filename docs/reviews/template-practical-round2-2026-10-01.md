# Practical campaign review — 1 October 2026, round 2

Scope: two new designs and the downloadable raster derivative of Product shelf. Reviewed by Codex against the prepared campaign and current renderer. This is editorial/functional approval, not evidence of conversion uplift.

## Native WordPress

A separate existing MySQL review site, WordPress 7.1 / PHP 8.5.8, runs on loopback port 9443. Only its disposable posts, options, campaigns and fictional Leads were changed. The user's wconvert.local campaigns were not modified. The demo MU plugin intercepts all wp_mail calls into its local capped outbox; no external email/SMS, purchases or checkout.

- Specification sheet: published popup on page 647. Desktop 1440px and phone 320px visually inspected; option names stay beside every fact after stacking. Keyboard activation of Explore the tables reached page 646 with matching Small 35 × 35 cm / Wide 50 × 40 cm, care information and clearly fictional product details. No sale or Lead is claimed.
- Excerpt window: published inline campaign on page 648. Desktop 1440px and phone 320px visually inspected, including the narrow article container and scrolling to the form. Browser keyboard submissions reached the request acknowledgement. Open the workbook reached page 649 with all six promised exercises; the first matches the excerpt. The resource request does not imply newsletter consent.
- Homeware care notes: published popup on page 522. Desktop 1440px and phone 320px inspected. The artwork keeps its complete pot, vase, plant stems and cup handle. Browser keyboard entry, explicit email-consent selection and submission reached the request acknowledgement. Both form and success screen remain readable without horizontal overflow.

Native capture verifier (scoped with WCONVERT_DEMO_IDS) also passed for all three: published configuration; real link destination; required-field refusal; accepted capture; idempotent retry; saved values; accessible acknowledgement resource link; exactly one resource email handoff for each new workbook request. It uses unique example.test recipients. The local handoff is not inbox delivery.

## Every screen and direction

Current renderer proof pages were visually inspected at 768px and 320px content widths in RTL for all three, including both form acknowledgements. This checks mirrored layout, not translated Arabic/Hebrew copy: English punctuation follows the selected bidi direction. LTR desktop/phone states were checked on native WordPress. Copy promises, fields, consent, one primary action, type hierarchy, line wrapping, spacing and accessible focus indicators were reviewed. The resource follow-up is hidden until the merchant configures it; native fixture supplies a real local resource.

## Artwork provenance

Original repository geometric SVG was extracted unchanged and exported using resvg-js to a 1920 × 500 PNG. A first ImageMagick trial omitted strokes and was discarded before approving the final derivative. Final artwork retains them. Payload tests then showed that embedding raster bytes in the bundled template exceeded its budgets. The bundled SVG was restored unchanged; only the explicitly reviewed downloadable export uses the PNG. Native screenshots below show the raster rehearsal; the bundled composition and copy are unchanged. The real pack importer independently verifies those exact PNG bytes. SVG source, exact PNG, alt text and hash-bound GPL-2.0-or-later redistribution record are committed. It is illustrative artwork, not a claim that pictured goods can be bought.

## Reproduce

Seed only these IDs with wconvert_demo_seed(['specification-sheet','excerpt-window','homeware-care-notes']) in the guarded disposable site, then run demo/verify.php with WCONVERT_DEMO_IDS set to those IDs. Resource fixtures are repository files. No cloud setup or licence manager is required.

## Exact reviewed revisions

- specification-sheet: 119a0c00403ecdf4339d8cb986c4b1443290b595550d00333f1e6a84eeedf73d
- excerpt-window: c2edc4992d98c2758a88fd1d8e84885e8a8dad407412978f943bb3432f92fb6a
- homeware-care-notes: e9d1ef522d673c769bc85de4de0ca90e99e13e283708417beb01de3da023f978

## Native verification result

```json
{
    "homeware-care-notes": {
        "status": "passed",
        "checks": [
            "published",
            "primary: required fields, capture, retry, saved values"
        ]
    },
    "specification-sheet": {
        "status": "passed",
        "checks": [
            "published",
            "real link destination"
        ]
    },
    "excerpt-window": {
        "status": "passed",
        "checks": [
            "published",
            "visible acknowledgement resource link",
            "primary: required fields, capture, retry, saved values",
            "one local resource email with an accessible content page"
        ]
    },
    "_outbox": {
        "messages": 100,
        "scope": "Local wp_mail handoff only; no external inbox delivery"
    }
}
```

## Automated layout support

The rebuilt collection audit checked 528 rendered cases across 18 prepared setups, at 320/390/768/1440px, LTR/RTL, normal/long copy. Zero findings for horizontal overflow, controls below 44px, input text below 16px, or solid-colour text/field-outline contrast. Results are in `template-collection-layout-round2-2026-10-01.txt`. This does not measure contrast over photographic backgrounds or replace visual inspection.
