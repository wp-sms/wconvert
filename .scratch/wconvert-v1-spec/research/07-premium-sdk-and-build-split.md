# 07 — Premium SDK and build split

Research ticket. Primary sources: the WSMS 8 tree at
`/Users/navidkashani/Local Sites/wsms8/app/public/wp-content/plugins/wp-sms-premium`
(read-only). Every factual claim below cites `path:LINE` in that tree unless the
path is prefixed with `wconvert/`.

---

## 1. Answer

WConvert should copy WSMS's **distribution boundary** almost verbatim: one private
monorepo, a `premium/` overlay directory whose *presence on disk* is the premium
switch, `@build-strip-free` fenced sections that a `sed` pass deletes from the free
artifact, a fail-closed leak guard (`bin/verify-free-contract.sh`) run before the
free ZIP is sealed, and a registry/slot seam in React so free code renders premium
placeholders without ever importing premium source. It should also copy the SDK's
cost model unchanged: an entitlement check is a **local read of one non-autoloaded
`wp_options` row, memoized per request, with zero HTTP** — the license server is
touched only from an admin AJAX action, WordPress's own update check, or a daily
Action Scheduler job that is itself gated on "expiring within 16 days"
(`premium/src/Service/License/LicenseRefreshScheduler.php:80-89`).

Two things WConvert should do differently. **First, do not share one output path
between two Vite configs that both set `emptyOutDir: true`** — that is the entire
`main.js` trap, and the reference checkout is sitting in the failure state right
now (§3). **Second, the gating boundary has to move from "module boot" to
"asset enqueue".** WSMS's premium is server-and-admin work, so gating at
`init@20` module boot is sufficient — a premium module simply never registers its
`wp_enqueue_scripts` callback. WConvert's premium features include *front-end
display rules* evaluated in the browser on fully-cached pages, so the enforceable
decision is which JS file the server put in the HTML, and everything after that
is advisory (§6).

One structural note: WSMS ships free and premium as **two mutually exclusive
plugins** with different slugs and different install folders, which costs it a
whole compatibility shim (`src/premium-compatibility.php`) and a silent
`deactivate_plugins()` in the premium activation hook (`wp-sms.php:183-190`).
WConvert starts clean and should weigh "free plugin + premium add-on plugin"
against inheriting that.

---

## 2. How WSMS does it

### 2.1 The `premium/` directory

Layout (`find premium -maxdepth 3`):

```
premium/src/Bootstrap.php
premium/src/Abstracts/BaseModule.php
premium/src/Container/PremiumServiceProvider.php
premium/src/Service/License/{TierGate,LicenseRefreshScheduler,LicenseInitialDataProvider,…}.php
premium/src/Service/Admin/{Notices,LicenseMenu}.php
premium/modules/<kebab-slug>/manifest.json + src/
premium/react/main.tsx + premium/react/modules/<slug>/index.tsx
```

#### Load path, plugin boot → premium module code running

1. **`wp-sms.php:36-39`** — the switch. Note it is on-disk presence, not a license:

   ```php
   $wp_sms_premium_active =
       !(defined('WSMS_TIER') && (string) WSMS_TIER === 'free')
       && is_dir(__DIR__ . '/premium')
       && file_exists(__DIR__ . '/premium/src/Bootstrap.php');
   ```

   The block comment above it states the model outright (`wp-sms.php:26-30`):
   *"The per-tier build IS the entitlement gate — there is no runtime license
   check that hides modules already on disk."*

2. **`wp-sms.php:43-48`** defines `WP_SMS_PREMIUM_LOADED`, `WP_SMS_PRODUCT_SLUG`,
   `WP_SMS_PREMIUM_SRC_DIR`, `WP_SMS_PREMIUM_MODULES_DIR`, `WSMS_NEXUS_URL`.

3. **`wp-sms.php:58-84`** registers a hand-rolled autoloader for `WSms\Premium\`.
   Modules are not standard PSR-4 — namespace `WSms\Premium\Modules\AdvancedReports\…`
   maps to `premium/modules/advanced-reports/src/…`, so the loader kebab-cases the
   namespace segment (`wp-sms.php:71`).

4. **`wp-sms.php:171-175`** — the overlay hooks onto the free core's own ready
   signal, at priority 5:

   ```php
   if ($wp_sms_premium_active) {
       require_once __DIR__ . '/premium/src/Bootstrap.php';
       add_action('wp_sms_loaded', static fn() => WSms\Premium\Bootstrap::init(), 5);
   }
   ```

   **No `is_admin()` guard** — the premium overlay boots on front-end requests too.

5. **`premium/src/Bootstrap.php:95-110`** takes the *core's* container
   (`CoreBootstrap::container()`) and runs one provider through the same
   two-phase `register()` / `boot()` contract as core providers, then adds two
   filters (`wsms_premium_unlocked_features`, `wsms_admin_settings_data`).

6. **`premium/src/Container/PremiumServiceProvider.php:50-107`** (`register`)
   builds a `ClientConfig` and wraps the SDK's own provider. `boot()`
   (109-221) then does the interesting part — it **removes the SDK's own
   license-gated module loader and substitutes a build-aware one**
   (`:176-186`):

   ```php
   // Replace the SDK's license-feature-gated module bootstrap with our
   // tier-build-aware loader. The per-tier ZIPs (built by bin/build.sh)
   // already determine which modules ship — the build IS the gate.
   // License is reserved for the update channel (PluginUpdater) and UI
   // affordances, not runtime feature unlock.
   $sdkLoader = $container->get(self::MODULES);
   if ($sdkLoader) {
       remove_action('init', [$sdkLoader, 'loadLicensedModules'], 20);
   }
   $this->licenseManager = $container->get(self::LICENSE_MANAGER);
   add_action('init', [$this, 'bootInstalledModules'], 20);
   ```

7. **`PremiumServiceProvider::bootModulesFromDir()` (`:325-375`)** at `init@20`
   `scandir()`s `premium/modules/`, `json_decode()`s each `manifest.json`, applies
   `isModuleEntitled()`, `require`s `src/{main_class}.php` and calls
   `(new $fqcn($manifest, $dir))->boot()` inside a `try/catch` so one bad module
   cannot take down the admin (`:362-373`).

8. **`premium/src/Abstracts/BaseModule.php:85-95`** — `init()` checks
   `checkRequirements()`, then registers the two contribution filters and calls
   the subclass's `setup()`:

   ```php
   final public function init(): void
   {
       if (!$this->checkRequirements()) { return; }
       add_filter('wsms_premium_module_data', [$this, 'provideModuleData']);
       add_filter('wsms_premium_unlocked_features', [$this, 'unlockFeature']);
       $this->setup();
   }
   ```

A module manifest is four fields plus a dependency floor
(`premium/modules/link-shortening/manifest.json:1-11`):

```json
{ "slug": "link-shortening", "name": "Link Shortening", "version": "1.0.0",
  "namespace": "WSms\\Premium\\Modules\\LinkShortening", "main_class": "LinkShortening",
  "dependencies": { "wp-sms": "8.0" } }
