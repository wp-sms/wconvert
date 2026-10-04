import type {
  BadgeNode,
  ButtonNode,
  CodeNode,
  ConsentNode,
  EyebrowNode,
  FieldNode,
  FollowupNode,
  HeadingNode,
  IconNode,
  ImageNode,
  RatingNode,
  SlotLink,
  SplitNode,
  TemplateNode,
  TemplateTree,
  TextNode,
  Tokens,
} from './types';

/**
 * The renderer: (tree, tokens) in, DOM out.
 *
 * Same inputs, same DOM. Clipboard access happens only in the visitor’s click
 * handler; rendering itself performs no ambient reads.
 * It asks nothing of the document it will be attached to, nothing of the site
 * it is running on, and nothing of the Optin it came from. That is what lets
 * the admin import this exact module and render the real template into a
 * gallery card, so there are no static thumbnails to produce or to let go
 * stale (ADR 0010).
 */

/** Token custom properties are prefixed, so a token cannot collide with anything else. */
const TOKEN_PREFIX = '--wc-';

/**
 * The same names again, for the narrow bag. {@see retune} for why there is a
 * second set rather than a conditional first one.
 */
const NARROW_PREFIX = '--wc-n-';

// Only the visitor build removes editor addresses; admin and tests keep them.
// This changes bookkeeping, never the template vocabulary or its appearance.
declare const __WCONVERT_VISITOR__: boolean;
const EDITABLE = typeof __WCONVERT_VISITOR__ === 'undefined' || !__WCONVERT_VISITOR__;

/**
 * Render one step of a template.
 *
 * The returned element is **the first element inside the shadow host**, and
 * everything load-bearing lives on it: the tokens, the base typography, the
 * panel's own box. Nothing goes on the host, because a normal declaration in
 * the outer tree beats a normal `:host` rule — OceanWP's reset names `div` and
 * pushed its body font across the boundary that way (ADR 0009).
 */
export function render(tree: TemplateTree, tokens: Tokens, step = 0, options: RenderOptions = {}): HTMLElement {
  const screen = tree.steps[step];
  const node = screen?.content;

  // A submit button outside a form submits nothing, so the step that holds one
  // IS the form. Which step that is follows from the tree, so this stays a
  // pure property of (tree, tokens) rather than something the caller declares.
  const root = document.createElement(screen?.kind === 'input' ? 'form' : 'div');

  root.className = 'wc-root';

  scope(root, tokens);

  if (node !== undefined) {
    appendNode(root, node, tokens, EDITABLE && options.paths === true ? String(step) : null);
  }

  if (screen?.kind === 'input' && screen.details_note?.trim()) {
    const note = document.createElement('p'); note.className = 'wc-text wc-capture-note'; note.textContent = screen.details_note;
    const heading = root.querySelector('h1,h2,h3'); if (heading) heading.after(note); else root.prepend(note);
  }

  if (screen?.kind === 'result' && journeyResult) {
    root.prepend(journeyResult(screen));
    root.classList.add('wc-stack');
  }

  return root;
}

/**
 * What the caller wants beyond the design itself.
 *
 * ============================================================================
 * ONE OPTION, AND IT IS OFF FOR EVERY VISITOR ON EVERY PAGE.
 * ============================================================================
 * `paths` stamps every element with its own address in the tree, which is what
 * makes the builder's preview an editing surface rather than a picture: a
 * `panel` and a `split` carry no [[Slot Role]] and no capture kind, so before
 * this there was nothing on them for a click to name — and a scope editor whose
 * primary gesture is *select that box* could not select a box.
 *
 * **An option rather than always on**, because an address is bytes on every
 * element of every design on every page an Optin matches. ADR 0010's payload
 * budget is what that would spend, and a visitor has nothing to select. The
 * builder asks; `mount()`'s default is silence.
 *
 * **It is not a capability**, which is the half ADR 0040 cared about: an
 * address in the DOM of a closed shadow root inside wp-admin lets nothing
 * write that could not already. The admin holds the tree and PATCHes it; the
 * preview reports where a press landed and stops there, exactly as it did when
 * it reported a Role.
 */
export interface RenderOptions {
  /**
   * Stamp `data-path` on every element, so a caller holding the tree can name
   * what was clicked. Off by default — see above.
   */
  readonly paths?: boolean;
}

let suppliedLeaf: ((node: TemplateNode) => HTMLElement | null) | undefined;
export function registerLeafRenderer(render: (node: TemplateNode) => HTMLElement | null): void { suppliedLeaf = render; }

let journeyQuestion: ((node: TemplateNode) => HTMLElement) | undefined;
let journeyResult: ((screen: TemplateTree['steps'][number]) => HTMLElement) | undefined;

/** Pro supplies its renderer in the same compiled bundle before mounting. */
export function registerJourneyRenderer(implementation: {
  question(node: TemplateNode): HTMLElement;
  result(screen: TemplateTree['steps'][number]): HTMLElement;
}): void {
  journeyQuestion = implementation.question;
  journeyResult = implementation.result;
}

