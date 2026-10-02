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

## Internal creation and review studio: 110 campaigns

Run `npm run templates:pilot`, then open `out/pilot.html` through the local site
(or serve `out/` over HTTP). Add `?batch=visual-variety` to show the eight latest compositions, or `?batch=new-directions` for the initial four. `out/proof.html` pairs every
screen at desktop and phone widths for visual review.
`npm run test:template-studio` tests discovery, duplicate detection, brief validation
and all prepared campaigns. The read-only PHP exporter loads repository classes directly, so review also works before Composer is installed in a release stage.

The studio contains **110 campaign setups using 61 designs**, drawn from a complete
inventory of **93 designs**. The first twelve received user approval of the design
direction. The next twelve add four new Free designs and reuse existing designs,
including deliberate reuse between two different enquiry workflows. Ten Playbooks
are new; cart return and standalone SMS already had useful registered starts.
The coverage batch reused existing designs for 24 setups for distinct practical needs.
The decision-support batch adds six anonymous finders, two comparison designs and sixteen
intentional design reuses. Every result variant is included in the layout audit
and paired proofs; the proof screen picker allows focused inspection.
The contextual-help batch adds eight bars, eight slide-ins, six popups and two
inline checklists, including one compact enquiry design and deliberate reuse.
The first four new directions add two popups, an illustrated slide-in and a compact bar.
The visual-variety batch adds eight further compositions: four popups, three slide-ins
and one quiet announcement bar, including two short enquiries and a resource request.
Shared designs now have one card with a use-case choice in both studio and customer creation.
There are now 133 registered Playbooks across Free and Pro modules. All seven Goals,
all five Display Types and three audiences are represented. These are editorial
candidates, not measured conversion winners or automatically approved releases.

The studio provides explicit type labels, audience/type/goal/batch/search filters,
a coverage table, real renderer previews, individual screens and result variants,
mobile widths, RTL, local form demonstrations, nearest-design comparison, layout
checks and exportable review notes. Campaign tier includes the Goal requirement:
a Free design serving cart recovery is correctly labelled Pro. Counts distinguish
campaign setups from unique referenced designs.

Coupon codes cleared by Prefill use `YOUR CODE`; countdowns display a static sample
so their occupied space is reviewed. Both are labelled as preview placeholders and
never become campaign configuration. Submitting a preview creates no Lead and does
not contact a Destination. Measurement images load eagerly so an offscreen lazy
image cannot stall either audit.

The studio uses the shipping `lite-phone-input` adapter, with GB as its labelled
sample site country. Country selection and canonical phone values survive screen
and width changes. Use **Simulate failure on next submission** to exercise retry;
accepted fields are locked when revisited. Unconfigured result links and shop
handoffs show setup notices. Apply the [practical review gate](pilot/PRACTICAL-REVIEW.md)
to every campaign before publication, including every branch and acknowledgement.

The [maintenance workflow](MAINTENANCE.md) explains design dependencies, version
notes, retirement/replacement metadata and the boundary around saved customer
campaigns. The studio exposes affected setups and advisory editorial prompts.

### Visual audit and reference board

`npm run templates:pilot` also builds `out/roadmap.html`. It presents the
29 September review of all 91 source designs: all retain recommendations, with
four related variants grouped into 87 review groups. The eleven remaining UI
recommendations and six consolidation candidates are resolved in the
[full-library cleanup report](../../docs/reviews/template-library-cleanup-2026-09-29.md).
Expand variants or filter by type or decision, compare
actual renders, inspect every authored screen, and switch to prepared campaign
copy. Dependencies include registered setups outside the curated collection.

The Next batch view pairs six original composition sketches and two deliberate
reuses with existing designs. These eight briefs are planned, not shipped or
added to the 110/61 library counts. The Inspiration view links the earlier
Depicter references and states exactly what was reviewed.

