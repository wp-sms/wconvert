---
name: design-a-template
description: Author a new WConvert design (a [[Template]]) — a node tree plus tokens, in the closed vocabulary. Use when adding designs to the library, growing the gallery, or when a Playbook needs a design that does not exist yet.
---

# Designing a Template

A [[Template]] is **configuration, not a document** (ADR 0010): a JSON node
tree over a closed vocabulary plus a closed set of CSS custom properties — set
for the whole design, and re-declared on layouts and leaves for their own
appearance (ADRs 0062 and 0067). It
carries no HTML or CSS. Copy usually comes from the [[Playbook]] or merchant;
a design's own text supplies gallery examples. **Use this design's sample
content** can explicitly copy those examples into the draft (ADR 0075), so
every sample still needs honest visitor-facing wording. **Keep my content**
remains the default and shows the actual prepared candidate before Apply.

That boundary is what keeps the library small. With copy held elsewhere a
design is Goal-agnostic, so the gallery is *N designs per [[Display Type]]*
rather than a design for every pairing of Display Type and [[Goal]].

**The builder starts with a preview and a contextual inspector** (ADR 0067).
Merchants can edit selected elements and use the optional Layers panel for
structure. A library design should still be a complete starting point: getting
a usable Optin must not require rebuilding its layout.

## The loop

1. **Read the spec.** `./tools/design-library/build.sh vocabulary` then read
   `tools/design-library/out/VOCABULARY.md`. It is generated from
   `resources/templates/manifest.json`, so it cannot be out of date, and it is
   self-contained — everything about layouts, leaves, params, tokens, Slot
   Roles and step counts is in it.
2. **Author** one JSON file. Free designs go in
   `resources/templates/library/`, or in `tools/design-library/hosted/templates/`
   when the catalogue alone should serve them (ADR 0157); Pro ones in
   `pro/modules/display-types/templates/`; paid question designs go in
   `pro/modules/journeys/templates/`. The `id` must be unique across all modules.
   Give each shipped leaf a stable `n1`…`n9999` id, unique within its tree, and
   preserve that id when reordering it. Author `tree.v: 2` — `v` is the vocabulary version, and nothing else. A journey that needs the graph contract adds a `graph`; never write `v: 3` (ADR 0156: it is the old spelling of a flow, read but never written, and the next vocabulary version is 4). Preserve stable screen IDs and validate every reachable route with the shipping capture contract. Do not author derived facets.
   PHP mints missing ids on newly added draft leaves; that fallback is not a
   reason to renumber shipped leaves and lose translation identity (ADR 0010).
3. **`composer verify:templates`.** Not optional — see below.
4. **Render it.** `./tools/design-library/build.sh renderer designs sheet` and
   read `out/contact-sheet-320-ltr.png` first.
5. **Inspect the final output again after the last edit.** Rebuild the renderer
   and review pages, then inspect the actual rendered result in a browser. Check
   every screen at desktop and phone widths, including acknowledgements and
   result variants. Look at hierarchy, font sizes, line breaks, spacing, row
   alignment, button prominence and overall balance. Run the size/contrast checks
   as well. Zero automated findings is not visual approval. Record what was
   actually inspected and keep a screenshot of the final result; an earlier
   screenshot does not verify a later edit. For wrapping rows and splits, also
   inspect the widths immediately before and after each layout transition with
   real filled copy and a longer CTA. Save those views with a short composition
   judgement (reading order, grouping and alignment), not only a count of passing
   checks. Inspect the mounted WordPress output with its dismiss control present
   and opening motion settled, including touch widths and acknowledgement.
   Announcement bars must not leave a heading beside a form whose button
   has dropped below its field. Run `npm run templates:check-announcements` against
   the rebuilt local studio when changing Bar with a field or its filled setups.
6. **Judge it** against `tools/design-library/GUIDELINES.md` §1, the
   conversion heuristics. Walk all eleven.
7. **Write its catalogue words** in `tools/design-library/publishing/designs.json`
   (see *Publishing* below) — not in the design file.
8. **Iterate**, then `composer test && npm test`.

The [Design Bench](../../../tools/design-library/README.md) is the interactive
half of steps 4–5: paste the tree in, drive every token live, switch container,
viewport, direction and theme, and copy the result back out.

## Run `composer verify:templates`. Authoring has six silent failures.

The validator's entire posture is **drop it and carry on**, which is right at
runtime and useless at a keyboard. Nothing throws, nothing is logged, and the
gallery card usually still looks right.

Three of the six cost a day each:

- **A missing or misspelled `tree` key silently becomes a Pro upsell card.**
  No `tree` is the whole discriminator for *"a design this install did not
  get"*, so one typo — `"trees"`, or `"steps"` at the top level — turns your
  free design into an advertisement for itself, complete with a **Pro** badge
  and a *"See this design"* link to a page that does not exist.
