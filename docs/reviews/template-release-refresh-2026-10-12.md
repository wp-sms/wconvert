# Local template release rehearsal — 12 October 2026

This completes the authorized studio compatibility refresh, local release rehearsal and small commerce batch. Work is isolated on `codex/template-library-refresh`; it has not been merged, pushed or deployed. The user's normal checkout was left untouched.

## Released locally

Storage: `/tmp/wconvert-october-release` (disposable, outside the WordPress document root).
Metadata origin: `https://templates.example` (never contacted).
Final release: `7c71c0d5fa2254a8fda0dd9c8e95ad3f2fdec878f5c46263ac79aee17a5aa736`.

- 22 campaign setups, 19 design identities, five packs and three complete collections.
- Four Free packs: stores 1.1.1, services 1.0.1, publishers 1.1.2 and homeware care 1.0.1.
- One premium pack: shopping help 1.0.0, containing the six commerce batch setups. Editable bytes live only under `private/packs`.
- The existing reviewed homeware raster is retained. Merchant product images are resolved on the receiving shop; they are not exported from test products.
- Two unconverted/site-specific sources remain explicitly deferred from remote release: sale-deadline and lighting-collection. They remain bundled designs.

The first local snapshot created 13 immutable objects. The optional-result-link preview correction and renewed collection dependency created three new objects, reusing ten. Repeating the final release created zero objects, reused thirteen and kept the same release ID. Previous immutable objects/manifests remain available. No release directory was served as a public web root.

## Actual WordPress verification

`bin/verify-template-release.php` ran against the actual plugin in disposable WordPress 7.1.3 / PHP 8.5.10 with Pro and WooCommerce 11.1.2. In-memory catalog options and a temporary archive prevent writes to saved site settings or campaigns.

```
PASS native preview/install: homeware-care
PASS native preview/install: publishers-starts
PASS native preview/install: services-starts
PASS native preview/install: shopping-help
PASS native preview/install: stores-starts
PASS offline library: 19 designs, 22 setups, 3 collections
PASS illustrated update/offline: homeware-care; unchanged artwork reused, original snapshot retained
```

Private premium bytes were available only through the verifier's explicit `WCONVERT_VERIFY_PREMIUM_FIXTURES=1` option. This proves local content compatibility, not licence authorization. Default verification still refuses private downloads. No hosted endpoint or default API URL was configured.

The actual goal-first creation screen also shows Find coffee by taste beside the eight existing find-match setups, with a correctly narrowed Help shoppers choose featured collection (one matching setup/design). `october-native-goal-picker.png` records the real WordPress picker, not a prototype. Six new/reused shop examples were separately published and exercised only in the disposable shop, as recorded in the commerce review.

## Checks and remaining work

PHP: 2,826 tests / 17,074 assertions. JavaScript: 4,297 existing tests plus the new inert-preview test. Studio/export: 38 tests. TypeScript, ESLint, build, template registration and source-contract checks pass. Scoped collection check: six approved collections; new batch gate: 6/6 current approvals. All 24 curated journeys were repeated after the final result-preview correction. Visual measurement: 672 passing cases.

Graph pack install/update/offline tests use a real v3 fixture and preserve old route/style snapshots. Invalid graph references, missing vocabulary capabilities, unknown keys and site URLs are rejected. Paid-rule tests reject insufficient tiers, undeclared capability and undeclared product IDs. The local exporter test now exercises the real plan, including illustrated media preparation and premium basket rules, without WordPress.

The studio contains 128 setups / 75 designs; all source libraries contain 107 designs / 153 registered setups. Only 24 curated setup approvals are current; 104 older approvals remain honestly stale after renderer changes. Re-review those in focused batches before including them in future releases. R2/Worker hosting, actual licence integration, hosted authorization/rollback, public website integration and real delivery remain deferred. No conversion-performance claim is made.
