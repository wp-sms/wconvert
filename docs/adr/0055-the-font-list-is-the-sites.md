# The font list is the site's, and WConvert loads no face

The Design panel offered four typefaces: *System*, *Sans serif*, *Serif*,
*Monospace*. A merchant whose theme ships Inter could not pick Inter — while
the family was sitting in their `theme.json` all along, already served on every
page of their site, already loaded by the theme.

What they could do instead was type
`"Inter", -apple-system, BlinkMacSystemFont, sans-serif` into a text box. That
is the *"type `center` into this box"* defect
([ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md)
rule 2) applied to the one token where the merchant's brand actually lives.

Two decisions, and the second is the one that makes the first safe.

## 1. The list is what the SITE declares, read at the boundary that already reads it

`ThemeTokens::font()` already walked
`wp_get_global_settings()['typography']['fontFamilies']` across the `default` /
`theme` / `custom` origins and took the first — the theme's body face, for
*Copy my theme's palette and font*. Every family was in its hand and it
returned one.

`ThemeTokens::fontsIn()` returns all of them, in declaration order, and
`fontsFromSite()` is its site-reading half — the same `from()` / `fromSite()`
split the palette side already has, so the walk is testable without a
WordPress install.

Three properties, each with a reason:

- **The same increasing-deliberateness order `palette()` documents.** Core's
  defaults, then the theme's, then `custom` — so a family the merchant added in
  the site editor beats the theme's entry of the same slug.
- **Deduped on the STACK, never on the name.** Two origins declaring one
  `fontFamily` are one family and the later name wins. Two families sharing a
  `name` but not a stack are two families and both show: the name is the
  theme's, and disambiguating it is not ours to do.
- **`fontFace` is not read at all.** A theme naming the system stack as a
  family has no face to load and works exactly as it is. What is offered is a
  stack the site already serves; the faces behind it are the theme's business.

**WordPress 6.5's Font Library needs no code and no version gate.** It writes
what the merchant installed into the `custom` origin, which this walk already
covers. On 6.2–6.4 the origin is simply absent and the list is the theme's.

`GET /wconvert/v1/theme` carries `fonts` beside `tokens` rather than earning a
route. It is the same fact about the same site out of the same settings, and
the panel that asks for one asks for the other; a second route would be a
second permission check and a second round trip for one answer. The picker
reads it **on the first open**, not on mount — which is that route's own
argument (*"read only when a merchant asks for it, which is rarely"*) kept
rather than quietly spent.

## 2. Nothing is fetched, and no face is declared

**This is not a saving. It is the only arrangement that works.**

An Optin renders inside a closed shadow root
([ADR 0009](0009-overlays-render-in-the-top-layer.md)), and
`resources/renderer/src/css.ts` states the consequence at the top of the file:
a face declared *inside* a shadow root is **silently ignored** — identical
computed `font-family`, different glyphs, and `document.fonts.check()`
returning true for fonts that do not exist. That is why `DOCUMENT_CSS` and
`SHADOW_CSS` are two halves rather than a stylistic split, and why
`tests/js/renderer-mount.test.ts` fails the day a face appears in the wrong one.

Offering the site's own stacks steps around that entirely. The stored token is
a **stack string**; on the front end the shadow root resolves it against the
document-level `@font-face` rules the theme already printed for its own pages.
`DOCUMENT_CSS` stays empty of faces and the guard keeps guarding nothing.

**In wp-admin the faces have to be asked for.** Core prints them on the front
end; the admin gets them only where something calls
`wp_print_font_faces()` — core's own, since 6.4, guarded because this plugin's
original floor was 6.2. The minimum is now 6.8 (ADR 0100); the availability
check is retained. Where the function is absent a row falls back to the next family in its
stack and the control still works. That call prints the **site's** faces, or
none; it fetches nothing.

> Extended by [ADR 0077](0077-editor-controls-make-placement-and-formatting-explicit.md): the site-font picker adds search and a capability/version-aware route to the WordPress Font Library for installing locally hosted Google Fonts. WConvert still loads no face of its own.

## The control changes shape, and that is rule 5 rather than a new treatment

`font` stops being a `ChoiceField`. Chips are the house treatment for one-of-N
([ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md)
rule 5) and they were right while N was four. Some themes declare twenty or
thirty families, and thirty chips in a wrapping segmented strip is not a font
picker.

So it takes the shape `ColourField` already has: a Radix `Popover` whose
trigger shows the current family **set in its own face**, opening a scrollable
list with the site's families above a rule and the four system stacks below,
each row set in the face it names. That is the existing treatment applied to a
second token, which is what rule 5 asks for — one job, one control — rather
than a fifth one invented ([ADR 0054](0054-every-control-has-the-shape-of-its-value.md)
rule 5).

