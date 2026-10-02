# Prepared collection setup review — 2026-09-30

Scope: the sixteen exact setup references in `tools/design-library/collections/source.json`, rendered by renderer SHA256 `98db80085e6a9e57bb85a64f7d53ae90cb63d5e8aef8d0bbbb1c4d300962b3cb`. This is a scoped re-review after the prior shared approvals became stale on main. It is not approval of the other 92 setups.

## Visual evidence

The shipping renderer and phone adapter rendered all 30 screens at 320, 390, 768 and 1440 CSS pixels, LTR/RTL, normal and longer copy plus consent. The browser's Check all sizes control completed 480 cases, with zero reported horizontal overflows, controls below 44 pixels, inputs below 16 pixels, low solid-colour text contrast or low field-boundary contrast. Minimum controls range from 44.2 to 50 pixels. Long phone screens scroll; this is expected, not hidden content.

Saved measurements: [layout report](picker-collection-layout-2026-09-30.json). All-screen visual inspection at 390 pixels: [group 1](picker-setups-1-2026-09-30.png), [group 2](picker-setups-2-2026-09-30.png), [group 3](picker-setups-3-2026-09-30.png). These show setup variants separately; they do not count shared layouts as new designs. The audit's old “undefined · Setup notes” caption was a tooling defect, subsequently corrected without altering designs.

Hierarchy, spacing, fields and acknowledgement copy are coherent. Service acknowledgements describe a request rather than a booking. Reading/launch forms show their actual consent purpose. Illustration backgrounds require visual inspection in addition to the solid-colour measurements; no text is placed over a busy illustration in this selection.

## Practical journey evidence

`bin/verify-picker.php` prepares each exact setup through the actual WordPress REST routes. For every capture setup it checks the published journey contract, accepts a realistic example using the declared fields, refuses invalid identifiers, enforces displayed consent, and refuses unknown service choices. Multi-screen enquiry fields are read across their real submission boundary, including the prior interest choice and later email. For the three click-only setups, there is no invented capture or subscriber claim.

A launch signup was also completed in the production picker’s visitor-journey test using `review@example.test` and explicit consent. It reached “You’re on our request list” and reported “Accepted in test”; no Lead, provider request or conversion was created. Every screen is directly inspectable, independently of this simulation.

Requirements remain merchant work: actual offer codes/terms/links, meaningful page placement, privacy and delivery settings, and real countdown schedules. The Black Friday collection is labelled preparation ideas; it does not claim these are finished seasonal campaigns. A guide request acknowledgement does not claim receipt in an inbox. Form validation and simulation are not delivery proof or measured conversion improvement.

## Native WordPress evidence

[Native report](picker-wordpress-2026-09-30.txt): WordPress 7.1.2 / PHP 8.5.10 in a disposable Playground, Free + Pro plugin sources mounted. All sixteen previews match prepared draft templates exactly; changed prepared hashes are refused. Metadata omits full trees/copy and preview batches reject more than 24 IDs. Preference conflicts, ownership, limits and valid calendar dates are exercised. No existing campaign changes, publication or external delivery occurred. Test user/documents are restored in `finally`.

No CI or real email/SMS tests were run. This review approves these versions as starting points, with the stated setup requirements, not ready-to-publish merchant campaigns.
