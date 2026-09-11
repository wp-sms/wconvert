# The design library, regenerated from `resources/templates`

The working set for growing the design library: the portable vocabulary spec,
a card per design per step, contact sheets at three viewports in both
directions, and the Design Bench.

```bash
npm install --no-save playwright       # not a repo dependency; see below
./tools/design-library/build.sh        # everything, ~30 seconds
./tools/design-library/build.sh vocabulary bench   # or just some steps
```

Output goes to `tools/design-library/out/`, which is gitignored. Nothing here
ships: `/tools` is in `.distignore`.

## A sibling of `tools/design-system`, not a step inside it

Same machinery, different subject. That one mirrors the **wp-admin screens**;
this one mirrors the **visitor-facing designs**.

**Our capture is far simpler, and it is worth knowing why.** The renderer is
four files that import nothing but their own types, and
`render(tree, tokens, step)` asks nothing of the document it is attached to,
nothing of the site and nothing of the Optin. So a card is a blank page, a
bundle and a tree — **no WordPress at all**. There is no Playground boot, no
seed, no `rest_pre_dispatch` harness, and none of the wp-admin traps that
README records.

What is shared is the contact-sheet tiler, which is **imported** from
`tools/design-system/build/contact-sheet.mjs` rather than copied. It already
solves two traps that cost a day between them, and a second copy here would be
a second copy of both.

## The steps

| Step | What it does |
|---|---|
| `vocabulary` | Generates `out/VOCABULARY.md` from `resources/templates/manifest.json` |
| `prose` | Copies `BRIEF.md` and `GUIDELINES.md`, the two authored files |
| `renderer` | Bundles the shipping renderer and themes to `out/renderer.iife.js` |
| `designs` | Writes one card per design per step per direction. No browser |
| `sheet` | Tiles them into six `contact-sheet-{320,768,1440}-{ltr,rtl}.png` |
| `bench` | Inlines all of the above into `out/bench.html` |
| `gallery` | Inlines every entry into `out/gallery.html` — the whole library, one page |
| `review` | Builds `out/flagships.html` for Fieldwork, Sunday marginalia and Callback notes; needs `renderer` |
| `library-review` | Builds `out/library-review.html` for every Free and Pro design, both screens, four widths and automated browser measurements; needs `renderer` |
| `starting-points` | Builds `out/starting-points.html` from the twelve flagship Playbooks through the shipping PHP Prefill, with setup notes and the same size checks; needs `renderer` and Composer dependencies |

For a complete library review, run `./tools/design-library/build.sh renderer library-review`
and open `out/library-review.html` through the local site's HTTP URL. The page
draws each design at its available container width before scaling its preview.
Choose one design to inspect it at a larger size. **Check all sizes** measures
320, 390, 768 and 1440px in both directions, with sample and longer copy plus
consent. It checks horizontal overflow, 44px controls, 16px input text and solid
text/placeholder contrast. Gradients, composition and vertical scrolling still
need visual review. The measurement details are available as JSON on the page.

`review/library-decisions.json` records each improvement, retirement and addition.
Set `WCONVERT_REVIEW_BASELINE` to a JSON array of earlier entries while building
to enable the Before view. Without that optional file, the current library and
all checks still work. See `docs/reviews/template-library-curation-2026-09-11.md`
for the completed review and its limits. All preview submissions stay local.

For the current three-template review, run `./tools/design-library/build.sh renderer designs review`
from the plugin root. Open the generated `out/flagships.html` through the local
site's HTTP URL. It compares exact design widths, themes, longer text, consent,
RTL and form/success states with the real renderer. Forms on that page are local
demonstrations and do not write leads or contact a destination.

## `VOCABULARY.md` is the point of this directory

It is **generated**, and that is strictly better than an authored spec with a
parity test over it: a generated file cannot drift, so there is no test to
write and none to forget. It is the same move `build/tokens.mjs` makes on
`index.css` one tool over, for the reason `design-system/build.sh` states —
*a hand-maintained mirror is one that is wrong from the first commit nobody
remembered to copy across.*

**Paste the whole file into a system that has never seen this repo** and it can
emit valid template JSON. That context-stripping is the point rather than a
convenience: "Constraint Decay" (arXiv 2605.06445) measures capable models
losing ~30 points of assertion pass rate as explicit structural requirements
accumulate on real repositories, and a session carrying 61 ADRs, a 1,100-line
glossary and a closed vocabulary **is** that load. The creative act and the
constrained act are separated on purpose.

What comes back is checked by `php bin/verify-templates.php`, which diffs the
raw file against the validator's output node for node.

## Three views, and each answers a different question

| | Answers | Shape |
|---|---|---|
| **Contact sheets** | *are these forty designs, or one design forty times?* | six PNGs on the disk of whoever ran the build |
| **Gallery** | *where can I see the templates?* | a link you can send someone |
| **Bench** | *what would this look like if I changed that?* | one design, every token live, and a way back out to JSON |

