# 0166: The page's own words are translated in PHP, and read by position

Accepted 2026-10-23. Completes 0165. Keeps 0004.

ADR 0165 got every string into a catalogue. A second group of strings never got
that far: they were not strings a gettext call ever saw. Visitors read a close
button's name, a countdown's units, a field's fallback label, the copy and apply
buttons on a code, Pro's product and question messages, and the phone search's
result count, all in English on every site. Merchants read the same English in
destination test errors, in design and screen names, in a report's CSV headers,
and in Pro's inspector explanations.

## Decisions

**1. The visitor's page still has no `wp.i18n` (ADR 0004).** PHP translates the
renderer's and loaders' words instead: `PageLabels` for free, and
`ProPageLabels` at positions from 100 through `wconvert_page_labels`. The
payload tag prints them as `data-labels`. Only the words that differ from
English are printed, as an object keyed by position, so an untranslated page's
markup does not change. The three per-feature attributes that came before it,
`data-journey`, `data-reopen` and `data-content-lock`, are folded into it,
because each carried its own parser in the loader.

**2. Read by position, with the English inline.** `pageLabel(0, 'Close')`. The
English renders wherever nothing is printed: untranslated sites, older cached
pages, and the design studio, whose rendered identities therefore did not move.
The loader's byte budget has no room for a second copy of the English.
`PageLabelsTest` holds every TypeScript call to the PHP lists, so moving a
position fails a test instead of relabelling a field. Folding the three
older parsers in paid for most of it: the net cost is 28 B gzipped in free's
loader and 29 B in Pro's. CI's Node 22 zlib measures about 65 B more than a
local build, so the headroom has to be read off CI, not off a laptop.

**3. Admin previews get the same words** through `wconvertAdmin.pageLabels`,
handed to the renderer on the deferred side of the admin's lazy boundary, which
is where the renderer itself loads.

**4. Pro's inspector explanations read their words off the inspector's tag.**
The words are grouped by key and added through `wconvert_inspector_labels`
(`resources/loader/src/inspect/labels.ts`).

**5. A bundled design's name and its screens' names come from a generated
`labels.php`.** `bin/template-labels.mjs` writes it beside each plugin's
designs as literal `_x()` calls, and `TemplateNames` applies it as a bundled
source reads its designs. `TemplateNamesTest` fails when a labels file no
longer says what the JSON says. A downloaded or imported design keeps the words
it arrived with.

**6. One count-agnostic string where no plural rule can run.** The phone
bundle used to pick `_n(…, 1)` or `_n(…, 2)` by `count === 1`, which is wrong
for Russian, Polish and Arabic. It now uses `Results: %s`.

**7. Lists use `Intl.ListFormat`, and fragments become whole strings.**
`anyOf()` and `allOf()` in `lib/format.ts` replace `.join(' or ')`, because where
the conjunction goes, and whether a comma comes before it, belongs to the
language. A label glued to a figure became one string with a `%s`. Two complete
sentences shown one after the other are left as two strings.

**8. Translator quality is enforced.** `i18n-translator-comments` is an error
in ESLint, with `@eslint/compat` adapting plugin 23's rule to ESLint 9.
`npm run check:pot` also fails on make-pot's own audit: a placeholder with no
comment, which is the only place a PHP call's comment is checked, and a plural
whose singular drops its number. Ambiguous short words such as `Short`, `Normal`
and `None` became `_x()` with a context per setting.

## Consequences

- Exception and push messages a merchant reads are translated at the throw
  site, in the site's locale, when they are thrown. A message stored as a
  destination's `last_error` stays in the language it was stored in.
- Free's throw sites carry `phpcs:ignore ExceptionNotEscaped`, as
  `OccasionStore` already did. The text is returned or stored as plain text and
  never printed as HTML.