/**
 * Colour names a token's VALUE may be, so a scope can follow the theme.
 *
 * ============================================================================
 * WITHOUT IT, EVERY SCOPE IS A HEX AND A THEME MOVES NOTHING INSIDE ONE.
 * ============================================================================
 * A theme sets the design's colours; a scoped bag re-declares them further in
 * (ADR 0062). Written verbatim, `{"bg":"#263f2c"}` on a panel is a colour that
 * survives every theme the merchant tries — so the deeper a design is styled,
 * the less a theme does, and the box they most want to follow the palette is
 * the one that never will.
 *
 * `{"bg":"accent"}` follows it. And it follows it **in CSS rather than here**:
 * the value becomes `var(--wc-accent)`, which resolves at the element against
 * whatever is in scope, at no cost to this module and with no resolution order
 * to get wrong. A theme applied after the render moves it too.
 *
 * **Closed to the six colours**, because those are the ones a palette is made
 * of and a `pad` that follows `gap` is a coincidence rather than an intent. It
 * is asserted against the manifest's own `referable` section by
 * `renderer-manifest-parity`, exactly as {@link SAFE_SCHEMES} is — the renderer
 * still imports no manifest.
 */
export const REFERABLE = ['bg', 'fg', 'muted', 'accent', 'accent-fg', 'border', 'input-bg'];

/**
 * Write a token bag onto one element, as the custom properties it names.
 *
 * ============================================================================
 * THE SAME THREE LINES AT TWO SCOPES, WHICH IS WHY THERE IS A FUNCTION.
 * ============================================================================
 * The design's own tokens land on `.wc-root`; a layout's bag lands on that
 * layout's element. Custom properties inherit, so the second is the first
 * re-declared further in — a panel with `--wc-bg` set paints everything inside
 * it and nothing outside, at no runtime cost beyond the `setProperty` calls
 * (ADR 0062).
 *
 * **Nothing here checks the names.** The 22 are closed and
 * `TemplateVocabulary` drops anything outside them on the way in, at both
 * scopes, through one private `tokens()`. This module is handed a bag that has
 * already been through it — the same bargain the whole renderer takes with the
 * tree it draws.
 *
 * The VALUES are unvalidated too, and that is what makes {@link REFERABLE} the
 * renderer's call rather than the boundary's: a value naming a colour token
 * becomes a reference to it, and every other value is written exactly as it
 * was. A name referring to itself is written verbatim as well — `var(--wc-bg)`
 * on `--wc-bg` is a cycle CSS discards, which would silently unset the one
 * property the author was trying to set.
 */
function scope(element: HTMLElement, tokens: Tokens | undefined, prefix = TOKEN_PREFIX): void {
  for (const [name, value] of Object.entries(tokens ?? {})) {
    element.style.setProperty(
      prefix + name,
      /*
        **A reference always points at the WIDE name**, at both prefixes. A
        narrow bag saying `{"bg":"accent"}` means *follow the accent* — and
        `--wc-n-accent` exists only on a box that carries a narrow bag, so
        pointing the mirror at itself would resolve to nothing on most of them.
      */
      value !== name && REFERABLE.includes(value)
        // Secondary actions can follow foreground even in an unstyled template.
        // Match the root's CSS fallback when that optional token is absent.
        ? `var(${TOKEN_PREFIX}${value}${value === 'fg' ? ',#111827' : ''})` : value,
    );
  }
}

/**
 * Append one node, or skip it.
 *
 * **Skipping is the whole point.** An Optin takes a COPY of its Template's
 * tree, so a snapshot outlives the vocabulary it was drawn from; a node type
 * this build has never heard of therefore has to be survivable, and throwing
 * would take the whole Optin off the page for one unrecognised leaf
 * (ADR 0010).
 */
function appendNode(parent: HTMLElement, node: TemplateNode, scoped: Tokens, at: string | null): void {
  // A slot the merchant switched off in the settings panel. Skipped rather
  // than removed from the tree, because the panel edits content and visibility
  // and never arrangement — so switching it back on is one click and not a
  // Template the merchant has to pick again (ADR 0010).
  if ((node as { hidden?: unknown }).hidden === true) {
    return;
  }

  const element = elementFor(node, scoped, at);

  if (element === null) {
    return;
  }

  // Layouts apply their bags while descending. Leaves can scope their own appearance too.
  if (!['stack', 'row', 'grid', 'split', 'panel', 'media'].includes(node.type)) {
    const styled = node as { tokens?: Tokens; narrow?: Tokens };
    if (styled.tokens !== undefined || styled.narrow !== undefined) {
      element.classList.add('wc-leaf');
      scope(element, styled.tokens);
      retune(element, { ...scoped, ...styled.tokens }, styled.narrow);
    }
  }

  const role = (node as { role?: string }).role;

  // The Role reaches the DOM because two things downstream need it: the
  // stylesheet, which makes fine print smaller and muted without a class per
  // slot, and the settings panel, which edits slot content BY Role.
  if (role === 'fine_print' || (EDITABLE && typeof role === 'string' && role !== '')) {
    element.dataset.role = role;
  }

  // Editor metadata is compiled out of the visitor build. A field has no Role
  // of its own — its Roles are DERIVED from what it
  // captures (CONTEXT.md, Slot Role) — so the key the panel heads it with is
  // the capture kind, and that is what has to reach the DOM for the builder's
  // preview to be clickable back to it (ADR 0040). The loader never reads it.
  if (EDITABLE) {
    const captures = (node as { name?: string }).name;
    if (node.type === 'field' && typeof captures === 'string' && captures !== '') {
      element.dataset.captures = captures;
    }
  }

  // Where this node sits in the tree, for a caller that holds one. Written
  // only where {@link RenderOptions.paths} asked, so a visitor's page carries
  // none of it.
  if (EDITABLE && at !== null) {
    element.dataset.path = at;
  }

  parent.append(element);
}

