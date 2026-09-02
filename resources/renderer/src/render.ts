import type {
  BadgeNode,
  ButtonNode,
  ConsentNode,
  EyebrowNode,
  FieldNode,
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
 * Pure in the sense that matters — same inputs, same output, no ambient reads.
 * It asks nothing of the document it will be attached to, nothing of the site
 * it is running on, and nothing of the Optin it came from. That is what lets
 * the admin import this exact module and render the real template into a
 * gallery card, so there are no static thumbnails to produce or to let go
 * stale (ADR 0010).
 */

/** Token custom properties are prefixed, so a token cannot collide with anything else. */
const TOKEN_PREFIX = '--wc-';

/**
 * Render one step of a template.
 *
 * The returned element is **the first element inside the shadow host**, and
 * everything load-bearing lives on it: the tokens, the base typography, the
 * panel's own box. Nothing goes on the host, because a normal declaration in
 * the outer tree beats a normal `:host` rule — OceanWP's reset names `div` and
 * pushed its body font across the boundary that way (ADR 0009).
 */
export function render(tree: TemplateTree, tokens: Tokens, step = 0): HTMLElement {
  const node = tree.steps[step];

  // A submit button outside a form submits nothing, so the step that holds one
  // IS the form. Which step that is follows from the tree, so this stays a
  // pure property of (tree, tokens) rather than something the caller declares.
  const root = document.createElement(node !== undefined && submits(node) ? 'form' : 'div');

  root.className = 'wc-root';

  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(TOKEN_PREFIX + name, value);
  }

  if (node !== undefined) {
    appendNode(root, node);
  }

  return root;
}

