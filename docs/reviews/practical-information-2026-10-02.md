# Two practical information setups — 2 October 2026

Completed the two intentional-reuse briefs: accessible-visit-note uses Availability note (slide-in), and returns-deadline-notice uses Inline signpost (floating bar). Both are supplied by the Pro display-types module. The library has 118 setups using 67 designs, with 99 designs across source libraries. No design trees, tokens, assets or renderer code changed. Completed briefs are removed from the planned backlog; hosted packs and curated collections are unchanged.

## Practical copy and setup

Arrival information points to entrance, parking, drop-off, step-free routes and facilities without asserting that the venue is accessible. Merchants must verify facts and provide a contact route; when facts are unknown, use an enquiry instead. Delay 20 seconds on relevant visit/location pages and exclude the information page. Keep ordinary page navigation available.

The returns-policy bar offers a direct information link while browsing seasonal collections. It invents no deadline or extended window. Merchants configure real terms, destination and any schedule, and exclude the policy page, basket and checkout. Its default delay is 8 seconds. Both setups measure link clicks, not visits completed, bookings, orders or return requests. Site-specific page rules and URLs must be configured before publication.

## Review evidence

- Inspected desktop and 320px previews, plus RTL and longer-copy previews. Audit: 32 rendered cases covering both single-screen setups at 320/390/768/1440, LTR/RTL, normal/stress. Zero overflow, target-size or solid-colour contrast findings. Minimum action heights 50px and 48.5px. Neither design needs an image, form, consent, result or acknowledgement.
- Inspected actual WordPress desktop overlays and 390px phone overlays after rendering settled: readable hierarchy, close controls, complete CTA and no excessive empty banner space.
- On wconvert.local, walked Create campaign → Promote an offer or content → new setup details. Arrival shares its design card with service-visit arrangements. Search for returns finds the new policy setup. Reviewed both detail modals and prerequisites. No customer campaign was created or published there.
- In the disposable WordPress site, normal Prefill/create/publish paths configured selected review pages, local destination URLs and immediate test display. The production playbooks retain their 20-second/8-second delay. Keyboard activation followed both real buttons to the correct matching pages, and both close buttons dismissed their overlays. The destination pages state their fictional status, limitations and actual role; they offer no real services or return terms.
- Native verifier passed publication and real link destinations for both. Capture validation/failure/retry are not applicable to these click-only setups. No real email/SMS delivery, CI, remote template release or customer publication.

## Validation

PHP: 2,436 tests / 14,787 assertions passed. Template studio: 36 tests passed. Source contract clean. The visual-direction refusal test now uses a stable fixture so an empty, completed backlog does not break that check. Review evidence is new and scoped to these setups; existing approvals are retained.
