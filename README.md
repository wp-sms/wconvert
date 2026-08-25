# WConvert

One monorepo, two independently installable WordPress plugins.

| | Plugin directory | Slug | Namespace | Text domain |
|---|---|---|---|---|
| Free | the repository root | `wconvert` | `WConvert\` | `wconvert` |
| Pro | [`pro/`](pro/) | `wconvert-pro` | `WConvert\Pro\` | `wconvert-pro` |

Pro is installed **alongside** free, not instead of it. It does not unlock
free's premium features — it **supplies** them, and a free install has never
contained them ([ADR 0014](docs/adr/0014-pro-replaces-the-loader.md),
[ADR 0015](docs/adr/0015-enforcement-is-by-non-registration.md)).

Read [`CONTEXT.md`](CONTEXT.md) before using any domain term.

## The free/Pro boundary

The dependency runs one way and only one way:

```
resources/loader/src/         free's loader modules   ─┐
pro/resources/loader/src/     Pro's loader modules    ─┴─> pro/…/main.ts
                                                            = free's + Pro's
```

Free's entry composes free's modules. Pro's entry composes free's **plus** its
own. There is **no mode flag and no tree-shaking, ever**: premium code is
absent from the free build because it was never in free's source
([ADR 0028](docs/adr/0028-the-free-loader-source-carries-no-premium-code.md)).

That boundary is drawn on day one, deliberately, rather than deferred behind a
flag. It is the cost of the decision, and it is the whole cost.

### It is checked, not trusted

```bash
bin/verify-source-contract.sh          # no build, runs on every pull request
npm run check:loader                   # two loader builds, runs on every pull request
```

No file in free's tree may import a `pro/` path or the `WConvert\Pro`
namespace, in TypeScript **and** PHP
([ADR 0029](docs/adr/0029-the-free-contract-is-proven-at-the-source.md)). The
check **fails closed**: a tree it cannot inspect *fails*, because "couldn't
look" reading as "clean" is how a leak ships.

One scanner per language does the looking, and neither is a grep.
[`bin/pro-ts-scan.php`](bin/pro-ts-scan.php) parses module specifiers, so
`repro/harness` is not mistaken for a `pro/` path.
[`bin/pro-php-scan.php`](bin/pro-php-scan.php) tokenizes PHP, so free may
*document* the boundary without tripping the guard that enforces it — while a
Pro name in a string literal still fails, because a dynamic class name resolves
it. Both halves apply in both languages: PHP is checked for `pro/` paths too,
since `require_once WCONVERT_DIR . 'pro/…'` is the shape a WordPress developer
reaches for first.

`npm run check:loader` is the **one build a pull request pays for**, and it
earns it: both of its assertions are about build output. Free's and Pro's
loader, gzip -9, hard-fail at 8192 bytes; and free's loader is scanned for
every rule identifier the manifest calls premium — free's *admin* bundle is
deliberately never scanned, because it carries premium identifiers on purpose
for its `locked` cards.

The artifact contract, Plugin Check and the release guard are **not** here.
They land with the release workflow: each half lands with the thing it
inspects.

## The rule manifest

[`resources/rules/manifest.json`](resources/rules/manifest.json) is the single
source of truth for every rule type, on all three axes, in **both** tiers. Free
ships the premium entries too, because free's PHP is what will strip an
unentitled rule at enqueue, and it can only strip what its own manifest calls
premium ([ADR 0005](docs/adr/0005-the-rule-model-is-three-flat-closed-axes.md)).
That strip lands with degradation and suspension; today PHP reads the manifest
for one thing, the publish-time partition into `triggers` and `conditions`.

**Free's loader must never `import` it.** The lookup would be dynamic, so
nothing tree-shakes, and every `tier: pro` identifier would land in free's
bundle — failing the scan above on a build that leaked nothing. Each loader
module declares its own `kind` and `consent_category` instead, and the
parity tests assert the declaration matches the manifest:

```bash
tests/js/manifest-parity.test.ts        # free's modules against the manifest
pro/tests/js/manifest-parity.test.ts    # Pro's own, from Pro's side
tests/unit/Rules/RuleManifestParityTest.php   # the four-field invariant, every axis
```

They are also what decides **where a new rule may land**: a `tier: pro` entry
with no Pro module fails on the pull request that adds it, so a premium entry
and its implementation arrive in the same commit.

## The template vocabulary

[`resources/templates/manifest.json`](resources/templates/manifest.json) is the
closed list of everything a Template may name: six leaf nodes, four layouts,
the token set, the Slot Roles and the field kinds. A Template is a JSON node
tree plus tokens with **no HTML and no CSS in it**
([ADR 0010](docs/adr/0010-templates-are-configuration-not-documents.md)), so
validating against this manifest is the whole of the sanitisation story —
`wp_kses` does not apply to templates at all.

One **dependency-free renderer** in
[`resources/renderer/src/`](resources/renderer/src/) owns the entire vocabulary
and every line of the stylesheet, and **both** bundles import it: the loader
draws the live Optin, the admin draws gallery cards and previews. There are no
static thumbnails to produce or to let go stale, and nothing React-shaped may
enter that tree — two consumers, two bundles, one byte budget.

```bash
tests/js/renderer-manifest-parity.test.ts     # the renderer against the manifest
tests/unit/Template/TemplateVocabularyTest.php # what validation drops on the way in
tests/unit/Template/TemplateSnapshotTest.php   # an Optin's copy outlives its entry
tests/unit/Frontend/PayloadBudgetTest.php      # ten snapshotted trees, ≤2KB gzipped
```

Like the rule manifest, **the loader must never `import` it**: an unrecognised
node is skipped by the renderer's own switch, so the lookup buys nothing and
the import would put the whole vocabulary in the byte budget. The parity test
asserts the renderer implements exactly what the manifest declares, in both
directions.

## Development

```bash
composer install && npm install

npm run build          # admin bundle + both loader bundles
npm run check:loader   # the loader byte budget + the premium-identifier scan
composer test          # PHPUnit
composer phpstan       # PHPStan, level 7
composer verify:source # the source contract
npm test               # Vitest — free's tree and Pro's
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint, --max-warnings=0
```

### Why WordPress 6.2

`WConvert\Database\Connection` takes its SQL as a `literal-string` and its
table as a separate argument, passed to `$wpdb->prepare()` through the `%i`
identifier placeholder that WordPress 6.2 added. That is what makes an injected
table or column name **unexpressible** rather than merely discouraged: PHPStan
rejects any query a variable helped build, at the call site.

### Running both plugins locally

WordPress scans `wp-content/plugins/` exactly one level deep, so Pro is not
found at `wconvert/pro/`. Symlink it beside free:

```bash
ln -s "$PWD/pro" ../wconvert-pro
```

Or boot a throwaway WordPress with both mounted, needing no database:

```bash
npx @wp-playground/cli server --workers=1 \
  --mount "$PWD:/wordpress/wp-content/plugins/wconvert" \
  --mount "$PWD/pro:/wordpress/wp-content/plugins/wconvert-pro"
```

`--workers=1` is not optional: Playground's default six worker threads all
write one SQLite file and corrupt it, which surfaces as intermittent 500s that
read like flaky tests rather than a broken database.

## Conventions

From WSMS 8 — PHP 8.1+, DI container, service providers, Vite + React admin,
PHPStan, PHPUnit. Read it; copy it; never modify it. **No code is shared**, and
neither release cycle constrains the other
([ADR 0030](docs/adr/0030-free-and-pro-release-on-independent-tags.md)).