function elementFor(node: TemplateNode, scoped: Tokens, at: string | null): HTMLElement | null {
  const supplied = suppliedLeaf?.(node);
  if (supplied) return supplied;
  switch (node.type) {
    case 'stack':
    case 'row':
    case 'grid':
    case 'panel':
    case 'media':
      return layout(node, scoped, at);
    case 'split':
      return split(node as SplitNode, scoped, at);
    case 'heading':
      return heading(node as HeadingNode);
    case 'text':
      return sentence('p', sized('wc-text', (node as TextNode).size), node as TextNode);
    case 'eyebrow':
      return words('p', 'wc-eyebrow', (node as EyebrowNode).text);
    case 'badge':
      return badge(node as BadgeNode);
    case 'divider':
      return divider();
    case 'countdown':
      return countdown();
    case 'code':
      return code(node as CodeNode, at);
    case 'rating':
      return rating(node as RatingNode);
    case 'icon':
      return icon(node as IconNode);
    case 'image':
      return image(node as ImageNode);
    case 'field':
      return field(node as FieldNode);
    case 'question':
      return journeyQuestion?.(node) ?? null;
    case 'button':
    case 'followup':
      return button(node as ButtonNode | FollowupNode);
    case 'consent':
      return consent(node as ConsentNode);
    default:
      return null;
  }
}

function layout(
  node: TemplateNode & {
    children?: readonly TemplateNode[];
    tokens?: Tokens;
    narrow?: Tokens;
    edges?: string;
    min?: string | number;
    notch?: boolean;
  },
  scoped: Tokens,
  at: string | null,
): HTMLElement {
  const element = document.createElement('div');

  element.className = `wc-${node.type}`;

  /*
   * **The floor under a box that draws a picture**, and it is declared by the
   * two layouts that can. `min` IS on a scale, so it is a custom property —
   * the same shape `split.ratio` has — and the manifest is what says which
   * layouts offer it, so a third one arrives here for free.
   */
  if (node.min !== undefined) {
    element.style.setProperty(TOKEN_PREFIX + 'min', String(node.min));
  }

  /*
   * ==========================================================================
   * A BOX THAT PAINTS INHERITS THE DESIGN'S COLOURS AND NOT ITS PHOTOGRAPH.
   * ==========================================================================
   * Every other token is wanted further in: a panel with no bag should read as
   * the design it is inside. `bg-image` is the exception, and it is not a
   * taste call — `.wc-panel` paints the same two background layers `.wc-root`
   * does, so a design with one picture would paint it AGAIN, cover and
   * centred, inside every panel in it. Reset before the bag rather than after,
   * so a photo pane's own `bg-image` still wins.
   *
   * `overlay` goes with it because an overlay is a wash over that picture; a
   * box that wants one over its own ground says so in its bag.
   *
   * **`media` takes the same reset for the same reason**, and it is the case
   * that makes the rule read oddly: a media with no picture in its bag draws
   * the design's ground rather than its photograph, which is an empty box
   * waiting for one instead of the design's own art repeated at a second size.
   */
  const reset: Tokens =
    node.type === 'panel' || node.type === 'media' ? { 'bg-image': 'none', overlay: '#0000' } : {};

  // scope already skips an empty bag; avoid enumerating the same reset twice.
  scope(element, reset);

  if (node.type === 'panel') {
    // A modifier ATTRIBUTE and not a custom property, for the reason
    // `badge.place` is a modifier class: the parity test asserts the
    // stylesheet reads no `--wc-*` name outside the tokens and the declared
    // layout params, and an edge treatment is one of three states rather than
    // a value on a scale. `none` writes nothing, so absent and default are the
    // same markup.
    if (node.edges !== undefined && node.edges !== 'none') {
      element.dataset.edges = node.edges;
    }

    // Two circles punched out of the corners, so the merchant's own page shows
    // through them. A modifier attribute for `edges`'s reason, and `false`
    // writes nothing — a design that never heard of the param renders
    // byte-identically to one that spells the default.
    if (node.notch === true) {
      element.dataset.notch = 'true';
    }
  }

  scope(element, node.tokens);

  /*
   * **What every token resolves to HERE at mobile width**, including ancestor
   * mobile overrides. Full-width CSS still inherits the separately applied
   * `node.tokens`. This bag is only for retuning and descending. See
   * {@link retune}: the mirror it writes has to be complete, because a name
   * the remap finds unset is not inherited — it is guaranteed-invalid, and
   * falls to whatever literal the stylesheet spells beside it.
   *
   * Build one merged bag per layout, preserving inherited mobile overrides
   * without repeatedly merging or enumerating empty bags.
   */
  // Merge the inherited, reset, wide and narrow bags once, in precedence order.
  const here = { ...scoped, ...reset, ...node.tokens, ...node.narrow };

  retune(element, here, node.narrow);

  for (const [index, child] of (node.children ?? []).entries()) {
    appendNode(element, child, here, into(at, 'children', index));
  }

  return element;
}

