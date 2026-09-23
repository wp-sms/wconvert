# Templates are configuration, not documents

**Current budget amendment — [ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md):** The page payload cap is 2,560 B gzip (per-design 1,280 B). Free loaders remain 14,012 B; paid loaders cap at 19,456 B. Earlier measurements below are historical. All remain hard checks.

A template is a JSON node tree plus a token set, validated against a shared
vocabulary manifest. It contains no HTML and no CSS. One renderer, shipped in the
loader, owns the entire component vocabulary and every line of the stylesheet.

The obvious alternative — each template its own HTML and CSS in the ZIP, which is
what the #10 prototype's `template.js` was — was rejected on four counts, only the
first of which is aesthetic.

## The no-canvas decision was conditional and this is the condition

The map rules out a drag-and-drop builder for v1 and records that "the data model
must not preclude a canvas later." Under configuration, a canvas is an editor over
a tree that already exists. Under documents, a canvas means parsing HTML that was
shipped as strings — which is the migration the condition forbids.

*Collected by the structure editor. The condition held for the whole of v1 — the
settings panel never reshaped a tree, so nothing had to be migrated — and the
editor that arrived is exactly the one this paragraph describes: an editor over a
tree that already exists, moving, adding and removing nodes the vocabulary
already declares. It parses nothing, it migrates nothing, and it cannot express a
node the manifest does not have. The consequence below that reads "never
arrangement" is amended where it stands.*

## Documents were arithmetically dead at about six templates

#10 measured one template's CSS at ~870 bytes gzipped. #9 set two budgets: a ≤8KB
gzipped loader asset, measured at 3.89KB with the full rule vocabulary and all four
display types already in it, and a ≤2KB gzipped per-page payload, measured at
351–621 bytes.

Five document-model templates is ~4.3KB of CSS — the entire remaining loader
headroom, for five designs. Delivered per-page instead, one template consumes 44% of
the payload budget on its own. Configuration pays for the vocabulary's stylesheet
once, budgeted at ≤2KB gzipped in the loader, and a template's token values then ride
the payload as custom properties at roughly 80 bytes gzipped each.

## The wp.org boundary becomes structural instead of enforced

#7 found that Guideline 8 names CSS alongside JavaScript — "a Playbook payload
carrying `<style>` or a remote stylesheet is caught by the same sentence that catches
remote `<script>`." A document-model template distributed through a remote library
therefore needs a CSS sanitiser, which is the same `!important` arms race #10
rejected scoped CSS for.

*Corrected, in place, because this paragraph over-reads the guideline it cites.
Guideline 8 is about **executable code and assets loaded from outside the
plugin** — its force here is against a REMOTE stylesheet and a remotely supplied
payload, not against CSS as such. A plugin shipping its own stylesheet in its
own ZIP breaks nothing, and every WordPress plugin does it; this one does too,
in `css.ts`. So the sentence proves less than it sounds like it proves: what it
actually rules out is a template library **distributed from our servers** whose
entries carry style, which is the arrangement #10 was describing. The
conclusion below is unaffected and reached by the other three counts as well —
a configuration template has no CSS to sanitise because of its shape, not
because a guideline forbids one. Recorded here rather than only in the ticket,
per the amend-in-place rule.*

A configuration template has no CSS to sanitise. Validation against the manifest
drops unknown node types and unknown tokens; there is no HTML, so `wp_kses` does not
apply to templates at all. "Content, never capability" stops being a rule enforced at
a boundary and becomes a shape that cannot express capability.

## #10's authoring rules become invariants nobody can break

#10 handed down three constraints on templates: logical properties only, nothing
load-bearing on the root element, and `@font-face` hoisted to the document. Under
documents those are lint rules every template must keep passing, forever, including
third-party ones. Under configuration they are properties of the one renderer.

## Consequences

