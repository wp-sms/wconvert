# The admin ships as an ES module so it can split

[ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md) decided that
the builder would be lazy-loaded and recorded, as a consequence, that the
printed bundle size was *"the UNSPLIT bundle … the pessimistic figure and not
the one a merchant checking yesterday's leads actually pays"*. It also named the
obstacle in one line: **the admin is built as an IIFE, and IIFE cannot
code-split.**

This is what that line cost, and the three things that had to change together.
Nothing in [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md)'s
loader budget is touched by any of it — `bin/check-loader.mjs` is not read, not
run differently, and free's loader is the same 5,994 bytes it was.

## An IIFE has nowhere to put a second chunk

An immediately-invoked function expression is one expression. There is no
syntax in it for "and here is another file, fetched later", so a bundler asked
to split one has two options: refuse, or flatten. Vite flattens — it forces
`inlineDynamicImports` on for `iife` and `umd`, which means a `React.lazy`
written against that config **silently does nothing**. The build succeeds, the
component still loads, and the byte it was written to save is still in the
entry.

That is the reason #73 was a ticket rather than a line, and the reason this
starts with the build config rather than with `React.lazy`.

## `lib` mode had to go too, and it was worth 34 kB

The obvious change — `formats: ['iife']` to `formats: ['es']` — code-splits
correctly and made the bundle **34 kB gzipped bigger**. Vite deliberately skips
whitespace minification for an ES **library** build, because stripping it would
remove the `/*#__PURE__*/` annotations a consumer's tree-shaker reads.

Nothing consumes this bundle. It is enqueued by WordPress and run. So the admin
build stopped being `build.lib` and became what it always was — an application
with an entry — and the exemption went with it. The format change is now worth
about 170 bytes, which is the ESM boilerplate.

## The WordPress globals became a shim, and stayed external

`rollupOptions.external` plus `output.globals` is an IIFE mechanism: Rollup drops
the import and reads `wp.i18n` off the window where the call happens. There is no
ES equivalent. An external in an ES build is emitted as
`import { __ } from "@wordpress/i18n"` — a bare specifier no browser resolves,
and no import map can supply it here, because WordPress ships both packages as
**classic scripts** rather than script modules. (That is also why
`wp_enqueue_script_module()`, added in 6.5, would not have helped even if the
plugin's original floor had already been 6.8: a script module cannot declare a dependency on a
classic script.)

They must stay out of the bundle, and the reason is not size:
`wp_set_script_translations()` loads its catalogue into the `wp.i18n` **WordPress
provides**, so a second bundled copy would be a second `__()` reading an empty
catalogue — every string rendering in English on a translated site, with nothing
anywhere saying why.

*Completed: `wp_set_script_translations()` loads the catalogue of the ENTRY
only. A catalogue is per JavaScript file, and the builder chunks are `import()`ed
rather than enqueued, so their strings had no catalogue loaded at all.
`ViteHelper::chunkTranslations()` registers each chunk — never enqueued — so
`load_script_textdomain()` can resolve its path, and merges its catalogue into
the entry's domain with `setLocaleData` before the entry runs.*

So a Vite plugin resolves each specifier to a module whose whole body reads the
global back out. The import stays an import, the code that runs is still
WordPress's, and no `@wordpress` source ships. Two guards sit on it, because a
hand-written surface fails by omission: the plugin is `enforce: 'pre'` (Vite's
own resolver is a core plugin and would otherwise win, bundling both packages
silently), and `MISSING_EXPORT` is promoted from a Rollup warning to a build
failure (a name the shim forgot would otherwise be emitted as `undefined` — a
screen that renders with a function that is not there).

## A hashed entry is a correctness fix, not a caching one

This is the part that only a browser could have found, and it did:
the screen went blank with *"Invalid hook call"* while every test stayed green.

`builder-<hash>.js` imports React and the shared components from the entry, as
`./main-<hash>.js`, resolved against its own URL. The entry was enqueued as
`main.js?ver=<mtime>` — `WConvert\Assets\BuiltAsset`'s mtime, the ordinary
WordPress way of busting a cache, applied to a file that is now also a module.
**To a browser those are two different modules.** React was instantiated
twice, and the builder's first `useState` ran against a copy that had never
rendered it.