- **A JSON syntax error skips the file entirely.** `JsonFile::read()` returns
  null, the library is never handed it, so no `Rejection` is constructed and
  nothing is warned. The design is simply absent.
- **A dropped [[Slot Role]] goes without a word.** A snapshot strips the text
  from every text node and binds it back only where a Role binds, so a node
  that lost its Role reaches a real visitor as an **empty paragraph** — while
  the gallery card looks fine, because the entry keeps its own placeholder.

And three quieter ones: a Role kept on the wrong node type (a `text` claiming
`cta_label` binds a button's label into a paragraph), an undeclared param or
token dropped so the design renders with the default, and a `split` written
with `children` losing both panes.

`bin/verify-templates.php` reports every one by name. It **diffs** the raw
decode against `TemplateVocabulary::normalize()` node for node rather than
re-validating, so it cannot drift from the validator.
`tests/unit/Template/LibraryLintTest.php` runs it in CI.

## The two refusals

Unlike the six above, these are **refusals** — the design is not registered at
all, so it is missing from the gallery entirely.

- **Explicit linear flow.** Use screen wrappers `{id, name, kind, content}` and
  `tree.submissions` with stable field/consent references. At most six screens
  precede one terminal acknowledgement, with one required submission and at most
  one optional signup for the other marketing channel. Click-only designs retain
  one content screen and no submissions, with either one link button or one Pro `products` block (ADR 0117). Product blocks ship empty `product_ids`, require WooCommerce, and count product-link clicks by default. ADR 0121 adds `action: add_to_cart` on the products block for server-confirmed quantity-one additions; supporting product links then do not convert.
- **Navigation is separate.** Next/Back do not save; Submit names its submission;
  every optional screen offers Skip for that submission. Use navigation Roles
  (`next_label`, `back_label`, `skip_label`, `close_label`) so copy transfer cannot
  turn a signup CTA into a Back label. Style Back/Skip/Close as secondary actions.
- **Every screen is reviewed.** Inspect mobile, desktop and RTL renders; verify
  actual navigation, fixed submitted fields and immediate primary acknowledgement.

**Success wording describes capture, not delivery.** Use *Request received* or
thank the visitor for the specific request. A form response does not prove
provider subscription, confirmation or inbox delivery, so never use *You are
subscribed* or *Your code is on its way* as library success copy. *Here is the
code* is appropriate only when a `code` node actually displays it. The merchant
still configures the offer and any delivery route. See `GUIDELINES.md` §1.5 and
ADR 0073. Library-copy changes affect examples and new drafts; do not rewrite
saved merchant copy.

**Author a label as well as an example for every field.** Field-only rows keep
their labels. Only a compact field-and-button row with non-empty examples may
visually hide its direct field labels on wide containers, and those labels
return at 24rem and below. The renderer supplies a fallback for missing labels
and an asterisk for required fields. Do not duplicate the asterisk or rely on
the fallback instead of clear words. Phone examples include a country code.

**One optional choice question is available as `name: "interest"`.** It renders
a native single-choice select. Supply a question label, an empty-option prompt
in `placeholder`, and a nonempty `options` list of `{value, label}` pairs. The
manifest's `field_options` is the authority: up to 12 choices, labels up to 120
Unicode characters, and unique stable values matching
`^[a-z][a-z0-9_-]{0,47}$`. Do not invent another field name, accept arbitrary
text, or use a choice as an identity. Every submit form still needs email or
phone. Default the choice to optional unless the visitor's request needs it.

`options` is content and travels through the derived `interest_options` Role
as `{options: [...]}`; labels and values survive compatible design changes.
The question and prompt use `interest_label` and `interest_placeholder`.
A Playbook localizes labels, not stable sent values. Include a concrete optional
choice only when it helps the receiving business respond; a catalogue of
unnecessary questions is not a better capture form. See ADR 0076 and
`resources/templates/library/inline-choice.json`.

**A design's act is no longer coupled to any Goal.** ADR 0059 deleted every
design↔Goal pairing: a Template offering exactly one converting act **is** the
declaration. Do not add a check for it, and do not file a design under a Goal.

## Facets are derived. Never author them.

`shape`, `captures` and `has_image` are read off the tree by
`src/Template/TemplateFacets.php`, so they cannot drift from the design they
describe. `TemplateFacetsTest` walks the real library, so a new design is
covered the day it lands.

There is no exception any more: `locked.json` is gone (ADR 0156). A hosted
card with no tree on this site carries facets the **publisher derived** from the
tree with the same `TemplateFacets`, so nobody writes a facet anywhere.

## A Pro design costs nothing extra in the free ZIP

Free ships no card for it. A Pro design reaches a free site only as a hosted
catalogue entry: the publisher renders its thumbnail, and the picker shows it
locked with a link to its page on wconvert.io (ADR 0156). Never put a Pro tree,
or anything that names one, in `resources/`.

## Publishing: words, families, images and revisions

Every design is published as its own object with its own **revision**
(ADR 0156, `docs/template-discovery-api.md`). What that asks of an author:

- **Catalogue words** go in `tools/design-library/publishing/designs.json`, keyed
  by design id: `description` (one honest sentence a merchant would search for,
  shown on the website), optional `slug`, and `industries`, `occasions`,
  `style`, `colour` — ids from that file's `taxonomy`, never free text. Add a
  taxonomy term there (with its label) when none fits; the plugin needs no
  release for it. Seeded values from 2026-10-20 are marked for review: correct
  them when you touch a design.
- **Family.** Hand-drawn siblings of one design across formats share
  `"family": "<id>"` in the same file. Each sibling is still its own design.
- **Ids are permanent.** Never reuse one, never rename one in place: a new id
  that replaces an old one lists it in `aliases`. A design that is gone is
  retired by `npm run templates:revisions` and its id can never come back.
- **Images need a rights record** in `publishing/catalog.json` → `image_rights`,
  keyed by the raster's SHA-256: `kind` (`original`, `ai-generated` or
  `licensed` — then `licence` too), `source`, `redistribution: true`,
  `reviewedBy`, `access`. Bundled designs included. A design with an image and
  no record cannot be exported; it stays `bundled_only`.
