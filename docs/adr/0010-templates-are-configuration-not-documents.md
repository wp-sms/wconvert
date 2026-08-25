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
  the gallery *is* the design surface.
  *Fixed in [#23](https://github.com/navidkashani/wconvert/issues/23) as six leaf
  nodes — `heading`, `text`, `image`, `field`, `button`, `consent` — and four
  layouts: `stack` (a column), `row` (a wrapping line), `split` (two independent
  panes, which is what makes an image-led design possible) and `grid` (equal
  collapsing tracks). `resources/templates/manifest.json` is the file, and
  `tests/js/renderer-manifest-parity.test.ts` asserts the renderer implements
  exactly it.* A thin vocabulary yields one popup in twelve
  colours — the "thin or ugly" failure the ticket names. This is why `image` and the
  `split` layout are in v1 rather than deferred: the differentiator that is not
  colour has to exist in the vocabulary, or the gallery is thin no matter how many
  entries it has.
- **The renderer is a pure function of (tree, tokens)**, so the admin imports the
  same module the loader does. Gallery cards and the live settings preview render the
  real template; there are no static thumbnails to produce or to let go stale.
- **That module must stay dependency-free.** Two consumers, two bundles — React
  inside it would drag the admin's dependencies into the loader budget.
- **The renderer and vocabulary are a live reference; a template's tree and tokens
  are snapshotted** into the Optin's `config` when picked. A release that fixes
  accessibility, RTL or layout reaches every existing Optin; a release that restyles
  a template does not silently restyle a live popup. This is what makes #2's word
  exact — `template_id` is provenance, and an Optin renders identically if the entry
  is deleted.
- **The renderer skips unknown nodes rather than throwing**, so a snapshot outlives a
  vocabulary change. Same failure posture #4 set for an unavailable Destination.
- **Authoring is the settings panel plus a dev-only export**, not hand-written JSON.
  That makes the vocabulary self-testing: every shipped template is provably
  expressible in the panel, so we never ship a design the user cannot adjust.
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
