/**
 * Every line of the vocabulary's stylesheet, in two halves.
 *
 * One renderer owns the whole component vocabulary and the whole stylesheet.
 * Configuration pays for it ONCE, in the loader, budgeted at ≤2KB gzipped; a
 * document-model template would have paid ~870 bytes of CSS per design and
 * been arithmetically dead at about six of them (ADR 0010).
 *
 * The two halves are not a stylistic split. A face declared inside a shadow
 * root is silently ignored — identical computed `font-family`, different
 * glyphs, and `document.fonts.check()` returns true for fonts that do not
 * exist — so `@font-face` MUST be hoisted to the document, and `::backdrop`
 * belongs to the dialog rather than to anything inside it. Everything else
 * belongs inside the boundary (ADR 0009).
 *
 * **Logical properties only.** Writing direction crosses every boundary — the
 * `all` shorthand excludes `direction` and `unicode-bidi` — so RTL correctness
 * is entirely a matter of never naming a physical side here. That was verified
 * at 44 of 44 under a real `fa_IR` locale; do not re-litigate it with
 * `margin-left`.
 */

/**
 * What lives on the document: the faces, and the backdrop.
 *
 * **v1 declares no `@font-face`.** Templates use system stacks, which cost
 * nothing to ship and nothing to license, so the face block is empty — but the
 * hoisting is structural rather than conditional, and
 * `tests/js/renderer-mount.test.ts` fails the day a face appears in
 * {@link SHADOW_CSS} instead of here.
 *
 * The backdrop reads a custom property set inline on the dialog, because a
 * `::backdrop` pseudo cannot see the tokens that live on the first element
 * inside the shadow root. The literal fallback is what older engines use,
 * where `::backdrop` does not yet inherit from its originating element.
 */
export const DOCUMENT_CSS = `dialog.wconvert-dialog::backdrop{background:var(--wc-backdrop,rgba(15,23,42,.55))}`;

/**
 * Everything inside the boundary.
 *
 * **Nothing load-bearing is on `:host`.** A normal declaration in the outer
 * tree beats a normal `:host` rule — OceanWP's Meyer-style reset names `div`
 * explicitly, matched the host, and pushed its body font across the boundary
 * by inheritance. So the host carries a reset and nothing else, the reset is
 * `!important` so the outer tree cannot outrank it, and every property the
 * design depends on lives on `.wc-root`, one element in (ADR 0009).
 */
/**
 * How wide a design is when it does not say.
 *
 * Named rather than written into the rule below, because it is not only this
 * stylesheet's business: a CONTAINER that has to size a box to the design it
 * will hold has to know the same number, and two spellings of it are a box and
 * a design that disagree by 448px the day one of them changes
 * (`pro/resources/renderer/src/popover.ts`, ADR 0011).
 */
export const A_DESIGNS_OWN_WIDTH = '28rem';

/**
 * The width below which a design's `narrow` bags take over.
 *
 * Named rather than written into the rule below for {@link A_DESIGNS_OWN_WIDTH}'s
 * reason: the ADMIN has to draw a width switch at exactly this number, and the
 * merchant is told where it fires. It is declared in
 * `resources/templates/manifest.json` as well, and
 * `renderer-manifest-parity` asserts the two agree — the renderer imports no
 * manifest.
 *
 * **24rem is derived rather than chosen: it is where a `split` stops being side
 * by side.** A pane's `flex-basis` is `12rem` and there are exactly two of
 * them, so below 24rem the panes have already wrapped into a column. Retuning
 * at the same width as the layout gives up means the two mechanisms cannot
 * disagree — a design does not retune while still side by side, or stay tuned
 * for two columns after it has one.
 *
 * A phone measure would have been the obvious number and is the wrong one. The
 * common ones straddle it — 360, 375, 390, 412 — so half the phones in
 * circulation would have wrapped without retuning or retuned without wrapping,
 * and the switch in the builder would have been drawn at a width the query did
 * not fire at.
 */
export const A_NARROW_DESIGN = '24rem';