- **Colour lives in the top-level tokens.** A literal colour in a node's
  `tokens` or `narrow` bag is counted against
  `publishing/colour-baseline.json`; a new design starts at zero and an
  existing one may only go down, so a future Brand setting can restyle it.
- **Revisions are computed, not written.** After any change that ships, run
  `npm run templates:revisions` and commit `publishing/revisions.json` with both
  generated `revisions.json` files; `templates:revisions:check` fails the build
  otherwise. Never put `revision` in the design file — it would change the bytes
  every approval is pinned to.
- **Approval is two machine checks and one judgement**
  ([`pilot/PRACTICAL-REVIEW.md`](../../../tools/design-library/pilot/PRACTICAL-REVIEW.md)).
  `setup-checks.mjs` records the visitor route and the configured WordPress run;
  you judge the contact sheets from `batch-audit.mjs queue --capture` and write
  only what is specific to each setup. After a renderer change run
  `templates:visual-diff --apply` first and judge only what it lists. An
  approval goes stale only when what ships changes, not when the brief does.
- **Publishing is a plan entry.** Add the setup to `publishing/catalog.json`
  `setups` once it is approved; `npm run templates:release:local` exports it,
  renders its thumbnails and previews, and runs the shipping PHP reader over
  the whole release. A design that cannot be exported yet goes in
  `bundled_only` with the exporter's reason.
- **Undo is a new revision**, or a `withdrawn` row with a reason (`rights`,
  `quality`, `broken`, `other`) — never a deleted design. A release that drops
  a live design without withdrawing it is refused.

## What cannot be imported, and why there is no mapper

HTML from anywhere — a competitor, a canvas, a generator — **cannot cross**.
Positioned badges, decorative shapes and second CTAs have no home in the
vocabulary and `TemplateVocabulary::normalize()` drops them **silently**.
Per-node colours DO have a home — a layout or leaf's `tokens` bag — using the
declared token names. A value affects the elements that read that token.