**It is dispatched on what the LIST is, never on the token's name.** A choice
list whose every value is a font stack is a font picker; `Tokens.tsx` still
names no token, and a second such token added to the manifest tomorrow gets the
same control with nothing in the bundle edited.

**Rows and not a `<select>`.** `index.css` recorded why the strip was chips —
`font-family` on an `<option>` is unreliable across browsers — and that is
exactly why the replacement is a list. The whole value of this control is
reading *Georgia* set in Georgia. What changed is the count; the reason did
not.

### Native radios inside it, and not a hand-authored listbox

The obvious spelling is `role="listbox"` with `role="option"` rows, to keep the
arrow keys the radio group was giving away for free. **A listbox does not give
arrow keys** — the role is a promise the author then has to implement, with
roving `tabindex` and a key handler.

Native radios keep the behaviour for real: arrow keys between them, one tab
stop for the set, and the set announced as a set, all from the browser. It is
`ChoiceField`'s own argument, which already refused Radix's `ToggleGroup` for
buying roving focus the browser supplies. The popover is where the radios live
now; it is not a reason to stop being radios.

## Consequences

- **A merchant who picks a site font and then switches theme keeps a stack**
  that degrades to whatever else it names. `"Inter", sans-serif` falls back
  cleanly; a bare family name falls to the browser default. Nothing to fix, and
  it is written here because the alternative is the tempting one: storing a
  family *id* and resolving it at render would put a registry lookup on the
  render path that [ADR 0010](0010-templates-are-configuration-not-documents.md)
  keeps off it, and would make an Optin's look depend on a theme it took a copy
  away from.
- **A classic theme with no `theme.json` declares no families**, and core
  declares none by default — so the list is empty and the control shows the
  four system stacks it always did. The feature degrades to nothing rather than
  to something broken.
- **A failed read costs a longer list, never a control.** It is swallowed, like
  the builder's own numbers: the four stacks still work, and an error banner
  over a working picker would be the louder wrong answer.
- **The four system stacks stay in the manifest and stay translated.**
  `TemplateLabels::tokenValues()` names them for the *register* rather than for
  a typeface — "Helvetica" on a Windows machine is Arial — and that is
  unchanged. A **site** family is named by the theme's own `name`, deliberately
  untranslated: *Playfair Display* is a proper noun.
- **The escape hatch moved inside the popover.** A stack nobody listed is still
  typeable, because token values are unvalidated on both sides of the boundary
  (ADR 0010) — but it is something you open the picker to reach rather than a
  box you land on, which is [ADR 0054](0054-every-control-has-the-shape-of-its-value.md)
  rule 2.

## What was considered and refused

**Loading from `fonts.googleapis.com`.** Three reasons, any one of which is
enough:

- **It makes the merchant liable.** The Munich Regional Court (LG München I,
  20 January 2022, 3 O 17493/20) awarded damages against a site operator for
  transmitting a visitor's IP address to Google by embedding Google Fonts
  remotely, and a wave of German claims followed. WConvert would be injecting
  that request into somebody else's page, on their domain, under their privacy
  policy — **our markup, their liability**, which is exactly the exposure
  [ADR 0052](0052-a-countdown-counts-to-the-optins-own-schedule-end.md) refuses
  to hand a merchant on the accessibility side.
- **It is a remote resource on a wp.org plugin**, and the guidelines are
  tightening rather than loosening on those.
- **It would not work anyway.** A `@font-face` inside the shadow root is
  ignored, so the request would need a second hoisting path into the document —
  new machinery, for the one option that also carries the legal problem.

**Bundling woff2 files.** A licensing audit per family, a ZIP that grows by
hundreds of kilobytes for faces most merchants will not use, and a second
answer to *"which fonts exist"* that would immediately disagree with the
theme's.

**Serving the theme's font files ourselves.** Same request, same face, worse:
the theme has already loaded them and a second copy is a second download of the
identical bytes.

**A `<select>` of families.** Refused above and refused before: `font-family` on
an `<option>` is unreliable, and a font picker that cannot show the font is a
list of words.

**Keeping the chips and appending the site's families to them.** This is the
one somebody will propose, because it is the smallest diff. It is refused on
the count: the strip is fixed-height house furniture sized for three or four
values, and a theme declaring thirty turns the Design tab into a wall of names.
Rule 5 exists to name exactly that boundary.
