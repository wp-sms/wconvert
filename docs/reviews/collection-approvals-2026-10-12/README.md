# Collection dependency re-review — 12 October 2026

Reviewer: Codex. Base: `bdfb4368`. Scope: 24 prepared setups used by six bundled
collections. This is fresh review of the current renderer and prepared campaigns,
not a renewal based on the older evidence. Exact setup revisions, the renderer CSS
hash and screen-to-contact-sheet mapping are in [manifest.json](manifest.json).
The remaining 104 studio setups are outside this approval pass.

## What was fixed

`ledger-card` placed its consent node after the stack containing the email field
and submit button. Move consent inside that stack, before submit. The prepared
`editorial-weekly` now keeps the field, consent and action together; both screens
were inspected again at desktop/phone widths and with long RTL copy. Design
history records version 4. No shared renderer change or approval bypass was made.

The local test fixtures also needed realistic resource pages, the actual phone
library, an actual WooCommerce coupon, and a root-level `ends_at` schedule value.
Those are review configuration, not changes to shipping campaign behavior.

## Visual inspection

Actually inspected all 42 prepared screens/results in the 11 [normal boards](visual/)
and 11 [long-copy RTL boards](stress/), plus the configured WordPress captures in
[native](native/) and [commerce](commerce/). Boards pair 320px and desktop. The
reports exercise 320, 390, 520, 640, 768, 960, 1280 and 1440px in both directions:
672 normal plus 672 long-copy cases, zero reported overflow, close collisions,
small-copy or contrast failures. These measurements support visual judgment;
they do not replace it. All screenshots are lossless WebP copies of fresh browser
captures, not reused artwork or screenshots from an earlier review.

Observed: heading/body hierarchy remains readable, labels and field boundaries
remain distinguishable, actions fit without clipping, and stacked phone layouts
keep related controls together. Success screens remain visually related to the
initial form and do not promise that a booking or subscription is confirmed.

| Setups | Practical and visual judgment |
| --- | --- |
| edition-early-access, homeware-care-notes, restock-announcements | Short signup followed by a clear received state; optional interest remains optional. Consent sits with the form. |
| sale-deadline, first-order-receipt | Announcement/offer can be understood without a form. Configured countdown and copied coupon remain readable at 320px. Merchant must supply genuine dates, offer and terms. |
| lighting-collection, specification-sheet | Clear linked information with a useful next step. Native review opens configured local collection/specification pages. |
| home-repair-quote, cleaning-quote, repair-assessment, renovation-callback, website-review-enquiry | Purpose-specific enquiries; required fields, phone control where used, retry and received state checked. No appointment is claimed by submitting. |
| repair-advice-request | Optional item choice precedes contact details. Back preserves the choice; all three screens remain usable on phone. |
| sunday-reading, editorial-weekly | Newsletter proposition, consent and action form a coherent sequence; editorial-weekly consent placement fixed. |
| writing-checklist, reading-notes-guide, excerpt-window | Resource promise and received state match a configured local resource. Local queued mail contains the correct link. |
| recommend-accessory, explore-compatible-extras, add-useful-extras, basket-cross-sells, shopping-guidance | Product/link actions remain clear; actual basket actions and empty-basket suppression checked where applicable. Missing product photos collapse gracefully in the disposable catalogue. |
| coffee-taste-finder | All three answers produce their own result with actual product links. A simulated empty catalogue retains an understandable unavailable state and working shop link. |

## Visitor and WordPress checks

- [Studio journeys](studio-journeys.json): all 24 passed, including every prepared
  route/result. These use simulated submissions.
- [Native results](native/native.json): 18 non-commerce setups at 320 and 1280px,
  36 cases. Four sale/coupon cases were rerun after adding real countdown and
  clipboard assertions; the archived records and images contain those final runs.
- Fourteen form setups (28 width cases): empty/invalid identifiers blocked,
  simulated first-request HTTP 503 retained input, retry saved an actual local
  Lead and reached the received state. Required visible consent checked in ten
  width cases. Country search uses the actual phone library. Back navigation
  retains the repair item selection.
