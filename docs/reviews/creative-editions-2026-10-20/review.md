# Creative editions — 20 October 2026

Ten new authored design trees and ten Playbooks, with eighteen screens. Eight designs are Free; Conversation note and Exhibition wall are Pro. These are local studio candidates, not additions to the hosted catalog in this change. The preceding hosted selection used existing designs; this batch creates new compositions instead.

## Creative and practical decisions

| Design | Distinct composition and visitor need | Review judgement |
| --- | --- | --- |
| Supper menu | Framed narrow menu with numbered courses; inspect an evening before opening booking details. | Course labels and descriptions read in order; mobile wraps without a wasted number column. One destination, no implied reservation. |
| Recipe clipping | Ingredient panel beside cooking idea, followed by a separate request slip and acknowledgement. | A useful sample comes before asking for email. All three screens inspected; back and failure/retry work. |
| Colour atlas | One large swatch beside two stacked swatches, then a signup band. | The mosaic replaces the conventional image/text split. Phone tiles remain compact. Removed an unnecessary volume label that collided with the close control. |
| Measurement map | Original A/B shirt diagram with measurement guidance, then the size-guide link. | The picture conveys useful information, with descriptive alt text and instructions outside it. Sample must match the merchant's actual size chart. |
| Programme board | Time rail and alternating programme bands. | At 390px the initial time gutter squeezed descriptions; increasing pane basis stacks it earlier. Wider views retain the rail. No booking is made by viewing it. |
| Conversation note | Speech-shaped topic and reply panels over three screens. | Optional topic survives Back; blank topic works. Explicitly an email enquiry, not live chat. |
| Weekend broadsheet | Newspaper masthead, lead story and contents, with a contrasting subscription band. | Reading hierarchy is distinct from the existing single letter card. Input text remains dark on white; consent stays with the form. |
| Project workboard | Unequal project-context and choice tiles, followed by a full reply strip. | Intent is gathered with one optional choice, without pretending a scope or price has been agreed. |
| Room checklist | A useful three-point checklist beside a contrasting request stub. | Mobile preserves checklist-first order. Form spacing and field contrast corrected; one-off request language retained. |
| Exhibition wall | Fullscreen artwork-led composition with a separate caption/action rail. | Original fictional ceramics illustration; mobile heading reduced and artwork remains legible. Merchant must replace illustrative objects/facts if inappropriate. |

The pilot brief for each setup records its nearest existing design and the structural difference. Changing colours or fonts alone is not counted as a new design. The designs reuse existing renderer primitives; no shared renderer or runtime code changed, so unrelated review approvals are not invalidated.

## Evidence and checks

- Inspected all eighteen screens in saved screenshots at studio widths 320, 390, 768 and 1440, plus native WordPress at 320 and 1280. `captures.json` records exact screen rectangles within the full-page studio captures; `native-results.json` maps every native screen. The hashed `proof.json` binds these files to the prepared revisions.
- Final browser measurements: **576 cases, zero findings**. Eighteen screens × eight widths (320, 390, 508, 536, 560, 592, 768, 1440) × both directions × sample/long copy. Checks cover overflow, solid text contrast, input boundaries, control size and close geometry. This is not a blanket accessibility certification.
- Six representative first screens were additionally viewed with RTL and extended copy. `stress-captures.json` lists these samples. Direction testing uses English stress text, not reviewed translations.
- The programme's stacking transition was captured at 508, 536, 560 and 592. Inspected the corrected 390 and 560 views after changing the pane basis.
- `simulated-journeys.json`: all ten pass. Six capture journeys exercise required fields, simulated failed save, retry and acknowledgement; four content-only journeys have no fake success form.
- Native fixture: WordPress 7.1.3 / PHP 8.1.34, actual plugin rendering and local capture. Every authored screen captured at both widths. Required email validation, optional choices and required consent exercised. No external messages sent.
- Short-phone follow-up at 320 × 568: colour popup scrolls to the email/consent/action, submits, closes, and restores the page. Conversation Back retains the chosen topic. Exhibition's link remains reachable by scrolling. Four link actions reach the disposable local destination; see `native-links.json`. These are fixture destinations, not merchant links.
- The final visual pass corrected menu number alignment, oversized narrow headings, cramped room form spacing, programme divider/rail treatment, dark-panel field contrast, and colour-label/close overlap. Re-captured changed designs after fixes.

## Local validation

- `npm test -- --maxWorkers=2`: 255 files / 4,524 tests passed.
- `composer test`: 3,466 tests / 19,915 assertions passed.
- `npm run test:template-studio`: 47 tests passed.
- `composer verify:templates`: 118 designs survive validation intact.
- `composer verify:source`: passed.
- Scoped approval gate: 10/10 current; curated collection gate: 9/9 approved. The existing whole-library queue still has 92 stale setup reviews and 39 unrelated designs with unrecorded changes; this batch does not claim to resolve that backlog.
- No CI or real delivery testing. No hosted publishing, merge or release build is claimed.

Merchant setup remains necessary: actual dates, menu/programme details, artwork suitability, guide delivery, links and email destinations. These designs are editorially reviewed starting points, not measured conversion winners. The garment SVG still needs a reviewed hosted raster mapping, and both new assets need publisher provenance entries before a later hosted release.
