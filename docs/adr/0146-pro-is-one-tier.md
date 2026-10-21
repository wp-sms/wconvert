# 0146: Pro is one tier

**Shared control amendment — [ADR 0155](0155-visitor-controls-use-font-independent-geometry.md):** Free now caps at 14,896 B and Pro at 27,872 B gzip-9 (*amended by [ADR 0158](0158-a-close-control-takes-room-only-beside-what-it-covers.md): Pro 28,160 B*). Earlier byte measurements below are historical.


Date: 2026-10-13. Status: accepted.
Supersedes [0056](0056-the-tier-ladder-is-a-manifest.md) (the three-rung ladder).
Amends [0014](0014-pro-replaces-the-loader.md), [0015](0015-enforcement-is-by-non-registration.md),
[0026](0026-a-goal-the-site-cannot-serve-is-hidden.md),
[0028](0028-the-free-loader-source-carries-no-premium-code.md),
[0029](0029-the-free-contract-is-proven-at-the-source.md),
[0030](0030-free-and-pro-release-on-independent-tags.md),
[0045](0045-an-ab-variant-is-a-whole-optin.md),
[0058](0058-a-test-ends-when-the-merchant-says-so.md),
[0098](0098-fullscreen-is-a-pro-modal-surface.md),
[0106](0106-question-journeys-extend-the-paid-loader.md),
[0116](0116-free-shows-nothing-it-cannot-run.md),
[0124](0124-quiz-products-share-protected-cart-actions.md) and
[0143](0143-license-page-and-updater.md).

The product is **free plus one Pro with every feature**. ADR 0056 modelled Pro
as three rungs — `basic`, `pro`, `elite` — so that splitting the range later
would be a `tiers.json` edit. The split never came. Only the top rung was sold,
all three displayed as "Pro", and every release built three loaders, three
inspectors and three ZIPs that nobody bought. The Nexus plans (`single-site`,
`5-sites`, `unlimited`) differ only in how many sites a licence covers, which
ADR 0143 already recorded: **a plan is a site count, not a tier.** A vocabulary
the product does not have is a vocabulary that misleads whoever reads the code
next, so it goes.

## Decisions

1. **The tiers are `free` and `pro`.** `WConvert\Support\Tier` has two cases;
   `ladder()` is `[Free, Pro]` and `paid()` is `[Pro]`. `includes()` stays, so
   every registry still answers through `Tier::isSuppliedBy()`. `tiers.json`
   declares one paid tier, `pro`, and **names all ten modules** — no wildcard,
   so the artifact contract still has a list to check the ZIP against.

2. **Every `tier` value in the shipped data was re-tagged in the same commit.**
   `RuleVocabulary`, `SetupIndex`, `TemplateController` and `TemplateLibrary`
   each read `Tier::tryFrom(...) ?? Tier::Free`, so removing the `Basic` and
   `Elite` cases without re-tagging would have turned every premium rule and
   design into a free one, silently. `tests/unit/Support/TierSlugsAreRealTest.php`
   now fails on any `tier` in the rule manifest, `locked.json` (removed by [ADR 0156](0156-the-catalogue-is-one-design-per-object.md)), either design
   library or the integration fixtures that is not a `Tier` case. No tier is
   stored in Optin data, so nothing saved migrates.

3. **The installed tier is no longer inferred from module directories.**
   `WpProPresence` answers `Pro` when `WCONVERT_PRO_LOADED` is defined and
   `Free` otherwise. `TierManifest::tierFor()` is gone; `lowestTierSupplying()`
   is `tierThatShips()`, still read by the admin to name A/B testing's tier.
   Possession is still the gate (ADR 0015): a module whose files are missing
   registers nothing, whatever this answers.

4. **One Pro loader and one Pro inspector**, from
   `pro/resources/loader/src/main.ts` and `inspect/main.ts`, written to the
   canonical `pro/public/{loader,inspector}`. `PRO_MODULES` is the one list.
   `public/tiers/` and `vite.config.pro-tier.mjs` are gone.

5. **One Pro ZIP, `wconvert-pro-v{VERSION}.zip`** — the same shape as free's.
   `release-pro.yml` posts it once per plan slug; Nexus keys each release on the
   `tier_slug` form field (the plan), never on the file name. The upload loop
   is unchanged.

6. **The artifact contract's check (f) is a completeness check.** The Pro ZIP
   carries every module `tiers.json` names and no other. The per-rung
   inference, the "no higher rung's rule identifier" scan and the module-marker
   scan between rungs are deleted with the rungs. `bin/check-loader.mjs` keeps
   the scan that still means something — **free's loader carries no premium
   rule identifier and no Pro module's `bundle_marker`** — and two budgets:
   Free 14,720 B, Pro 27,712 B (the old top rung's, unchanged). *Amended by
   [ADR 0152](0152-a-coupon-link-applies-a-code-a-published-campaign-shows.md): Free 14,768 B.* *Amended by
   [ADR 0147](0147-free-names-what-pro-adds-where-it-is-wanted.md): `bin/check-admin.mjs` runs the free scan over the admin and
   inspector bundles too, with each module's `admin_markers` and the word
   "upgrade".*

## Consequences

- `bin/tier-manifest.php` answers `tiers` and `modules` only.
- The admin's `installedTier` is `'free' | 'pro'`. A Pro install supplies every
  member, so `locked` in practice only reaches free, where ADR 0116 hides it.
- `pro/tests/js/admin-entry.test.ts`'s tripwire — "split the admin build per
  rung before adding a premium screen" — is deleted. There is one Pro, so a
  premium screen belongs in the one Pro admin bundle.
- **Seven approved campaign setups and three collections were carried forward**
  in `tools/design-library/review/shared-reviews.json` (now one file per record in `review/records/`, [ADR 0156](0156-the-catalogue-is-one-design-per-object.md)), because their design
  files' bytes changed: the only difference was the tier slug. The records are
  attributed to the carry-forward and point at the approvals they replace.
- Splitting Pro again later is a real change: a new enum case, new data, new
  builds and a new contract. That is the honest cost of a decision nobody has
  made, and ADR 0056 paying it in advance bought nothing.