An HTML→JSON mapper is easy to write and unsafe to trust, which is exactly why
there is not one ([#18](https://github.com/navidkashani/wconvert/issues/18)).
Author against `VOCABULARY.md` instead.

## The ceiling, stated plainly

The token **names** are closed and that is the ceiling. Where each one APPLIES
is not: ADR 0062 added layout `tokens` bags and ADR 0067 extended them to leaves,
re-declaring the same names for the element and everything inside it. Custom
properties inherit, so a `split` can hold a cream pane beside a dark one and the
form can have a different ground from the headline. Bags nest.

**A bag is only visible where something draws it, and two layouts are that
something.** `stack`, `row`, `split` and `grid` arrange and paint nothing, so a
`stack` with `{"bg":"…"}` tints only what inside it happens to read `--wc-bg`.

- A **`panel`** holds its children in a column exactly as `stack` does *and*
  draws the box — ground, picture, wash, padding, corner, edge. A photo pane
  with nothing written on it is a `panel` carrying `bg-image`, `overlay` and
  `min`. `notch: true` punches two circles out of its top corners so the page
  shows through — the one ornament a token cannot reach, and only visible where
  the halves paint and the design's own ground does not.
- A **`media`** is the picture box: the same two background layers, and its
  children pushed to its top and bottom edges rather than stacked. That is a
  wordmark above a display line on one photograph, which thirteen of the
  sixteen reference designs are. Give it `min`, or the spread has nothing to
  spread across, and `fg`, because the design's ink was chosen against the
  design's ground and not against your picture.

Both reset `bg-image` and `overlay` before their own bag applies, so the
design's picture is not repainted inside every box in it (ADR 0063).

**Text copy supports line breaks, links and emphasis.** A newline is a real line break
on every text leaf — write where a display headline breaks rather than hoping
for the wrap. `%s` plus a `link` object is an anchor, and `%b` plus an
`emphasis` string is a `<strong>`; one of each per sentence, a second mark is
literal, and a mark with nothing to fill it renders nothing.
Keep privacy wording grammatical when the site has no policy URL; a complete
sentence followed by `%s` works without leaving a fragment such as `See our.`.

**A colour token's value may name another colour token** — `{"bg": "accent"}` —
and it then follows the theme. Reach for a literal hex only where the box is
deliberately outside the palette.

**A layout or leaf may carry the bag twice.** `narrow` is the same names again,
applying below 24rem (384px) of *container* — so an inline Optin in a sidebar
retunes on a desktop (ADRs 0064 and 0067). Reach for it where shrinking is not
the same as retuning: a
photo pane that is 440px of a split and the whole width on a phone wants less
padding and smaller display type, not the same values in a narrower box.
Everything that merely needs to be smaller already is — a `split` stacks, a
`grid` drops to one column. It is the one thing that **doubles what a scope
stores**, so set the two or three tokens that retune and not the bag again.

**A floor is only needed where the picture is the taller thing.** `.wc-split`
is `align-items: stretch`, so a `media` beside a form is already the form's
height and `min` adds nothing — and once the split wraps, `min` is what leaves
a 384px picture above the fold on a phone.

ADR 0061 declined per-node styling as "rung 3" and named the evidence that would
reopen it; ADR 0062 records the reopening, and that the evidence was a different
kind than the one asked for.

**Arrangement stays within the tree's layout vocabulary.** The editor offers
guarded move, copy, delete and layout controls. There is no per-node `class`,
arbitrary `style`, or absolute positioning; the layout still decides where its
children go.

Beyond the bag, **token values are unvalidated** — only the names are checked —
so `clamp()` widths, asymmetric `pad`, arbitrary radii, gradients through
`bg-image` and washes through `overlay` all work today. ADR 0054: `choices` is
*an offer, not a limit*.

## Watch items

- **The gallery at 40+ designs.** ADR 0043 notes filters appear only at nine
  designs of one Display Type, and `TemplateController::MOST_TREES = 24` caps
  trees per request. The picker batches by viewport, so this should hold — but
  it is the first time the facet strip is load-bearing.
- **`losesWordsOnSwitch`.** More designs × more Playbooks means more Slot Role
  mismatches on a switch. It lives in
  `resources/admin/src/builder/structure/catalogue.ts` and reports to the
  merchant on screen; **it is not in `bin/verify-templates.php`**, so CI will
  not catch it for you.
- **A `countdown` counts to the Optin's `ends_at` and nothing else** (ADR
  0052). With no end date it draws its shape and no time, and the builder says
  so. That is honest, not broken — but a design built around a clock needs a
  Playbook whose notes tell the merchant to set one. `"layout": "boxes"` draws a
  box per unit; give it `"role": "countdown_units"` and its four words come
  from the Playbook under that Role (`days_label` …), never from the Template
  (ADR 0159).
- **The close × and the error box are coloured by the design's tokens**
  (`close-fg`, `close-bg`, `close-border`, `close-radius`, `error-fg`,
  `error-bg`; ADR 0159). On a dark card use a bare × pointing at `fg`; over a
  photograph a soft dark disc with a white ×. GUIDELINES.md §1.8 has the values.
  The catalogue gate fails a × under 3:1 or an error under 4.5:1.

## Before opening a PR

```bash
composer verify:templates   # every entry survives registration intact
npm run templates:revisions:check   # revisions and both bundled revision files current
composer test               # TemplateFacetsTest, TemplateLibraryTest, ProLibraryTest
npm test                    # renderer-manifest-parity, builder-gallery — READ THE EXIT CODE
composer verify:source      # no Pro tree in the free tree
```

`npm test` can print a green summary and **still exit 1**: an unhandled error
in a `requestAnimationFrame` or a timer is reported below it.

And per `AGENTS.md`: **verify on a real WordPress.** A green suite is not a
booting plugin. Use the Playground one-liner in `README.md`.