So the entry carries a content hash and no query at all, and its name is what
busts its cache. Two details are load-bearing enough to be commented in the code:

- **`null`, not `false`**, is the version that adds nothing.
  `WP_Scripts::get_normalized_src()` tests `empty($obj->ver) && null !== $obj->ver`,
  so `false` — the parameter's own default — falls through to the site's
  WordPress version.
- **The stylesheet keeps its `?ver`.** A stylesheet has no module identity and
  nothing imports it, so `BuiltAsset::version()` is still right there.

## Enqueuing it preserves classic script dependencies

An ES build is inert in a classic `<script src>`: the browser parses it as a
script, reaches `export`, and throws before a line runs. WordPress has no API
for the `type="module"` attribute at the original **6.2** floor —
`wp_script_add_data()` carries a `strategy` since 6.3 and no type ever — so the
tag is filtered, which every version since 3.0 supports. The existing `type` is
stripped rather than joined, since WordPress writes `type='text/javascript'` on
any theme without HTML5 script support and two of them is the first one winning.

The minimum is now **6.8** (ADR 0100). The filter remains because the admin
depends on classic WordPress scripts; raising the minimum does not convert those
dependencies into script modules.

A module is deferred, which is what `$in_footer` already wanted, and
`wp_add_inline_script(…, 'before')` still runs first because a classic inline
script executes where it is written.

## What this amends

- [ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md)'s
  consequence *"the printed number is the UNSPLIT bundle"* is no longer true,
  and its note now says so. Its **decision** is untouched and is what this
  carries out; what changes is that the number it prints is now two numbers.
- [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md) is **untouched
  in every direction.** `bin/check-loader.mjs`, `resources/loader/` and
  `resources/renderer/` are not edited by this, free's built loader is the same
  5,994 bytes gzipped, and the admin build has never been inside that budget.

## Consequences

- **The reading screens pay 132.6 kB gzipped and the builder 20.6 kB on top**,
  against 150.1 kB for everything before. The build prints the two separately,
  classified by the build's own answer — an entry chunk and its assets load with
  the page, a dynamically imported chunk does not — so a second boundary reports
  itself with no edit to the reporter.
- **`resources/admin/src/builder/deferred.ts` is the chunk**, and it is the one
  file nothing may statically import. One such import pulls the whole subtree
  back into the entry, the build still succeeds, every screen still works, and
  the only symptom is a number in a log. `tests/js/admin-split.test.ts` walks the
  static import graph from the entry and fails on it — proven at the source, per
  run, in the same spirit as ADR 0029's scan.
- **The artifact contract names two patterns**, not one path. A ZIP carrying the
  entry without the chunk boots, renders four working screens, and fails only on
  the fifth — in a browser, with a 404 in a console nobody has open. Both
  `bin/verify-artifact-contract.sh` and `ViteHelper` refuse it, and
  `require_matching_file` holds the zero-byte floor `require_populated_dir` does
  not.
- **A loading state is now a shipped component rather than an arm of a screen.**
  A fallback cannot live inside the chunk it is waiting for, so the builder's
  skeleton and the choice-card vocabulary moved out to `shell/` — and the
  builder renders the same skeleton for its own first fetch, so the two waits
  read as one.
  *Held by [ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md),
  which adds a second in-chunk skeleton and keeps the rule intact.
  **`GallerySkeleton` is inside `builder/`** — it pairs with the grid the way
  `ChoiceSkeleton` pairs with `ChoiceGrid`, and what it waits for is a fetch the
  chunk itself makes, never the chunk. The chunk-level fallback is still
  `shell/BuilderSkeleton`. The whole design picker — the dialog, the facet
  toolbar, the card — is on the far side of the boundary and
  `tests/js/admin-split.test.ts` passed untouched, which is the assertion that
  matters: a picker reachable from `main.tsx` would put the renderer back on
  every reading screen.*
- **The creation flow is behind the same boundary as the builder.** It ends in
  the builder by construction and draws a real design at its last step
  ([ADR 0010](0010-templates-are-configuration-not-documents.md)), so leaving it
  eager would have put the renderer back on every reading screen to serve a
  screen whose next click loads the builder anyway.