/** Does this subtree hold the converting act that is a submission? */
function submits(node: TemplateNode): boolean {
  const branch = node as { children?: readonly TemplateNode[]; start?: readonly TemplateNode[]; end?: readonly TemplateNode[]; action?: string };

  if (node.type === 'button') {
    return branch.action !== 'link';
  }

  return [...(branch.children ?? []), ...(branch.start ?? []), ...(branch.end ?? [])].some(submits);
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
function appendNode(parent: HTMLElement, node: TemplateNode): void {
  // A slot the merchant switched off in the settings panel. Skipped rather
  // than removed from the tree, because the panel edits content and visibility
  // and never arrangement — so switching it back on is one click and not a
  // Template the merchant has to pick again (ADR 0010).
  if ((node as { hidden?: unknown }).hidden === true) {
    return;
  }

  const element = elementFor(node);

  if (element === null) {
    return;
  }

  const role = (node as { role?: string }).role;

  // The Role reaches the DOM because two things downstream need it: the
  // stylesheet, which makes fine print smaller and muted without a class per
  // slot, and the settings panel, which edits slot content BY Role.
  if (typeof role === 'string' && role !== '') {
    element.dataset.role = role;
  }

  // A `field` has no Role of its own — its Roles are DERIVED from what it
  // captures (CONTEXT.md, Slot Role) — so the key the panel heads it with is
  // the capture kind, and that is what has to reach the DOM for the builder's
  // preview to be clickable back to it (ADR 0040). The loader never reads it;
  // it costs the free bundle a few bytes of the budget `check-loader.mjs`
  // measures, and it is the only way a field is addressable at all.
  const captures = (node as { name?: string }).name;

  if (node.type === 'field' && typeof captures === 'string' && captures !== '') {
    element.dataset.captures = captures;
  }

  parent.appendChild(element);
}

function elementFor(node: TemplateNode): HTMLElement | null {
  switch (node.type) {
    case 'stack':
    case 'row':
    case 'grid':
      return layout(node);
    case 'split':
      return split(node as SplitNode);
    case 'heading':
      return heading(node as HeadingNode);
    case 'text':
      return sentence('p', 'wc-text', node as TextNode);
    case 'eyebrow':
      return words('p', 'wc-eyebrow', (node as EyebrowNode).text);
    case 'badge':
      return words('span', 'wc-badge', (node as BadgeNode).text);
    case 'divider':
      return divider();
    case 'countdown':
      return countdown();
    case 'rating':
      return rating(node as RatingNode);
    case 'icon':
      return icon(node as IconNode);
    case 'image':
      return image(node as ImageNode);
    case 'field':
      return field(node as FieldNode);
    case 'button':
      return button(node as ButtonNode);
    case 'consent':
      return consent(node as ConsentNode);
    default:
      return null;
  }
}

function layout(node: TemplateNode & { children?: readonly TemplateNode[] }): HTMLElement {
  const element = document.createElement('div');

  element.className = `wc-${node.type}`;

  for (const child of node.children ?? []) {
    appendNode(element, child);
  }

  return element;
}

/**
 * Two panes, each holding its own children.
 *
 * The panes are `start` and `end` rather than `left` and `right`, which is the
 * same reason the stylesheet is written in logical properties: writing
 * direction crosses every boundary, so RTL correctness is a matter of the
 * vocabulary never naming a physical side (ADR 0009).
 */
function split(node: SplitNode): HTMLElement {
  const element = document.createElement('div');

  element.className = 'wc-split';

  if (typeof node.ratio === 'number') {
    element.style.setProperty(TOKEN_PREFIX + 'ratio', String(node.ratio));
  }

  for (const children of [node.start ?? [], node.end ?? []]) {
    const pane = document.createElement('div');

    pane.className = 'wc-pane';

    for (const child of children) {
      appendNode(pane, child);
    }

    element.appendChild(pane);
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
function words(tag: string, className: string, text: string | undefined): HTMLElement {
  const element = document.createElement(tag);

  element.className = className;
  element.textContent = text ?? '';

  return element;
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
 */
const GLYPHS: Readonly<Record<string, string>> = {
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
  svg.appendChild(path);

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
  const stars = document.createElement('span');
  const element = document.createElement('div');

  stars.className = 'wc-stars';

  for (let at = 0; at < 5; at += 1) {
    stars.appendChild(glyph('star', at < filled ? 'wc-glyph wc-star' : 'wc-glyph'));
  }

  element.className = 'wc-rating';
  element.append(stars);

  if (typeof node.text === 'string' && node.text !== '') {
    element.appendChild(words('span', 'wc-rating-text', node.text));
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
  const element = document.createElement('hr');

  element.className = 'wc-divider';

  return element;
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
  const element = document.createElement('div');
  const value = document.createElement('span');

  value.className = COUNTDOWN_SLOT;
  element.className = 'wc-countdown';
  element.setAttribute('role', 'timer');
  element.setAttribute('aria-atomic', 'true');
  element.setAttribute('aria-label', 'Time remaining');
  element.appendChild(value);

  return element;
}

/** One element around one child, so the SVG has a box the layout can size. */
function wrap(tag: string, className: string, child: Node): HTMLElement {
  const element = document.createElement(tag);

  element.className = className;
  element.appendChild(child);

  return element;
}

function heading(node: HeadingNode): HTMLElement {
  const element = document.createElement(node.level === 2 ? 'h3' : 'h2');

  element.className = 'wc-heading';
  element.textContent = node.text ?? '';

  return element;
}

/**
 * The two leaves that are a sentence which may hold one link. Named for the
 * shape rather than for either node, because the rule is the same for both.
 */
type Sentence = Pick<TextNode | ConsentNode, 'text' | 'link'>;

/**
 * The one placeholder a sentence may carry, and the only reason a leaf holds
 * more than a string (ADR 0013).
 */
const PLACEHOLDER = '%s';

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
 * A sentence that may hold one link, built as STRUCTURE and never as markup.
 *
 * The text is split on the placeholder and the `<a>` is constructed here, so
 * no code path in the renderer reaches `innerHTML` — which is what keeps an
 * XSS sink out of the loader's hot path (ADR 0013).
 *
 * With no href the link renders NOTHING, and the placeholder goes with it
 * along with the space in front of it. Never a dead `#`: a site with no
 * privacy policy configured has no link to offer, and offering a broken one is
 * worse than offering none (ADR 0032).
 */
function sentence(tag: string, className: string, node: Sentence): HTMLElement {
  const element = document.createElement(tag);
  const text = node.text ?? '';
  const href = safeHref(node.link?.href);

  element.className = className;

  // No link, no destination for one, or NOWHERE TO PUT ONE: all three render
  // the sentence and no anchor. The placeholder goes with it, and the space in
  // front of it goes too. A sentence carrying no `%s` has no place for a link,
  // and appending the label to the end of it produces a word glued to the last
  // one — evidence of a sentence nobody wrote.
  if (node.link === undefined || href === null || !text.includes(PLACEHOLDER)) {
    element.textContent = text.replace(/ ?%s/g, '');

    return element;
  }

  const [before, ...after] = text.split(PLACEHOLDER);
  const anchor = document.createElement('a');

  anchor.className = 'wc-link';
  anchor.href = href;
  anchor.textContent = node.link.label;
  anchor.rel = 'noopener';

  element.append(before ?? '', anchor, after.join(PLACEHOLDER));

  return element;
}

function safeHref(href: SlotLink['href']): string | null {
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

  return element;
}

/**
 * What each field kind captures: the input type that gets the right keyboard,
 * and the autofill token that lets a browser fill it.
 */
const FIELD_KINDS: Readonly<Record<string, { type: string; autocomplete: AutoFill }>> = {
  email: { type: 'email', autocomplete: 'email' },
  phone: { type: 'tel', autocomplete: 'tel' },
  name: { type: 'text', autocomplete: 'name' },
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

  const wrapper = document.createElement('div');
  const label = document.createElement('label');
  const input = document.createElement('input');

  input.id = `wc-${name}`;
  input.className = 'wc-input';
  input.type = kind.type;
  input.name = name;
  input.placeholder = node.placeholder ?? '';
  input.required = node.required === true;
  input.autocomplete = kind.autocomplete;

  label.className = 'wc-label';
  label.htmlFor = input.id;
  label.textContent = node.label ?? '';

  wrapper.className = 'wc-field';
  wrapper.append(label, input);

  return wrapper;
}

/**
 * The converting act, in one of its two spellings.
 *
 * `submit` is a form submission and `link` is a navigation, and one Optin has
 * exactly one converting act — a Template offering both is rejected when it is
 * registered rather than disambiguated here (CONTEXT.md, Conversion).
 */
function button(node: ButtonNode): HTMLElement {
  const label = node.label ?? '';

  if (node.action === 'link') {
    const anchor = document.createElement('a');
    const href = safeHref(node.href);

    anchor.className = 'wc-button';
    anchor.textContent = label;
    anchor.rel = 'noopener';

    if (href !== null) {
      anchor.href = href;
    }

    return anchor;
  }

  const element = document.createElement('button');

  element.className = 'wc-button';
  element.type = 'submit';
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
  box.required = true;

  label.setAttribute('for', box.id);
  wrapper.className = 'wc-consent';
  wrapper.append(box, label);

  return wrapper;
}
