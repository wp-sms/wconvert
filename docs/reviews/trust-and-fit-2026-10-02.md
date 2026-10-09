# Clear expectations and useful evidence — 2 October 2026

Four new campaign setups, three new Free designs and one deliberate reuse. These checks establish rendering and local behaviour, not conversion performance, provider subscription or external delivery. No release was published and no existing customer campaign was updated.

## Design decisions

- `sms-message-preview` / Message sample: the example message is the focal point, alongside frequency expectations, the existing country/phone library and visible, initially unchecked consent. This serves a different visitor question from a plain phone signup or an optional second-channel step.
- `service-fit-brief` / Scope sheet: two clearly labelled panels distinguish included work from separately agreed work beside the reply form. Service summary groups a summary above its form; Service process strip explains three chronological steps. This composition makes boundaries the primary information.
- `edition-sample-signup` reuses Excerpt window. It changes the purpose, copy, visible newsletter consent and setup guidance; it does not count as a new design. Its resource follow-up stays hidden.
- `workspace-change-story` / Project pair: two labelled views of one fictional workspace, matching room outlines, descriptive captions, a changes note and one story link. Material pair compares alternatives; Product detail sheet describes one product. The new design explains a before/after sequence. Original vector assets have source and redistribution notes in `pilot/assets/README.md`.
- Existing `excerpt-window` workbook was reviewed again after its string ratio was corrected to a numeric ratio. Its resource request remains distinct from newsletter signup.

## Rendered checks

`trust-and-fit-2026-10-02-audit.json` covers all nine screens across five setups, at 320, 390, 768 and 1440 pixels, LTR/RTL and normal/longer copy: 144 cases, no horizontal overflow, controls below 44 pixels, input text below 16 pixels, or solid-colour text/field-outline contrast findings. The same 144-case check with optional artwork hidden passed; see `trust-and-fit-2026-10-02-no-artwork.json`. These measurements are supplemented by browser inspection, not treated as aesthetic approval on their own.

Inspected the actual WordPress output at desktop and 390px phone widths, including all four acknowledgements. Checked the 320px RTL/long-copy SMS form visually. The phone popup scrolls internally when content exceeds its available height. Long inline designs now grow with the page.

A native project-story check revealed that inline mounts inherited the popup's 85vh cap. Fixed the shared mount on every screen bind. A regression test failed before the fix, then passed for initial and subsequent inline screens while leaving popup sizing unchanged. Rebuilt free/Pro loaders and admin bundles. Verified the project action and phone forms remain reachable with ordinary page scrolling.

## Visitor journeys and WordPress

The isolated WordPress instance at port 9443 uses local-only collection and a trapped local mail handoff. No external messages were sent.

- All five setups passed the PHP WordPress verifier: required fields, capture, retry and saved values where applicable; working story destination; one local workbook-resource email and accessible content page. See `trust-and-fit-2026-10-02-wordpress.json`.
- Browser: empty native phone submission was rejected; a fictional UK number with consent reached the receipt screen; Escape dismissed the popup. Native service and newsletter forms accepted fictional example.test addresses and showed truthful receipts.
- Studio: injected failure for each new capture form kept details/consent on the input screen; retry reached acknowledgement. SMS failure screenshot is attached as evidence.
- Browser: Project pair's action reached the fictional workspace study; workbook submission exposed its resource action and that action reached the six-exercise page.
- Actual `wconvert.local` customer picker: the new SMS setup appeared under Grow my SMS list and its shared detail modal rendered correctly. No campaign was created on the user's site during this check.

## Automated validation

- PHP suite: 2,461 tests / 14,999 assertions passed.
- JavaScript suite before the isolated inline-container correction: 3,553 tests passed. After that correction, the affected mount/follow-up suites passed all 32 tests, including the added regression test.
- Template studio: 36 tests passed.
- TypeScript check, targeted ESLint, template registration (102 designs), source contract and all four loader size/tier contracts passed.
- No CI, external delivery, hosted publishing, licence-manager connection or merge was performed.

## Evidence

The sibling PNGs under the `trust-and-fit-2026-10-02-` prefix show desktop layouts, phone layouts, native acknowledgement screens, simulated failure, and the actual local picker. Existing evidence files were not changed. All four new setups and the existing workbook receive current editorial review records; the 92 older stale approvals remain pending in a separate refresh plan.