/**
 * One step down the address, or null where nobody asked for one.
 *
 * The spelling is the ADMIN's `Path` joined on a dot — `0.children.2` — because
 * the admin is the only caller that reads it and a second spelling would be a
 * string two programs have to agree about. `slots.ts` parses it back.
 */
function into(at: string | null, key: string, index: number): string | null {
  return !EDITABLE || at === null ? null : `${at}.${key}.${index}`;
}

/**
 * The same bag again, for the width below which the design retunes.
 *
 * ============================================================================
 * ONE ATTRIBUTE AND A MIRRORED SET OF NAMES, BECAUSE INLINE STYLE HAS NO IF.
 * ============================================================================
 * A bag is written with `setProperty`, and there is no conditional form of
 * that — so the switch has to be in the stylesheet, and the stylesheet cannot
 * name one node. The mirror is what bridges the two: this writes the narrow
 * values under `--wc-n-*`, and one `@container` rule in `css.ts` remaps every
 * `--wc-n-x` onto `--wc-x` for the boxes that carry one.
 *
 * **`data-narrow` gates it, and the gate is the whole correctness argument.**
 * Without it the remap would fire on every box: `--wc-n-bg` inherits, so a
 * child of a retuned box that sets its OWN `bg` and no narrow bag would be
 * repainted with its ancestor's narrow ground. Gated, a box with no narrow bag
 * is untouched at every width and inherits its ancestor's remapped value the
 * ordinary way — which is exactly what a scope means.
 *
 * **The mirror is EVERY token in scope, not the narrow bag and not the box's
 * own.** This is the part that was wrong first time and was found in a
 * browser: an unset `var(--wc-n-heading-font)` is not *inherited*, it is
 * **guaranteed-invalid** — so the remap wiped the property and
 * `.wc-heading{font-family:var(--wc-heading-font,var(--wc-font,…))}` fell to
 * its own literal fallback. Fieldwork's serif display line came out in the
 * body face below 360px, and only there.
 *
 * So a retuned box is handed what every one of the 24 names resolves to where
 * it sits — threaded down the walk, which is the only new thing this module
 * has had to know — with the narrow bag written over the top. The remap then
 * always finds a value and needs no fallback.
 *
 * It costs 24 `setProperty` calls on a retuned box and nothing at all on every
 * other box, and it costs the PAYLOAD nothing: what is stored is the narrow
 * bag the author wrote.
 */
function retune(element: HTMLElement, here: Tokens, narrow: Tokens | undefined): void {
  if (narrow === undefined || Object.keys(narrow).length === 0) {
    return;
  }

  element.dataset.narrow = '';
  scope(element, { ...here, ...narrow }, NARROW_PREFIX);
}

/**
 * Two panes, each holding its own children.
 *
 * The panes are `start` and `end` rather than `left` and `right`, which is the
 * same reason the stylesheet is written in logical properties: writing
 * direction crosses every boundary, so RTL correctness is a matter of the
 * vocabulary never naming a physical side (ADR 0009).
 */
function split(node: SplitNode, scoped: Tokens, at: string | null): HTMLElement {
  const element = document.createElement('div');

  element.className = 'wc-split';

  scope(element, node.tokens);

  const here = { ...scoped, ...node.tokens, ...node.narrow };

  retune(element, here, node.narrow);

  if (typeof node.ratio === 'number') {
    element.style.setProperty(TOKEN_PREFIX + 'ratio', String(node.ratio));
  }

  for (const key of ['start', 'end'] as const) {
    const pane = document.createElement('div');

    pane.className = 'wc-pane';
    // A pane's own basis cannot inherit from an outer split.
    pane.style.flexBasis = node.basis ?? '12rem';

    for (const [index, child] of (node[key] ?? []).entries()) {
      appendNode(pane, child, here, into(at, key, index));
    }

    element.append(pane);
  }

  return element;
}

/**
 * A leaf that is one string and nothing else.
 *
 * `eyebrow` and `badge` are the two, and neither takes a link: a sentence with
 * a link inside it is what `text` is for, and an eyebrow reading *"LIMITED
 * TIME %s"* is a design that wanted a paragraph.
 */
/**
 * A badge, in the flow or pinned to the panel's corner.
 *
 * A modifier CLASS rather than a custom property, and that is forced rather
 * than stylistic: `renderer-manifest-parity` asserts that the only
 * `var(--wc-*)` names the stylesheet reads are declared TOKENS and layout
 * params, so a `--wc-place` would fail the build. It is also the right shape —
 * placement is one of two states, not a value on a scale.
 *
 * `inline` adds nothing, so a design that never heard of this param renders
 * byte-identically to one that spells the default. That equality is what
 * `renderer-manifest-parity`'s absent-versus-declared case checks.
 */
function badge(node: BadgeNode): HTMLElement {
  return words('span', node.place === 'corner' ? 'wc-badge wc-badge-corner' : 'wc-badge', node.text);
}

function words(tag: string, className: string, text: string | undefined): HTMLElement {
  const element = document.createElement(tag);

  element.className = className;
  lines(element, text ?? '');

  return element;
}

