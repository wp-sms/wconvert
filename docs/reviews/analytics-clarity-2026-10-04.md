# Analytics clarity review — 4 October 2026

## Brief

The user found the newly added sections unclear and visually weak and requested an implementation that follows the existing guidelines. Improve hierarchy, scanning, short copy, setup versus reporting, and mobile/RTL behavior. Preserve reporting periods, evidence, consent, currencies, refunds, manual merchant actions and the exclusion of AI. The baseline is merged PR #213, commit 2093db04fe06135212f7bf459abf448769e7554e.

## Changes

- Needs attention: campaign identity, the observed change, current/prior evidence and the edit action are visible together. Full period comparisons remain inspectable.
- Campaign sales: a two-step first-time setup; separate report figures, linked orders, tracking settings and metric definitions. One currency uses figures; multiple currencies use the shared table. Consent setup has a direct guide link.
- Submitted interests: count-and-percentage bars show the distribution of retained responses; each question keeps its own denominator and multi-choice overlap is explained.
- Signup and screen activity: accepted signups stay separate; actions align on one row per screen/version. Missing observations stay unavailable rather than being inferred as zero.
- Shared native disclosures, Harbor icons/surfaces/type, logical styles, responsive DataTable rows and space between independent regions.

## Verification

TypeScript and ESLint passed. The focused dashboard, report and stylesheet suites passed 612 tests. Disposable WordPress 7.1.2 / PHP 8.3 / WooCommerce 11.1.2 loads the actual production bundles; browser response fixtures supply illustrative report states without touching the user's local database. Visual review covers overview, campaign detail, expanded evidence, setup, empty, loading and failure states; narrow and RTL layouts are included. Final visual results and the two-axis review are recorded below after completion.
