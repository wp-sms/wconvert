# Fabric sample enquiry — 19 October 2026

Reviewed by Codex for the illustrated premium delivery pack. `upholstery-samples` reuses the unchanged Sample envelope v3. This adds a reviewed delivery pack, not another design count or copy-only variant.

## Visual and practical review

Inspected the actual shipping-renderer campaign in the studio at desktop and 320px, both input and acknowledgement, plus RTL and longer-copy screens. Screenshots and the raw 32-case size/contrast report are in `fabric-samples-2026-10-19/`. Checked 320/390/768/1440, LTR/RTL and normal/long copy through the review page's own controls. No horizontal overflow, detached groups, low text contrast or low field contrast. Placeholder contrast is 4.61:1, secondary text 5.49:1, field outlines 3.24:1, CTA 9.29:1. Inputs remain 16px; small copy is 14px.

The generic checker flags the 32px dismiss button in all fine-pointer cases. This is the shipping renderer's intentional 32px mouse target, enlarged to 44px by `(pointer:coarse)`; it is not a 32px form control. The pointer-specific rule was checked in source. Phone viewport checks here retain a desktop pointer and are not physical touchscreen certification. Actual form controls measure at least 48px. No renderer changes were made to silence this finding or invalidate other approvals.

The three shallow swatches explain the material enquiry without dominating the form. Heading, explanation, optional preference and required email read in order; the action and privacy note are grouped. Long headline/body/CTA wrap without collision. At short phone heights the card scrolls; normal 320 × 740 fits, with a visible dismiss button. The PNG derivative was inspected separately and in the inert package preview; colours, gaps and proportions match the vector.

One primary action asks about samples; it does not promise an order, payment or free postage. The optional question reduces friction. Privacy wording fits a reply, not a marketing subscription. The success state explicitly says no order/payment has been made. No fabricated urgency, testimonials, discount or stock claims. Swatches are illustrations, not proof of stock. Merchant setup notes require relevant upholstery pages, follow-up availability/postage and avoiding checkout. Existing 20-second timing is a suggestion, not proof of conversion improvement. A licence grants download access; it does not block an installed campaign.

## Journeys

In the studio: empty required email blocked; simulated failed submission retained the typed email; retry reached the acknowledgement. Dismiss remains visible and independent. No provider messages were sent.

## Native WordPress

Rebuilt Free and Pro assets, booted disposable WordPress 7.1.3 / PHP 8.3.33 with the actual plugins and no WooCommerce. Created an isolated local-capture campaign through Prefill and OptinRepository. The fixture changes only opening to immediate and broad local targeting for inspection. Test-only shadow roots were opened to make the real loader inspectable; the production renderer, capture endpoint and contract were unchanged. Inspected native desktop and 320px form and settled acknowledgement. Submitted fictional email addresses with Everyday care selected and with the optional preference blank. Both succeeded; database inspection confirmed two local Lead captures and the preference persisted. See `native-results.json` and native screenshots.

Limits: no external email/SMS delivery, physical-device test or measured conversion claim. Live premium transport and installation/offline verification are separate release acceptance checks; this editorial approval does not claim those happened before publication.