export const SHADOW_CSS = [
  `:host{all:initial!important;display:block!important}`,
  `*,::before,::after{box-sizing:border-box}`,

  /*
   * One element in: this is where positioning, stacking and base typography
   * are allowed to live.
   *
   * ==========================================================================
   * TWO BACKGROUND LAYERS, AND THE ORDER OF THEM IS THE WHOLE FEATURE.
   * ==========================================================================
   * `bg-image` is the picture and `overlay` is a flat wash over it, declared as
   * a gradient from one colour to itself because CSS has no "solid colour" that
   * is also an `<image>`. The overlay is listed FIRST because the first layer
   * in `background-image` paints on top — which is what makes white text on a
   * photograph legible, and it is the only reason a background image is usable
   * in a lead-capture design at all.
   *
   * `--wc-bg` stays underneath both as the `background` shorthand's colour, so
   * a design with no picture is exactly what it was and a picture that fails to
   * load falls back to the design's own surface rather than to nothing.
   *
   * `none` is a legal layer in the list, so the default costs no branch.
   */
  `.wc-root{font-family:var(--wc-font,system-ui,sans-serif);font-size:var(--wc-text-size,1rem);line-height:var(--wc-leading,1.5);color:var(--wc-fg,#111827);background:var(--wc-bg,#fff);background-image:linear-gradient(var(--wc-overlay,#0000),var(--wc-overlay,#0000)),var(--wc-bg-image,none);background-size:cover;background-position:center;border-radius:var(--wc-radius,.5rem);padding:var(--wc-pad,1.5rem);container:wc/inline-size;text-align:var(--wc-align,start);inline-size:min(var(--wc-width,${A_DESIGNS_OWN_WIDTH}),100%);max-block-size:85vh;overflow:auto;position:relative;box-shadow:var(--wc-shadow,0 10px 40px rgba(0,0,0,.18))}`,

  // Resolve inherited typography at each scope, so a local bag changes its own text.
  `.wc-stack,.wc-row,.wc-grid,.wc-split,.wc-panel,.wc-media,.wc-leaf{font-family:var(--wc-font,system-ui,sans-serif);font-size:var(--wc-text-size,1rem);line-height:var(--wc-leading,1.5);color:var(--wc-fg,#111827);text-align:var(--wc-align,start)}`,

  `.wc-stack{display:flex;flex-direction:column;gap:var(--wc-gap,.75rem)}`,
  `.wc-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--wc-gap,.75rem)}`,

  /*
   * ==========================================================================
   * `auto-fit` IS THE WHOLE DIFFERENCE FROM THE `grid` THAT WAS DELETED.
   * ==========================================================================
   * The old one declared `repeat(columns, 1fr)`: always N across, so a
   * two-column grid stayed two columns at 320px and handed a phone two 140px
   * columns of prose. This asks for as many `8rem` columns as fit and wraps by
   * construction — three across on a desktop, one per line on a phone, with no
   * media query and no `columns` param for a design to get wrong.
   *
   * It is the only route to a three-up: `split` is hard-coded to exactly two
   * panes, and a benefit list has three benefits.
   */
  `.wc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));gap:var(--wc-gap,.75rem)}`,

  /*
   * ==========================================================================
   * THE ONE LAYOUT THAT PAINTS. EVERY OTHER ONE ONLY ARRANGES.
   * ==========================================================================
   * `stack`, `row`, `grid` and `split` place their children and draw nothing —
   * the design's ground is `.wc-root`'s and there is exactly one of it. A
   * `panel` is a stack that paints the tokens IN SCOPE, which is what makes a
   * scoped bag visible: a cream box beside a dark one is a `panel` with
   * `{"bg":"#fff4df"}` next to a `panel` with `{"bg":"#0f172a"}`, and neither
   * needs a rule of its own (ADR 0062).
   *
   * It reads the same properties `.wc-root` reads, including the two-layer
   * background in the same order — `overlay` first so it paints ON TOP of
   * `bg-image`, which is the only reason light text over a photograph is
   * legible. That is what makes a photo pane a `panel` rather than a second
   * member: `bg-image` + `overlay` + `min`, in a `split` pane.
   *
   * **`render.ts` resets the picture on every panel** before the bag is
   * applied, so a panel inherits the design's COLOURS and not its photograph.
   * Without that, one `bg-image` on the design would be painted again, cover
   * and centred, inside every panel in it.
   */
  `.wc-panel{display:flex;flex-direction:column;gap:var(--wc-gap,.75rem);min-block-size:var(--wc-min,0);padding:var(--wc-pad,1.5rem);border-radius:var(--wc-radius,.5rem);color:var(--wc-fg,#111827);background:var(--wc-bg,#fff);background-image:linear-gradient(var(--wc-overlay,#0000),var(--wc-overlay,#0000)),var(--wc-bg-image,none);background-size:cover;background-position:center}`,
  /*
   * Two edge treatments, and the widths are different because the jobs are.
   * `block-start` is a GRAPHIC — the accent rule over a result panel, which is
   * the single most copied device in this genre — so it is thick enough to read
   * as one. `all` is an OUTLINE, so it is a hairline; a card outlined at half a
   * rem is a box with a frame around it.
   *
   * Logical on both axes, so an `fa_IR` site and a vertical writing mode each
   * get the edge they actually have (ADR 0009). `none` is the default and adds
   * no attribute, so a design that never heard of this param renders
   * byte-identically to one that spells it.
   */
  `.wc-panel[data-edges=block-start]{border-block-start:.5rem solid var(--wc-border,#e5e7eb)}`,
  `.wc-panel[data-edges=all]{border:1px solid var(--wc-border,#e5e7eb)}`,

  /*
   * ==========================================================================
   * THE ONE ORNAMENT SCOPING CANNOT REACH, AND THE ONLY `mask` IN THE PRODUCT.
   * ==========================================================================
   * Of the eighteen decorations in the reference set, seventeen are a token in
   * disguise: a photo scrim is `overlay`, a tick bullet is an `icon`, a ring is
   * the data URI nine designs already use for `image`. A perforation is the
   * one that is not, because it has to REMOVE the panel — the ground behind a
   * punched notch is the merchant's own page, and no background layer can name
   * that.
   *
   * Two circles, at the top corners, which is where a ticket tears. It pairs
   * with `edges: block-start`: the rule is the perforation line and the holes
   * are its ends.
   *
   * **`intersect` is what makes two layers one shape.** Each gradient is
   * transparent inside its own circle and opaque everywhere else, so composing
   * them keeps only what both agree is opaque — everything but the two holes.
   * The DEFAULT composite is `add`, so an engine that does not understand this
   * property draws a panel with no notches rather than a panel with no
   * corners: it degrades to the design without the ornament, which is the only
   * degradation worth having.
   *
   * The `-webkit-` pair is Safari before 15.4, and it costs almost nothing
   * compressed because it is the same string twice.
   */
  `.wc-panel[data-notch=true]{-webkit-mask-image:radial-gradient(circle 10px at 0 0,#0000 10px,#000 10.5px),radial-gradient(circle 10px at 100% 0,#0000 10px,#000 10.5px);mask-image:radial-gradient(circle 10px at 0 0,#0000 10px,#000 10.5px),radial-gradient(circle 10px at 100% 0,#0000 10px,#000 10.5px);-webkit-mask-composite:source-in;mask-composite:intersect}`,

  /*
   * ==========================================================================
   * A PICTURE THAT HOLDS THINGS. `panel` PAINTS A BOX; THIS IS TYPE ON ART.
   * ==========================================================================
   * `justify-content:space-between` is the whole difference and it is not a
   * nicety: thirteen of the sixteen reference designs put a wordmark at the
   * top of one photograph and a display line at the bottom of the SAME one, so
   * spreading the children to the far edges is what putting type on a picture
   * IS. A `panel` stacks them at the top and leaves the room underneath.
   *
   * `min` is load-bearing here rather than a nicety, for the reason the spread
   * makes obvious: two short lines with nothing to spread across are two short
   * lines.
   *
   * **The overlay is a LAYER of its own and not the second background layer.**
   * On `.wc-root` and `.wc-panel` the wash is painted into `background-image`
   * above the picture, which is right where the box's own text is the thing
   * being made legible. Here the children sit ON the picture, so a wash in the
   * background would darken the photograph and the words equally. A
   * pseudo-element sits between the two — no extra markup, and the children
   * take `position:relative` to clear it.
   */
  `.wc-media{position:relative;display:flex;flex-direction:column;justify-content:space-between;gap:var(--wc-gap,.75rem);min-block-size:var(--wc-min,0);padding:var(--wc-pad,1.5rem);border-radius:var(--wc-radius,.5rem);overflow:hidden;color:var(--wc-fg,#111827);background:var(--wc-bg,#fff);background-image:var(--wc-bg-image,none);background-size:cover;background-position:center}`,
  `.wc-media::before{content:"";position:absolute;inset:0;background:var(--wc-overlay,#0000);pointer-events:none}`,
  `.wc-media>*{position:relative}`,
  /*
   * A media alone in a pane fills it, exactly as an image alone in one does —
   * the rule below this one, for the same design and the same reason.
   */
  `.wc-pane>.wc-media{block-size:100%}`,

  // `flex-basis` plus `wrap` is what stacks the two panes on a narrow screen,
  // with no media query and no container query to keep in step.
  /*
   * ==========================================================================
   * `stretch` AND NOT `center`, BECAUSE A PANE HOLDING A PICTURE IS A SIDE.
   * ==========================================================================
   * Centring left the shorter pane floating with dead space above and below
   * it — and the shorter pane is almost always the picture, so every
   * side-by-side design in the library had a band of panel colour along the
   * top and bottom of its own artwork. It reads as an image that failed to
   * load into its slot.
   *
   * Stretch makes both panes the height of the taller, which is what "side by
   * side" means. When the split WRAPS at a narrow width there is one item per
   * line, so this changes nothing there.
   */
  `.wc-split{display:flex;flex-wrap:wrap;gap:var(--wc-gap,.75rem);align-items:stretch}`,
  /*
   * A pane centres its own contents against the taller pane beside it.
   *
   * This is the other half of the `stretch` above, and without it that change
   * traded one defect for another: the panes became equal height, so the
   * SHORTER one's content sat at the top with the difference as dead space
   * under it — a column of text ending two-thirds of the way down a panel
   * whose other half is a full-bleed picture.
   *
   * Centring is what "side by side" means when the two sides are different
   * lengths, and it is what every specimen of this genre does. A pane holding
   * nothing but a picture is unaffected: the picture already fills it.
   */
  `.wc-pane{flex:1 1 12rem;min-inline-size:0;display:flex;flex-direction:column;justify-content:center}`,
  /*
   * ==========================================================================
   * THE GROWS ARE SCALED BY TEN, AND THAT IS A BUG FIX RATHER THAN A STYLE.
   * ==========================================================================
   * `flex-grow` distributes FREE SPACE, and a value below 1 distributes only
   * that fraction of it. Side by side the two grows sum to 1 and the line is
   * consumed exactly — which is why this was right for as long as a pane drew
   * nothing. Wrapped, each pane is alone on its line with a grow of `.35` or
   * `.5`, so it takes a third or a half of the space beyond its `12rem` basis
   * and stops: measured at 320px, `split-hero` drew two 228px panes in a 264px
   * row and `inline-split` two of 209 and 223 in 240.
   *
   * **It was invisible until a pane had a ground.** A transparent pane that is
   * 40px short of the line looks like a pane; a `panel` inside one is a dark
   * box with a stripe of the design's own background down its edge (ADR 0062).
   *
   * Ten, because only the RATIO between two grows matters once their sum
   * clears 1 — so `3.5 : 6.5` divides a shared line exactly as `.35 : .65`
   * did, and either alone now fills its own. `max()` keeps that true for a
   * design shipping a fraction below `.1`, which `choices` permits and no
   * shipped design uses (ADR 0054: an offer, not a limit).
   */
  `.wc-pane:first-child{flex-grow:max(1,calc(var(--wc-ratio,.5)*10))}`,
  `.wc-pane:last-child{flex-grow:max(1,calc((1 - var(--wc-ratio,.5))*10))}`,

  /*
   * **A display face is the second thing a reference-class design decides**,
   * after its palette — eight of the sixteen designs in the reference set set
   * one, and until now a design had exactly one face for everything. So
   * `heading-font` falls back to `font` rather than to a stack of its own: a
   * design that sets only `font` is unchanged to the byte, and one that sets
   * both gets a display face over body text without saying the body stack
   * twice.
   *
   * `1.12` and not `1.2`, which is a BODY leading: a display heading set at it
   * looks slack, and the bigger `heading-size` gets the worse it reads — which
   * is the direction both this token and the library moved.
   */
  `.wc-heading{margin:0;font-family:var(--wc-heading-font,var(--wc-font,system-ui,sans-serif));font-size:var(--wc-heading-size,1.5rem);font-weight:var(--wc-heading-weight,700);letter-spacing:var(--wc-tracking,normal);line-height:1.12}`,
  /*
   * **A sub-heading is smaller, or `level` is a control that does nothing.**
   * `render.ts` draws an `h3` for `level: 2` and an `h2` otherwise, and both
   * wore this one size — so a design with two headings rendered them
   * identically, and the block inspector's *Main heading / Sub-heading* switch
   * changed the document outline and not one pixel. A merchant pressing it saw
   * nothing happen.
   *
   * Derived from the token rather than given a size of its own, so
   * `heading-size` still decides the scale and the sub-heading follows it. The
   * ratio is the one this admin's own type scale uses between its title and its
   * heading role (1.5rem → 1rem is .67; .72 keeps a sub-heading clearly a
   * heading rather than body text at the default 1.5rem).
   */
  `h3.wc-heading{font-size:calc(var(--wc-heading-size,1.5rem)*.72)}`,
  `.wc-text{margin:0}`,
  // `.8125em` is small body text, not fine print — it sat close enough to the
  // body copy that a design with both read as two paragraphs of equal weight.
  // `.6875em` is the size this genre actually sets a consent line at.
  `[data-role=fine_print]{font-size:.6875em;line-height:1.5;color:var(--wc-muted,#6b7280)}`,

  /*
   * ==========================================================================
   * THE TYPE SCALE — SIX STEPS, AND THE MOST RECOGNISABLE MOVE IN THE GENRE.
   * ==========================================================================
   * *"15%"* at 90px beside its own sentence at 24px is what a discount design
   * looks like, and until now a design had ONE heading size and ONE text size.
   * The token still decides the scale; a step MULTIPLIES it, so a design that
   * sets `heading-size` moves all six together and the merchant's one lever
   * still works.
   *
   * **Ten rules and not five**, because the base differs: a heading scales
   * `heading-size` and a paragraph scales `text-size`. The obvious compression —
   * one `--wc-scale` the two base rules read — is exactly what the parity test
   * forbids, since a node param is not a token and the stylesheet may read no
   * `--wc-*` name that is not one (see `sized()` in `render.ts`).
   *
   * `m` has no rule at all: it is the base, and it is the default, so a design
   * that spells it renders byte-identically to one that does not.
   *
   * **Specificity is doing real work here.** `h3.wc-heading` is (0,1,1) and
   * these are (0,2,0), so an explicit step beats the rank-derived sub-heading
   * size rather than composing with it — which is the honest reading of a
   * merchant who set a size: they said how big, not how much smaller than the
   * other thing.
   */
  `.wc-heading.wc-3xl{font-size:calc(var(--wc-heading-size,1.5rem)*2.5)}`,
  `.wc-heading.wc-2xl{font-size:calc(var(--wc-heading-size,1.5rem)*2)}`,
  `.wc-heading.wc-xl{font-size:calc(var(--wc-heading-size,1.5rem)*1.5)}`,
  `.wc-heading.wc-s{font-size:calc(var(--wc-heading-size,1.5rem)*.75)}`,
  `.wc-heading.wc-xs{font-size:calc(var(--wc-heading-size,1.5rem)*.625)}`,
  `.wc-text.wc-3xl{font-size:calc(var(--wc-text-size,1rem)*2.5)}`,
  `.wc-text.wc-2xl{font-size:calc(var(--wc-text-size,1rem)*2)}`,
  `.wc-text.wc-xl{font-size:calc(var(--wc-text-size,1rem)*1.5)}`,
  `.wc-text.wc-s{font-size:calc(var(--wc-text-size,1rem)*.75)}`,
  `.wc-text.wc-xs{font-size:calc(var(--wc-text-size,1rem)*.625)}`,
  /*
   * A display number is a number, and at 2.5× the base a heading's line box is
   * mostly air above and below it. `1.2` is right for a two-line headline and
   * wrong for *"15%"* on its own; the two big steps get a tighter one so the
   * thing sits on its own baseline rather than floating in a band.
   */
  `.wc-3xl,.wc-2xl{line-height:1.05}`,

  /*
   * The eyebrow and the badge are the same short string wearing two jobs, and
   * the typography is the whole of what distinguishes them: an eyebrow is a
   * quiet LABEL above something, a badge is a loud thing stuck ON it. Neither
   * is expressible by typing into a `text` slot, which is why they are nodes
   * and not a convention.
   *
   * Their letter-spacing is their own rather than `--wc-tracking`: the token is
   * the merchant's lever over HEADINGS, and an eyebrow set at a heading's
   * tracking stops being an eyebrow.
   */
  `.wc-eyebrow{margin:0;font-size:.75em;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--wc-muted,#6b7280)}`,
  `.wc-badge{align-self:start;font-size:.75em;font-weight:600;line-height:1.4;padding-block:.125rem;padding-inline:.5rem;border-radius:calc(var(--wc-radius,.5rem)/2);background:var(--wc-accent,#2563eb);color:var(--wc-accent-fg,#fff)}`,
  /*
   * ==========================================================================
   * THE CORNER FLASH — THE ONE PLACEMENT NO TOKEN REACHES, AT ANY SCOPE.
   * ==========================================================================
   * `.wc-root` is already `position: relative`, so this needs no new
   * containing block. It is pinned by `--wc-pad` rather than by a number of
   * its own, which is what keeps it aligned with the content it is flashing
   * over — a design with generous padding gets a badge inside that air rather
   * than one floating in it.
   *
   * **Inside the box and never overhanging it.** `.wc-root` carries
   * `overflow: auto` for the tall-design case, so an overhanging corner would
   * be clipped on exactly the designs that most want one.
   *
   * Logical properties, so a `fa_IR` site flashes the corner that side of the
   * page actually has with no second spelling (ADR 0009).
   */
  `.wc-badge-corner{position:absolute;inset-block-start:var(--wc-pad,1.5rem);inset-inline-end:var(--wc-pad,1.5rem)}`,
  // `1px` and not a token: a rule the merchant can make 8px thick is a rule
  // that stops being a rule. Its COLOUR is the design's border colour, which is
  // the lever that matters.
  `.wc-divider{margin:0;border:0;border-block-start:1px solid var(--wc-border,#e5e7eb)}`,

  // Tabular figures so the digits do not jitter as they tick — the one thing a
  // countdown does that nothing else in this vocabulary does.
  `.wc-countdown{font-variant-numeric:tabular-nums;font-weight:var(--wc-heading-weight,700);letter-spacing:var(--wc-tracking,normal)}`,

  /*
   * ==========================================================================
   * A CODE HAS TO LOOK LIKE A CODE, AND `--wc-font` IS THE WHOLE DESIGN'S.
   * ==========================================================================
   * Monospace is spelled literally rather than read from a token because the
   * token sets the DESIGN's face; routing this through it would mean setting a
   * whole popup in monospace to box one word. Letter-spacing for the same
   * reason a countdown gets tabular figures — a code is read character by
   * character and retyped, so the characters have to be separable.
   *
   * **`user-select: all` is the copy affordance, and it is the whole of it.**
   * `navigator.clipboard` is capability, and this vocabulary expresses content
   * and never capability (ADR 0010). One tap or click takes the whole string,
   * which is what a visitor on a phone actually reaches for — at the cost of
   * no event handler here and no bytes in the loader. Safari still needs the
   * prefix.
   *
   * A dashed border, because that is what a coupon looks like everywhere a
   * visitor has already seen one. `display: block` with centred text rather
   * than `align-self: start`: a flex column stretches it either way, so
   * centring inside the box is what makes it sit right under both a
   * start-aligned and a centre-aligned design.
   */
  `.wc-code{display:block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.125em;font-weight:700;letter-spacing:.12em;text-align:center;-webkit-user-select:all;user-select:all;padding-block:.625rem;padding-inline:1rem;border:1px dashed var(--wc-border,#e5e7eb);border-radius:calc(var(--wc-radius,.5rem)/2)}`,

  `.wc-rating{display:flex;flex-wrap:wrap;align-items:center;gap:.375rem}`,
  `.wc-stars{display:inline-flex;color:var(--wc-border,#e5e7eb)}`,
  // An unfilled star inherits `--wc-border` from the row above it, so the two
  // states are one declaration apart and neither needs a colour of its own.
  `.wc-star{color:var(--wc-accent,#2563eb);fill:currentColor}`,
  `.wc-rating-text{font-size:.8125em;color:var(--wc-muted,#6b7280)}`,
  // `em` throughout, so an icon beside body text is the size of body text and
  // one in a `grid` cell scales with whatever the design set.
  `.wc-icon{display:inline-flex;color:var(--wc-accent,#2563eb)}`,
  /*
   * ==========================================================================
   * A GLYPH IN A COLUMN FOLLOWS THE DESIGN'S OWN ALIGNMENT, OR IT SITS ALONE
   * ON THE LEFT OF A CENTRED DESIGN.
   * ==========================================================================
   * `.wc-stack` is `flex-direction: column`, so its default `align-items:
   * stretch` makes an `inline-flex` icon full width — and the glyph then draws
   * at the START of that width regardless of `text-align`. On a centred design
   * the tick sat hard left under a centred headline, which reads as a broken
   * layout rather than as a missing rule.
   *
   * `--wc-align` already holds exactly `start`, `center` or `end`, which are
   * the three values `align-self` wants — so this is the token doing the job
   * it was named for, with nothing new to declare.
   *
   * **Scoped to `.wc-stack` on purpose.** In a `row` the cross axis is
   * vertical, where `align-items: center` is already right and honouring
   * `--wc-align` would top-align every icon in a floating bar.
   *
   * The circular image has the same shape — a fixed size in a stretch
   * container — and is covered by the same rule.
   */
  `.wc-stack>.wc-icon,.wc-stack>.wc-image-circle{align-self:var(--wc-align,start)}`,
  `.wc-glyph{inline-size:1.25em;block-size:1.25em}`,
  `.wc-link{color:inherit}`,

  /*
   * ==========================================================================
   * EMPHASIS IS WEIGHT, AND NOTHING ELSE, ON PURPOSE.
   * ==========================================================================
   * *"Take **10% off** your first order"* is 71 sentences across the reference
   * set, and every one of them lifts the run by WEIGHT. A colour would be the
   * obvious second declaration and is the wrong one: the same `%b` sits in
   * fine print — which is already `--wc-muted` — so tinting it `--wc-accent`
   * would put the loudest colour in the design on the quietest line in it.
   *
   * `inherit` on colour is therefore the feature rather than an omission: an
   * emphasised run is the sentence around it, said harder.
   */
  `.wc-strong{font-weight:700}`,
  `.wc-image{display:block;inline-size:100%;block-size:auto;object-fit:cover;border-radius:var(--wc-radius,.5rem)}`,
  /*
   * A picture that IS one side of a split fills that side.
   *
   * `block-size: auto` leaves it at its natural aspect inside a pane the rule
   * above just made full height, so the stretch bought nothing and the dead
   * band stayed. `:only-child` is what scopes this to a pane that is nothing
   * BUT the picture — an image sitting above text in a pane keeps its own
   * aspect, which is what that arrangement wants.
   *
   * `object-fit` is already `cover`, so filling crops rather than distorts.
   */
  `.wc-pane>.wc-image:only-child{block-size:100%}`,
  /*
   * ==========================================================================
   * A CIRCLE, BECAUSE `--wc-radius` IS GLOBAL AND AN AVATAR IS NOT.
   * ==========================================================================
   * The rule above takes the design's ONE corner, shared with the panel, the
   * button and every input — so the round portrait beside a testimonial could
   * only be had by rounding all of them to match, which is a different design
   * rather than the same design with an avatar in it.
   *
   * A fixed square rather than a percentage of whatever holds it: `50%` of a
   * `100%`-wide image is an ellipse, and a portrait that changed size with its
   * container is a portrait that is enormous in a `split` pane and a dot in a
   * `row`. `flex:0 0 auto` is what stops a `row` stretching it back out.
   */
  `.wc-image-circle{inline-size:4.5rem;block-size:4.5rem;flex:0 0 auto;border-radius:50%}`,

  /*
   * ==========================================================================
   * `flex-basis` IS A MAIN-AXIS LENGTH, AND HALF THE LIBRARY'S MAIN AXIS IS
   * VERTICAL.
   * ==========================================================================
   * This rule used to carry `flex:1 1 12rem` itself, which is right in a `row`
   * — a field beside a button should take the slack — and is a **192px-tall
   * field** in a `stack`, because `flex-direction:column` makes the main axis
   * the block axis and `flex-basis` a HEIGHT. Eight of the thirteen shipped
   * designs put a field in a stack, so eight of them drew a label, an input,
   * and 130px of nothing under it, in a popup, on a live site.
   *
   * It looked like air rather than like a bug, which is why it survived every
   * screenshot: the gap reads as generous spacing until there are TWO fields,
   * and then the button is a screen away from the form.
   *
   * So the growth is scoped to the axis it was written for. A field in a
   * `grid` cell or a `split` pane needs neither: neither parent is a flex
   * container, so the shorthand was already inert there.
   */
  `.wc-field{display:flex;flex-direction:column;gap:.25rem;text-align:start}`,
  `.wc-row>.wc-field{flex:1 1 12rem}`,
  /*
   * ==========================================================================
   * A WRAPPED ROW FOLLOWS THE DESIGN'S OWN ALIGNMENT.
   * ==========================================================================
   * `.wc-row` wraps by construction, and a field beside a button needs about
   * 20rem to stay on one line — so in a narrower panel the button wraps onto
   * its own line and, sized to its content, sat there as a small stray control
   * under a full-width field, hard LEFT in a centre-aligned design.
   *
   * `flex-grow: 1` was the first fix and it was wrong: it also grows a button
   * that did NOT wrap, so every floating bar's CTA swelled to fill half the
   * strip. A bar's button must hug its label.
   *
   * `--wc-align` already holds exactly `start`, `center` or `end` — the three
   * values `justify-content` wants — so a centred design centres its wrapped
   * button and a bar, which aligns `start`, is untouched.
   */
  `.wc-row{justify-content:var(--wc-align,start)}`,
  `.wc-label{font-size:.8125em;font-weight:500;color:var(--wc-muted,#6b7280)}`,
  /*
   * ==========================================================================
   * A LABEL INSIDE A ROW IS READ, NOT SEEN.
   * ==========================================================================
   * `.wc-field` stacks its label above its input, which is right in a column
   * and wrong in a `row`: a floating bar is one strip of page furniture, and
   * stacking "Email address" above the box doubled its height and put a second
   * competing line of text next to the offer. Every bar in the library looked
   * like a form that had fallen into a strip.
   *
   * **Hidden from the eye and not from the accessibility tree.** The label
   * still names its input for a screen reader and still takes the click; the
   * placeholder is what a sighted visitor reads, which is what this genre does
   * in a horizontal form and only there.
   */
  `.wc-row>.wc-field>.wc-label{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`,
  /*
   * ==========================================================================
   * AN INSET RING RATHER THAN A BORDER, AND IT IS NOT A STYLISTIC PREFERENCE.
   * ==========================================================================
   * A `1px solid` border is drawn OUTSIDE the padding box, so on a design
   * whose `bg` is dark the field was a dark box with a dark hairline round it
   * — invisible, on the one control a visitor has to find. The ring is an
   * inset shadow, so it composites over whatever ground the field is on and
   * reads on both.
   *
   * **The ring and `input-bg` are the same defect fixed from two ends, and
   * both are kept.** The ring makes the field's EDGE read on an unknown
   * ground; `input-bg` decides what that ground is, falling back to `bg` so
   * every design shipped before it renders identically (ADR 0062). Neither
   * replaces the other: a light field on a dark panel needs the token, and a
   * field on a ground nobody predicted needs the ring.
   *
   * `color-mix` is not reachable here — the ring has to work against an
   * unknown ground — so it is a translucent black plus a translucent white,
   * one of which is always the visible one.
   */
  `.wc-input{inline-size:100%;font:inherit;color:inherit;background:var(--wc-input-bg,var(--wc-bg,#fff));border:0;border-radius:var(--wc-radius,.5rem);box-shadow:inset 0 0 0 1px var(--wc-border,#e5e7eb);padding-block:.75rem;padding-inline:.875rem}`,


  /*
   * ==========================================================================
   * THE CONVERTING CONTROL IS THE HEAVIEST THING ON THE PANEL, OR IT IS NOT A
   * CALL TO ACTION.
   * ==========================================================================
   * This was `600` at `.625rem` of block padding, which is the weight and the
   * height of a form control rather than of the one element the whole design
   * exists to get pressed. Against a specimen of the genre it read as a
   * secondary button in every design at once — and no token could fix it,
   * because neither weight nor padding is one.
   *
   * `700` and `.8125rem`, which is the shape this genre actually uses. The
   * inline padding stays generous for the same reason it always was: a label
   * that says what happens ("Send my code") is longer than "Submit".
   */
  `.wc-button{display:inline-block;font:inherit;font-weight:700;text-align:center;text-decoration:none;cursor:pointer;border:0;border-radius:var(--wc-radius,.5rem);background:var(--wc-accent,#2563eb);color:var(--wc-accent-fg,#fff);padding-block:.8125rem;padding-inline:1.25rem;transition:opacity var(--wc-motion,200ms) ease}`,
  /*
   * ==========================================================================
   * THE ONLY MOTION INSIDE THE BOUNDARY, AND IT IS ON THE CONTROL THAT MATTERS.
   * ==========================================================================
   * A grep for `transition|animation|@keyframes` across this renderer returned
   * nothing until now — popups simply existed, abruptly, and so did every
   * button in them. This is the cheapest motion a design gets and the one a
   * visitor's cursor actually asks for.
   *
   * **`motion` is one token with two consumers**, which is why it lives here
   * rather than being a number Pro spells for itself. The popover container
   * reads the same token to time its ENTRY (`pro/resources/renderer/src/
   * popover.ts`), and a design whose button eased at 200ms while its slide-in
   * arrived at 400ms would be two decisions where the merchant made one.
   * `opacity` and not `background`, so a design whose accent is a gradient or a
   * `var()` still animates.
   */
  `.wc-button:hover{opacity:.88}`,

  `.wc-consent{display:flex;align-items:start;gap:.5rem;text-align:start}`,
  `.wc-consent-text{font-size:.8125em;color:var(--wc-muted,#6b7280)}`,
  `.wc-checkbox{margin-block-start:.25em;accent-color:var(--wc-accent,#2563eb)}`,

  // A refused capture, drawn by the loader rather than by the vocabulary — for
  // the same reason the close button is: a template must not be able to omit
  // the way out, and it must not be able to make the reason its form was
  // refused invisible. So the colour is a literal and not a token.
  `.wc-error{margin:0;color:#b91c1c;font-size:.875em;font-weight:600}`,
  // Follows the ring above. `border-color` styled a border this no longer
  // draws, so the invalid state was silently invisible the moment the field
  // changed shape — which is the one state that must not be.
  `.wc-input[aria-invalid]{box-shadow:inset 0 0 0 2px #b91c1c}`,

  // Container chrome, not vocabulary: a template cannot omit the way out.
  `.wc-close{position:absolute;inset-block-start:.5rem;inset-inline-end:.5rem;inline-size:2rem;block-size:2rem;font:inherit;font-size:1.25rem;line-height:1;cursor:pointer;color:var(--wc-muted,#6b7280);background:transparent;border:0;border-radius:var(--wc-radius,.5rem)}`,
  /*
   * ==========================================================================
   * 24×24 IS THE FLOOR. IT IS NOT THE TARGET SIZE FOR A THUMB.
   * ==========================================================================
   * WCAG 2.2 SC 2.5.8 puts the minimum at 24×24, so the 2rem above passes AA
   * on paper. Apple's own guidance is 44×44 and Google's is 48×48, and this is
   * the control the whole Dismissal model rests on — "making dismissal
   * difficult frustrates users and damages brand perception" is the failure,
   * and a close button a thumb misses IS dismissal made difficult.
   *
   * Raised on COARSE POINTERS only, which is the query that asks the actual
   * question: a mouse hits 32px without thinking about it, and 44px of
   * transparent button in the corner of a 26rem card is 44px the design does
   * not get. The glyph does not grow with the target — a bigger × is not a
   * more findable ×, it is a louder one.
   */
  `@media (pointer:coarse){.wc-close{inline-size:2.75rem;block-size:2.75rem}}`,

  // One visible focus ring for everything focusable, so the keyboard path
  // `showModal()` supplies for free is actually followable.
  `:focus-visible{outline:2px solid var(--wc-accent,#2563eb);outline-offset:2px}`,

  /*
   * ==========================================================================
   * REDUCED MOTION IS NOT A PREFERENCE THIS PLUGIN GETS TO WEIGH.
   * ==========================================================================
   * A visitor who has asked their operating system for less motion has asked
   * every site, and an overlay is the one piece of UI they cannot look away
   * from. So it is a blanket rule at the end of the sheet rather than a
   * per-rule opt-out somebody has to remember on the next animated thing —
   * `!important` wins whatever order the rules land in, and the last line is
   * where the next author looks for "and what about…".
   *
   * `.01ms` rather than `0`, and that is load-bearing: a zero-length
   * transition fires no `transitionend`, and Pro's popover holds its own
   * REMOVAL behind exactly that event. At `0` a reduced-motion visitor would
   * press Close on an overlay that never finishes closing.
   */
  `@media (prefers-reduced-motion:reduce){*{transition-duration:.01ms!important;animation-duration:.01ms!important}}`,

  /* ------------------------------------------------------------------------
   * A SECOND BAG PER BOX, AND ONE RULE IS THE WHOLE RUNTIME OF IT.
   *
   * ========================================================================
   * INLINE STYLE HAS NO CONDITIONAL FORM, SO THE SWITCH LIVES HERE.
   * ========================================================================
   * A token bag is written with `setProperty` and there is no `@media` form of
   * that; a stylesheet, conversely, cannot name one node in a tree it has
   * never seen. The bridge is a MIRROR: `render.ts` writes a retuned box's
   * values under `--wc-n-*`, and this remaps every one of them onto the name
   * the rest of the stylesheet already reads.
   *
   * **`!important`, because it has to beat an inline declaration.** The wide
   * bag is on the element's own `style`, which outranks every stylesheet rule
   * that is not important. Inside a shadow root the only thing this can
   * outrank is the design's own inline properties, which is precisely what it
   * is for.
   *
   * **`[data-narrow]` is the correctness argument, not an optimisation.**
   * `--wc-n-bg` inherits, so an ungated remap would fire on every descendant:
   * a child of a retuned box that sets its OWN `bg` and no narrow bag would be
   * repainted with its ancestor's narrow ground. Gated, a box with no narrow
   * bag is untouched at every width and inherits its ancestor's already-remapped
   * value the ordinary way — which is what a scope means.
   *
   * **A name in neither bag resolves to nothing, and that is the fallback.**
   * `var(--wc-n-fg)` with `--wc-n-fg` unset is invalid at computed-value time,
   * which for a custom property means *inherit* — so the remap needs no
   * fallback and cannot accidentally pin a value the box never set.
   *
   * A CONTAINER query and not a media query, for the reason ADR 0062's own
   * inspector query gives: an `inline` Optin in a sidebar is narrow on a
   * desktop, and the viewport would call it wide. `.wc-root` is the container,
   * declared above.
   * --------------------------------------------------------------------- */
  `@container wc (max-width:24rem){.wc-stack[data-narrow],.wc-row[data-narrow],.wc-split[data-narrow],.wc-grid[data-narrow],.wc-panel[data-narrow],.wc-media[data-narrow],.wc-leaf[data-narrow]{--wc-bg:var(--wc-n-bg)!important;--wc-fg:var(--wc-n-fg)!important;--wc-muted:var(--wc-n-muted)!important;--wc-accent:var(--wc-n-accent)!important;--wc-accent-fg:var(--wc-n-accent-fg)!important;--wc-border:var(--wc-n-border)!important;--wc-input-bg:var(--wc-n-input-bg)!important;--wc-font:var(--wc-n-font)!important;--wc-heading-font:var(--wc-n-heading-font)!important;--wc-heading-size:var(--wc-n-heading-size)!important;--wc-heading-weight:var(--wc-n-heading-weight)!important;--wc-tracking:var(--wc-n-tracking)!important;--wc-text-size:var(--wc-n-text-size)!important;--wc-leading:var(--wc-n-leading)!important;--wc-radius:var(--wc-n-radius)!important;--wc-pad:var(--wc-n-pad)!important;--wc-gap:var(--wc-n-gap)!important;--wc-width:var(--wc-n-width)!important;--wc-align:var(--wc-n-align)!important;--wc-bg-image:var(--wc-n-bg-image)!important;--wc-overlay:var(--wc-n-overlay)!important;--wc-shadow:var(--wc-n-shadow)!important;--wc-motion:var(--wc-n-motion)!important;--wc-backdrop:var(--wc-n-backdrop)!important}}`,
].join('');