- **The vocabulary is the ceiling on design variety**, and the product bet is that
  the gallery *is* the design surface. *Built in
  [#29](https://github.com/navidkashani/wconvert/issues/29): the gallery is a set
  of designs per [[Display Type]] with no [[Goal]] filter, because Templates are
  goal-agnostic and the copy is held elsewhere. Picking one SAVES at once, since
  it takes a fresh snapshot and carries the merchant's words across by
  [[Slot Role]] — `TemplateLibrary::snapshotInto()` now rebinds rather than
  stripping, which is what finally makes CONTEXT.md's "the words survive
  switching Template" true of the one screen where a merchant switches one.*
  *Amended by [ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md):
  applying changes the working draft, not storage or the published snapshot.
  **Keep my content** is the default; **Use this design's sample content** is
  an explicit alternative. Both prepare a normalized candidate before Apply,
  which uses exactly that candidate. One draft Undo restores the previous
  content and template id. Library samples can therefore become visitor copy
  through that deliberate choice or the merchant's own edits.*
  *Amended by [ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md):
  **the gallery is still the design surface, and it is no longer part of the
  Design tab.** At three entries a gallery and fifteen token controls in one
  region was invisible; at forty the gallery swamps the tokens, which is two
  concerns in one region ([ADR 0039](0039-a-screen-is-regions-and-scope-decides-placement.md)).
  Choosing a design is a dialog behind "Browse designs" — it owns the screen
  until it is answered — and the tab keeps the look. The bet is unchanged and
  the surface moved.*
  *Fixed in [#23](https://github.com/navidkashani/wconvert/issues/23) as six leaf
  nodes — `heading`, `text`, `image`, `field`, `button`, `consent` — and four
  layouts: `stack` (a column), `row` (a wrapping line), `split` (two independent
  panes, which is what makes an image-led design possible) and `grid` (equal
  collapsing tracks). `resources/templates/manifest.json` is the file, and
  `tests/js/renderer-manifest-parity.test.ts` asserts the renderer implements
  exactly it.* *Widened by [#75](https://github.com/navidkashani/wconvert/issues/75)
  with a sibling **`choices`** section, which says what the Design panel OFFERS
  for a token and never what a token may HOLD. The rule it makes explicit: **a
  control that ENUMERATES reads its enumeration from the manifest; a control
  that INFERS reads the value.** Two token shapes say nothing about themselves —
  `align` is a three-value enum that looks like the word `start`, and `font` is
  a curated choice that looks like any other string — so both were text boxes a
  merchant had to type `center` into. A control table in the admin bundle was
  the alternative and is the "second spelling" this codebase refuses everywhere
  else; a sibling section costs one mapper, because every other reader of
  `tokens` takes `array_keys`/`Object.keys` of it. **Token values stay
  unvalidated** — `TemplateVocabulary` does not read `choices` and will not —
  which is what keeps `clamp(20rem, 50vw, 30rem)` expressible, and every choice
  control keeps a typed box beside it. A token this bundle has never heard of
  still lands in the panel's trailing group wearing a text box, which is the
  promise below kept literally.* *Narrowed to **three layouts** by #75:
  `grid` is gone. It declared `repeat(columns, 1fr)` — equal tracks, always N
  across — which at a popup's `min(28rem, 100%)` hands a phone two 140px columns
  of prose, while `split` solves the same problem and WRAPS. Nothing shipped
  used it, and its one option was reachable from nowhere in the admin, so no
  merchant could ever have made it three columns: a layout that cannot be
  configured and is demonstrated by no design is a fourth word in a menu rather
  than a capability. `split.ratio` is now a real control, which is the same
  finding acted on rather than deleted. **A snapshot holding a `grid` still
  renders** — the renderer skips a node type it does not know, which is the
  clause that makes narrowing the vocabulary safe at all.*

  ***Widened again, and `grid` came back with the param that killed it left
  out.*** *The audit that preceded #95's designs found the vocabulary
  structurally sound and* not wide enough*: twelve shipped designs are the same
  eight-slot skeleton in different colours, and the next thirty would be too. So
  the manifest gained five leaves — `eyebrow`, `badge`, `divider`, `rating` and
  a closed six-glyph `icon` — five style tokens (`heading-weight`, `tracking`,
  `leading`, `shadow`, `motion`), and `grid` again as
  `repeat(auto-fit, minmax(8rem, 1fr))`.*

  ***That last one is a different layout wearing the old name.** The deletion
  above is still right about what it deleted: `repeat(columns, 1fr)` is always N
  across, and a `columns` param no control reached is not a capability.
  `auto-fit` has no column count to store and no param to misconfigure — the
  browser counts them from the space it has — so it wraps by construction and is
  the only route to a three-up, since `split` is hard-coded to exactly two
  panes. A snapshot carrying the old `columns: 3` still renders: the key is
  dropped on the way in and ignored if it arrives anyway.*

  ***Widened a third time, and this time with a stated admission test.***
  *[ADR 0061](0061-the-vocabulary-widens-by-what-the-library-cannot-draw.md)
  took the library from 20 designs to ~42 and had to answer whether the
  vocabulary widens with it. It does, by one rule: **a member earns its place by
  naming something the library provably cannot draw** — not something it draws
  verbosely. Three passed: a `code` leaf for the static shared discount code
  (which is [ADR 0025](0025-cart-recovery-captures-nothing.md)'s own conclusion
  about coupons, not a reopening of
  [ADR 0053](0053-the-spin-to-win-card-is-withdrawn.md)), `image.shape` for a
  circle, and `badge.place` for the corner flash. A `list` node, a `progress`
  indicator and a third step were each considered and refused by that same test.*

  **Planned amendment by [ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md):**
  offer-first, multi-screen enquiries and optional other-channel signup provide
  the use cases for additional screens. The shared linear-flow contract replaces
  the two-screen limit; it does not introduce a conditional route graph.

  ***The same ADR declined per-node styling, which is this ADR's real
  ceiling.*** *~~Every design's look is 22 **global** custom properties, so
  nothing can tint one panel or give the form a different ground from the
  headline.~~ That is a genuine limit and removing it would amend the bargain
  this ADR is named for — so it stays, with 0061 recording what evidence would
  reopen it.*

  ***Amended by [ADR 0062](0062-a-token-bag-is-scoped-to-the-box-that-carries-it.md):
  the tokens are no longer global, and the bargain is not amended.*** *Any
  LAYOUT node may carry a `tokens` bag re-declaring the same closed 22 for
  itself and everything inside it, so a panel can be tinted and the form can
  have a different ground from the headline. What made that affordable is that
  it changes **where a value applies** and nothing else: the names stay closed,
  custom properties already inherit so there is no cascade to implement, and the
  bag goes through the same `TemplateVocabulary::tokens()` the design's own
  tokens do — which is what keeps "there is no CSS to sanitise" literally true.*

  ***The one thing that clause got wrong is worth naming, because it is this
  ADR's own safety claim.*** *`node()` copied every declared param verbatim,
  which is correct for a scalar and is a property-name injection for a map: an
  arbitrary key would have reached `style.setProperty('--wc-' + name, value)` in
  the one place this ADR says none exists. A bag is the first non-scalar param,
  so it has a clause of its own beside `link` and `href`, and anything nested
  added later needs the same.*

  ***Still out of reach, deliberately: arrangement.*** *There is no per-node
  `class`, no `style`, no positioning. A merchant may change anything about a
  box and not where the boxes are — which is exactly where a canvas would begin,
  and the line 0061's Depicter teardown said not to cross.*

  ***And a fifth layout came with it, because a bag with nothing drawing it is
  invisible.*** *`stack`, `row`, `split` and `grid` arrange and paint nothing —
  the design's ground is `.wc-root`'s and there is exactly one of it — so a
  `stack` with `{"bg":"#fff4df"}` tinted only what inside it happened to read
  `--wc-bg`. **`panel`** is a `stack` that DRAWS the tokens in scope: ground,
  picture, wash, padding, corner, edge. It is the whole of what makes a cream
  box beside a dark one expressible, and it takes two params of its own,
  `edges` and `min`.*

  ***A photo pane is a `panel` and there is no `media` node.*** *A second
  child-key shape would have cost `TemplateTree::CHILD_KEYS`, `panel.ts`,
  `TemplateVocabulary::childKeysOf` and `vocabulary.mjs` an edit each, plus a
  branch in a hardcoded test, to buy content spread top-and-bottom rather than
  stacked. `bg-image` + `overlay` + `min` on a `panel` in a `split` pane draws
  the same thing, and a `spread` param buys the rest the day a design needs it.*

  ***Two tokens landed beside it, and each closes a hole the panel opened.***
  *`input-bg` — a field took the design's own `bg`, which was right while there
  was one surface and is wrong the moment a panel paints a second: a light form
  on a navy panel had a navy input with light text in it. `heading-font` — eight
  of the sixteen reference designs set a display face, and a design had exactly
  one face for everything. **Both chain to the token they replaced**
  (`var(--wc-input-bg,var(--wc-bg,#fff))`), so every design shipped before them
  renders identically — and that chain is the one thing the manifest cannot
  spell, since a default is one string and no string means "whatever `bg` is".
  `resources/admin/src/builder/panel.ts`'s `resolvedToken` is where it is
  spelled a second time, deliberately and in one place, because the AA contrast
  check reads it.*

  *An `icon` is the one member that draws a SHAPE rather than a box of text, and
  its set is closed for this ADR's own reason — an `src` would be the remote
  asset [ADR 0013](0013-playbook-copy-carries-no-markup.md) keeps out, and an
  inline SVG would be markup in a vocabulary whose whole claim is that it cannot
  express any. The renderer owns the six paths, so there is nothing to sanitise
  and nothing to fetch.* *Refined by
  [ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md):
  the typed box that keeps a value unvalidated is a **Custom** option rather
  than a field on screen at all times. The property is untouched — a merchant
  may still write anything a token can hold — but a box reading `center` under
  three chips reading Left · Centre · Right explained nothing and invited
  nothing.* *Extended by
  [ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md) with a
  sibling **`facets`** section under the same rule — a control that ENUMERATES
  reads its enumeration from the manifest — saying which facets the design
  picker filters by and what each one offers. Its VALUES are not authored:
  every facet is derived from the tree by `TemplateFacets`, precisely because a
  Template carries no words and so cannot honestly be tagged by industry or
  season.* *Extended once more, one level down: a **`choices` section on each
  LEAF**, saying what the block inspector offers for that node's own params.
  `split.ratio` was found by that same reading — a param the renderer read and
  no control reached — and the leaves had three more of exactly it:
  `heading.level`, `image.fit` and `field.required`, the last of which
  `WConvert\Lead\CaptureForm` enforces at capture. **`choices` is what declares
  that a param has a control**, rather than `params`: `hidden` is the inspector's
  *Show this* switch and `name` and `action` are its ⇄ menu, each with words of
  its own, so naming them again would be a second control for one question.
  `TemplateLabelParityTest` holds both directions, and the values stay
  unvalidated exactly as a token's do — a design shipping a `fit` nothing offers
  keeps it and the control shows nothing checked.* A thin vocabulary yields one popup in twelve
  colours — the "thin or ugly" failure the ticket names. This is why `image` and the
  `split` layout are in v1 rather than deferred: the differentiator that is not
  colour has to exist in the vocabulary, or the gallery is thin no matter how many
  entries it has.
  *Extended by [ADR 0076](0076-an-enquiry-captures-one-optional-choice-before-handoff.md):
  one named `interest` field renders a native single-choice select. `options`
  is content: stable values and editable labels, bounded by the manifest's
  `field_options`. Its `interest_options` Slot Role holds a named
  `{options: [...]}` wrapper. This adds a qualification answer, not arbitrary
  field names or HTML. A publishable submit screen still offers email or phone
  and cannot contain an empty choice list. An incomplete draft may.*
- **The renderer is a pure function of (tree, tokens)**, so the admin imports the
  same module the loader does. Gallery cards and the live settings preview render the
  real template; there are no static thumbnails to produce or to let go stale.
  *Untouched by [ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md),
  and worth saying because that ADR introduces a card with no render on it. A
  **locked** card — a design free ships the advertisement for and not the design
  — carries its facets in words and a link to a live preview on wconvert.com. It
  carries **no image at all**, so there is still nothing to produce and nothing
  to let go stale. What changed is when a real card renders: `TemplateCard`
  mounts its preview only while near the viewport, because forty on one screen
  is forty closed shadow roots nobody has scrolled to.*
  *Amended by [ADR 0098](0098-fullscreen-is-a-pro-modal-surface.md): until a
  fullscreen design's public preview exists, its Free card says "Included in
  Pro" with no link. Pro previews share the shipping fullscreen content surface;
  no template schema or tokens are added.*
- **That module must stay dependency-free.** Two consumers, two bundles — React
  inside it would drag the admin's dependencies into the loader budget.
- **The renderer and vocabulary are a live reference; a template's tree and tokens
  are snapshotted** into the Optin's `config` when picked. A release that fixes
  accessibility, RTL or layout reaches every existing Optin; a release that restyles
  a template does not silently restyle a live popup. This is what makes #2's word
  exact — `template_id` is provenance, and an Optin renders identically if the entry
  is deleted.
  *Enforced by [#27](https://github.com/navidkashani/wconvert/issues/27), which is
  also where the header's "never appears in the payload" stopped being a claim.
  `template_id` was riding to the browser on every matching page view against a
  2KB budget, because the projection shipped `published_config` whole.
  [`PublishedProjection`](../../src/Optin/PublishedProjection.php) now strips it
  and `playbook_id` beside it — [[Playbook]] provenance works the same way and
  arrived the same way, and neither is read by anything that renders.*
  *The same snapshot now includes the interest question and option values and
  labels (ADR 0076). Editing the library or Playbook cannot change an existing
  form's choices or previously captured answer evidence.*
- **The renderer skips unknown nodes rather than throwing**, so a snapshot outlives a
  vocabulary change. Same failure posture #4 set for an unavailable Destination.
  ***Completed: a stored tree now says which vocabulary wrote it.*** *Skipping
  covers the widening direction and only that one. A snapshot meeting a NEWER
  vocabulary renders as it always did, because `normalize()` drops what it does
  not know and the renderer skips what it cannot draw — but the reverse move,
  renaming a node or tightening a param's meaning, would silently rewrite
  designs already running, with no way to tell a tree that meant the old thing
  from one that means the new thing. So every tree this plugin builds is stamped
  `v` ([`TemplateTree::VERSION`](../../src/Template/TemplateTree.php)), added
  while there is only one version for it to be. **Nothing reads it yet, and that
  is the point:** it is the fact a migration would need and cannot reconstruct,
  and retrofitting it after thirty designs are in the wild costs a guess about
  what each one meant. CONTEXT.md flagged the same gap under* Storage Consent *—
  "the `1` is a version, and it is an escape hatch the server side does not
  have".*
- **Registration is where a *Template* is refused**, on the two questions a
  renderer cannot answer without showing a blank popup. *Amended by the
  structure editor: it is no longer the only place, and it never covered an
  Optin's own `config` — `TemplateLibrary::refuse()` reads a library entry off
  disk. An editor that can delete needed the same question asked at the write,
  which is {@see OptinController::refuseADesignThatCannotConvert()}.* *Added by
  [#27](https://github.com/navidkashani/wconvert/issues/27):
  [`TemplateLibrary`](../../src/Template/TemplateLibrary.php) rejects an entry
  offering two converting acts or none
  ([ADR 0020](0020-conversions-are-interpreted-at-read.md)), and one whose step
  count disagrees with its act — two for a submit, one for a click
  ([ADR 0025](0025-cart-recovery-captures-nothing.md)). *The fixed submit
  screen count is amended for planned progressive capture by
  [ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md): validate
  the explicit linear journey and its submission points instead. The shipping
  validator is not yet updated.* Recorded rather than
  thrown, because one bad entry must not take the gallery down; and **not
  dropped in silence**, because an entry that simply vanished looks exactly like
  a gallery that failed to load. The channel is `_doing_it_wrong()` rather than
  an admin notice: a rejection is an AUTHORING error, and a notice the merchant
  cannot act on is one they learn to dismiss.*
- **Authoring is the settings panel plus a dev-only export**, not hand-written JSON.
  That makes the vocabulary self-testing: every shipped template is provably
  expressible in the panel, so we never ship a design the user cannot adjust.
  *Built in [#29](https://github.com/navidkashani/wconvert/issues/29). The export
  is gated on `WP_DEBUG` rather than on a capability — everyone on that screen
  already has `manage_options`, so it is not a permission question — and the
  round trip is asserted by RENDERING rather than by comparing trees, because
  the claim is about what a visitor sees (`tests/js/builder-export.test.ts`).
  The panel half is asserted from both ends: every shipped entry re-normalises
  to itself in PHP, and every value in it is reachable through a slot in the
  panel's own model (`tests/js/builder-panel.test.ts`).*

- **The ~~panel~~ *settings panel* edits tokens, slot content and slot
  VISIBILITY — never arrangement.** *Added by
  [#29](https://github.com/navidkashani/wconvert/issues/29): a merchant who does
  not want the fine print hides it rather than deleting it, which is what lets
  the panel be complete without a control that reshapes the tree — and it is why
  a canvas can still land later as an editor over a tree that already exists.

  **Amended by the structure editor, which is that canvas arriving.** The
  sentence became a fact about the *Content* tab rather than about the product:
  `SettingsPanel` still edited words, visibility and tokens and still could not
  reshape anything, and `tests/js/builder-settings-panel.test.tsx` asserted it
  offered no control reading add, remove, move, up or down. Arrangement moved to
  a **second view of the same document** — the *Structure* tab — rather than
  into the panel.

  **Amended again by the editor merge, and that reading is now dead.** There is
  one surface, and it edits words **and** arrangement: the block tree with an
  inspector under it, on the tab called *Content*. `SettingsPanel.tsx` no longer
  exists — it dissolved into `SlotFields` (the controls for one slot, in the
  inspector), `Tokens` and `DevExport` (the look, on *Design*). The assertion
  named above went with it, **deleted rather than moved**, because it stopped
  being true on purpose; the deletion is recorded at the head of
  `tests/js/builder-design-tab.test.tsx`.

  **The substance of this bargain is untouched, and it is worth restating
  exactly.** Three things were what it was made of, and none of them moved:

  1. **The vocabulary is still the ceiling.** `structure/catalogue.ts` reads
     `manifest.json` and can express nothing outside it. The editor arranges
     what the vocabulary offers; it cannot invent design variety.
  2. **The gallery is still where a design comes from.** A merchant adjusts one
     here; they choose one there.
  3. **There is still no migration**, because the tree the editor edits is the
     tree that was always stored.

  `hidden` therefore keeps its whole meaning. Hiding a slot and removing it are
  both possible and they are different acts: hidden is reversible in the
  inspector and rides the payload, removed is reversible by Undo and does not.*
  *`hidden` is a param on `heading`, `text`, `image` and `consent` and on nothing
  else: hiding the button that converts leaves an Optin with no countable act,
  and hiding a required field leaves a form the capture endpoint refuses every
  submission of, so neither declares the key and PHP drops it on the way in.
  **That non-registration was also the whole of the enforcement, and the
  structure editor is what made it insufficient** — a Delete key reaches what
  `hidden` could not express. `OptinController::refuseADesignThatCannotConvert()`
  now refuses at the write what `TemplateLibrary::refuse()` only ever refused at
  registration, and `structure/guards.ts` prevents it on the screen.*
  `button` also gained `href` as CONTENT rather than a param, because a
  click-metered CTA's destination is the merchant's to type — and it is
  scheme-validated at write for the same reason a link inside a sentence is
  ([ADR 0013](0013-playbook-copy-carries-no-markup.md)).*
- **The tree is `steps[]`, and how many steps a template has follows from its
  metric.** A submit-metered template has **two** — the post-submit success state
  is a terminal step, so a Yes/No two-step needs no new structure, just a second
  non-terminal step. *Corrected by
  [ADR 0025](0025-cart-recovery-captures-nothing.md): a **click-metered**
  template has **one**. The click navigates the visitor away, so there is no
  success state left to render, and an interstitial is worse than the navigation
  it delays. This applies to both click Goals — "Promote a sale or offer" and
  "Bring shoppers back to their cart" — so it is a property of the metric, not of
  WooCommerce.*
  *Amended for progressive capture by
  [ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md): submit
  designs may contain content screens and multiple input screens, including
  optional submissions after the first accepted capture. Merchants arrange
  them in a linear journey. The JSON v2 contract and readers implement this flow.*
- **Every leaf now carries an `id`, and it is the one key validation ADDS rather
  than drops.** *This ADR's closure rule is that an unknown node type, token,
  param or Slot Role is dropped on the way in
  ([`TemplateVocabulary`](../../src/Template/TemplateVocabulary.php)). `id` runs
  the other way: a leaf that arrives without one leaves with a minted one
  ([`NodeIdentities`](../../src/Template/NodeIdentities.php)), unique across the
  whole tree ~~exactly as a Slot Role is~~.*

  ***Amended by [ADR 0051](0051-a-slot-role-repeats-and-binds-in-order.md): an
  `id` is unique and a Slot Role no longer is.*** *The comparison was true when
  it was written and is now the wrong way round — a Role may be claimed by
  several nodes and a Playbook's words bind to them in tree order, while an `id`
  stays one node's own name because it is what a TRANSLATION is attached to.
  Everything else in this entry stands: `id` is still the one key validation
  adds rather than drops.*

  *The bundled authoring rule is explicit: ship each leaf with its stable
  `n1`…`n9999` id, unique in that tree, and keep it with the leaf when moving
  it. Server minting remains the fallback for newly added unnamed nodes; it
  must not rename every later leaf when a library file is reordered.
  `NodeIdentityTest` enforces this for shipped JSON, and the authoring guides
  now agree (ADR 0076).*

  *The reason is translation, and it is a consequence of "configuration, not
  documents" rather than a departure from it. Merchant copy lives inside
  `wconvert_optins.config` as JSON, and WPML and Polylang both register a string
  by a **name** — `wpml_register_single_string(context, name, value)`. The only
  name a node had was its position, `steps[0].children[0]`, and the structure
  editor above is precisely the thing that moves positions: reorder the design
  and the French headline attaches to the fine print. With ids the name is
  `optin-01HA/n3.text` and rearranging changes nothing.*

  *Minted in PHP rather than in the admin, and that follows from a rule
  `resources/admin/src/builder/structure/tree.ts` already stated at length:
  **nothing in the editor may invent a key**, because a save replaces `config`
  with what came back and only manifest-declared keys survive. So the server
  mints, and the editor's one obligation is the mirror image — `withDuplicated`
  **strips** the id from a copy, as it already strips a Role, so two sentences
  never sit behind one name.*

  *This is what makes the WPML/Polylang integration a later ticket instead of a
  later **migration**. Every tree passes through `normalize()`, so a snapshot
  written before the key existed acquires ids the first time it is saved rather
  than needing a walk over every Optin on every site. Layouts carry none — an id
  names a string and a `stack` says nothing — and the cost against the payload
  budget was measured rather than assumed: **29 bytes gzipped** across ten
  worst-case trees, which the bullet below has the room for.*
- **The vocabulary gained a `consent` leaf node** after this ADR, paired with a
  `consent_text` Slot Role — see
  [ADR 0032](0032-consent-capture-is-first-class-in-the-template.md). Consent
  capture is first-class in the template rather than a required field the
  merchant hand-adds: off by default, required once present, and enforced
  server-side, because an *optional* consent checkbox captures Leads whose
  consent was explicitly refused.
- **~~Unverified:~~ Verified** — that ten snapshotted trees on one page still gzip
  inside the 2KB payload budget. #9 measured ten rule-set projections at 5.7KB raw
  compressing to 621 bytes because they are near-identical text; template trees drawn
  from one closed vocabulary should be more self-similar, not less, but this was a
  prediction. *Confirmed in [#23](https://github.com/navidkashani/wconvert/issues/23):
  ten snapshots of the shipped `centred-card`, each filled with different copy so the
  ten share structure and almost no text, each carrying its own tokens, rules and
  frequency, measure **13,044 bytes raw compressing to 1,072 bytes** — 52% of the
  budget, gzipped in isolation rather than against the surrounding HTML, so the real
  figure is lower still. `tests/unit/Frontend/PayloadBudgetTest.php` holds it.*
  *Re-measured when node ids landed: **1,173 bytes**, against 1,144 before them.
  Eighty ids across ten trees cost **29 bytes gzipped**, because `"id":"n` is the
  most compressible thing in the payload — which is the same self-similarity
  argument this bullet was uncertain about, holding a second time.*
  The recorded fix if it ever fails is unchanged: delta-encoding each Optin against its
  `template_id`, rejected now because snapshots diverge from their source by design and
  the delta would need the source *version* too.

  > *Amended by the port of six reference designs (2026-09-10).* **The ten is
  > gone and the 2KB is not.** `PayloadBudgetTest` measured ten copies of the
  > richest design on one page, which is a page the rule engine cannot produce —
  > at most one overlay wins a page view. Six reference-class designs came to
  > 2,192–2,293 B there, and stripping every SVG and gradient out of them still
  > measured 2,087–2,108 B, so there was no design change that bought the pass.
  > The horn this ADR left open is answered: *a page carrying ten rich designs
  > is not the case we design for.* The fixture measures **five**, at which the
  > costliest shipped design is **1,854 B of 2,048**, and the one Optin a
  > visitor actually sees is 1,482 B.
