# Recommendations release candidate: library regression review

5 October 2026. Reviewer: Codex. Scope: the 18 existing setups referenced by
five bundled collections, and the separately reviewed new recommendation setup.
This is an engineering/editorial review, not a merchant study or public release.

## Existing collection setups

Built the HEAD renderer from a disposable `git archive` checkout and the current
renderer using their own build entries. The browser comparison covers all 122
prepared setups and 241 screens/result variants: their complete markup and shared
responsive styles are byte-identical. See `renderer-comparison.json`. The baseline
hash matches the final renderer approved in `../commerce-renderer-2026-10-04.md`.
No collection Playbook or design source changed; the collection build verifies
its pinned source hashes. The new renderer event only handles confirmed cart
additions. None of these 18 existing setups uses that action.

Fresh visual inspection also covered every screen of all 18 referenced setups,
paired at 768px and 320px available widths. Corresponding `<setup-id>.png` files
sit beside this report. Headings, labels, consent text, primary actions, wrapping,
spacing and acknowledgements remain readable, without clipping or overlap.
Inspected Excerpt window in RTL as well (`excerpt-window-rtl.png`). The studio's
1,928 screen/width/direction cases report zero layout findings; see
`layout-checks.txt`. These are browser/container checks, not physical-device tests.

The current full JavaScript run (211 files, 3,764 tests) covers existing renderer,
journey, required-input, error/retry and conversion behavior. The PHP run passed
2,544 tests and 15,651 assertions; final lifecycle checks passed 33 related tests.
These runs are recorded in `../../testing/recommendation-additions-2026-10-05.md`.
The unchanged existing route and configured WordPress evidence is retained from
`../commerce-renderer-2026-10-04.md` and its earlier linked review history. This
review does not claim fresh manual submission or external delivery for every
old setup. No capture form, submission identity or destination in these setups
changed. Fresh real WordPress/WooCommerce checks passed 21 recommendation checks
and 14 addition checks against the final source.

Decision: renew the 18 collection setup reviews with this regression evidence.
Historical review records for setups outside these collections are left intact.
This does not relabel the entire historical library as freshly reviewed.

## Collections

Sale planning, Launch a collection, Service enquiries, Reader relationships and
Black Friday 2026 retain their membership, names, descriptions, audience, ordering
and event dates. All 18 dependencies pass the review above. The collection review
changes only renderer-bound dependency review references; the generated runtime
snapshots must be refreshed through the normal publish/check commands.

## New recommendation setup

The user approved the local **Add useful extras** design after implementation.
The actual 320px campaign, desktop storefront, inert setup preview, keyboard
addition, accepted feedback and native cart updates are documented in
`../../testing/recommendation-additions-2026-10-05.md` with screenshots under
`../recommendations-2026-10-05/`. It is a bundled starting point, not a new member
of these curated collections. Product-option, missing-stock and extension
fallbacks remain part of the verified action contract.
