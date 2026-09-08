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

  // `flex-basis` plus `wrap` is what stacks the two panes on a narrow screen,
  // with no media query and no container query to keep in step.
  `.wc-split{display:flex;flex-wrap:wrap;gap:var(--wc-gap,.75rem);align-items:center}`,
  `.wc-pane{flex:1 1 12rem;min-inline-size:0}`,
  `.wc-pane:first-child{flex-grow:var(--wc-ratio,.5)}`,
  `.wc-pane:last-child{flex-grow:calc(1 - var(--wc-ratio,.5))}`,

  /*
   * **A display face is the second thing a reference-class design decides**,
   * after its palette — eight of the sixteen designs in the reference set set
   * one, and until now a design had exactly one face for everything. So
   * `heading-font` falls back to `font` rather than to a stack of its own: a
   * design that sets only `font` is unchanged to the byte, and one that sets
   * both gets a display face over body text without saying the body stack
   * twice.
   */
  `.wc-heading{margin:0;font-family:var(--wc-heading-font,var(--wc-font,system-ui,sans-serif));font-size:var(--wc-heading-size,1.5rem);font-weight:var(--wc-heading-weight,700);letter-spacing:var(--wc-tracking,normal);line-height:1.2}`,
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
  `[data-role=fine_print]{font-size:.8125em;color:var(--wc-muted,#6b7280)}`,

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
  `.wc-label{font-size:.875em;color:var(--wc-muted,#6b7280)}`,
  /*
   * **A field on a dark panel needs a ground of its own.** The input took the
   * design's `bg`, which was right while there was one surface and is wrong the
   * moment a `panel` paints a second: a white form on a navy panel had a navy
   * input with white text in it, and the one control a visitor MUST find looked
   * like the panel it sits on. `input-bg` falls back to `bg`, so every design
   * shipped before this renders identically.
   */
  `.wc-input{inline-size:100%;font:inherit;color:inherit;background:var(--wc-input-bg,var(--wc-bg,#fff));border:1px solid var(--wc-border,#e5e7eb);border-radius:var(--wc-radius,.5rem);padding-block:.625rem;padding-inline:.75rem}`,

  `.wc-button{display:inline-block;font:inherit;font-weight:600;text-align:center;text-decoration:none;cursor:pointer;border:0;border-radius:var(--wc-radius,.5rem);background:var(--wc-accent,#2563eb);color:var(--wc-accent-fg,#fff);padding-block:.625rem;padding-inline:1.25rem;transition:opacity var(--wc-motion,200ms) ease}`,
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
  `.wc-input[aria-invalid]{border-color:#b91c1c}`,

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
