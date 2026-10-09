# Product warnings are current catalog advice

Accepted 2026-10-05 after approval to implement the first maintenance feature.

Campaigns checks displayed rows in batches of at most twelve. **Amended by
[ADR 0127](0127-free-keeps-product-seams-not-product-reads.md):** only on an
install where the journeys or commerce capability is active; elsewhere the list
shows no product checks and the endpoint returns none. The protected,
no-store admin endpoint reads the published snapshot for a published Campaign,
including a suspended one; otherwise it reads the saved draft. Checks do not
write campaign state, create statistics, open a WooCommerce session, or add
tables, options, scheduled tasks or visitor requests.

Each product selection reports available, warning, unable to check, or needs a
sample basket. Details name the result or recommendation selection and the next
repair; selected unavailable products include their current names or deleted ID.
All six selected IDs are checked, including reserves beyond three visible cards.
The commerce adapter reuses storefront card eligibility and recommendation
resolution. Ordinary paid quiz links use their existing Store API predicates
(answered by Pro's journeys module through `wconvert_check_products`, per 0127);
category filters share the storefront query. **Extended by
[ADR 0126](0126-category-results-support-explicit-curation.md):** curation adds
up to three pin candidates alongside the bounded twelve ordinary candidates.
Missing eligible pins warn even when other products match; intentionally excluded
pins do not warn.
No-match warnings mean that this source currently supplies no eligible cards,
not that the entire category was exhaustively scanned.

The optional Everyone else result can intentionally have only a fallback link.
Variable quiz products remain valid links. Standalone direct-add offers with no
supported direct addition warn because their runtime suppresses that offer.
Basket-sourced cross-sells without a fixed main product require an editor sample;
the check never invents a visitor's basket or claims display eligibility.

Warnings are advisory, not Suspension and not a new publication gate. The list's
status filter explicitly says Suspended so its count cannot be mistaken for a
site-wide count of product warnings. Health is page-scoped, not a whole-store
audit. Recheck refreshes catalog state; page changes abort/ignore old requests,
partial reads fail explicitly, and a twenty-second timeout permits retry.
Unpublished fixes do not hide live issues. Opening details shows which version
was checked and offers the existing editor action. There is no background monitor.

No visitor outcome, module entitlement, ordering, cart mutation or reporting
contract changes. Earlier ADRs 0120–0124 remain in force. A full storefront cart
pass and existing release gates still apply before shipping.
