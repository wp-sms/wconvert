# Actionable analytics implementation verification

4 October 2026. Implementation for PR #213, with AI excluded. Decisions and explicit scope boundaries are in [ADR 0119](../adr/0119-actionable-reports-use-local-evidence-and-order-provenance.md).

## Automated checks

- Full PHP suite: 2,529 tests, 15,244 assertions passed.
- Full JavaScript suite: 208 files, 3,723 tests passed with two workers. An earlier highly concurrent run timed out in several editor tests; all affected files passed on the bounded rerun. The one genuine lazy-import violation was corrected by moving shared journey reporting out of the editor directory.
- PHPStan, TypeScript and ESLint passed during implementation; final focused checks follow the last review changes.
- Source boundary and all loader byte gates pass. The separate enabled-store attribution asset is 565 bytes gzip, below its 2,048-byte cap. A shared quiz result-click helper keeps existing paid-loader budgets intact.
- Report rules exercise low-volume suppression, equal-period comparisons, exposure versus result-rate changes, and exclusion of historical/paused campaigns. Answer tests separate changed labels and omit text answers. UI tests reject mismatched journey periods and verify inspectable evidence and explicit edit actions.

## Real WordPress and WooCommerce

Used a fresh, disposable Playground at port 9442, WordPress 7.1.2 / PHP 8.3 / WooCommerce 11.1.2, with the site calendar set to Asia/Muscat. Both plugins mounted successfully. No existing merchant database was used. Fixture files under `tools/visual-tests` are excluded from releases.

`revenue.spec.mjs` verifies on both legacy and HPOS order storage:

- A qualifying interaction initializes pending attribution; an appearance alone does not.
- Classic and Blocks checkout hooks bind one order; repeat hooks and a second order do not double-credit it.
- A paid order contributes its product total, an allocated product refund reduces it, and an unallocated refund makes the amount unavailable.
- WooCommerce order privacy erasure removes provenance.
- Denied consent, expired interactions, nonexistent campaigns, and older orders do not gain credit. Unpaid orders do not contribute revenue.
- A real form submission in the browser records attribution only after acceptance.
- Actual classic AJAX checkout and Store API checkout both bind campaign provenance using a disposable virtual product and local COD test gateway. No real charge is made.

The fixture synchronizes order storage before changing the WooCommerce storage mode; it does not bypass WooCommerce’s pending-sync guard.

## Visual review

Viewed the real Analytics screen at desktop width and captured [desktop](actionable-analytics-2026-10-04-desktop.png), [390px](actionable-analytics-2026-10-04-mobile.png) and [320px RTL](actionable-analytics-2026-10-04-rtl.png). No whole-page overflow at 390px or 320px, including a proper RTL page reload. Inspectable evidence uses native keyboard-operable disclosures and labeled scroll regions. New totals reuse the existing Harbor table/region styles.

## Practical limits

Customer interviews and production-scale store measurements have not been performed. Gateway-specific test-order identification is not universal; the setup guide requires a staging store and explains the explicit exclusion marker. Revenue queries refuse partial totals above 2,000 paid orders or the processing budget and ask for a shorter period. Site-wide and exact-campaign revenue are implemented; family/Goal revenue rollups and revenue CSV remain outside this first release. Existing outcome CSV, A/B comparisons and manual campaign editing remain available. Tracking is off by default and requires explicit statistics consent configuration.
