# Templates are configuration, not documents

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
  clause that makes narrowing the vocabulary safe at all.* *Refined by
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
  season.* A thin vocabulary yields one popup in twelve
  colours — the "thin or ugly" failure the ticket names. This is why `image` and the
  `split` layout are in v1 rather than deferred: the differentiator that is not
  colour has to exist in the vocabulary, or the gallery is thin no matter how many
  entries it has.
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
- **The renderer skips unknown nodes rather than throwing**, so a snapshot outlives a
  vocabulary change. Same failure posture #4 set for an unavailable Destination.
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
  ([ADR 0025](0025-cart-recovery-captures-nothing.md)). Recorded rather than
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
  The recorded fix if it ever fails is unchanged: delta-encoding each Optin against its
  `template_id`, rejected now because snapshots diverge from their source by design and
  the delta would need the source *version* too.
