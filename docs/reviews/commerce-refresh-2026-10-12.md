# Template studio and commerce refresh — 12 October 2026

Reviewed in the isolated `codex/template-library-refresh` checkout. The user's active Flow work and local site were not edited. These are editorial approvals of the listed snapshots, not conversion-performance claims or hosted publication. External delivery and CI were skipped as requested.

## Scope and compatibility

The studio now prepares 128 setups. Three new source designs and three new registered setups join three existing commerce setups in the six-item `commerce-refresh` batch. The full source inventory contains 107 designs and 153 registered setups. The studio counts designs separately from setups.

The standalone authoring environment supplies an empty offer destination through Prefill's existing injection seam. It never guesses a store URL; real WordPress still resolves the site's own destination. Runtime constants are loaded from the source. Product-result previews now include explicitly labelled inert sample cards and every result variant. No product request or invented price is made by a static studio preview.

Remote pack validation now accepts declared v3 flow trees, validates their routes and capture contract, and retains immutable installed versions. Invalid routes, undeclared vocabulary, unknown keys and site-specific URLs remain rejected. Paid display-format validation uses the shipping `floating_bar` identity.

## Visual review

The 24 unique setups referenced by the six collections were rebuilt with the current renderer. All 42 screens/result variants were captured at desktop and phone sizes and visually inspected. The `october-<setup>-<screen>-wide.png` and `-phone.png` files record this review. Controls, typography, wrapping, spacing, success screens and product areas were inspected.

`commerce-refresh-2026-10-12-audit.json` records **672 cases** at 320, 390, 768 and 1440px, in LTR/RTL, with normal and longer copy. There are zero horizontal-overflow, small-control, small-input-text or solid-colour contrast findings. This measurement is scoped to those 24 setups, not the entire library. The preview product-image block uses a neutral background with explicit readable text.

## Journey and WordPress review

`commerce-refresh-2026-10-12-journeys.json` records 24 browser rehearsals through the studio's actual controls: required input blocks progression, simulated failure retains the current form, retry reaches the acknowledgement, and non-capture setups remain non-capture. Simulated acceptance does not save or send anything.

`commerce-refresh-2026-10-12-wordpress.json` records all **128 curated setups** successfully prepared by the real WordPress container, with registered designs and no data lost by normalization. The disposable site reports WordPress 7.1.3 / PHP 8.5.10 / WooCommerce 11.1.2. It uses the repository's no-delivery harness and an explicitly consented test browser.

`commerce-refresh-2026-10-12-live.json` and `october-live-*.png` record six published examples on that disposable WooCommerce site:

- Add useful extras: product cards, prices and a confirmed addition.
- Recommend an accessory: configured product-page context and product links.
- Shopping guidance: populated-basket appearance and empty-basket hiding.
- Explore compatible extras: new split composition, configured main product and compatible choices.
- Basket cross-sells: new compact composition, configured WooCommerce cross-sells, out-of-stock exclusion, confirmed addition and empty-basket hiding.
- Coffee taste finder: new question composition; bright, smooth and unsure answers each resolve the expected real category product; returning preserves the answer. No email gate.

Desktop and 320px screenshots were captured, with no document overflow. Test products deliberately have no images; the live cards also work without artwork. Merchant product choices, category mappings and cross-sells still need to be configured for each real shop. No purchase or conversion lift was asserted.

## Editorial decisions

Approve the 24 collection-dependent setup snapshots after the above review. This renews only the inspected subset after the renderer changes. Other stale approvals remain stale. Two pre-existing note changes are now pinned: Homeware care says “Keep in WConvert only”, and Website review enquiry uses the current equivalent wording. No customer campaign is rewritten.

The new shopping collection uses three existing designs and three new designs honestly. It offers alternatives for product-page browsing, basket extras and product discovery; they are not six steps a merchant must deploy together. The content is evergreen, store-specific and filtered by Goal, format and entitlement. Each new brief states prerequisites, practical placement and what the plugin measures.

The six collection sources retain their existing date/market rules; the new collection has no event dates. Approval of collections follows separately after these exact setup decisions are imported. Hosted promotion and licence authorization remain separate, deferred work.

## Verification

- PHP: 2,825 tests / 17,068 assertions passed.
- JavaScript: 234 files / 4,297 tests passed; the added inert-product-preview regression also passes separately.
- Studio: 37 tests passed, including flow reference normalization, source-bound review invalidation and publishing guards.
- Template registration: 107 designs passed. Source-contract verification passed.
- TypeScript and production assets build passed.
- Graph pack install/update/offline regression preserves original routes and styles and rejects malformed inputs.

Run `tools/visual-tests/template-refresh.mjs` against the explicitly disposable commerce harness and `template-studio-refresh.mjs` against the local studio to repeat the behavioural checks. The JSON/layout evidence is a dated snapshot, not an automatic assertion that future renderer changes are approved.