- Three resource setups at both widths: actual destination configuration and
  Action Scheduler handoff to a local `pre_wp_mail` interceptor, with the resource
  URL in the recorded message. Unique fictional recipients avoid the intentional
  resource-send deduplication window. No external email/SMS was sent.
- First-order offer: copied `REVIEW10` using the browser clipboard and verified an
  actual WooCommerce ten-percent cart discount. Sale: actual configured countdown.
- [Commerce results](commerce/commerce-refresh-2026-10-12-live.json): all six
  setups rendered at desktop/320px, two confirmed basket additions, two
  empty-basket suppression checks, actual destination/product URL responses,
  three coffee result routes, and one simulated empty-catalogue fallback.
- The disposable shop has fictional, sometimes repeated product names from
  repeated seeding. Results are checked by actual product identity. This is not a
  review of a merchant's catalogue or imagery.

## Collections

Reviewed sale-planning, launch-a-collection, service-enquiries,
reader-relationships, black-friday-2026 and help-shoppers-choose. Membership is
useful to the named need; steps are alternatives/stages, not an automatically
scheduled campaign. Member screenshots and native checks above support each
collection's checks. [Candidate discovery results](discovery/discovery.json)
and [screenshots](discovery/) use the shipping discovery model in the studio:
all six have prepared screens, five usable collections remain on Free, and the
all-Pro shopping collection is excluded from Free recommendations.

Black Friday enters Featured on 16 October, is available before then in Browse,
and expires at the exclusive 1 December boundary. Selecting/browsing does not
publish or schedule anything. Checked dates: 15/16 October, 27 November, 1 December.

The candidate discovery report deliberately records zero collections from the
WordPress picker before republishing: stale runtime dependency hashes make the
old snapshots ineligible. This is not a successful published-membership check.
Approve reviewed setups first, rebuild collection revisions, import collection
reviews, then generate runtime snapshots. A separate post-publication report
must verify all six from the actual WordPress picker before release acceptance.

## Limits and reproduction

Chromium, disposable WordPress 6.8.3/PHP 8.1, current Free/Pro bundles and
WooCommerce. Native visitor journeys use 320/1280px LTR; renderer visual audits
also cover RTL and long copy. Not a physical-device/cross-browser certification,
external-delivery test or measured conversion claim. No R2, licence integration,
remote deployment or CI. No setup in this reviewed scope remains marked revise;
out-of-scope stale reviews are deliberately untouched.

Use the guarded MU fixtures only in a disposable loopback site with
`WCONVERT_DS_SECRET` defined. They create/reset local campaigns and intercept mail.
Never mount them on a merchant or production site. Existing demo setup instructions
are in `tools/design-library/demo/README.md`.

```sh
npm run templates:pilot
# WCONVERT_REVIEW_IDS is a comma-separated subset; omit for full library scope.
WCONVERT_REVIEW_IDS="$REVIEW_IDS" node tools/visual-tests/library-polish.mjs audit
WCONVERT_REVIEW_IDS="$REVIEW_IDS" node tools/visual-tests/library-polish.mjs capture
WCONVERT_REVIEW_IDS="$REVIEW_IDS" WCONVERT_REVIEW_LONG_COPY=1 node tools/visual-tests/library-polish.mjs audit
WCONVERT_REVIEW_IDS="$REVIEW_IDS" WCONVERT_REVIEW_LONG_COPY=1 WCONVERT_REVIEW_RTL=1 node tools/visual-tests/library-polish.mjs capture
node tools/visual-tests/collection-approval.mjs
node tools/visual-tests/template-refresh.mjs
node tools/visual-tests/collection-discovery-review.mjs --candidate
# After review imports and collections:publish, rerun without --candidate.
```

This report and its evidence are immutable once imported. Record subsequent
release checks separately so their addition cannot silently rewrite approvals.
