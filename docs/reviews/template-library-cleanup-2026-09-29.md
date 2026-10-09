# Full library cleanup — 29 September 2026

The remaining 85 source designs were reviewed alongside the six previously refined designs. All 91 source designs remain available. This is an internal authoring and usability review; “Keep” is not a claim of measured conversion improvement or a release decision.

## Changes

54 sources changed. Forty-nine receive stronger field boundaries, preserving their colour families and using the existing phone-input wrapper. Punched ticket also had white typed text on a cream field; it now uses dark text. The field checker measures the fill against its surroundings or a visible outline against both sides. Decorative separators do not have to look like form borders.

Eleven outstanding UI recommendations are resolved:

- **Corner nudge:** stacked invitation, compact typography and one content-width action; removed an unrelated icon.
- **Inline split:** original shallow guide artwork and a clearer request-specific form.
- **Corner card with a picture:** original note illustration and compact spacing replace unrelated photography.
- **Fullscreen editorial / split:** calmer phone typography, less padding, explicit narrow widths and consent before the action when shown.
- **Let a reader say it:** a complete content promise by default; invented testimonial, star and attribution examples remain hidden until the merchant supplies verified proof.
- **The maker’s index:** balanced product panel, no decorative minimum height on phones, and a shorter acknowledgement without repeated product artwork. The 725px phone form still scrolls; this is expected and is not counted as a layout failure.
- **Resource index:** aligned numbered topic rows replace the awkward grid.
- **Service ledger:** shorter descriptions, tighter phone spacing and a content-width action.
- **Service docket:** concise introduction and compact form, preserving optional name and service choice.
- **Photo offer:** original basket/vase/cup artwork and no unverified returns-policy promise. The category-promotion Playbook override was corrected too.

Gradient text was inspected separately because the automated checker handles solid colours only. Corner flash now uses white supporting text on a darker violet/pink gradient (at least 6.32:1 at its authored stops). A quieter frequency uses lighter supporting text against the brightest authored background. Both initial and acknowledgement screens were re-inspected after editing.

## Consolidation decisions

| Source variant | Preferred starting point | Decision |
| --- | --- | --- |
| Flash over a picture | Corner flash | Group the one-screen sale variants internally. |
| Quiet, in the flow | Inline rule | Group the editorial inline email forms. |
| The number is the invitation | Ready for launch | Group the number-led split compositions; preserve extra copy roles. |
| Email signup | Centred card | Group the simple two-screen email signup; retain the dependent Playbook and identifiers. |
| Two-column offer | Separate design | Optional first name and inset artwork serve a different setup from the email-only split hero. |
| Name and email | Separate design | Three registered guide/consultation setups need its optional-name form. |

The review board shows **87 review groups, 91 source designs and four related variants**. It can expand all sources, search variants directly and open the canonical comparison. This does not claim 87 visually unique designs. The customer picker, source IDs, saved templates and campaign copy are unchanged by grouping. Grouping becomes stale if either related source changes; invalid or cyclic groups are rejected.

## Final output and practical checks

Evidence is in [the review folder](template-library-cleanup-2026-09-29/manifest.json). Its manifest pins all 91 source files and every saved screenshot.

- `sheet-320-*` and `sheet-768-*`: every source screen and default result, visually inspected. The journey-tail sheet completes the tall phone page. Final maker, gradient and practical screenshots supersede earlier captures of those revised designs.
- `practical-320-*` and `practical-768-*`: all screens of 19 actual WordPress-prefilled setups using the eleven refined compositions. This caught generic consent and a returns-policy override that source-only review missed.
- `native-newsletter-*` / `native-guide-*`: real plugin fullscreen forms at 390px, including keyboard focus, empty-field validation, fictional request capture, acknowledgement and Escape dismissal. Guide publishing correctly required a real local resource destination; the disposable fixture was configured with a seven-step guide. No external delivery was attempted.
- `native-phone-field.png`: existing country selector, phone library wrapper and optional select in a real renovation-call campaign. Source checks cover its narrow rendering; the phone library was not replaced.
- `snapshot-check.json`: all 108 existing published demo snapshots stayed unchanged when new sources and all registered Playbook prefills were loaded. Updated disposable demos were then explicitly reseeded for testing.

The fullscreen guide now describes one requested resource without newsletter signup. The fullscreen newsletter describes weekly email and an unsubscribe option. Neither acknowledgement promises inbox delivery. Existing quiz/result logic, field IDs, submission IDs and optional-channel navigation are preserved; prior branch-specific journey evidence remains applicable.

## Verification

- Corrected baseline checker: 832 failing rendered cases across the library, primarily faint field boundaries. Final source check: **2,720 cases, zero findings**.
- Actual 133 registered Playbook prefills: **3,888 rendered cases, zero findings**. Both checks cover 320/390/768/1440px, RTL and long copy/consent. Cases are screen/scenario combinations, not independent campaigns or a complete accessibility audit.
- Native WordPress verification: **108/108 curated setups passed**, including required fields, saved values, retries, optional capture and valid local link/resource targets. Local mail interception remains active.
- **2,328 PHP tests**, **3,387 JavaScript tests**, **18 studio tests** passed. The final fullscreen source changes also passed the focused nine-test container suite. All **91 templates** survive schema normalization intact; source verification passes.
- Three affected collection packs advance to **1.4.1** with updated source fingerprints. The immutable-release test now reads the current declared versions, retaining its conflict assertion when packs advance.
- Shared approvals refresh only after final rendering: **71 changed campaign outputs** and **24 comparison-only revisions**. The latter were compared field by field: only nearest-design metadata and the resulting revision changed. Their previous stage evidence is retained; the new report documents the changed comparisons.

No CI was run, no production campaigns were migrated, and no real email or SMS delivery was tested.