The gallery is the one to reach for first:
<https://claude.ai/code/artifact/dbb3b0e2-5fd0-403c-9769-b244fb6144be>

Every card is the real entry JSON through the real renderer, in a shadow root,
in its real container geometry — filterable by Display Type, tier and step.
Designs are drawn at the width they declare and then **scaled** into the card,
because re-flowing one into 320px would re-run its own wrapping and show a
design nobody is ever served.

## The round trip

```bash
./tools/design-library/build.sh vocabulary     # writes out/VOCABULARY.md
#   paste that file + a brief into any system, anywhere
pbpaste | node tools/design-library/build/import.mjs
composer verify:templates
./tools/design-library/build.sh designs sheet gallery
```

`import.mjs` files each entry by its **tier** — free designs to
`resources/templates/library`, paid ones to the Pro module that owns their
Display Type — and refuses three mistakes before writing rather than after: an
entry with no `tree` (which lands as a silent Pro upsell card for the design in
the file), a bar or slide-in at the free tier (free has no container to mount
one in), and an id the library already holds.

It does **not** verify. `bin/verify-templates.php` is the authority on whether a
design survives registration and it names six failures precisely; a second,
worse summary in front of it would help nobody.

## The Bench is the return path

`tools/design-system` is one-way: repo → canvas. A design has to come **back**,
as JSON, and that is what `out/bench.html` is for — paste a tree in, drive every
token live, judge it in its real container at 320/768/1440 in both directions and
against the shipping themes, copy it out.

It is a published Artifact:
<https://claude.ai/code/artifact/ce24835b-c23e-4313-a79f-80adcf594287>. The
renderer is **inlined** because an Artifact cannot load an external script
outside its CDN allowlist — a `<script src>` would fail silently and the page
would render nothing with no error.

`out/bench.html` is gitignored like everything else here, so republishing after
a vocabulary change is `./build.sh renderer bench` and then publishing that file
to the same URL.

`out/library.json` sits beside it with every shipped entry, so a session can
paste any existing design in rather than only the seed.

## Reading the output

`contact-sheet-320-ltr.png` first. **320 is where a design is tallest**,
because everything wraps there — a `split` stacks, a `row` breaks, a `grid`
drops to one column — so a design is at its longest exactly where the screen is
shortest.

The question the sheets answer, and nothing else does: **are these forty
designs, or one design forty times?** That is the failure ADR 0010 named when
it widened the vocabulary the first time, and it is invisible in any view that
shows one design at a time.

## Things that bit, so they do not bite again

- **The container must WRAP the shadow host and can never BE it.** `SHADOW_CSS`
  opens with `:host{all:initial!important;display:block!important}`, and while
  a `:host` rule normally loses to the outer document, an **`!important`
  declaration inside `:host` beats a normal declaration outside it**. So
  `position: absolute` set on the host from outside is silently reverted to
  `static`: the floating bar rendered full width at the **top** of the frame,
  which reads as a design that does not know where it goes rather than as CSS
  that never applied. `.wc-box` is the wrapper. The shipping code has the same
  shape for the same reason — free's `<dialog>` and Pro's popover both
  *contain* the host.
- **One step per card, not both.** The first version stacked a design's two
  steps in one cell, and any popup taller than half of it was clipped top and
  bottom — which read as two designs colliding. A step is a screen and a cell
  holds one screen.
- **A backtick in a JS comment ends a template literal.** Two generators here
  build HTML with backticks, and both broke on a docblock that quoted `:host`
  in backticks the way the rest of this repo does. Inside a template literal,
  write those comments in plain words.
- **`build/containers.mjs` is the one mirror in this tool**, because the
  shipping containers are built imperatively — property by property, inline,
  with `!important` — and there is no stylesheet to lift. It asserts itself
  against their source and **throws** when they move. A design captured in a
  container it is not actually served in is a design judged against a lie.
- **`locked.json` stubs are skipped by the capture.** They are metadata for
  designs a free tree does not hold, so there is nothing to draw; a stub
  reaching the sheet would render an empty card, which reads as a broken design
  rather than an absent one.

## Why Playwright is not in `devDependencies`

CI never runs this, and adding it would make every `npm ci` download a browser
driver for a script no workflow calls. `npm install --no-save playwright` when
you need it. Only the `sheet` step uses it — everything else is plain Node.

The flagship review also offers **Swap panes**, **Picture focus**, and **Try resource
link**. On the success screen, Fieldwork’s copy button is live. The resource example
opens a local placeholder. The HTTP WordPress preview may lack clipboard access;
it then shows the configured manual-copy message. Set your own resource URL in the
editor’s Resource link block. No extra conversion is recorded by either action.
