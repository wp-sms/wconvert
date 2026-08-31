import type {
  ButtonNode,
  ConsentNode,
  FieldNode,
  HeadingNode,
  ImageNode,
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
      return layout(node);
    case 'split':
      return split(node as SplitNode);
    case 'heading':
      return heading(node as HeadingNode);
    case 'text':
      return sentence('p', 'wc-text', node as TextNode);
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
 * collide, because a Slot Role is unique across a Template's whole tree
 * (CONTEXT.md, Slot Role) and a field's Roles are named for what it captures.
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
