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
export const SHADOW_CSS = [
  `:host{all:initial!important;display:block!important}`,
  `*,::before,::after{box-sizing:border-box}`,

  // One element in: this is where positioning, stacking and base typography
  // are allowed to live.
  `.wc-root{font-family:var(--wc-font,system-ui,sans-serif);font-size:var(--wc-text-size,1rem);line-height:1.5;color:var(--wc-fg,#111827);background:var(--wc-bg,#fff);border-radius:var(--wc-radius,.5rem);padding:var(--wc-pad,1.5rem);text-align:var(--wc-align,start);inline-size:min(var(--wc-width,28rem),100%);max-block-size:85vh;overflow:auto;position:relative;box-shadow:0 10px 40px rgba(0,0,0,.18)}`,

  `.wc-stack{display:flex;flex-direction:column;gap:var(--wc-gap,.75rem)}`,
  `.wc-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--wc-gap,.75rem)}`,
  `.wc-grid{display:grid;grid-template-columns:repeat(var(--wc-columns,2),minmax(0,1fr));gap:var(--wc-gap,.75rem)}`,

  // `flex-basis` plus `wrap` is what stacks the two panes on a narrow screen,
  // with no media query and no container query to keep in step.
  `.wc-split{display:flex;flex-wrap:wrap;gap:var(--wc-gap,.75rem);align-items:center}`,
  `.wc-pane{flex:1 1 12rem;min-inline-size:0}`,
  `.wc-pane:first-child{flex-grow:var(--wc-ratio,.5)}`,
  `.wc-pane:last-child{flex-grow:calc(1 - var(--wc-ratio,.5))}`,

  `.wc-heading{margin:0;font-size:var(--wc-heading-size,1.5rem);font-weight:700;line-height:1.2}`,
  `.wc-text{margin:0}`,
  `[data-role=fine_print]{font-size:.8125em;color:var(--wc-muted,#6b7280)}`,
  `.wc-link{color:inherit}`,
  `.wc-image{display:block;inline-size:100%;block-size:auto;object-fit:cover;border-radius:var(--wc-radius,.5rem)}`,

  `.wc-field{display:flex;flex:1 1 12rem;flex-direction:column;gap:.25rem;text-align:start}`,
  `.wc-label{font-size:.875em;color:var(--wc-muted,#6b7280)}`,
  `.wc-input{inline-size:100%;font:inherit;color:inherit;background:var(--wc-bg,#fff);border:1px solid var(--wc-border,#e5e7eb);border-radius:var(--wc-radius,.5rem);padding-block:.625rem;padding-inline:.75rem}`,

  `.wc-button{display:inline-block;font:inherit;font-weight:600;text-align:center;text-decoration:none;cursor:pointer;border:0;border-radius:var(--wc-radius,.5rem);background:var(--wc-accent,#2563eb);color:var(--wc-accent-fg,#fff);padding-block:.625rem;padding-inline:1.25rem}`,

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

  // One visible focus ring for everything focusable, so the keyboard path
  // `showModal()` supplies for free is actually followable.
  `:focus-visible{outline:2px solid var(--wc-accent,#2563eb);outline-offset:2px}`,
].join('');