`review/visual-audit.json` holds advisory decisions bound to source and renderer
revisions. Changes show “Needs a fresh review”; new designs receive no automatic
decision. These records neither approve campaigns nor retire shipping designs.
See [the review report](../../docs/reviews/template-visual-audit-2026-09-29.md).

### Adding the next reviewed batch

1. Choose an uncovered visitor need from the [library plan](../../docs/plans/template-library-system-2026-09-28.md).
   Record the batch, audience, composition family, meaningful difference and publication
   requirements in `pilot/collection.json`. Campaign IDs must reference registered
   Playbooks. Each expansion brief must name existing comparison designs, state
   new-design or reuse-design, and explain the decision. The build rejects missing
   comparisons, unknown batches and unsupported audiences. The Goal and format come from those Playbooks rather than a second list.
2. Author or reuse a design with `.claude/skills/design-a-template/SKILL.md` and
   the generated vocabulary. Author the complete campaign using
   `.claude/skills/design-a-playbook/SKILL.md`. Supply translated copy, display-rule
   suggestions, honest acknowledgement and setup notes. Changing only colour or
   industry wording does not justify counting another distinct design.
3. Run `composer verify:templates`, `composer verify:source`,
   `npm run test:template-studio` and `npm run templates:pilot`.
   The inventory discovers every Free and Pro module and fails on invalid JSON,
   duplicate design IDs and missing campaign references.
4. Compare the nearest designs in the studio. `out/inventory.json` records style
   and structure fingerprints plus the five nearest structures. IDs and copy are
   ignored consistently; references, field types, requiredness and journey paths
   remain meaningful. Colour variants share a structure fingerprint. Similarity
   uses structural features, not screenshot/AI comparison: a reviewer decides
   whether the difference is useful. It does not automatically reject reuse.
5. Inspect every screen and result on desktop and phone, keyboard behaviour,
   contrast, long copy and RTL. Run the built-in layout checks. Those checks cover
   overflow, control height (including link buttons), input text size, badge row
   alignment and compact-bar headline/button hierarchy; they do not certify
   accessibility or good composition. Rebuild after the final edit and inspect
   the final output again. Record typography, spacing, balance and line-break
   review for all screens, including acknowledgements and result variants.
   Then verify creation in WordPress and the actual configured destination journey.
6. Record the reviewer, decision, notes and three evidence stages, then export the
   review JSON. Import with `npm run templates:review -- /path/to/export.json`;
   commit the shared records and evidence together. Campaign, renderer or evidence
   changes invalidate the shared approval. Run `npm run templates:gate -- BATCH_ID`
   locally. See [the shared-review workflow](review/README.md). Editorial review is
   separate from release approval. Publish through the normal branch/PR process.

Original artwork and provenance live in `pilot/assets/`. These SVG illustrations
are embedded in the bundled JSON, with no remote asset dependency. This does not
add asset support to downloadable catalog packs.

A [real WordPress demo](demo/README.md) exercises publication, saved leads, retry
handling, sample products/coupons, useful resource pages and a local mail outbox.
It uses MySQL, not a mocked capture endpoint. The shipping Goal-first screen now
filters by business as well as format, collection and search. The bounded catalog
accepts 50 packs, retaining the existing 12-design and 256 KiB limits.

The [shared editorial queue](review/README.md) now stores revision-bound decisions
and evidence in Git. The studio shows review-state filters for 110 actual setups.
The completed decision-support briefs are archived under `pilot/batches/`; the
next-batch queue holds six new composition candidates and two deliberate reuses,
following the full-inventory visual audit. `npm run templates:gate` checks the
current evidence locally without CI. Automated generation, hosted multi-user
review, screenshot similarity, conversion measurement, paid asset distribution
and broad 300–500 campaign rollout remain future work. The current 110 are reviewed editorial candidates, not measured winners.

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
| `pilot` | Builds `out/pilot.html`, `pilot.json` and `inventory.json` from registered campaigns and all module designs; needs `renderer` and Composer dependencies |
| `roadmap` | Builds `out/roadmap.html` with revision-aware visual triage, comparisons, reference principles and the next-batch sketches; needs `pilot` and `renderer` |
| `proof` | Builds `out/proof.html`, pairing all screens at desktop/320px widths; needs `pilot` and `renderer` |
| `starting-points` | Builds `out/starting-points.html` from the twelve flagship Playbooks through the shipping PHP Prefill, with setup notes and the same size checks; needs `renderer` and Composer dependencies |