/**
 * Authored text, with the line breaks in it.
 *
 * ============================================================================
 * EVERY HEADLINE IN THE REFERENCE SET BREAKS ITS OWN LINE, AND `textContent`
 * ATE ALL OF THEM.
 * ============================================================================
 * *"Room⏎to grow."* is one heading and two lines, and where the break falls is
 * most of what a display headline IS — the alternative is two `heading` nodes
 * with a gap between them, which is a different thing that happens to look
 * similar at one width.
 *
 * `SlotFields` has given the merchant a `<textarea>` for this text since it
 * was written, so they could already type a newline; what happened to it was
 * that `textContent` collapsed it to a space and nothing said so.
 *
 * **Structure and never markup.** Each line is a text node and each break is a
 * real `<br>`, so this is one more place that does not reach `innerHTML`
 * (ADR 0013). An empty line writes the `<br>` and no text node, which is what
 * makes a deliberate blank line survive.
 */
function lines(element: HTMLElement, text: string): void {
  text.split('\n').forEach((line, at) => {
    if (at > 0) {
      element.append(document.createElement('br'));
    }

    if (line !== '') {
      element.append(line);
    }
  });
}

/**
 * The six glyphs, as path data this module owns.
 *
 * ============================================================================
 * THE ONE PLACE THE VOCABULARY DRAWS A SHAPE RATHER THAN A BOX OF TEXT.
 * ============================================================================
 * They are paths and not characters because the alternatives are worse in ways
 * that only show up on somebody else's machine: an emoji is a different picture
 * per platform and carries its own colour, a dingbat glyph is missing from
 * plenty of system stacks, and an icon FONT is a `@font-face` — which this
 * renderer cannot ship at all, because a face declared inside a shadow root is
 * silently ignored (see `css.ts`).
 *
 * Stroked rather than filled, at a nominal 24×24, so every one of them reads at
 * body-text size and inherits `currentColor`. `star` is the exception at use
 * rather than at declaration: {@link rating} fills it through a class, which is
 * one CSS declaration instead of a second copy of the path.
 *
 * **Exported for the admin's own picker**, which offered six NOUNS for six
 * pictures — a merchant chose *Delivery van* and found out what it drew by
 * looking at the preview (ADR 0054 rule 3). The renderer owns the paths and the
 * admin already imports this module to draw those previews, so exporting one
 * identifier is the whole cost: one source, nothing copied, and nothing new in
 * the loader (`npm run check:loader` is what says so rather than this line).
 */
export const GLYPHS: Readonly<Record<string, string>> = {
  check: 'M20 6 9 17l-5-5',
  star: 'm12 3 2.9 5.8 6.1.9-4.5 4.3 1.1 6-5.6-2.9L6.4 20l1.1-6L3 9.7l6.1-.9z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l3.5 2',
  gift: 'M20 12v9H4v-9M3 8h18v4H3zm9 13V8m0 0H8a2.5 2.5 0 0 1 0-5c3 0 4 5 4 5m0 0h4a2.5 2.5 0 0 0 0-5c-3 0-4 5-4 5',
  truck: 'M14 17V5H2v12h2m10 0h-4m4 0h1m-11 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0m9 0h1m-1 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0m4 0h2v-6l-3-4h-4',
};

/** One `<svg>` around one path, with no attribute the caller can influence. */
function glyph(name: string, className: string): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // An icon is never the only thing that says something, so it is hidden from
  // assistive technology rather than given a name the merchant did not write.
  // A tick beside "Free shipping" read out as "check, Free shipping" is noise.
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  path.setAttribute('d', GLYPHS[name] ?? '');
  svg.append(path);

  return svg;
}

/**
 * One glyph, or nothing where the name is not one of the six.
 *
 * Skipped rather than substituted, the same posture an unknown node type gets:
 * a design asking for a glyph this build does not have is better read as a
 * design with no glyph than as a design with the wrong one.
 */
function icon(node: IconNode): HTMLElement | null {
  const name = node.name ?? 'check';

  return name in GLYPHS ? wrap('span', 'wc-icon', glyph(name, 'wc-glyph')) : null;
}

/**
 * Five stars, some of them filled, and optionally a line beside them.
 *
 * The count is drawn out of five rather than out of `value`, because four stars
 * on their own read as a four-star scale rather than as four out of five —
 * which is the whole claim the design is making.
 */
function rating(node: RatingNode): HTMLElement {
  const filled = node.value === 3 || node.value === 4 ? node.value : 5;
  const stars = words('span', 'wc-stars', '');
  const element = wrap('div', 'wc-rating', stars);

  for (let at = 0; at < 5; at += 1) {
    stars.append(glyph('star', at < filled ? 'wc-glyph wc-star' : 'wc-glyph'));
  }

  if (typeof node.text === 'string' && node.text !== '') {
    element.append(words('span', 'wc-rating-text', node.text));
  }

  return element;
}

/**
 * A rule, as an `<hr>` rather than a bordered `<div>`.
 *
 * The element already MEANS a thematic break, so a screen reader announces one
 * without this vocabulary having to invent a role for it — and it is the one
 * leaf here with no words at all, so semantics is the only thing it has.
 */
function divider(): HTMLElement {
  return words('hr', 'wc-divider', '');
}

