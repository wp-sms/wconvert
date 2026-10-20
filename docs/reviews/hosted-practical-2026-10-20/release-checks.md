# Release validation

Candidate: `3f78ca41c2f7c38f7a6fec4b3a741fa200ef88b4b5333e909a57fb663711e5a7`.
Previous live release: `359f655d63d6c070eed1266a7a0fc43a57d80ebb8270745f0920c814051172bb`.

- Shipping catalog/pack reader accepted all eight packs.
- Local Workerd/R2 verification: five Free packs, three anonymous premium refusals, eight public previews, two public images and 25 downloadable Free setups.
- Disposable WordPress 7.1.3 / PHP 8.1.34, Pro and WooCommerce with explicit local premium fixtures: all eight packs installed; 32 designs, 35 setups and six collections readable offline. Three illustrated packs passed update/offline checks, reusing unchanged artwork and retaining the original snapshot.
- All 20 exported design screens inspected at desktop (1440) and phone (320), saved in `export-captures.json`. Exported examples show base design wording; installed campaign presets apply their specific wording and privacy guidance. Public previews are inert, omit overlay dismiss controls and use the phone fallback input; actual prepared campaigns and country-picker interactions are covered by native evidence.
- Source/editorial gate: nine curated collections approved and compiled; twelve selected setup approvals imported through the review tool. Other existing approved collections remain valid.
- PHP: 3,382 tests / 19,274 assertions passed. Studio tools: 47 tests passed. TypeScript passed. Initial parallel JavaScript run had five 5-second timeouts in two unchanged builder test files; both files passed when rerun alone (152 tests). A full run with two workers is recorded separately.

No Worker deployment, Nexus configuration, customer campaign publication or external message delivery is part of this update. Hosted catalog promotion is a separate compare-and-swap publication, recorded after live verification.