For a complete library review, run `./tools/design-library/build.sh renderer library-review`
and open `out/library-review.html` through the local site's HTTP URL. The page
draws each design at its available container width before scaling its preview.
Choose one design to inspect it at a larger size. **Check all sizes** measures
320, 390, 768 and 1440px in both directions, with sample and longer copy plus
consent. It checks horizontal overflow, 44px controls, 16px input text and solid
text/placeholder contrast and field boundaries, including phone wrappers.
Gradients, composition and vertical scrolling still
need visual review. The measurement details are available as JSON on the page.

`review/visual-audit.json` supplies the current, revision-bound recommendations.
`review/library-decisions.json` is the historical September 11 record, not the
authority for current review labels. Related variants expire when their source
or canonical source changes; grouping does not retire designs or migrate campaigns.
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

## Reviewed featured collections and production picker

The customer picker is now the real plugin UI, described in
[ADR 0112](../../docs/adr/0112-template-discovery-and-reviewed-collections.md).
The internal studio remains repository tooling and contains public authored
setups/collections, not customer accounts or campaign/Lead records.

```bash
npm run templates:collections          # candidates, coverage, studio and audits
npm run templates:collections:publish  # requires current setup + collection reviews
npm run templates:collections:check    # rebuild and check exact shipped revisions
```

Open `out/collection-studio.html` for site date, Goal, business, format, plan,
market and direction scenarios; `out/collection-audit.html` measures all selected
prepared screens. `collections/source.json` pins source hashes; shared reviews
pin current renderer/prepared revisions and evidence. Editing a dependency,
collection or evidence requires review again before publication. Runtime seeds
and translated labels are generated under `resources/collections`, with `/tools`
excluded from every release artifact.

The initial five collections use 16 freshly reviewed setups. The remaining 92
pilot setup approvals are stale after previous renderer changes; the scoped
collection check does not certify the entire library. Existing advisory design
reviews also do not replace campaign approval. See the
[implementation review](../../docs/reviews/template-picker-implementation-2026-09-30.md)
and [API contract](../../docs/template-discovery-api.md) for limits and pending work.


### 1 October follow-through

Specification sheet and Excerpt window are approved campaign starts after native
WordPress, desktop/phone and RTL checks. Five curated collections now reference
18 current approved setups; 92 other pilot reviews remain stale. The local release
contains 16 setups / 13 designs / four Free packs / two complete collections.
Homeware care includes the first real illustrated download; see
[publishing](publishing/README.md) for hash-bound artwork derivatives and the
native update/offline rehearsal. Adding a similarity neighbour no longer expires
an unchanged campaign approval. Content, setup, renderer and evidence changes do.

### 2 October practical-moments batch

Six new compositions add four Free designs and two Pro formats: Callback slip,
Event calendar, Product detail sheet, Service process strip, Launch index and
Appointment agenda. Each has its own prepared setup and practical guidance.
The pilot now contains 116 setups using 67 designs (99 designs across all source
libraries). This batch does not change the hosted-release plan or featured
collections. The two deliberate-reuse briefs remain planned.

```bash
npm run templates:pilot
node tools/design-library/build/batch-audit.mjs practical-moments
```

Open `out/pilot.html?batch=practical-moments` to try the journeys, and
`out/practical-moments-audit.html` for every screen, four widths, RTL, longer
copy and **Hide optional images**. The batch audit reuses the shared review
surface and accepts any existing batch ID. See the
[review evidence](../../docs/reviews/practical-moments-2026-10-02.md).
