---
name: design-a-template
description: Author a new WConvert design (a [[Template]]) — a node tree plus tokens, in the closed vocabulary. Use when adding designs to the library, growing the gallery, or when a Playbook needs a design that does not exist yet.
---

# Designing a Template

A [[Template]] is **configuration, not a document** (ADR 0010): a JSON node
tree over a closed vocabulary plus 22 CSS custom properties — set for the whole
design, and re-declared on any layout node for what is inside it (ADR 0062). It
carries no HTML, no CSS and — this is the part that catches everyone — **no
words a visitor reads**. Copy lives on the [[Playbook]]; a design's own text is
placeholder that exists so the gallery has something to show.

That boundary is what keeps the library small. With copy held elsewhere a
design is Goal-agnostic, so the gallery is *N designs per [[Display Type]]*
rather than a design for every pairing of Display Type and [[Goal]].

**The builder has no canvas** ([#15](https://github.com/navidkashani/wconvert/issues/15)),
so this library is the entire design surface of the product. There is nowhere
for a merchant to escape to.

## The loop

1. **Read the spec.** `./tools/design-library/build.sh vocabulary` then read
   `tools/design-library/out/VOCABULARY.md`. It is generated from
   `resources/templates/manifest.json`, so it cannot be out of date, and it is
   self-contained — everything about layouts, leaves, params, tokens, Slot
   Roles and step counts is in it.
2. **Author** one JSON file. Free designs go in
   `resources/templates/library/`, Pro ones in
   `pro/modules/display-types/templates/`. The `id` must be unique across
   **both**.
3. **`composer verify:templates`.** Not optional — see below.
4. **Render it.** `./tools/design-library/build.sh renderer designs sheet` and
   read `out/contact-sheet-320-ltr.png` first.
5. **Judge it** against `tools/design-library/GUIDELINES.md` §1, the
   conversion heuristics. Walk all eleven.
6. **Iterate**, then `composer test && npm test`.

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

- **Exactly one converting act.** One `button`, with `action` either `submit`
  or `link`. Two is refused, none is refused.
- **The step count follows from the act.** `submit` → **2 steps** (the second
  is the terminal success state). `link` → **1 step**, because the click
  navigates the visitor away and an interstitial is worse than the navigation
  it delays (ADR 0025).

**A design's act is no longer coupled to any Goal.** ADR 0059 deleted every
design↔Goal pairing: a Template offering exactly one converting act **is** the
declaration. Do not add a check for it, and do not file a design under a Goal.

## Facets are derived. Never author them.

`shape`, `captures` and `has_image` are read off the tree by
`src/Template/TemplateFacets.php`, so they cannot drift from the design they
describe. `TemplateFacetsTest` walks the real library, so a new design is
covered the day it lands.

**The one exception is `locked.json`**, which has no tree to read — that is
where a Pro design's facets are *written*, and it is the only place a facet is
written anywhere.

## A Pro design costs two more things

1. **A metadata-only stub** in `resources/templates/locked.json` — never a
   `tree`, ever. Shipping premium trees in the free ZIP and refusing the save
   is trialware ([#7](https://github.com/navidkashani/wconvert/issues/7)).
   `bin/verify-artifact-contract.sh` enforces it.
2. **A live page** at `https://wconvert.com/designs/<slug>/` for its
   `preview_url`. Out-of-repo work, one per design. A free install draws a card
   with a *"See this design"* link, and a dead link is worse than one fewer
   card.

## What cannot be imported, and why there is no mapper

HTML from anywhere — a competitor, a canvas, a generator — **cannot cross**.
Positioned badges, decorative shapes and second CTAs have no home in the
vocabulary and `TemplateVocabulary::normalize()` drops them **silently**.
Per-node colours DO have a home — a layout's `tokens` bag — but only in the 22
declared names, and only on a layout.

An HTML→JSON mapper is easy to write and unsafe to trust, which is exactly why
there is not one ([#18](https://github.com/navidkashani/wconvert/issues/18)).
Author against `VOCABULARY.md` instead.

## The ceiling, stated plainly

The 22 token **names** are closed and that is the ceiling. Where each one
APPLIES is not: since ADR 0062 any layout node carries its own `tokens` bag,
re-declaring the same names for itself and everything inside it. Custom
properties inherit, so a `split` can hold a cream pane beside a dark one and the
form can have a different ground from the headline. Bags nest.

ADR 0061 declined per-node styling as "rung 3" and named the evidence that would
reopen it; ADR 0062 records the reopening, and that the evidence was a different
kind than the one asked for.

What is still out of reach: **arrangement**. There is no per-node `class`, no
`style`, no positioning, and nothing that moves a box somewhere the layout did
not put it. A design that wants the photo on the other side is a different
design.

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
  Playbook whose notes tell the merchant to set one.

## Before opening a PR

```bash
composer verify:templates   # every entry survives registration intact
composer test               # TemplateFacetsTest, TemplateLibraryTest, ProLibraryTest
npm test                    # renderer-manifest-parity, builder-gallery — READ THE EXIT CODE
composer verify:source      # no Pro tree in the free tree
```

`npm test` can print a green summary and **still exit 1**: an unhandled error
in a `requestAnimationFrame` or a timer is reported below it.

And per `CLAUDE.md`: **verify on a real WordPress.** A green suite is not a
booting plugin. Use the Playground one-liner in `README.md`.
