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

The artifact contract, Plugin Check and the release guard are **not** here.
They land with the release workflow: each half lands with the thing it
inspects.

## Development

```bash
composer install && npm install

npm run build          # admin bundle + both loader bundles
composer test          # PHPUnit
composer phpstan       # PHPStan, level 7
npm test               # Vitest — free's tree and Pro's
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint, --max-warnings=0
```

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
