# Eight distinct practical designs, 28 September 2026

The collection now contains 108 campaign setups using 59 source designs, from an inventory of 91 designs and 133 registered Playbooks. This batch adds four Free popups, three Basic slide-ins and one Basic floating bar. Counts describe registered source designs, not proof that every older library silhouette is unique or that any design improves conversion.

## Composition and practical purpose

| Design | Campaign | Distinguishing composition | Visitor outcome |
| --- | --- | --- | --- |
| Offer receipt | First-order offer | Narrow receipt, large serif offer, separate copyable code and terms | Copy a configured coupon and open the shop |
| Reading cover | Practical reading guide | Editable portrait cover alongside a narrow request column | Request one guide, with an optional configured acknowledgement link |
| Service summary | Website review enquiry | Two small scope columns above a full-width request band | Ask about scope and pricing using only an email address |
| Collection poster | Lighting collection | Display headline, original lamp composition, edge-aligned compact action | Open collection information without a signup |
| Margin note | Rereading essay | Source gutter beside serif reading title and a quiet text action | Read a relevant complete essay |
| Sample envelope | Upholstery samples | Shallow swatch strip, optional useful choice, separated privacy wording | Ask about samples without implying an order or payment |
| Availability note | Service visit arrangements | Bordered where/when information inset | Check area and visit arrangements without reserving a slot |
| Inline signpost | Current opening hours | Single compact text row and quiet action; wraps on phones | Open current opening hours |

The signpost is a floating bar despite its source ID. Existing receipt, resource, service-docket, image-offer, reading-slip, choice-slide-in and information-bar structures were compared before authoring. Differences and comparator IDs are recorded in every brief. These eight extend the four previously reviewed directions; completed briefs are archived in `pilot/batches/visual-variety.json` and removed from the pending list.

## Final rendered review

All 11 new screens were inspected in the shipping renderer at 768px and 320px available width, LTR and RTL: 22 final paired screenshots in the adjacent directory. The full collection audit checks 320, 390, 768 and 1440px in both directions: **1,760 cases, zero layout findings**, including input size, touch target height, overflow and bar hierarchy. All eight published compositions were also inspected on the disposable WordPress site at desktop and 390 × 844. Acknowledgements were inspected separately from forms.

The final pass simplified the poster's top label, made the sample-card close control legible over its artwork, reserved space above the guide cover for dismissal, and removed acknowledgement wording that assumed a resource URL had already been configured. The related-reading source gutter was changed to fit the actual slide-in width. Stable leaf IDs were preserved through these edits. The proof page now labels `YOUR CODE` just as the studio already did; it never writes a preview coupon into campaign configuration.

Rendered solid text/ground colours were measured on the new screens: 124 pairs, minimum 5.48:1. This is not certification for arbitrary merchant themes, replacement photography or translations. The artwork is original code-native SVG, and the cover words remain editable text. No decorative icons were added; acknowledgement checks indicate a completed request.

## Practical journeys and real WordPress

The guarded local WordPress/MySQL/WooCommerce harness verifies all **108 campaigns**: publication, required-field refusal, accepted capture, idempotent retry, stored fields, real destinations and configured resource links. All 11 resource campaigns pass the local email-handoff/content-page check. Mail is intercepted locally; no real inbox or SMS delivery was attempted.

Native browser interactions additionally verified:

- Coupon copying visibly reports “Copied”; the main action opens the sample shop.
- The reading-guide request reaches a truthful acknowledgement and opens a complete five-part guide.
- The service enquiry saves an email and acknowledges the request without promising a booking.
- The fabric form accepts the optional “Matching a colour” choice; capture history retains the stable `colour` value and label.
- Collection, reading, visiting and opening-hours actions open relevant working example pages.
- Studio failure simulation leaves the email and “Everyday care” choice in place; retry reaches acknowledgement.
- The customer creator finds the website review setup by search and displays its format, trigger, scope and setup guidance.

The test pages deliberately contain fictional content. Merchants must supply real products, offer restrictions, delivery configuration, service availability and destination pages before publishing. The demo coupon proves the copy and shop route; it does not certify every merchant's first-order eligibility rules.

## Existing reviews and maintenance

Adding eight designs changes nearest-comparison metadata for 49 previously approved setups. Their Playbook and design source files were checked byte-for-byte against HEAD, and their brief objects were checked for equality. Those refreshes retain the previous visual and journey evidence and add this report plus fresh full-library layout/native checks. They are **comparison-only refreshes**, not claims of 49 new manual visual inspections. The affected IDs are in `comparison-only.json`.

New and edited source designs have numbered history entries. Shipped library changes affect future drafts; no merchant campaign content was migrated or overwritten. Only the guarded disposable demo was reseeded for testing.

## Validation and boundaries

PHP: 2,328 tests, 13,873 assertions. JavaScript: 3,387 tests across 180 files. Studio: 15 tests. All 91 design definitions and the source distribution contract pass. One unrelated scope-style test hit its five-second timeout during a concurrent full run; its 23-test file passed alone, followed by a complete rerun with fewer workers. No product code or timeout was changed to conceal it.

Shared editorial approvals require this final evidence, not an earlier image. CI and external delivery remain skipped at the user's request. Draft PR only, no merge or release. The four new paid designs still need hosted marketing previews; Free cards are informational without fabricated URLs. Measured conversion lift, physical-device/cross-browser certification and production rollout remain outside this local review.
