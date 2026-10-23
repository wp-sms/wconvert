The self-check fixture for `bin/pot-coverage.mjs`, ported from WSMS 8's. Every
run of that script copies this directory, minifies `src/minified.js` into
`build/` with the admin build's own `GETTEXT_SAFE_TERSER`, generates a POT for
the copy and demands that its comparator finds **exactly** the three calls
planted here that make-pot cannot extract:

- `plugin.php` — `Fixture cast`: a plural whose count is a cast over a
  parenthesised expression, which make-pot silently drops.
- `plugin.php` — the second `Fixture shared`: the same shape, but its msgid is
  also contributed by an extractable call two lines up. It is in the POT, just
  not from this line — so a check that tested msgid membership instead of `#:`
  references would pass it, and the self-check would catch that check.
- `src/app.tsx` — `Fixture dropped`: a source string that is not in the "bundle"
  (`build/app.js`), the way a JS string is lost when its component never ships.

And it must set aside `src/dead.tsx` — imported by nothing, in no bundle — as
dead code rather than fail on it, while `src/app.tsx` (imported by `src/index.ts`)
stays checked. `vite.config.mjs` names the entries, the way the real bundler
configs do.

`src/minified.js` must PASS, with its `translators:` comment in the POT. It is
the admin bundle's shape — gettext destructured into module-scope locals — and
it is what fails the check when a name leaves `mangle.reserved` or the comments
filter stops keeping translator comments. The real bundles would fail too, but
this says why.

Everything else here must pass. Change a string and you change the self-check.