```

#### How free code calls into premium without depending on it

There are **four distinct seams**, and it is worth naming them separately because
WConvert will need three of them:

**(a) `defined('WP_SMS_PREMIUM_LOADED')` — a constant probe, free code branches.**
This is the only PHP-side detection in the free tree, and it is used sparingly:

- `src/Service/Assets/AssetManager.php:89` — `'isPremium' => defined('WP_SMS_PREMIUM_LOADED')` in the React payload.
- `src/Service/Assets/ViteHelper.php:99` — decides whether to inline the premium i18n catalog.
- `src/Notification/ConditionTagEvaluator.php:41-43` — an `is-premium` condition tag.
- `src/Rest/CampaignController.php:56-70` — a **REST-boundary gate**, the pattern most relevant to WConvert:

  ```php
  private function premiumManageCampaigns(): \Closure
  {
      return function () {
          if (!defined('WP_SMS_PREMIUM_LOADED')) {
              return new \WP_Error('wsms_premium_required',
                  __('Scheduling campaigns requires WSMS Premium.', 'wp-sms'),
                  ['status' => 403]);
          }
          return $this->access()->canManageSection('campaigns');
      };
  }
  ```

  and at `:90` `sanitizeRecurrence()` returns `null` unconditionally in the free
  build — *the free code silently drops the premium field regardless of what the
  client sends*. That is the null-object half of the pattern: free branches at
  the boundary and no-ops on the payload.

**(b) Filters as the injection point — premium pushes, free never pulls.**
`wsms_premium_module_data` and `wsms_premium_unlocked_features`
(`BaseModule.php:91-92`) are `apply_filters` sites owned by premium
(`Bootstrap.php:136,144`), not by free. Free code never calls
`apply_filters('wsms_premium_…')`; it just reads `$data['modules']` if present.

**(c) The React component registry — the real seam.**
`resources/react/src/lib/extensions.ts` is core code that declares the *names* and
the *owners* of every premium contribution point, and premium modules fill them at
import time. From its header (`:4-20`):

> "Component registry — the seam that keeps premium React out of the free
> WordPress.org build. Core compiles against this registry and never statically
> imports premium source."

Core declares `SLOT_OWNER` (`:41-55`) mapping slot name → owning module slug, and
`SECTION_OWNER` (`:122-126`) for whole routed sections. The comment at `:29-33`
explains why ownership must live in core: *"Core can't learn ownership from the
premium module itself: that's exactly the code that didn't run."*

Entitlement is read from PHP-injected data, not from registration
(`extensions.ts:113-116`):

```ts
export function isModuleEnabled(slug: string): boolean {
  const mod = getConfig().modules?.[slug] as { enabled?: boolean } | undefined;
  return mod?.enabled === true;
}
```

`modules[slug].enabled` is set by each entitled module's `provideModuleData()`
(e.g. `premium/modules/scheduled-campaigns/src/ScheduledCampaigns.php:93-102`,
`premium/modules/premium-gateways/src/PremiumGateways.php:51-61`) — so only
modules that actually booted appear, which makes the flag tier-aware for free.

**(d) A three-state renderer, not a boolean.** This is the detail most worth
stealing. `slotState()` (`extensions.ts:137-142`) returns `'ready' | 'unavailable'
| 'locked'`, and `Slot` (`resources/react/src/components/ui/slot.tsx:32-41`)
renders each differently. From `slot.tsx:5-13`:

> "the tier doesn't entitle the module → render `fallback` (the upsell); the tier
> entitles it but the premium bundle didn't load → render `unavailable` (a
> transient "couldn't load" notice), **so a paying customer is never shown a sales
> pitch for a feature they already bought**."

The upsell placeholder itself is plain free code
(`resources/react/src/components/ui/premium-feature-lock.tsx:7-11`): *"a marketing
description that links out to the upgrade page — never a disabled-but-real control
— so the free editor stays fully functional without it (WordPress.org Guidelines
5 & 11)."*

#### What happens at runtime when premium is absent

Nothing runs and nothing branches, because **nothing is on disk**. In the free
artifact the entire `@build-strip-free-start`…`-end` region of `wp-sms.php`
(lines 20-86 and 171-191) has been *deleted by the build*
(`bin/build.sh:129-149`), so the free plugin contains no reference to `/premium`,
no `WSMS_TIER`, and no premium autoloader. `$data['modules']` is simply absent
from the React payload, `isModuleEnabled()` returns `false` for everything
(`extensions.ts:111`: "Always false in the free build, where `modules` is
absent"), every `Slot` falls to `'locked'`, and the upsell renders. There is no
null-object implementation and no `class_exists` shim in the free tree.

`class_exists` *is* used, but only **inside premium**, to guard against a module
that a lower tier's ZIP did not ship
(`PremiumServiceProvider.php:120-121, 155-157`) — `premium/src` goes to every
tier, `premium/modules/*` does not.

#### How a per-feature entitlement is expressed

Three layers, in decreasing authority:

1. **The build.** `tiers.json` maps tier → module list; `bin/build.sh:293-312`
   copies only that tier's module directories into the staging tree. Verified in
   the shipped artifacts: `dist/wp-sms-premium-basic-v8.0-beta.5.zip` contains 5
   module directories, `…-elite-…zip` contains 8.
2. **A runtime tier gate, as a *safety net*.** `PremiumServiceProvider::isModuleEntitled()`
   (`:274-303`) resolves `LicenseManager::getTier()` against `tiers.json` via
   `TierGate`. Its docblock (`:265-273`) is explicit that this is *"additive
   safety net on top of 'the build is the gate'"* for the downgrade case —
   a Basic license activated on an Elite build.
3. **Fail-open everywhere.** `TierGate::tierEntitlesModule()` (`:168-175`) returns
   `true` for a null/empty/unrecognized tier: *"an unknown entitlement must never
   white-out premium modules."*

So the granularity is **per-module**, not per-capability and not a single
`isLicensed` boolean — but the *primary* enforcement is which files exist, and the
license only reconciles drift. The SDK also carries a per-feature slug list
(`LicenseManager::hasFeature()`, `packages/…/License/LicenseManager.php:313-319`,
with a `'*'` wildcard) — WSMS deliberately unhooks the loader that uses it
(`PremiumServiceProvider.php:181-184`).

`TierGate`'s own header (`:7-18`) is honest about the threat model: the installed
tier *"is a client-side fact and therefore spoofable — but because it's inferred
from on-disk modules rather than a label, spoofing it 'down' costs the attacker
the modules themselves. … Real enforcement stays server-side (Nexus only serves
the ZIP matching the license tier)."*

### 2.2 `composer.json` and scoping

`composer.json:56-70`:

```json
"extra": {
  "wp-scoper": {
    "namespace_prefix": "WSms\\Dependencies",
    "packages": ["firebase/php-jwt", "spomky-labs/otphp", "bacon/bacon-qr-code",
                 "symfony/expression-language", "symfony/uid", "league/csv", "lbuchs/webauthn"],
    "profiles": { "premium": { "packages": ["veronalabs/wp-premium-sdk"] } },
    "target_directory": "packages",
    "delete_vendor_packages": true,
    "php_compat": true,
    "exclude_directories": ["views", "templates", "resources", "public"]
  }
}
```

There is **no `scoper.inc.php`** — configuration is entirely in `composer.json`
and consumed by `veronalabs/wp-scoper`, a Composer plugin
(`composer.json:34` requires it dev-only; `composer.json:88-91` allow-lists it).

**Profile mechanics.** `SCOPER_PROFILE` is read once, in
`vendor/veronalabs/wp-scoper/src/Config/Config.php:154-155`:

```php
$profile = getenv('SCOPER_PROFILE');
$config = self::applyProfile($config, $profile === false || $profile === '' ? null : $profile);
```

`applyProfile()` (`:202-252`) **appends** `packages` (`:221-226`) and *replaces*
every other key. Its docblock (`:188-196`) names the exact use case: *"a premium
profile adds the SDK on top of free's shared deps without restating them."* An
unknown profile name throws (`:211-217`).

**Every reference to `SCOPER_PROFILE=premium`:**

| Location | Line | What it does |
|---|---|---|
| `composer.json` | 79 | `"scope:premium": ["SCOPER_PROFILE=premium wp-scoper", "@php bin/reconcile-scoped-installed.php"]` |
| `bin/build.sh` | 227 | premium build: `SCOPER_PROFILE=premium composer install --no-interaction --quiet` |
| `bin/build.sh` | 159 | free build: `unset SCOPER_PROFILE` first |
| `bin/build.sh` | 360 | restores the dev tree to premium state after a `free` build |
| `.github/workflows/php-tests.yml` | 130, 170 | CI |
| `.github/workflows/e2e-api.yml` | 242 | CI |
| `.github/workflows/e2e-browser.yml` | 83 | CI |
| `AGENTS.md` | 28 | documented dev command |
| `README.md` | 20, 35, 40 | documented |
| `.claude/rules/testing.md` | 367 | test setup requires it |

`composer.json:80-81` wires `post-install-cmd` / `post-update-cmd` to
`bin/reconcile-scoped-installed.php`, so scoping runs as a side effect of a plain
`composer install`.

**What lands in `packages/` and how it is loaded.** `packages/` holds the scoped
source trees (`bacon dasprid firebase lbuchs league paragonie psr spomky-labs
symfony veronalabs` — the direct list plus transitive deps), an
`autoload-classmap.php` (43 KB), and a generated `autoload.php`.
`packages/autoload.php:7-17` is a classmap autoloader; `:20-39` adds a PSR-4 map;
`:42-44` requires the `files` entries. `wp-sms.php:115-123` prefers it and falls
back to Composer in dev:

```php
// In production, wp-scoper generates packages/autoload.php.
// In development, Composer's vendor/autoload.php is used instead.
$composerAutoload = __DIR__ . '/packages/autoload.php';
if (!file_exists($composerAutoload)) { $composerAutoload = __DIR__ . '/vendor/autoload.php'; }
```

**Are first-party classes scoped? No — vendor only.** `packages/autoload.php:21-23`
maps `'WSms\\' => __DIR__ . '/../src'` **unprefixed**. Premium code imports scoped
SDK classes but keeps its own namespace bare — `premium/src/Bootstrap.php:3` is
`namespace WSms\Premium;` while `:7-8` are:

```php
use WSms\Dependencies\VeronaLabs\WpPremiumSdk\License\LicenseManager;
use WSms\Dependencies\VeronaLabs\WpPremiumSdk\Module\ModuleLoader;
```

Global classes and constants *inside* scoped packages get `WSmsDependencies_` /
`WSMS_DEPENDENCIES_` prefixes (derived at `Config.php:254-270`).

#### Why scoping is needed — the concrete collision

Generic "avoids conflicts" is not the answer; there are two specific risks, and
one of them is first-party.

**(1) The first-party one, and the reason the *premium profile* exists at all.**
`veronalabs/wp-premium-sdk` is shipped by more than one VeronaLabs product. The
SDK's own usage docblock names the sibling
(`packages/veronalabs/wp-premium-sdk/src/Container/PremiumServiceProvider.php:28-32`):

```php
//   $provider = new PremiumServiceProvider(
//       config: $config,
//       pluginBasename: 'wp-statistics-premium/wp-statistics-premium.php',
```

A site running **WSMS Premium and WP Statistics Premium together** would have two
plugins each shipping `VeronaLabs\WpPremiumSdk\…` at independently-versioned
states. PHP has one global class table and whichever autoloader resolves first
wins, so the second plugin silently executes against the other product's SDK
build. That is not hypothetical drift: WSMS already carries a `method_exists`
guard for exactly this class of skew — `premium/src/Service/Admin/Notices.php:57-64`:

> "getRenewal() is OPTIONAL: the SDK is a separately-versioned dependency and
> older builds (≤ beta.4) don't expose it. Guard with method_exists so a lagging
> SDK degrades to the generic copy instead of fataling."

Without scoping, a *newer* WSMS running against an *older* sibling's SDK hits
missing methods, and `PremiumStore` would read the wrong `option_key` semantics.
Scoping under `WSms\Dependencies\` makes the two copies genuinely separate types.

**(2) The vendor list is a who's-who of libraries other WP plugins bundle**, each
with a real API break across the major version boundary WSMS pins:

- `firebase/php-jwt ^7.0` (`composer.json:15`) — bundled by essentially every
  JWT/OAuth WP plugin. `JWT::decode()` took `($jwt, $key, array $allowed_algs)`
  in v5 and `($jwt, Key $keyOrKeyArray)` from v6. An older copy winning the
  autoload race turns WSMS's decode call into a fatal `ArgumentCountError`.
- `bacon/bacon-qr-code ^3.0` + `spomky-labs/otphp ^11.3` (`:16-17`) — the standard
  2FA pair, bundled by Two-Factor / WP 2FA / WooCommerce security plugins, with
  breaking changes across v2→v3 and v10→v11 respectively.
- `league/csv ^9.0` (`:21`) — v8→v9 removed `fetchAssoc()` and reshaped
  `Reader`/`Writer`.
- `symfony/expression-language`, `symfony/uid` `^6.4` (`:19-20`) — Symfony
  components arrive via countless plugin vendor trees at 4.x/5.x.

**The instructive counter-example: what is deliberately NOT scoped.**
`woocommerce/action-scheduler` (`composer.json:18`) is absent from the scoper
package list and is required directly from `vendor/`
(`wp-sms.php:125-133`), under the header:

```
| Action Scheduler (shared library — must NOT be prefixed)
```

Action Scheduler is designed as a per-site singleton with its own cross-plugin
version negotiation and shared DB tables; prefixing it would produce N parallel
schedulers. **Rule to carry over: scope private dependencies, never scope
libraries whose whole design is to be shared.**

**The cost of `delete_vendor_packages: true`.** wp-scoper copies the scoped source
into `packages/` and deletes the originals from `vendor/`, but leaves them in
`vendor/composer/installed.json` — which then makes Composer's autoloader
generation warn or fatal. `bin/reconcile-scoped-installed.php:1-25` exists purely
to drop those records, and describes the resulting loop as *"a stable cycle"*:
Composer reinstalls → wp-scoper deletes → the script reconciles. This is
self-inflicted churn.

### 2.3 How the two distributions are built and shipped

**One codebase, two subset builds.** Not a subset repo and not "strip premium
files from a shipped free plugin" — the free artifact is *staged by explicit
allow-list copy*, then pruned, then verified.

`composer.json:74-77`:

```json
"dist": "@dist:all",
"dist:all": "bash bin/build.sh all",
"dist:free": "bash bin/build.sh free",
"dist:premium": "bash bin/build.sh premium",
```

`bin/build.sh:8-25` states the contract:

```
#   ./bin/build.sh free      → dist/{free.slug}-v{version}.zip
#   ./bin/build.sh premium   → dist/{premium.slug}-{tier}-v{version}.zip per tier
#   ./bin/build.sh all       → both
#   - Free ZIP: no /premium, no SDK in /packages.
#   - Premium ZIP: /premium with tier-specific module set + SDK scoped under
#     WSms\Dependencies in /packages.
```

**Artifacts: 1 free ZIP + N premium ZIPs (one per tier), all separate installable
plugins.** Confirmed in `dist/`:

```
wp-sms-v8.0-beta.5.zip                    (free)
wp-sms-premium-basic-v8.0-beta.5.zip
wp-sms-premium-pro-v8.0-beta.5.zip
wp-sms-premium-elite-v8.0-beta.5.zip
```

There is **no add-on ZIP** — premium is a whole replacement plugin under a
different folder (`wp-sms-premium/`), which is why the mutual-exclusivity dance
exists (`wp-sms.php:88-106` + `183-190` + `src/premium-compatibility.php`).

**`build_free()` (`bin/build.sh:151-211`), in order:**

1. `node bin/check-gateway-tiers.mjs` — drift check (`:156`).
2. `unset SCOPER_PROFILE; composer install` (`:159-160`) — no SDK in `packages/`.
3. `npm run build` (`:163`).
4. `gen_pot build:pot` (`:166`) — optional, never fails the build (`:40-50`).
5. `write_main_file … "free"` (`:173`) → the `sed` program
   `/@build-strip-free-start/,/@build-strip-free-end/d` (`:133`) plus a Plugin
   Name/Description header swap from `tiers.json` (`:144-148`).
6. **Allow-list copy** (`:175-187`): `uninstall.php readme.txt LICENSE src/
   compat/ views/ data/ packages/ public/` and `vendor/woocommerce/action-scheduler`.
7. Belt-and-braces deletes (`:192-197`): `$stage/premium`,
   `$stage/packages/veronalabs`, `$stage/public/app-premium`.
8. `apply_distignore "$stage"` (`:199`) — `.distignore` is applied *to the staging
   tree*, not to a copy of the repo (`:75-107`).
9. `stage_pot` (`:200`) re-adds only the POT that step 8 just removed with `/resources`.
10. **`bin/verify-free-contract.sh "$stage"` (`:204`) — the leak guard.**
11. `zip -rq` (`:208`).

**`build_premium()` (`:213-342`):** `SCOPER_PROFILE=premium composer install`
(`:227`) → `npm run build` (`:229`) → **`npm run build:premium`** (`:232`, comment:
*"dashboard bundle → public/app, overwrites the free bundle"*) → both POTs
(`:236-237`) → build a shared `.core-` tree once (`:243-262`, `premium/src` only)
→ for each tier, hardlink-clone it (`:264-266`) and copy just that tier's modules
(`:293-312`) → `apply_distignore` → **copy `tiers.json` in *after* distignore
stripped it** (`:317-324`, because it is runtime data for `TierGate`, not just a
build manifest) → zip.

**The leak guard (`bin/verify-free-contract.sh`) — 7 checks, fail-closed.**

1. no `/premium` dir (`:44`)
2. no `public/app-premium` (`:47`)
3. no `packages/veronalabs` (`:50`)
4. no `WSms\Premium` namespace *used* in shipped PHP — delegated to a **PHP
   tokenizer** (`bin/premium-ns-scan.php`) rather than grep, so prose mentions in
   comments pass and string literals fail (`:53-77`)
5. no surviving `@build-strip-free` markers (`:81-84`)
6. built `public/app/main.js` / `main.css` must not contain the `wp-sms-premium`
   text domain (`:104-118`) — and it **fails closed** if no bundle exists at all
   (`:119-125`): *"Treating 'couldn't inspect' as 'clean' (the old behavior) would
   let a premium leak ship silently the one time the build is incomplete."*
7. **the drift-proof invariant** (`:127-150`): no file under `resources/react/src`
   may import a `premium/` path segment. Its comment (`:132-140`) is the design
   statement — *"If no free source file imports a `premium/` path, no premium code
   can reach public/app — by construction, whatever domain it uses."* The regex is
   deliberately written so the legitimately-named free `premium-feature-lock.tsx`
   (hyphen, not a path segment) is not a false positive.

Check 6 also carries a scar worth reading before copying
(`verify-free-contract.sh:94-103`): they explicitly **do not** grep the core
bundle for premium module slugs, because core owns `SLOT_OWNER` and so premium
slugs land in the free bundle *by design*; an earlier commit added that check and
would have broken every release build.

**What the free (wp.org) artifact actually contains.** From
`unzip -l dist/wp-sms-v8.0-beta.5.zip`, top level:

```
wp-sms/{compat,data,packages,public,resources,src,views}/  wp-sms.php
wp-sms/{LICENSE, readme.txt, uninstall.php}
```

Excluded: `/premium`, `packages/veronalabs`, `/bin`, `/tests`, `/docs`, `/dist`,
`/node_modules`, `/vendor`, `tiers.json`, `composer.json`, `composer.lock`,
`package.json`, every `vite.config*`, `CLAUDE.md`, `AGENTS.md`, `/.claude`
(`.distignore:1-87`). `resources/` survives only as `resources/languages/*.pot`
(re-added by `stage_pot`, `bin/build.sh:114-119`). The only string matching
`premium` anywhere in the free ZIP's file list is `src/premium-compatibility.php`
— which is intentional and is why it defines **global functions, not the
`WSms\Premium` namespace** (`src/premium-compatibility.php:10-12`: *"so the
free-build leak guard (verify-free-contract.sh) does not flag it"*).

`.distignore:33-39` also carries a hard-won special case:

```
/resources
# Premium module block SOURCE is build-input only; the built output ships under
# each module's public/blocks. The anchored /resources rule above is top-level
# only, so strip the module source explicitly (else the premium ZIP carries raw
# block.json/JS the way it did before the block relocation).
/premium/modules/woo-commerce/resources
```

### 2.4 `veronalabs/wp-premium-sdk`

Location: `packages/veronalabs/wp-premium-sdk/src/` after scoping (22 files); the
unscoped original is deleted from `vendor/` by `delete_vendor_packages`. Sourced
from a private VCS repo (`composer.json:25-30`), version `^1.0@beta`
(`composer.json:23`).

**What it provides**

| Area | Class | Notes |
|---|---|---|
| License activate / deactivate / validate / classify | `License/LicenseManager.php` | plus an `activation_gate` filter veto (`:60-69`) |
| HTTP to "Nexus" | `Http/ApiClient.php` | `wp_remote_get/post`, `'timeout' => 30` (`:39`, `:56`) |
| Admin AJAX endpoints | `License/LicenseEndpoints.php`, `Endpoint/AbstractAjaxEndpoint.php` | `wp_ajax_{prefix}_license`, `current_user_can('manage_options')` + nonce (`AbstractAjaxEndpoint.php:29-44`) |
| Update delivery | `Update/PluginUpdater.php` | injects into `pre_set_site_transient_update_plugins` from a Nexus manifest |
| Module download/install | `Feature/FeatureInstaller.php` | signed URLs, SHA-256 verify before extract (`:41-48`) |
| Entitlement checks | `LicenseManager::hasFeature()/getTier()/isValid()` | pure local reads |
| Module discovery/boot | `Module/ModuleLoader.php` | **WSMS unhooks this** (`PremiumServiceProvider.php:181-184`) |
| Storage | `Store/PremiumStore.php` | one `wp_options` row, sectioned |
| Key encryption at rest | `Encryption/SodiumEncryptor.php` | key derived from WP SALTs (`:53-63`) |
| Account / OAuth | `Account/*` | `admin_init` OAuth callback (`AccountBootstrap.php:32-37`) |

**Runtime cost of an entitlement check — the actual code path.**

`isValid()` → `isActivated()` → `PremiumStore::get('license')`
(`LicenseManager.php:154-182`). `PremiumStore::get()` (`:31-36`) calls `load()`
(`:98-107`):

```php
private function load(): array
{
    if ($this->cache !== null) { return $this->cache; }
    $raw = get_option($this->config->optionKey(), []);
    return $this->cache = is_array($raw) ? $raw : [];
}
```

So: **one `get_option('wsms_premium')`, memoized in `$this->cache` for the rest of
the request.** No transient. No HTTP. No decryption — `SodiumEncryptor::decrypt()`
runs only in `getLicenseKey()` (`LicenseManager.php:333-342`), which is reached
only from the network paths. `isValid()` adds one `strtotime()` (`:173-179`).
`hasFeature()` is two `in_array()` calls (`:313-319`). `getTier()` is an array read
(`:326-331`).

The one wrinkle: `PremiumStore::save()` writes with autoload **off**
(`PremiumStore.php:114`):

```php
update_option($this->config->optionKey(), $data, false);
```

so the row is *not* in WP's `alloptions` bundle. The first `get_option()` in a
request is therefore a cache miss → one `SELECT option_value FROM wp_options
WHERE option_name='wsms_premium'` (cached in the `options` group for the rest of
the request; served from a persistent object cache across requests where one
exists). **Budget: ≤1 extra DB query per request, then free.**

**Can an entitlement check run on the front-end hot path?**

*Mechanically, yes.* An `isValid()` / `hasFeature()` / `getTier()` call is a
memoized option read with no network. And WSMS does in fact evaluate entitlement
on front-end requests today — `Bootstrap::init` is hooked with no `is_admin()`
guard (`wp-sms.php:174`), and `bootInstalledModules()` runs at `init@20` on every
request (`PremiumServiceProvider.php:186`), calling `isModuleEntitled()` per
module (`:347`).

*But the answer for WConvert is still "don't".* Three reasons, all concrete:

1. **On a fully-cached page PHP does not run at all.** Whatever the check costs is
   irrelevant, and whatever it decides cannot reach the browser. An entitlement
   check is only meaningful at the moment the HTML/asset URL is generated.
2. **The expensive part is not the check, it is the discovery around it.**
   `bootModulesFromDir()` (`PremiumServiceProvider.php:325-375`) does a `scandir()`
   plus a `file_get_contents()` + `json_decode()` **per module, per request,
   front-end included** — 8-10 stat+read+parse cycles before any entitlement
   logic runs. `TierGate::installedTier()` (`TierGate.php:63-100`) does a *second*
   full scan of the same directory (that one is admin-path only, via
   `LicenseInitialDataProvider`). WConvert should replace filesystem discovery
   with a generated static registry.
3. **Anything that can reach `ApiClient` must never be on a user-facing request.**
   `'timeout' => 30` (`ApiClient.php:39, 56`) would hold a front-end request for
   half a minute on a Nexus outage. WSMS keeps this safe by construction: the only
   callers are the admin AJAX dispatcher (`AbstractAjaxEndpoint.php:27-44`,
   `manage_options` + nonce), `PluginUpdater::injectPluginUpdate` on WP's own
   update-check transient (`PluginUpdater.php:36`, admin/cron), and the daily
   Action Scheduler job. **Copy that discipline literally.**

**Cache miss and unreachable server.**

- *No license row at all* → `get('license')` returns `null` → `isActivated()`
  false → `isValid()` false. Still zero HTTP; nothing blocks; and the *module*
  gate fails open anyway (`TierGate.php:168-175`).
- *Server unreachable* → nothing on the request path calls it. When a refresh does
  happen, `refreshStatus()` swallows the exception (`LicenseManager.php:149-151`):
  *"Keep the cached license; a failed refresh must not lock out a valid site."*
  `validate()` likewise preserves the cached row and only stamps
  `last_validated_at` (`:118-127`).
- *Manifest cache* → `PluginUpdater::fetchManifest()` reads a **12-hour site
  transient** (`:88-95`, `:113`) and short-circuits to `null` on an invalid
  license (`:97-99`) — so a miss costs at most one 30 s-timeout call, in admin.

**License failure/expiry: degrades, never hard-blocks.** `classify()`
(`LicenseManager.php:200-235`) returns a state code with documented precedence
(`:190-197`: suspended/revoked/disabled > over_limit > expired > expiring_soon >
not_activated > active; empty `expires_at` = lifetime). The consequences are
purely (a) an admin notice — `premium/src/Service/Admin/Notices.php:12-25`
explicitly: *"The per-tier ZIP IS the entitlement gate, so this notice exists only
so the admin knows the precise state of their license"* — and (b) losing the
update channel: `PluginUpdater::injectPluginUpdate` bails when
`!$this->license->isValid()` (`:52-54`), and WSMS layers its own
`gatePluginUpdateByLicense()` on top (`PremiumServiceProvider.php:217, 231-251`)
that moves the offer into `no_update` because *"The SDK's PluginUpdater offers our
update from a cached manifest without re-checking the license, and its deactivate
cleanup deletes the wrong (non-site) transient"* (`:210-216`). **Features keep
working with an expired license.**

**Scheduled task: one daily Action Scheduler action, usually a no-op.**
`premium/src/Service/License/LicenseRefreshScheduler.php`:

```php
public const HOOK_NAME = 'wsms_license_refresh';
private const REFRESH_WINDOW_DAYS = 16;              // :36

public function run(): void                            // :66-73
{ if (!$this->shouldRefresh()) { return; } $this->licenseManager->refreshStatus(); }

private function shouldRefresh(): bool                 // :80-89
{ $d = $this->licenseManager->classify()['days_remaining'];
  if ($d === null) { return false; } return $d <= self::REFRESH_WINDOW_DAYS; }
```

Its header (`:18-22`): *"A healthy license therefore makes 0 background requests;
only the final ~2 weeks before expiry incur at most one per day."* Scheduling is
`is_admin()`-only and deferred to `init` (`PremiumServiceProvider.php:195-201`)
because Action Scheduler's store is not up at `plugins_loaded`; the `run` callback
is hooked on every request because AS dispatches it via cron/async.
Cost: **one AS row; a local `classify()` on fire; zero network in steady state.**

### 2.5 The React admin

**Two entries, one output path.**

- Free: `vite.config.js` — `root: 'resources/react'` (`:17`), entry
  `resources/react/src/main.tsx` (`:23`), `outDir: public/app` (`:20`),
  `fileName: () => 'main.js'` (`:26`), `emptyOutDir: true` (`:21`), IIFE
  (`:24-25`), `assetFileNames: 'main[extname]'` (`:36`).
- Premium: `vite.config.premium.mjs` — entry `premium/react/main.tsx` (`:46`),
  **same** `outDir: public/app` (`:43`), **same** `fileName: () => 'main.js'`
  (`:49`), **same** `emptyOutDir: true` (`:44`), different global name (`:48`),
  `publicDir: false` (`:41`).

`premium/react/main.tsx` is the free entry plus ten side-effect imports
(`:18-27`) and the same `createRoot(...).render(<App />)` (`:29-33`). Each premium
module's `index.tsx` calls `registerModule(slug, () => registerSlot(...))`
(e.g. `premium/react/modules/scheduled-campaigns/index.tsx:3`), and premium
strings use the `wp-sms-premium` domain written as a literal so make-pot can find
it in the minified bundle (`:25-28`).

**How the free admin renders a premium placeholder without importing premium.**
Core imports only `@/lib/extensions` and `@/components/ui/slot`; the page writes

```tsx
<Slot name="campaign.schedule.extras" draft={draft} updateDraft={fn}
      fallback={<PremiumFeatureLock … />} />
```

(`slot.tsx:14-16`). `PremiumFeatureLock` and `PremiumFeatureUnavailable` are free
components under `resources/react/src/components/ui/`. The slot *name* and its
*owner slug* are core constants (`extensions.ts:41-55`), so premium slugs appear
in the free bundle deliberately — see the note in
`verify-free-contract.sh:94-103`.

**Shared component layer, not duplicated.** Both configs alias `'@' →
resources/react/src` (`vite.config.js:46`, `vite.config.premium.mjs:69`) and
`'@preact' → resources/preact/src`. The premium entry imports `@/App`
(`premium/react/main.tsx:2`), so the premium bundle is a **superset** built from
the same source, not a second bundle loaded alongside the first. Since only one of
the two ever ships, IIFE with no code-splitting is fine — stated at
`vite.config.premium.mjs:19-22`: *"IIFE format (no code-splitting → React/Tailwind
are re-bundled, fine because only one of free/premium ever loads)."* Measured:
free `main.js` = 1,301,271 B, elite `main.js` = 1,390,448 B (from
`unzip -l dist/*.zip`).

**Front-end entitlement in the dashboard is a runtime check, and WSMS says so
plainly** (`extensions.ts:96-101`):

> "The dashboard JS for every module ships in every tier's bundle (app-premium is
> built once and shipped to all tiers), so this runtime check — not the build —
> is the real frontend entitlement boundary."

That is acceptable *in the admin*, because the premium bundle only ever reaches a
site that downloaded a licensed ZIP, and the screen is behind `manage_options`.
It does **not** transfer to a public page (§6).

---

## 3. The `main.js` trap

### The mechanism

Two Vite configs, two different entries, **one `outDir`, one `fileName`, and
`emptyOutDir: true` on both**:

```
vite.config.js:20-26              vite.config.premium.mjs:43-49
  outDir: public/app                outDir: public/app
  emptyOutDir: true                 emptyOutDir: true
  entry: resources/react/src/main.tsx   entry: premium/react/main.tsx
  fileName: () => 'main.js'         fileName: () => 'main.js'
```

Plus `assetFileNames: 'main[extname]'` in both (`vite.config.js:36`,
`vite.config.premium.mjs:59`), so `main.css` collides too.

`emptyOutDir: true` means each build **wipes `public/app` first**. There is no
merge and no marker: whichever config ran last is the *entire* contents of
`public/app`.

The PHP side has no way to tell. `ViteHelper::resolveDashboardBuild()`
(`src/Service/Assets/ViteHelper.php:94-101`) hardcodes the path and derives
"is this premium?" from a **PHP constant, not from the file**:

```php
return [
    WP_SMS_URL . 'public/app/',
    WP_SMS_DIR . 'public/app/',
    defined('WP_SMS_PREMIUM_LOADED'),
];
```

So on a premium install with the free bundle in place, PHP still reports
`isPremium: true` (`AssetManager.php:89`), still injects `modules[…] = ['enabled'
=> true]` from every booted module, and still inlines the premium i18n catalog
(`ViteHelper.php:50-52`) for a bundle that contains none of those strings.

### How it manifests

Not as a crash, and — importantly — **not as an upsell**. Trace it:

1. PHP booted premium, so `getConfig().modules['scheduled-campaigns'].enabled === true`.
2. `isModuleEnabled('scheduled-campaigns')` → `true` (`extensions.ts:113-116`).
3. But nothing called `registerSlot` — the free bundle has no premium imports.
4. `slotState()` (`extensions.ts:137-142`): entitlement passes, `slots.has()` fails
   → **`'unavailable'`**.
5. `Slot` renders `<PremiumFeatureUnavailable />` (`slot.tsx:37-39`) — a transient
   "couldn't load" notice.
6. Routed premium sections (`SECTION_OWNER`, `extensions.ts:122-126`) go the same
   way via `sectionState()` (`:144-152`).

So a paying customer sees **"couldn't load" notices where their features should
be**, and premium screens quietly disappear from nav. The page renders, no console
error, no PHP notice. Exactly as `CLAUDE.md:17-18` says: *"It fails quietly: the
page still loads, the premium screens are just gone."*

### How you would know

`CLAUDE.md:19` gives two tells: *"The tell is the file size (free is ~150 kB
smaller); the check is `grep outDir vite.config*.mjs` before you build."*

A sharper check exists in the repo already — `verify-free-contract.sh:104-118`
greps the built bundle for the `wp-sms-premium` text domain. Inverted, that is a
one-liner premium-build assertion:

```bash
grep -c wp-sms-premium public/app/main.js    # 0 ⇒ the FREE bundle is installed
```

**The reference checkout is in the failed state right now.**
`public/app/main.js` is 1,306,234 B, `grep -c wp-sms-premium` returns **0**, and
`premium/` is present — i.e. a premium dev tree currently serving the free
dashboard. The measured size delta between the shipped artifacts is 1,390,448 −
1,301,271 = **~87 KB**, not the ~150 KB `CLAUDE.md` quotes, which makes "eyeball
the file size" a weak tell.

### Three ways the repo makes it easy to get wrong

1. **`npm run build` does not build the premium dashboard at all.**
   `package.json:17`:

   ```
   "build": "npm run build:dashboard && npm run build:scripts && npm run build:sass
             && npm run build:blocks && npm run build:blocks:premium && rm -rf public/auth
             && npm run build:vendor && npm run build:auth && …"
   ```

   It runs `build:blocks:premium` (`package.json:29` — webpack, writes
   `premium/modules/woo-commerce/public/blocks`, no collision) but **not**
   `build:premium` (`package.json:19` — the Vite dashboard build). So
   `CLAUDE.md:15-16`'s *"`npm run build` runs premium last"* and `AGENTS.md:30`'s
   *"`npm run build`  # all bundles, correct ordering"* are both **inaccurate as
   the scripts stand**. The only place the correct ordering exists is
   `bin/build.sh:229-233`, which runs `npm run build` and then
   `npm run build:premium`.

2. **`bin/build.sh free` leaves the dev tree with a free dashboard and does not
   restore it.** The restore block (`:352-361`) is composer-only:

   ```bash
   # Leave /packages/ in premium state (SDK scoped) so the dev install … can boot
   if [ "$CMD" = "free" ]; then
       SCOPER_PROFILE=premium composer install --no-interaction --quiet
   fi
   ```

   No `npm run build:premium`. This is almost certainly how the reference checkout
   got into its current state.

3. **There is no `dev:premium` watcher.** `dev:dashboard` is bare `vite`
   (`package.json:10`), which serves the *free* entry. `build:premium` has no
   `--watch` sibling. So premium React development has no HMR path at all.

### How WConvert avoids inheriting it

The shared path exists for a real reason — WordPress keys script-translation
catalogs by `md5(script-src-path)`, so one path means one catalog hash for both
builds (`vite.config.premium.mjs:11-16`, `.claude/rules/i18n.md` "Unified
dashboard path"). Options, cheapest first:

- **Distinct filenames + a manifest.** Emit `admin.free.js` / `admin.premium.js`
  and have PHP pick from the same constant it already uses. Costs the shared
  catalog hash; if WConvert ships one text domain (which it should — WSMS's
  two-domain split forces the awkward `inlinePremiumTranslations()` hack at
  `ViteHelper.php:61-80`), the hash argument evaporates entirely.
- **Keep one path, add a build stamp.** Have each config emit
  `public/app/.build-tier` (`free` / `premium`); have PHP compare it to
  `defined('WCONVERT_PREMIUM')` and raise a loud admin notice on mismatch — the
  same shape as `ViteHelper::noticeMissingDashboardBundle()` (`:107-117`), which
  already handles the "no bundle at all" case.
- **Never publish a `build` script that produces the wrong-tier bundle for the
  current tree.** Make `npm run build` detect `premium/` on disk and dispatch, or
  refuse to run without an explicit `--tier`.
- **Assert in CI.** Add the inverse of `verify-free-contract.sh` check 6 —
  a `verify-premium-contract` that fails if `public/app/main.js` lacks a premium
  marker in a premium staging tree.

---

## 4. Entitlement checks on the hot path

**The concrete cost of one check**

```
LicenseManager::isValid()                     LicenseManager.php:161-182
  └─ isActivated()                                              :154-159
       └─ PremiumStore::get('license')            PremiumStore.php:31-36
            └─ load()                                            :98-107
                 └─ static $cache  (hit  → 0 work)
                 └─ get_option('wsms_premium', [])   ← 1 non-autoloaded option read
  + strtotime($data['expires_at'])                LicenseManager.php:174
```

- **HTTP requests: 0.** **Transients: 0.** **Decryption: 0.**
- **DB: ≤1 `SELECT`** per request, because `PremiumStore::save()` passes
  `autoload = false` (`PremiumStore.php:114`) so the row is not in `alloptions`.
  WP caches it in the `options` group after the first read; a persistent object
  cache removes even that.
- Subsequent checks in the same request are a `null` comparison
  (`PremiumStore.php:100-101`).
- `hasFeature()` = 2× `in_array` (`LicenseManager.php:313-319`);
  `getTier()` = one array read (`:326-331`).

**Cache miss:** no license row → `null` → `isValid()` false, still zero network.
The *module* gate fails open regardless (`TierGate.php:168-175`).

**License server unreachable:** nothing on a page-render path calls it. When a
refresh path does run it swallows and keeps the cache
(`LicenseManager.php:149-151`, `:118-127`). `PluginUpdater::fetchManifest()` caches
for 12 h (`:113`) and short-circuits on an invalid license (`:97-99`).

**Verdict for WConvert's front end**

*The check is cheap enough that cost is not the objection.* The objections are
architectural, and they are decisive:

1. **On a fully-cached page, PHP does not execute.** A server-side entitlement
   check cannot participate in rendering a cached page at all. Any check that
   matters must happen when the cache entry is *generated* — i.e. at enqueue /
   localize time — and its result is then baked into the cached HTML.
2. **The check must not be reachable from a request that can hit the network.**
   `ApiClient` uses `'timeout' => 30` (`ApiClient.php:39, 56`). WSMS keeps every
   caller behind `manage_options` AJAX, WP's update transient, or Action
   Scheduler. WConvert must hold that line absolutely — no lazy
   "revalidate if stale" on any front-end code path, ever.
3. **Do not copy the per-request filesystem discovery.**
   `bootModulesFromDir()` (`PremiumServiceProvider.php:325-375`) does a `scandir`
   + read + `json_decode` per module on *every* request including the front end.
   WSMS gets away with it because its premium modules are integrations, not
   page-render code. WConvert should generate a static module registry at build
   time (`bin/gen-tier-modules.mjs` already exists in WSMS as the seed of this
   idea, and `extensions.ts:36-39` flags the same "generate it once the count
   grows" migration for `SLOT_OWNER`).
4. **Nothing about licensing needs to reach the browser.** The `<15 KB gzipped`
   loader budget should carry **zero** licensing code. The only bit of
   entitlement that legitimately crosses to the client is a consequence, not a
   check: which script the server enqueued, and which rules are present in the
   localized payload.

**Bottom line:** entitlement is an *enqueue-time* decision on WConvert's front
end, evaluated once when the page is cached, at a cost of ≤1 option read.
It is never a render-time or client-side decision.

One inherited nicety worth copying: WSMS purges its caches when the license
option changes (`PremiumServiceProvider.php:217-220, 258-263`):

```php
add_action('update_option_wsms_premium', [$this, 'flushUpdateCaches']);
add_action('add_option_wsms_premium',    [$this, 'flushUpdateCaches']);
add_action('delete_option_wsms_premium', [$this, 'flushUpdateCaches']);
```

WConvert wants the same three hooks, but flushing the **page cache** (and any
rules JSON), so an activate/deactivate takes effect on cached pages immediately.

---

## 5. Copy / adapt / avoid

| Mechanic | Verdict | One-line reason |
|---|---|---|
| One private monorepo → free + premium artifacts (`README.md:1-6`; `bin/build.sh:8-25`) | **Copy** | One commit changes both; one tag releases both. |
| On-disk presence of `premium/` as the switch (`wp-sms.php:36-39`) | **Copy** | No runtime license needed to decide what code exists; distribution is the gate. |
| `@build-strip-free-start/-end` + `sed` deletion (`wp-sms.php:20,86`; `bin/build.sh:129-149`) | **Copy** | Free artifact ships literally zero premium-aware lines — clean for wp.org review. |
| `bin/verify-free-contract.sh`, fail-closed (`:119-125`) | **Copy** | A leak guard that passes when it cannot look is worse than none. |
| Source-import invariant (check 7, `:127-150`) | **Copy** | Drift-proof by construction; text-domain grepping is not. |
| Premium-only PSR-4 autoloader registered inside the strip fence (`wp-sms.php:58-84`) | **Copy** | Zero autoloader cost and zero namespace in the free build. |
| Manifest-driven modules with a `boot()` entry (`BaseModule.php`; `manifest.json`) | **Copy** | Adding a premium feature is a directory, not a wiring change. |
| Core-declared registry + `SLOT_OWNER` (`extensions.ts:41-55`) | **Copy** | Core owns the contract; the module that never ran cannot declare its own ownership. |
| Three-state `ready`/`unavailable`/`locked` (`extensions.ts:132-142`; `slot.tsx:5-16`) | **Copy** | Never show a paying customer an upsell for something they bought. |
| Upsell as marketing copy, never a disabled real control (`premium-feature-lock.tsx:7-11`) | **Copy** | Explicitly what wp.org Guidelines 5 & 11 ask for. |
| REST-boundary premium gate + silent field drop (`CampaignController.php:56-70, 88-92`) | **Copy** | Server-side enforcement of the thing that actually costs money. |
| Single sectioned `wp_options` row for license state (`PremiumStore.php`) | **Copy** | One row, memoized, no transient sprawl. |
| Entitlement reads are local-only; network confined to admin AJAX / update transient / AS job | **Copy** | The single most important property for a front-end budget. |
| Degrade-not-block on expiry (`LicenseManager.php:118-152`; `Notices.php:12-25`) | **Copy** | Expired license loses updates, not the customer's site. |
| Daily AS refresh gated on `days_remaining <= 16` (`LicenseRefreshScheduler.php:80-89`) | **Copy** | Healthy licenses make zero background requests. |
| `flushUpdateCaches` on the three option hooks (`PremiumServiceProvider.php:217-220`) | **Copy** (widen) | License changes must invalidate caches; WConvert must also purge page cache. |
| wp-scoper with a `premium` profile (`composer.json:56-69`) | **Copy** | Free build carries no SDK at all; premium build's SDK cannot collide with a sibling product's. |
| Never scoping shared singletons (`wp-sms.php:125-133`, Action Scheduler) | **Copy** | Prefixing a library designed to be shared multiplies it. |
| Tiers + `TierGate` rank/compare machinery (`tiers.json`; `TierGate.php`) | **Adapt** | WConvert v1 has one premium tier; keep the module map, defer rank/compare/installedTier. |
| "The build is the gate" + runtime gate as safety net (`PremiumServiceProvider.php:176-186, 265-273`) | **Adapt** | Right idea; WConvert's front-end rules need the gate at *enqueue*, not just module boot. |
| Per-request `scandir` module discovery (`PremiumServiceProvider.php:325-375`) | **Adapt** | Fine in admin; generate a static registry rather than stat the filesystem on every page view. |
| Two text domains + inlined premium catalog (`ViteHelper.php:61-80`) | **Adapt** | Only worth it if premium ships strings; one domain removes the hack and the shared-path constraint. |
| Free and premium as two mutually exclusive plugins (`wp-sms.php:100-106, 183-190`; `src/premium-compatibility.php`) | **Adapt** | Works, but costs a shim file and a silent deactivation; weigh "free + premium add-on" while WConvert is still clean. |
| One `public/app/main.js` path for both builds (`vite.config.premium.mjs:9-16`) | **Adapt** | Justified only by the i18n catalog hash; if that justification goes, so should the shared path. |
| Client-side runtime entitlement as "the real frontend boundary" (`extensions.ts:96-101`) | **Adapt** | Sound for a `manage_options` admin bundle shipped only in licensed ZIPs; not transferable to a public page. |
| `emptyOutDir: true` on a shared `outDir` from two configs, no marker | **Avoid** | The whole trap; the reference checkout is in the failure state today. |
| A `build` script that silently emits the wrong-tier bundle (`package.json:17` vs `CLAUDE.md:15-16`) | **Avoid** | The docs describe an ordering the scripts do not implement. |
| `bin/build.sh free` restoring composer but not the JS (`:352-361`) | **Avoid** | Half a restore is a booby trap; restore everything or nothing. |
| `delete_vendor_packages: true` + reconcile script (`composer.json:66`; `bin/reconcile-scoped-installed.php`) | **Avoid** | Self-inflicted install/delete/reconcile cycle; scope in the release build only, or copy without deleting. |
| 30 s HTTP timeout reachable from any user-facing request (`ApiClient.php:39,56`) | **Avoid** | Contain it behind admin actions and scheduled jobs, as WSMS does — but state it as a rule, not a habit. |
| No `dev:premium` watcher (`package.json:10,19`) | **Avoid** | Premium React has no HMR path; WConvert should define one from day one. |
| Docs that state build ordering aspirationally (`CLAUDE.md:14-19`; `AGENTS.md:30`) | **Avoid** | If the guard is a sentence in a doc, it is not a guard. |

---

## 6. What changes because premium features are front-end display rules

**This is the one place where WSMS's model does not transfer, and it should be
stated plainly rather than papered over.**

### The structural difference

In WSMS, "premium" means server-side capability (a gateway, a scheduler, a report
query, an ESP call) or admin UI. Premium modules *do* touch the front end — there
are exactly four `wp_enqueue_scripts` call sites across all modules
(`premium/modules/{buddy-press/src/Verification/BpRegistrationVerification.php:60,
ultimate-member/src/Verification/UmRegistrationVerification.php:68,
woo-commerce/src/Verification/WooClassicCheckoutVerification.php:40,
woo-commerce/src/Verification/WooProfileReverification.php:64}`) — but every one
of them is registered from inside a module's `setup()`, which only runs if the
module's files are on disk *and* the tier entitles it. **The enqueue never
happens, so the code never reaches the browser, so there is nothing to bypass.**

WConvert's exit intent, A/B testing and advanced targeting are **rules evaluated
in the browser**, on a page that may be served entirely from a full-page cache
where PHP never runs. Three consequences:

1. **The loader is one static asset shared by every visitor.** You cannot vary it
   per request without defeating the cache.
2. **The rule data must already be in the cached HTML or in a cached JSON**, so
   entitlement was decided at cache-fill time, possibly hours ago.
3. **Everything that reaches the browser is readable and editable.** A
   `config.isPremium` flag is a suggestion, not a gate.

### The options

**Option A — Build-time subset, the WSMS model translated to JS.**
Two front-end loaders; the premium loader (containing exit-intent, A/B assignment,
advanced targeting) exists only in the licensed download. Enforcement is
distribution: a free install literally does not have the file.

- *Pro:* zero front-end cost for free users; premium display code genuinely
  absent; identical mental model to the PHP split; the existing leak guard
  generalizes to it.
- *Con:* two front-end artifacts to build, test and keep in sync; inherits WSMS's
  "two mutually exclusive plugins" install story; any shared rule-engine code is
  either duplicated or has to be factored into a shared chunk (which reintroduces
  a second request).

**Option B — One free loader + a premium add-on script, enqueued only when
entitled.** The free loader exposes a tiny registration API — the front-end
analogue of `registerSlot` (`extensions.ts:84-90`):

```js
window.wconvert.registerTrigger('exit-intent', fn);
window.wconvert.registerTargeting('advanced', fn);
```

PHP decides at enqueue time — one entitlement read, exactly the §4 cost — whether
to add `wconvert-premium.js`. The decision is baked into the cached HTML, and the
`update_option_wconvert_license` hooks purge the page cache so a license change
takes effect at once.

- *Pro:* free loader stays inside the 15 KB budget and never carries dead premium
  bytes; the premium file is a separate asset a free install never requests;
  enforcement is server-side at the only moment it can be; the seam is the same
  registry pattern already proven in the WSMS admin.
- *Con:* a second HTTP request for premium users (mitigable by preload/`defer`, or
  by inlining for small rule sets); the split point must be chosen carefully so
  the shared engine lives in the free loader and only the *rules* live premium —
  otherwise the premium file duplicates the engine.
- *Note:* the free loader still has to contain the **generic** trigger dispatcher
  and the fallback for an unregistered trigger, so a few hundred bytes of "seam"
  do land in the free budget. That is cheap and predictable.

**Option C — One loader with all rules, gated by a config flag. Avoid.**
Cheapest to build, worst on both axes: free users pay bytes for code they cannot
use (directly against the 15 KB budget), and the gate is a boolean anyone can flip
in devtools. Note that WSMS's admin-side runtime check
(`extensions.ts:96-101`) is *not* precedent for this: it is acceptable there only
because the premium bundle is shipped exclusively in licensed ZIPs and the screen
is behind `manage_options`. A public page has neither backstop.

### Sizing the actual risk

Worth stating before the trade-off is priced, because it changes the answer:

- **A copied display rule is low-value theft.** If a determined free user extracts
  the exit-intent handler and wires it into their own site, they have done manual
  work that breaks on the next update, on one site, with no revenue diverted at
  scale. This does not justify paying front-end bytes or building obfuscation.
- **The parts with real value are already server-side.** A/B testing needs
  variant *assignment* persistence, impression/conversion ingest and reporting;
  advanced targeting that depends on user/order/segment data needs a server query;
  third-party ESPs need stored credentials and an outbound call. All of that is
  gated exactly like `CampaignController::premiumManageCampaigns()`
  (`src/Rest/CampaignController.php:56-70`) — a REST permission callback plus a
  silent field-drop on the write path (`:88-92`). **Client-side A/B rendering
  without server-side assignment and stats is not the feature anyone is paying
  for.**

### Recommendation (input, not a decision)

**Option B**, with the enforceable value pushed server-side:

1. Gate at **enqueue**: one entitlement read when the page is generated, deciding
   whether `wconvert-premium.js` is in the HTML. Zero licensing code in the free
   loader.
2. Keep the trigger/targeting **dispatcher** in the free loader and ship only the
   premium **rule implementations** in the add-on file, so the free budget pays
   for a seam, not a duplicate engine.
3. Put every premium capability with a server cost or a persistence requirement
   behind a REST permission callback — A/B variant assignment, stats ingest, ESP
   dispatch. Copy `premiumManageCampaigns()` verbatim in shape.
4. Treat a copied exit-intent handler as an accepted, low-severity loss. Do not
   spend front-end bytes or complexity defending against it.
5. Purge the page cache on the three license-option hooks so entitlement changes
   land on cached pages.

**Flagging explicitly:** this is input to the *Free and premium gating
architecture* ticket, not the decision. In particular, three questions belong to
that ticket and are deliberately not answered here: whether WConvert ships one
plugin or two; where exactly the dispatcher/implementation split falls for A/B
testing (whose client half is larger than exit intent's); and whether the premium
loader is a second request or is inlined into the localized payload.

---

## 7. Open questions / risks

1. **One plugin or two?** WSMS's mutual exclusivity costs `src/premium-compatibility.php`,
   a `deactivate_plugins(..., true)` in the activation hook (`wp-sms.php:183-190`,
   silent so the free deactivation handler does not tear down shared tables/cron),
   and a "re-installing a different tier overwrites the previous premium folder"
   caveat (`bin/build.sh:12-19`). A free-plugin + premium-add-on layout avoids all
   of it but changes the update story. **Owned by the gating-architecture ticket.**

2. **`tiers.json` is runtime data, and the shipped elite ZIP does not contain it.**
   `bin/build.sh:317-324` copies it in *after* `apply_distignore`, precisely
   because `TierGate` reads it at runtime — but
   `dist/wp-sms-premium-elite-v8.0-beta.5.zip` (Jul 26) has no `tiers.json`, while
   `bin/build.sh` was last modified Aug 9. So the fix postdates the artifact.
   The failure mode was benign only because every lookup fails open
   (`TierGate.php:170`). **Risk to inherit: a build manifest that is also runtime
   data is easy to strip by accident.** WConvert should either keep tier data out
   of runtime entirely, or compile it into PHP so `.distignore` cannot reach it.

3. **The reference checkout is currently mis-built.** `public/app/main.js` has zero
   `wp-sms-premium` occurrences while `premium/` is present. Anyone reading WSMS
   as a working example of the premium dashboard is reading a free bundle. Do not
   treat "it works in wsms8" as verification of premium React behaviour without
   rebuilding first.

4. **`CLAUDE.md` / `AGENTS.md` describe an ordering the scripts do not implement**
   (`package.json:17` never runs `build:premium`). If WConvert documents a build
   invariant, encode it as a script guard or a CI assertion, not prose.

5. **`veronalabs/wp-premium-sdk` is `^1.0@beta` from a private VCS repo**
   (`composer.json:23-30`) with `minimum-stability: dev` (`:31`). WSMS already
   carries a `method_exists` compatibility guard for SDK skew
   (`Notices.php:57-64`). WConvert should pin an exact version and re-audit on
   every bump, and should not assume any SDK method exists.

6. **Unverified: whether the SDK is on Packagist or GitHub-only.** Only the VCS
   repository entry is visible in-tree; WConvert's CI will need whatever deploy
   key or token WSMS's workflows use. Not readable from this tree.

7. **Unverified: the wp.org review posture of the free artifact.** The free ZIP
   contains `packages/` with scoped vendor source (~2.5 MB zipped) and a generated
   43 KB classmap. WSMS ships it and presumably passes review, but WConvert should
   confirm current wp.org expectations about bundled/prefixed dependencies before
   copying the layout wholesale.

8. **The free ZIP shipped no `vendor/woocommerce/action-scheduler`**, despite
   `bin/build.sh:184-187` copying it when present. Either the dev tree lacked it at
   build time or the free tier does not use it. If WConvert bundles any
   shared-singleton library, the build must **fail** when the source directory is
   missing rather than skip it silently (`[ -d … ] && cp` is a silent skip).

9. **Front-end budget accounting is not yet done.** The seam in Option B (trigger
   dispatcher + registration API + unregistered-trigger fallback) has a real,
   non-zero size that lands in the free loader. That number needs measuring
   against the 15 KB gzipped budget before the gating ticket commits to a shape.

10. **Cache-purge coverage on license change is an unknown.** WSMS purges only WP's
    own update transients (`PremiumServiceProvider.php:258-263`). WConvert needs
    to purge whatever full-page cache the host runs, and there is no single API
    for that — a per-host adapter or a documented manual step will be needed.
