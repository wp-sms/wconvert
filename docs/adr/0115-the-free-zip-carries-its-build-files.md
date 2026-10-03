# 0115 — The free ZIP carries its build files

Date: 2026-10-03

## Decision

The free artifact ships what rebuilds its bundles: `package.json`,
`package-lock.json`, `tsconfig.json`, `composer.json`, `composer.lock`, free's six
Vite configs and the two factories they import. A `build:free` npm script builds
every free bundle and nothing of Pro's, so `npm ci && npm run build:free` and
`composer install --no-dev` in the unzipped plugin reproduce `public/` and
`vendor/` without `pro/`.

Pro's configs stay out, each named in `.distignore`. The artifact contract fails
the build when a shipped root Vite config names a `pro/` path, so a Pro config
nobody listed — `vite.config.block-pro.mjs` was one — stops the ZIP rather than
leaking into it. The contract also requires the build files, `build:free` and
`license.txt`.

## Why

wp.org Guideline 4 asks that a reviewer can read the source of minified code
*and* reproduce it. [ADR 0028](0028-the-free-loader-source-carries-no-premium-code.md)
shipped the sources; with the repository private, the download is the only place
the build instructions can live.

## Consequences

- [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md)'s "the Vite
  configs are build tooling that never ships" is no longer true of free's
  configs. The source contract's scope is unchanged — Pro's configs live beside
  free's in the repository, so scanning either at the source would need an
  exception list. They are checked at the artifact, where only free's remain.
- The shipped `package.json` still lists Pro's scripts. They fail in the free
  ZIP because their configs are absent; the readme names `build:free`.
- Translations come from wp.org language packs: no `Domain Path` header and no
  `load_plugin_textdomain()`.
