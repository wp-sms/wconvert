# Practical moments: six distinct designs

Reviewed 2 October 2026 with the shipping renderer, native phone control and WordPress. This adds six designs and six prepared setups, not six copy variants. The pilot contains 116 setups using 67 designs; the complete source inventory has 99 designs. Four new designs are Free, two use Pro display types.

| Design | Format | Visitor task | Composition difference |
| --- | --- | --- | --- |
| Callback slip | Pro slide-in | Discuss a repair by phone | Subject panel, inset phone form, separate next-step footer; unlike Inline phone or Slide-in question |
| Event calendar | Free popup | See an open workshop's details | Date tile beside invitation, then labelled time and venue; unlike the agenda/session layouts |
| Product detail sheet | Free popup | Understand a desk lamp | Original product illustration beside three facts, then caption/action; unlike Specification sheet or Two-column offer |
| Service process strip | Free inline | Start a restoration enquiry | Three numbered stages, followed by a reply panel; nested splits stack each whole stage on phones |
| Launch index | Pro floating bar | Visit a new collection | Inset collection masthead, short descriptor and contrasting action; shallow row with reserved dismissal space |
| Appointment agenda | Free popup | Ask about a room-planning consultation | Preparatory agenda beside a reply form; unlike the top-and-bottom Appointment note |

## Final visual review

The shared audit rendered all nine screens at 320, 390, 768 and 1440px, LTR and RTL, normal and longer copy with visible consent. All 144 cases passed horizontal-overflow, 44px control, 16px input, solid-colour text and field-boundary checks. A second 144-case pass hid optional images; Product detail sheet collapses its image column without leaving an empty pane. Measurements and final screenshots are attached beside this file. Check results do not establish conversion performance or certify accessibility.

Visual inspection covered the phone and desktop contact sheets and focused native previews. Fixes made after rendering: replace the process's two-plus-one phone grid with stacked stages; keep consent before the restoration action; shorten event/product actions; reduce consultation copy; use supporting text for the date so the popup's accessible name is the actual event title; reserve dark space beside the announcement's light masthead so the close control remains visible. Rebuilt and captured final output after these edits.

All eleven design heuristics were considered: one clear request/action, specific outcome, only necessary fields, no fabricated urgency, intentional acknowledgements, phone readability, format-appropriate geometry, contrast, request-specific fine print, reusable composition and transferable Slot Roles with stable leaf IDs. The template validator verifies the last point against the closed vocabulary. The callback is not SMS marketing; the enquiries do not reserve times or book work. The optional consultation topic helps the reply and has stable sent values. The event uses a consistent sample Saturday, 14 November 2026, 14:00–16:00 Europe/London; notes require replacement and an explicit campaign end. No automatic event scheduling is implied.

## Visitor journeys and native WordPress

- Studio: all three capture flows were submitted through their real controls, deliberately failed, then retried. The callback retained the United States country and fictional phone number. The consultation retained its selected topic and email. All reached honest request acknowledgements. No provider messages were sent.
- Disposable native WordPress at port 9443: created/configured/published the six setups through the existing Prefill and REST workflow. The verifier checked required-field rejection, accepted capture, idempotent replay and saved canonical values (including phone and topic), plus real destination resolution. All six passed; see the WordPress JSON evidence. The reported outbox count is the demo's pre-existing cumulative local outbox, not messages produced by this batch.
- Browser: opened all six native campaigns. Changed the callback country using the shipping selector, rejected a short number, then saved a valid fictional request. Submitted restoration and consultation forms; checked their acknowledgements. Selected the optional consultation topic by keyboard. Followed all three link actions to their matching local information pages. Checked popup scrolling to the product action at 320px, keyboard access, focus and Escape dismissal. Inspected the final announcement close control at 320px.
- Real `wconvert.local` admin: walked goal-first creation, found the new promotion and enquiry entries, searched for the desk-lamp use case and inspected it in the shared setup-detail modal. No customer draft was created or published there. The six native publications exist only in the disposable demo.

## Distribution and limits

New paid metadata stubs contain no trees or invented public preview URLs; their informational-card behavior follows ADR 0098. The original lamp artwork and its provenance are in `pilot/assets`. The existing hosted-release plan and five curated collections are unchanged. These approvals cover template/setup quality; they do not publish an API release, website preview or merchant campaign. Actual registration, purchases, calls, appointments and external delivery remain outside the demonstrated outcomes. Native mobile keyboards and assistive-technology testing remain device-level release QA.

## Reproduce

```sh
npm run templates:pilot
node tools/design-library/build/batch-audit.mjs practical-moments
```

Open `out/pilot.html?batch=practical-moments` for journeys and setup guidance, or `out/practical-moments-audit.html` for all screens and repeatable measurements. Enable **Hide optional images** for the image-free pass.

Validation: 2,436 PHP tests (14,787 assertions), 3,538 JavaScript tests across 194 files, 36 studio tests, template vocabulary verification for all 99 designs, source-distribution contract and ESLint passed. No CI or external delivery was run.