/**
 * The class the tick writes into. Exported because `mount()`'s `shell()` is
 * what finds these — the renderer draws the shape and no time at all, so that
 * one string is the whole seam between a pure render and a live clock.
 */
export const COUNTDOWN_SLOT = 'wc-count';

/**
 * The countdown, drawn empty.
 *
 * ============================================================================
 * `role="timer"` CARRIES AN IMPLICIT `aria-live="off"`, AND THAT IS WHY IT IS
 * THE RIGHT ROLE.
 * ============================================================================
 * A ticking display announced every second is unusable, and the two obvious
 * spellings both do it: `aria-live="polite"` on a value that changes once a
 * second queues an announcement a second, and `role="status"` is
 * `aria-live="polite"` under another name. `timer` is the role for exactly this
 * — a numerical counter — and it is silent until something asks.
 *
 * `aria-atomic` so what is read is the whole time rather than the digit that
 * changed. Nothing here escalates to `assertive`: an offer expiring is not an
 * emergency, and there is no milestone in the vocabulary to escalate at.
 *
 * The label is English, exactly as the close button's is, and for the same
 * reason: the loader is a raw IIFE with no `wp.i18n` dependency, and adding one
 * would put a second script on the page for one string.
 *
 * **It renders the shape and no time**, because `render()` asks nothing of the
 * world it will be attached to — including what time it is. `shell()` fills it
 * and keeps filling it.
 */
function countdown(): HTMLElement {
  const value = document.createElement('span');

  value.className = COUNTDOWN_SLOT;
  const element = wrap('div', 'wc-countdown', value);
  element.setAttribute('role', 'timer');
  element.setAttribute('aria-atomic', 'true');
  element.setAttribute('aria-label', 'Time remaining');

  return element;
}

/** One element around one child, so the SVG has a box the layout can size. */
function wrap(tag: string, className: string, child: Node): HTMLElement {
  const element = document.createElement(tag);

  element.className = className;
  element.append(child);

  return element;
}

/**
 * A step on the type scale, as a modifier class.
 *
 * ============================================================================
 * A CLASS AND NOT A CUSTOM PROPERTY, AND THAT IS FORCED RATHER THAN STYLISTIC.
 * ============================================================================
 * `renderer-manifest-parity` asserts the stylesheet reads no `--wc-*` name
 * outside the declared tokens and the declared LAYOUT params — node params are
 * excluded — so a `--wc-size`, or a `--wc-scale` under any name, would fail the
 * build. The same rule `badge.place` and `image.shape` are already modifier
 * classes for.
 *
 * **`m` adds nothing**, so a design that never heard of this param renders
 * byte-identically to one that spells the default. That equality is what the
 * absent-versus-declared case checks.
 */
function sized(className: string, size: string | undefined): string {
  return size === undefined || size === 'm' ? className : `${className} wc-${size}`;
}

function heading(node: HeadingNode): HTMLElement {
  return words(node.level === 2 ? 'h3' : 'h2', sized('wc-heading', node.size), node.text);
}

/**
 * Text and consent may hold one link, one bold phrase and one italic phrase.
 * Named for the sentence shape because the rule is the same for both.
 */
type Sentence = Pick<TextNode | ConsentNode, 'text' | 'link' | 'emphasis' | 'italic'>;

/**
 * The placeholders a sentence may carry, and the only reason a leaf holds
 * more than a string (ADR 0013).
 *
 * ============================================================================
 * TWO MARKS RATHER THAN ONE FILLER FOR ONE MARK, AND THAT IS WHAT REMOVES THE
 * AMBIGUITY.
 * ============================================================================
 * `%s` was alone while a link was the only structure a sentence could hold.
 * Emphasis is the second, and giving it the same mark would mean a sentence
 * carrying both had one slot and two claimants — a rule about which wins,
 * decided in this file, that nothing on the merchant's screen could explain.
 *
 * So *"Take %b off, and read our %s."* is one sentence with both, and the
 * split does the telling apart. `%b` for bold, beside `%s` for string, which
 * is the spelling the merchant already meets in `SlotFields`.
 */
const PLACEHOLDER = '%s';
const EMPHASIS = '%b';
const ITALIC = '%i';

/** All marks, kept by the split so each piece is either text or a mark. */
const MARKS = /(%s|%b|%i)/;

/** All marks with the space in front, for the pass that removes an unfilled one. */
const UNFILLED = / ?(%s|%b|%i)/g;

/**
 * Schemes an `<a>` may carry.
 *
 * PHP scheme-validates the href at write (ADR 0013), and this is not a second
 * spelling of that rule so much as the same rule where the first one cannot
 * reach: the admin renders a tree through this module BEFORE it has been
 * written, so a preview is a live render of unvalidated input.
 *
 * Exported so it can be ASSERTED against the manifest PHP reads, rather than
 * being a second hand-maintained list. The renderer still does not import the
 * manifest — the test does, from both sides, exactly as the rule vocabulary's
 * parity tests do.
 */
export const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

/**
 * A sentence that may hold a link, bold and italic phrases, built as
 * STRUCTURE and never as markup.
 *
 * The text is split on the placeholders and its elements are constructed
 * here, so no code path in the renderer reaches `innerHTML` — which is what
 * keeps an XSS sink out of the loader's hot path (ADR 0013).
 *
 * With no href the link renders NOTHING, and its placeholder goes with it
 * along with the space in front of it. Never a dead `#`: a site with no
 * privacy policy configured has no link to offer, and offering a broken one is
 * worse than offering none (ADR 0032). An absent emphasis is treated
 * identically — one rule for both marks rather than two that could drift.
 */
