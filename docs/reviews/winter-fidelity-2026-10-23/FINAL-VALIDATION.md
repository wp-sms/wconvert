# Final validation

The full suites passed 5,151 JavaScript tests and 3,732 PHP tests (21,907 assertions), 92 studio tests, lint, TypeScript, PHPStan, template registration, source split, revision currency and the releasable gate. Spec and standards reviews resolved their findings.

CI uses Node 22, whose gzip result is slightly larger than the local Node 24 build. Reproduced with Node 22.23.4 and kept the existing budgets: Pro 30,601 / 30,720 bytes gzip, Free 17,370 / 17,456. Each loader uses measured safe compression and omits its unused IIFE export namespace; source exports remain available to composition tests. The shared journey resolvers omit editor-only diagnostic arrays in visitor builds, while route selection, traversal, loop guards and filtered answers remain unchanged. Routing parity and existing trace tests verify this boundary. Both inspectors retain their existing settings and do not consume these diagnostic arrays.

The full Node 22 loader contract and both inspector builds pass. Both final minified loaders boot; 86 targeted loader, inspector, tier and routing tests pass. Four further real WordPress signup/offer cases pass against the production loader (`../winter-production-loader-2026-10-23/results.json`).

The server reader now accepts safe continuous layout values and exact declared palette references. Its tests reject unsafe input, unknown categorical settings and external CSS variables. All 40 winter designs export successfully. The reader correction also exposed three repeated-space strings in an existing editorial design, normalized and separately reviewed in `../winter-export-spacing-2026-10-23/`.

Local server release 409ee17397172aea39db7e9378e3ee42f02143d654e2ff287d03399fef27c9b2 passes release integrity/entitlement checks and real WordPress installation, including premium fixtures. Commerce-dependent items are explicitly skipped on the WooCommerce-free verifier site; none of the winter designs require WooCommerce. The local PHP validation transport excludes website HTML, which its catalogue reader never requests; the complete public HTML remains in the release and in release integrity verification.

The local release is prepared, not evidence of a live deployment. Live verification is recorded separately after promotion.
