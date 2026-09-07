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
  `.wc-root{font-family:var(--wc-font,system-ui,sans-serif);font-size:var(--wc-text-size,1rem);line-height:var(--wc-leading,1.5);color:var(--wc-fg,#111827);background:var(--wc-bg,#fff);background-image:linear-gradient(var(--wc-overlay,#0000),var(--wc-overlay,#0000)),var(--wc-bg-image,none);background-size:cover;background-position:center;border-radius:var(--wc-radius,.5rem);padding:var(--wc-pad,1.5rem);text-align:var(--wc-align,start);inline-size:min(var(--wc-width,${A_DESIGNS_OWN_WIDTH}),100%);max-block-size:85vh;overflow:auto;position:relative;box-shadow:var(--wc-shadow,0 10px 40px rgba(0,0,0,.18))}`,

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

  // `flex-basis` plus `wrap` is what stacks the two panes on a narrow screen,
  // with no media query and no container query to keep in step.
  `.wc-split{display:flex;flex-wrap:wrap;gap:var(--wc-gap,.75rem);align-items:center}`,
  `.wc-pane{flex:1 1 12rem;min-inline-size:0}`,
  `.wc-pane:first-child{flex-grow:var(--wc-ratio,.5)}`,
  `.wc-pane:last-child{flex-grow:calc(1 - var(--wc-ratio,.5))}`,

  // `1.2` is a body leading, and a display heading set at it looks slack —
  // the bigger `heading-size` gets the worse it reads, which is exactly the
  // direction the library moved. `1.12` is the ratio a display face wants and
  // is still comfortable at the 1.5rem default.
  `.wc-heading{margin:0;font-size:var(--wc-heading-size,1.5rem);font-weight:var(--wc-heading-weight,700);letter-spacing:var(--wc-tracking,normal);line-height:1.12}`,
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
   * THE CORNER FLASH — THE ONE PLACEMENT 22 GLOBAL TOKENS CANNOT REACH.
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
  `.wc-image{display:block;inline-size:100%;block-size:auto;object-fit:cover;border-radius:var(--wc-radius,.5rem)}`,
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
   * A BUTTON THAT WRAPPED ONTO ITS OWN LINE FILLS IT.
   * ==========================================================================
   * `.wc-row` wraps by construction, and a field beside a button needs about
   * 20rem to stay on one line — so in any panel narrower than that the button
   * wraps and, sized to its content, sat as a small stray control under a
   * full-width field. On a centre-aligned design it sat under it and to the
   * LEFT, which reads as a broken layout.
   *
   * `flex-grow` rather than `inline-size: 100%`: growing fills whatever is
   * left on the line, so a button that wrapped alone takes the width and one
   * that did not still shares the row. The field keeps the larger basis, so a
   * one-line form still gives most of the room to the input.
   */
  `.wc-row>.wc-button{flex-grow:1}`,
  `.wc-label{font-size:.8125em;font-weight:500;color:var(--wc-muted,#6b7280)}`,
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
   * It also frees the field to keep a light ground of its own on a dark
   * design, which is what every specimen of this genre does and what
   * `--wc-bg` on a dark panel could never give.
   *
   * `color-mix` is not reachable here — the ring has to work against an
   * unknown ground — so it is a translucent black plus a translucent white,
   * one of which is always the visible one.
   */
  `.wc-input{inline-size:100%;font:inherit;color:inherit;background:var(--wc-bg,#fff);border:0;border-radius:var(--wc-radius,.5rem);box-shadow:inset 0 0 0 1px var(--wc-border,#e5e7eb);padding-block:.75rem;padding-inline:.875rem}`,

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
].join('');
