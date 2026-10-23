# 0165: Every translatable string reaches a catalogue, provably

Accepted 2026-10-23. Amends 0041. Corrects the boot guard's docblock.

An audit asked whether translation covers every string. In a shipped build it
did not. Free's PHP was fine. The React admin could not be translated at all,
and most of Pro's strings were in a domain no catalogue holds. Pro shipped no
catalogue, and the free strings inside Pro's bundle could never find free's
language pack. Every suite was green the whole time, because no check read a
POT.

## Decisions

**1. The admin is minified by terser, with the gettext names kept.** wp.org's
packs and `wp i18n make-pot` both read the shipped `.js`, and both recognise a
call only by its callee's name. The `wordpressGlobals()` shim (ADR 0041)
destructures `__` into a local, and esbuild renamed it, so the built entry read
`c("…","wconvert")`. Free had 3,703 calls and Pro 4,641, and make-pot could
extract none of them. `GETTEXT_SAFE_TERSER` in `vite.admin-config.mjs` reserves
`__`, `_x`, `_n`, `_nx` and `sprintf`, and keeps `translators:` comments. It also
turns two compressions off, because each one lost strings even with the names
kept. `conditionals` folds `c ? __('A') : __('B')` into `__(c ? 'A' : 'B')`.
`inline` above 1 writes a shape Peast cannot parse, and make-pot then skips the
whole file without saying so. The result is still smaller than esbuild's: 478 kB
gzipped against 490 kB for free, and 551 kB against 566 kB for Pro.

**2. Code under `pro/` says `'wconvert-pro'`, and everything else says
`'wconvert'`.** A string's domain decides which catalogue it can ever be found
in. Free's comes from wp.org, which builds the pack from free's ZIP, and that
ZIP holds nothing under `pro/`. This covers PHP, Pro's playbooks and Pro's
TypeScript. `@wordpress/eslint-plugin`'s `i18n-text-domain` enforces it per
directory.

A helper in free's tree that tree-shakes out of free's bundle and ships only in
Pro's has no catalogue it could reach. That is a property of the code, not of its
strings. Journey result access, the graph screen insertion and capture helpers,
answer references, retiring an answer, the result product filter and picker, and
the product preview leaf therefore moved to `pro/` (beside ADR 0147's journey
authoring).

**3. Pro ships its own catalogue.** Pro is not on wp.org. `bin/build.sh pro` runs
`npm run build:pot:pro` before staging. In the stage, any `.po` is first brought
up to that `.pot`, because a JS catalogue is named after the md5 of a
content-hashed file. It is then compiled to `.mo`, `.l10n.php` and per-script
`.json`. The artifact contract refuses a `.pot` that names a bundle file the
stage does not carry. `Bootstrap::loadTextdomain()` is hooked before the min-core
guard, so a refusal notice is translated too.

**4. Pro's handle binds Pro's domain, and free's catalogues are inlined.** Pro's
`.json` is keyed by Pro's own file names, so `wp_set_script_translations()` on
Pro's handle binds `wconvert-pro`. Binding `wconvert` there, as before, looked up
free's language pack under Pro's file names, where nothing ever exists.
`ViteHelper::inlineAdminTranslations()` reads the catalogue of each of FREE's
built admin files, by free's paths, and merges it into `wconvert` on Pro's
handle. Chunks load per file, in the handle's own domain.

**5. `npm run check:pot` proves all of it, in CI, as its own required job.** It
was ported from WSMS. Every literal gettext call must be in its domain's POT:
PHP by its `#:` line, JS by a reference from a built `.js`, and `block.json` by
its file. A file make-pot could not parse fails, and so does any self-check
deviation. The self-check minifies a fixture with `GETTEXT_SAFE_TERSER` itself.
Removing a reserved name, either compression or the comments filter fails it.
A string in no built file at all is noted as dead code rather than failed: a
constant-folded branch, or a helper only a test calls.

## Consequences

- `npm run check:pot` needs wp-cli and built bundles, and exits 2 rather than
  passing without them.
- `i18n-translator-comments` is off until the 451 placeholders without a
  `translators:` comment have one. `--max-warnings=0` leaves no warning tier to
  start it at.
- Pro's playbooks changed bytes. Collections pin setups by file hash, so the
  collections that hold Pro setups were re-hashed and need a fresh review.
- A comparison against generated copy (`label === __('Back', …)`) now matches
  across two catalogues wherever free code wrote the text and Pro code compares
  it. When the translations differ, the comparison fails, and the generated copy
  is left as it is.
- Visitor-facing English in the renderer and loaders, and template and screen
  names, are untouched here.