function sentence(tag: string, className: string, node: Sentence): HTMLElement {
  const element = document.createElement(tag);
  const href = safeHref(node.link?.href);

  element.className = className;

  // No link, no destination for one, or no emphasis to lift: the mark renders
  // nothing and the space in front of it goes too. A word appended to the end
  // of a sentence that had no place for it is evidence of a sentence nobody
  // wrote.
  const anchor =
    node.link === undefined || href === null ? null : link(node.link.label, href);
  const strong =
    node.emphasis ? words('strong', 'wc-strong', node.emphasis) : null;

  const italic = node.italic ? words('em', 'wc-italic', node.italic) : null;

  fill(element, node.text ?? '', anchor, strong, italic);

  return element;
}

function link(label: string, href: string): HTMLElement {
  const anchor = document.createElement('a');

  anchor.className = 'wc-link';
  anchor.href = href;
  anchor.textContent = label;
  anchor.rel = 'noopener';

  return anchor;
}

/**
 * One sentence's text, its line breaks, and whatever fills its marks.
 *
 * Two passes over the string and no branch per mark: the first removes a mark
 * nothing fills, the second splits on what is left. A piece that is a mark is
 * the element for it; every other piece is text, and goes through
 * {@link lines} so a sentence breaks its own line exactly as a heading does.
 */
function fill(element: HTMLElement, text: string, anchor: Node | null, strong: Node | null, italic: Node | null): void {
  const parts = new Map<string, Node | null>([[PLACEHOLDER, anchor], [EMPHASIS, strong], [ITALIC, italic]]);
  const stripped = text.replace(UNFILLED, (whole, mark: string) => (parts.get(mark) === null ? '' : whole));

  for (const piece of stripped.split(MARKS)) {
    // Map has no prototype keys: authored words such as "constructor" stay text.
    const part = parts.get(piece) ?? null;

    if (part !== null) {
      /*
       * **One link, bold and italic phrase per sentence, and a second mark of the
       * same kind is literal text.** The rule predates emphasis — it is what
       * `[before, ...after].join(PLACEHOLDER)` did — and it is asserted from
       * both sides by `tests/fixtures/consent-sentences.json`, because
       * `WConvert\Lead\ConsentRecord` composes the same sentence in PHP for
       * the Consent Record and evidence that disagrees with what was shown is
       * evidence of nothing.
       */
      parts.set(piece, null);
      element.append(part);
      continue;
    }

    lines(element, piece);
  }
}

export function safeHref(href: SlotLink['href']): string | null {
  if (typeof href !== 'string' || href === '') {
    return null;
  }

  try {
    // A base is supplied so a relative href — which a site-resolved policy URL
    // may well be — parses at all. It is never used in the output.
    return SAFE_SCHEMES.includes(new URL(href, 'https://x.invalid').protocol) ? href : null;
  } catch {
    return null;
  }
}

function image(node: ImageNode): HTMLElement | null {
  if (typeof node.src !== 'string' || node.src === '') {
    return null;
  }

  const element = document.createElement('img');

  element.className = 'wc-image';
  element.setAttribute('src', node.src);
  // Always set, never omitted. An image slot the merchant left undescribed is
  // decorative, and an alt-less <img> is the one an assistive technology reads
  // the filename of.
  element.alt = node.alt ?? '';
  element.loading = 'lazy';

  if (node.fit === 'contain') {
    element.style.setProperty('object-fit', 'contain');
  }

  // A circle is the one shape `--wc-radius` cannot give one picture without
  // rounding the panel, the button and every input to match. `rect` adds
  // nothing, so a design without the param is unchanged.
  if (node.shape === 'circle') {
    element.className = 'wc-image wc-image-circle';
  }

  return element;
}

/**
 * What each field kind captures: the input type that gets the right keyboard,
 * and the autofill token that lets a browser fill it.
 */
const FIELD_KINDS: Readonly<Record<string, { type: string; autocomplete: AutoFill; label: string; maxLength?: number }>> = {
  email: { type: 'email', autocomplete: 'email', label: 'Email address', maxLength: 254 },
  phone: { type: 'tel', autocomplete: 'tel', label: 'Phone number', maxLength: 64 },
  name: { type: 'text', autocomplete: 'name', label: 'Name', maxLength: 200 },
  interest: { type: 'select', autocomplete: 'off', label: 'Interested in' },
};

/**
 * One captured value, with its label bound to it.
 *
 * The id is derived from the field's name rather than generated, because a
 * generated one would make two renders of the same tree differ — and the whole
 * point of this module is that they do not. Two fields of one kind cannot
 * collide, because the capture kind is what the id is derived FROM and a
 * second field of a kind already on the form is refused by the editor and by
 * the capture path (`builder/structure/catalogue.ts`, CONTEXT.md Slot Role).
 * That argument used to be made through Slot Role uniqueness, which no longer
 * holds and never was the load-bearing half of it (ADR 0051).
 */
