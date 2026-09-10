# The library is indexed, its facets are derived, and choosing a design is its own surface

The library shipped **three** designs — all `display_type: popup`, all free,
carrying no metadata beyond `id`, `name` and `display_type`. The map's target
for [#15](https://github.com/navidkashani/wconvert/issues/15) was **24**, across
four Display Types, with a free/Pro split.

Three cards make every expensive decision look free. Forty make each of them the
screen's whole cost:

- `GET /wconvert/v1/templates` returned **every tree on every request**, and the
  builder fetches it on open.
- `Preview` mounted a closed shadow root on effect with no gate, so a grid of
  forty was forty renders nobody had scrolled to.
- `builder/Gallery.tsx` filtered on one axis — `display_type` equality — with no
  search and no way to narrow.
- The Design tab held the gallery *and* the fifteen token controls, which is two
  concerns in one region ([ADR 0039](0039-a-screen-is-regions-and-scope-decides-placement.md)).

## Every facet is derived from the tree. Only `tier` is authored

**This is the decision the rest follows from**, and it is forced by what a
[[Template]] is.

OptinMonster filters by Goal, Industry and Season. Those work because their
templates contain words and a photograph of a bakery. A WConvert Template is the
design of an Optin **with no words in it** — copy lives on the [[Playbook]]
(CONTEXT.md, Template) — and that boundary is exactly what collapsed the
Display Type × Goal matrix to *"N designs per Display Type"*. Authoring an
industry or season taxonomy over these files would tag them for something they
do not contain, and the first entry to drift would be the first entry anybody
edited.

So a facet is a question the tree can answer:

| Facet | Derived from | Values |
|---|---|---|
| `display_type` | the entry | `popup` `floating_bar` `slide_in` `inline` |
| `act` | `ConvertingAct::offeredIn()` | `submit` `click` |
| `captures` | `field` node kinds | `email` `name` `phone` |
| `shape` | step 0's root layout | the manifest's layout vocabulary |
| `has_image` | an image node or an image URL in a painted background | bool |
| `asks_consent` | a `consent` node | bool |

**Six are derived; the merchant can narrow by behavior and capabilities.**
As amended by
[ADR 0069](0069-the-library-helps-merchants-compare-before-applying.md), the
picker offers an optional **Fill in a form / Follow a link** choice alongside
`captures`, `has_image` and secondary `shape` filters. `asks_consent` is a fact
in the detail preview, not a filter. `display_type` remains the Optin's fixed
scope and is identified in the library; browsing does not change that format.
Image backgrounds count where the renderer paints them; decorative gradients
do not become pictures merely because they use `bg-image`.

[ADR 0059](0059-the-converting-act-belongs-to-the-design.md) still owns the
compatibility boundary: no [[Goal]] refuses a design for its act. Changing that
act warns that the Optin's reporting, including its history, is reinterpreted;
an A/B arm must still agree with its siblings. `captures` carries the refusal
for a Goal read from deliveries or an Optin holding a [[Destination]]. Explicit
merchant filters do not replace these checks or select themselves from a Goal.

**There is no Goal facet, and there will not be.** `Gallery.tsx` was right the
first time: asserting a Goal pairing that does not exist is what this boundary
prevents.

> *Load-bearing rather than incidental as of
> [ADR 0059](0059-the-converting-act-belongs-to-the-design.md), which had to
> answer the obvious follow-up: since a Goal read from deliveries needs a
> capture, why not pre-press the* Email *chip for it? Because that is a Goal
> facet wearing a captures chip's clothes, which is exactly this paragraph —
> and on today's library the SMS Goal would open showing **one** design. It is
> a note in the builder's Summary instead, on the one case that is genuinely a
> mistake. Which detail to ask for stays silent altogether: email against phone
> is the merchant's judgement.*

**The facet vocabulary lives in `resources/templates/manifest.json`**, as a
sibling `facets` section — exactly as
[#75](https://github.com/navidkashani/wconvert/issues/75) added `choices`, and
under the rule ADR 0010 already states: *a control that ENUMERATES reads its
enumeration from the manifest.* Its words ride `TemplateLabels::all()` on
`GET /templates`, because `make-pot` cannot see a string inside JSON
([ADR 0013](0013-playbook-copy-carries-no-markup.md)), and
`TemplateLabelParityTest` fails in both directions.

**Computed server-side**, in `TemplateFacets`, once at registration. The client
has `convertingActOf` and could derive all of it — but the index route
deliberately withholds trees, so it would have nothing to read.

## The index and the trees are two routes

- `GET /wconvert/v1/templates` → `{ templates: [index], labels, facets }`. An
  index entry is `{ id, name, display_type, tier, availability, facets,
  preview_url? }`. **No `tree`, no `tokens`.**
- `GET /wconvert/v1/templates/trees?ids=…` → `{ templates: [{ id, tree, tokens }] }`
  for the cards on screen. Batched, capped at 24, `Routes::canManage` as before.

**Three places move together or a new field vanishes in silence**:
`TemplateLibrary::read()`'s whitelist, `templates/api.ts`'s
`TemplateIndexEntry`, and `builder/entry.ts`'s `exportEntry()`.

## Entries may come from more than one place

`fromDirectory()` globbed one directory with no filter and no seam.
`TemplateSource` is that seam, and three things compose over it:

1. **Bundled free entries** — `resources/templates/library/`, now twelve across
   `popup` and `inline`, which are free's only renderer paths
   (`mount.ts`, [ADR 0015](0015-enforcement-is-by-non-registration.md)). Always
   present, so a fresh or offline install is never empty.
2. **Bundled locked metadata** — `resources/templates/locked.json`: `id`,
   `name`, `display_type`, `facets`, `preview_url`, and **no tree**. Bundled,
   never fetched: *a free wp.org plugin phoning home for advertising copy is a
   different conversation with the review team* (ADR 0015, and
   `goals/availability.ts` already says it about upsell copy).
3. **Fetched free entries** — `wp_remote_get` against a WConvert-hosted index,
   transient-cached, degrading to (1) on any failure. **Not built here.** It
   adds a hosted endpoint, a cache and a `readme.txt` external-service
   disclosure, and the picker is fully useful without it — same seam, separate
   ticket.

A candidate with **no `tree` is the whole discriminator**: it is a design this
install did not get. Everything else — bundled, fetched, Pro's own — goes
through `TemplateVocabulary::normalize()` and `refuse()` identically, which is
what will make the fetched source deliver **content and never capability**
structurally rather than by intention.

## A premium design is a card, never a disabled control

[#7](https://github.com/navidkashani/wconvert/issues/7) states it: *"if the free
ZIP ships exit-intent code and refuses to run it, that is trialware"*. So free
ships the card and never the design. `LockedCard` renders the name, its facet
chips and **"See this design"** linking to a live preview on wconvert.com —
no preview, no thumbnail, **no image at all**, which is why ADR 0010's *no
static thumbnails anywhere* survives this intact. There is no `disabled` "Use
this design", which is what wp.org Guideline 9 fires on; an admin-side link to
your own site is what Guideline 10 explicitly welcomes.

`renderingFor(availability, surface)` is reused rather than a second rule being
invented. Templates reach `ready` or `locked` only — no site capability makes a
*design* absent, so `unavailable` does not arise
([ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md)).

**A Pro install sees no locked cards, and not because of a tier test on a
surface.** Pro registers the real designs through the same `TemplateSource`
seam, so the stub's id collides and it is never returned. A paying customer is
never shown an advertisement for what they bought, and that falls out of the id
rather than out of something somebody has to remember.

`bin/verify-artifact-contract.sh` gained check **(e)**: no `tier: pro` entry in
the free ZIP, and no `tree` anywhere in `locked.json`.

## Choosing a design is its own surface

**A region holds exactly one concern** (ADR 0039). The Design tab held two —
*choose a design* and *adjust the look*. At three cards that was invisible; at
forty the gallery swamps the tokens the tab is named for. So the tab keeps the
look, names the design in use, and the gallery moved behind **"Browse designs"**.

That surface is the vendored `Dialog`. ADR 0042 rule 7 sets the test — *a modal
is for something that owns the screen until it is answered* — and picking a
design is exactly that. (Rule 7's complaint is about `DropdownMenu` defaulting
to `modal`, not about dialogs.) It also buys the grid the full 1440px the
builder caps at rather than one pane beside a pinned preview:
[ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md)'s answer to a
wider screen is another pane or more air, never a longer line.

**The creation flow's step 2 needs no dialog** — that screen has full width and
no pinned preview, so the grid renders inline, and unlike the builder it has to
work to 360px.

## Consequences

- **Filtering does not disappear in a smaller library** (amended by ADR 0069).
  Search and relevant capability controls remain available for every nonempty
  Display Type. Search uses names and localized derived features. Choices absent
  from that format are omitted; impossible combinations remain visible with
  counts, while selected choices remain removable even at zero results.
- **Field selections mean “Must include.”** Email + Phone requires both fields.
  Layout selections are alternatives; different groups combine with AND. Counts
  preserve search and the other constraints; a field count also retains the
  other required fields, while a layout count measures that alternative. The
  optional act choice has All, and unselected capability groups impose no
  constraint. Active filters and Clear filters make the current scope explicit.
- **Forty live previews, with no virtualization library.** `TemplateCard` mounts
  its `Preview` only while near the viewport and takes it down again;
  `content-visibility: auto` plus `contain-intrinsic-size` stops an off-screen
  card that still exists from being laid out; trees are fetched for what is
  visible. Remounting is affordable because `mount()` reads nothing ambient — no
  network, no layout measurement — so a card that comes back draws the same
  pixels. The alternative was a dependency inside a bundle whose halves are
  reported at every build (ADR 0038).
- **A preview needs a definite containing width outside its shadow host.**
  The renderer uses inline-size containment for mobile layout, so intrinsic
  flex sizing cannot use its contents to size the host. In gallery and creation
  cards this collapsed some previews to a strip. `Preview` now gives its mount
  wrapper the design's width (or the renderer's default), capped at the available
  width. The wrapper sits outside the host's `all: initial !important` reset;
  the visitor renderer and its protection from page styles are unchanged.
  Real WordPress checks cover gallery cards at 1024px, creation previews, and
  the editor's 600px desktop and 352px mobile canvases.
- **Picking a design after editing the structure is destructive, and the
  affordance says so.** `snapshotInto()` carries copy by [[Slot Role]] and
  `MerchantsOwn` carries image `src`/`alt` and button `href` — but **blocks the
  merchant added, moved or deleted are lost.** ADR 0039 says destructive actions
  confirm; the structure editor's amendment says undo buys the exception, and
  picking a design is already one undo entry. As amended by ADR 0069, a card
  opens a detail preview before applying. Its sample-content label and warning
  beside **Use this design** explain replacement, carried text that may move or
  leave empty slots, and Undo. There is no second confirmation dialog. The
  sample-import choice remains deferred; the snapshot contract is unchanged.
- **An optional remote catalogue fetch that fails degrades in silence.** The region is `ready` with
  what it has — bundled designs are always there — and the failure is logged,
  not announced. An error banner on every visit of a picker that is working is
  the sentence ADR 0042 rule 2 forbids. This does not describe the installed
  library's tree requests: a failed or omitted requested preview gets a local
  error and Retry. The client splits requests into at most 24 ids and never
  retries endlessly as a card re-enters the viewport (ADR 0069).
- **A Pro licence that expired keeps every feature** (ADR 0015: *a licence buys
  updates and support, never the features*). What stops is the fetch of *new*
  premium designs; the cache keeps serving and no locked cards appear.
- **The library never reaches a visitor's page, and now it is asserted.**
  `template_id` is provenance and the registry is not consulted at render time
  (ADR 0010), which is why three designs became twelve — with nine more
  advertised — without a byte reaching the front end. *Eight advertised as of
  [ADR 0053](0053-the-spin-to-win-card-is-withdrawn.md), which withdrew
  `popup-spin-to-win`: the other eight are all real designs in Pro's ZIP now, so
  the stub set and the Pro library are the same eight ids and a Pro install's
  `locked()` is empty.*
  `PayloadBudgetTest::testNothingAboutTheLIBRARYReachesTheBrowser()` names the
  index fields individually, because the way this breaks is a convenience —
  a design's name on a beacon, its `tier` in a report — and each is one line.
- **The picker is inside the builder chunk** and its fallback is not
  ([ADR 0041](0041-the-admin-ships-as-a-module-so-it-can-split.md)): a fallback
  cannot live inside the chunk it is waiting for, so `GallerySkeleton` pairs with
  the grid the way `ChoiceSkeleton` pairs with `ChoiceGrid` and the chunk-level
  fallback stays in `shell/`.
- **`TemplateCard` is shared by the picker and the creation flow's step 2**, and
  the facet toolbar is not. A Playbook card renders that Playbook's template
  *with its copy in it* — a different object — composed by `Prefill` on the
  server so step 2 draws exactly what step 3 draws and exactly what creating it
  stores ([#79](https://github.com/navidkashani/wconvert/issues/79),
  [#68](https://github.com/navidkashani/wconvert/issues/68)).
- **The admin resolves the site's privacy-policy link at the render**
  ([#77](https://github.com/navidkashani/wconvert/issues/77)). `PolicyLink::into()`
  had no admin call site, so every capture design's fine print read *"See
  our."* — one stale card is a bug and forty is the gallery's first impression.
  It could not be fixed on the server: the builder PATCHes the config it was
  handed straight back, so an href resolved on the way out is an href **stored**,
  frozen at publish, which is what
  [ADR 0032](0032-consent-capture-is-first-class-in-the-template.md) exists to
  prevent. So `builder/policy.ts` mirrors `PolicyLink::resolve()` and runs
  immediately before `mount()`, and `Preview` is the admin's one call site for
  the renderer so there is one place that has to remember.
- **What the picker needs to say** is amended by ADR 0069: the current format,
  matching designs out of that format's total, active constraints, and how to
  inspect before applying. The detail view identifies sample content and the
  replacement consequence beside the action. A `Free` badge remains unnecessary;
  premium availability belongs on the card it changes.
- **A rule anchored on `#wconvert-admin` stops at the portal boundary.** A Radix
  dialog renders into `document.body`, so the picker found that the control
  height, the segmented group's *selected* treatment and the hand cursor were all
  unreachable from a dialog — the confirm dialog has had no hand cursor since
  ADR 0039 added it. The three rules a portalled surface needs take a root list
  now, and it is `:is()` and not `:where()`: every one of them is an `!important`
  utility override whose standing depends on beating a single class inside the
  same layer (ADR 0042 rule 6).
