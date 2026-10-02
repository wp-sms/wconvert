# Local release follow-through — final validation, 1 October 2026

Completed the approved three steps: practical campaign approval for Specification sheet and Excerpt window; content-based approval identity independent of similarity neighbours; first illustrated downloadable Homeware care pack with update/offline verification.

## Result

- 110 pilot setups, using 61 designs from the 93-design inventory.
- 18 current approved setups in five approved curated collections. The other 92 pilot approvals remain stale; no blanket approval.
- Downloadable compatible subset: 16 setups, 13 designs, four Free packs, two complete collections. Stores/publishers 1.1.0; services/homeware care 1.0.0.
- Exact local release: `fcae3992f5664f27ae9287360e73008520becf13d7e3f9a991f6a702b62662d3`.
- Repeated publication created zero objects and reused all eleven. Storage is disposable `/tmp/wconvert-template-release-local`, not hosted infrastructure.

## Checks

- Template registration: 93 designs preserved by the shipping vocabulary.
- Final full PHP suite: 2,404 tests, 14,491 assertions, passed.
- Full JS suite: 194 files, 3,516 tests, passed with two workers. The first concurrent run hit nine timing failures while browser/layout checks were also active; the bounded-worker rerun passed without changing those tests.
- Studio suite: 36 tests passed, including stable review identity, real reviewed artwork export and refusal after source/raster/evidence changes.
- PHPStan with 1 GiB memory: no errors. ESLint: passed. Free source contract: passed. Exact runtime collection check: five approved.
- Browser collection audit: 528 cases across 18 prepared setups, four widths, both directions and longer copy; zero overflow/control/input-size/solid-colour contrast findings.
- Native WordPress: all three scoped campaigns passed publication/link/capture/retry/saved-values checks. Real browser keyboard flows reached matching product information, request acknowledgements and the six-exercise workbook. Emails were intercepted in the disposable local outbox only.
- Actual exported pack: preview/install agreement for all four packs; offline 13-design/16-setup/two-collection library; synthetic next version of the real illustrated pack reused the image, retained the original pack/design and resolved both offline.
- Generated public illustrated preview inspected on `wconvert.local`; the user can open `tools/design-library/out/illustrated-pack.html`. This is the generated release showcase, not a configured catalog endpoint.

## Correction found by the full suite

An initial raster embedded in the bundled JSON violated both the design and frontend payload budgets. It was removed; those budgets were not raised. The original compact SVG remains unchanged. Publication now explicitly binds its reviewed raster derivative and evidence hashes. Final full PHP checks pass. Existing saved campaign snapshots were not rewritten.

## Boundaries

No licence-manager adapter, R2/Worker deployment, external email/SMS delivery, CI or merge. Real server authorization, website integration, retention policy, more distinct templates, merchant studies and the remaining deferred sale-link/lighting-artwork exports still need separate work. Native fixtures and screenshot evidence prove local behaviour, not conversion uplift or production infrastructure.