function field(node: FieldNode): HTMLElement | null {
  const name = node.name ?? '';
  const kind = FIELD_KINDS[name];

  // A field capturing nothing this build knows how to canonicalise is skipped,
  // the same posture an unknown node type gets.
  if (kind === undefined) {
    return null;
  }

  const label = document.createElement('label');
  const input = document.createElement(kind.type === 'select' ? 'select' : 'input');

  input.id = `wc-${name}`;
  input.className = 'wc-input';
  input.name = name;
  if (node.id) input.dataset.captureId = node.id;
  input.required = node.required === true;
  if (name === 'phone') {
    input.dataset.pc = node.phone_country || '';
    input.dataset.pd = node.phone_dropdown === false ? '0' : '';
  }
  input.autocomplete = kind.autocomplete;
  if (input instanceof HTMLSelectElement) {
    input.add(new Option(node.placeholder || 'Choose an option', ''));
    for (const choice of Array.isArray(node.options) ? node.options : []) {
      if (choice && typeof choice.label === 'string' && typeof choice.value === 'string') input.add(new Option(choice.label, choice.value));
    }
  } else {
    input.type = kind.type;
    if (kind.maxLength !== undefined) input.maxLength = kind.maxLength;
    input.placeholder = node.placeholder?.trim() ? node.placeholder : '';
    input.inputMode = kind.type;
    if (name !== 'name') {
      input.setAttribute('autocapitalize', 'none');
      input.spellcheck = false;
    }
  }

  label.className = 'wc-label';
  label.htmlFor = input.id;
  label.textContent = node.label?.trim() ? node.label : kind.label;

  if (input.required) {
    const required = document.createElement('span');

    // The native required attribute already announces this to assistive tech.
    required.setAttribute('aria-hidden', 'true');
    required.textContent = ' *';
    label.append(required);
  }

  const wrapper = wrap('div', 'wc-field', label);
  wrapper.append(input);
  if (name === 'phone') {
    const hint = document.createElement('small');
    hint.className = 'wc-phone-fallback';
    hint.textContent = (window as Window & { __wcPhoneLabels?: Record<string, string> }).__wcPhoneLabels?.fallback
      || 'Include + and the country code, for example +1 202 555 0123.';
    hint.id = `${input.id}-hint`;
    input.setAttribute('aria-describedby', hint.id);
    wrapper.append(hint);
  }

  return wrapper;
}

/** Copying is optional; the readable code remains available when clipboard access fails. */
function code(node: CodeNode, at: string | null): HTMLElement {
  const value = words('span', 'wc-code', node.text);
  if (!node.copy) return value;
  const wrapper = wrap('div', 'wc-stack', value);
  const copy = words('button', 'wc-button', node.copy_label || 'Copy code') as HTMLButtonElement;
  copy.type = 'button';
  const status = words('span', 'wc-text', '');
  status.setAttribute('role', 'status');
  wrapper.append(copy, status);
  // A selectable preview has addresses and edits the block instead of copying.
  if (!EDITABLE || at === null) copy.addEventListener('click', async () => {
    copy.disabled = true;
    try {
      await navigator.clipboard.writeText(node.text ?? '');
      status.textContent = node.copied_label || 'Copied';
    } catch {
      status.textContent = node.copy_failed_label || 'Copy failed. Select the code.';
    } finally {
      copy.disabled = false;
    }
  });
  return wrapper;
}

/**
 * The converting act, in one of its two spellings.
 *
 * `submit` is a form submission and `link` is a navigation, and one Optin has
 * exactly one converting act — a Template offering both is rejected when it is
 * registered rather than disambiguated here (CONTEXT.md, Conversion).
 */
function button(node: ButtonNode | FollowupNode): HTMLElement {
  const label = node.label ?? '';

  if (node.type === 'followup' || node.action === 'link') {
    const anchor = document.createElement('a');
    const href = safeHref(node.href);

    anchor.className = 'wc-button';
    anchor.textContent = label;
    anchor.rel = 'noopener';
    if (node.type === 'button') anchor.dataset.convert = '';

    if (href !== null) {
      anchor.href = href;
    }

    return anchor;
  }

  const element = document.createElement('button');

  element.className = 'wc-button';
  const action = node.action ?? 'next';
  element.type = action === 'submit' || action === 'next' ? 'submit' : 'button';
  element.dataset.action = action;
  if (node.submission) element.dataset.submission = node.submission;
  element.textContent = label;

  return element;
}

/**
 * The consent checkbox — required once present, because an OPTIONAL one
 * captures Leads whose consent was explicitly refused, which is worse than
 * never asking (ADR 0032).
 *
 * The wording is a sentence like any other, so it reaches the same structured
 * link the fine print does; enforcement is server-side and lands with capture,
 * since the capture endpoint is public and a client-side check is decoration.
 */
function consent(node: ConsentNode): HTMLElement {
  const wrapper = document.createElement('div');
  const label = sentence('label', 'wc-consent-text', node);
  const box = document.createElement('input');

  box.id = 'wc-consent';
  box.className = 'wc-checkbox';
  box.type = 'checkbox';
  box.name = 'consent';
  if (node.id) box.dataset.captureId = node.id;
  box.required = true;

  label.setAttribute('for', box.id);
  wrapper.className = 'wc-consent';
  wrapper.append(box, label);

  return wrapper;
}
