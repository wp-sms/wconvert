import vocabulary from '../../../templates/manifest.json';
import type { TemplateNode, TemplateTree, Tokens } from '@renderer/types';

/**
 * The settings panel's model of a design: tokens, slot content and slot
 * visibility, over a tree it never restructures.
 *
 * ============================================================================
 * THE PANEL OFFERS NO WAY TO CHANGE ARRANGEMENT, AND THAT IS THE POINT.
 * ============================================================================
 * The vocabulary is the ceiling on design variety and the gallery IS the
 * design surface (ADR 0010). Editing arrangement here would move that ceiling
 * into a builder nobody designed, and it would cost the other half of the
 * bargain: a canvas lands later as an editor over a tree that already exists,
 * with no migration, precisely because the tree is never reshaped by anything
 * else in the meantime.
 *
 * So every function here takes a tree and returns one with the SAME shape —
 * same node types, same order, same nesting. What changes is what a node says
 * and whether it is shown.
 *
 * **The vocabulary is imported rather than fetched.** It is a static file with
 * nothing per-install to resolve — unlike the rule vocabulary, whose
 * [[Availability]] is a fact about this install and therefore the server's to
 * answer. A REST route for it would be a second copy of a file both sides
 * already read, and the admin bundle has no byte budget to protect (the
 * loader's is what `bin/check-loader.mjs` guards, and it must never import
 * this).
 */

interface LeafDeclaration {
  readonly content: readonly string[];
  readonly copy: readonly string[];
  readonly params: readonly string[];
}

const LEAVES = vocabulary.nodes as Readonly<Record<string, LeafDeclaration>>;
const LAYOUTS = vocabulary.layouts as Readonly<Record<string, { readonly children: string }>>;

/** Where a layout keeps its children. `split` is the one with two. */
const PANES = ['start', 'end'] as const;

/**
 * Every token the vocabulary declares, with the value it falls back to.
 *
 * The panel draws one control per entry, so a token added to the manifest
 * appears here without anything else being edited — and an unconsumed one
 * cannot hide, because `tests/js/renderer-manifest-parity.test.ts` fails the
 * day the stylesheet stops reading it.
 */
export const TOKENS: readonly { readonly name: string; readonly fallback: string }[] = Object.entries(
  vocabulary.tokens as Readonly<Record<string, string>>,
).map(([name, fallback]) => ({ name, fallback }));

/**
 * Where a node sits, as the keys and indices that reach it.
 *
 * An address rather than a reference, because every edit returns a NEW tree —
 * React compares by identity, and a mutated node would leave the preview
 * showing the previous render.
 */
export type Path = readonly (string | number)[];

export interface Slot {
  readonly path: Path;
  readonly type: string;
  /**
   * The [[Slot Role]] it fills, or null where it has none. A `field`'s Roles
   * are derived from what it captures rather than declared, so it carries no
   * `role` key of its own (CONTEXT.md, Slot Role).
   */
  readonly role: string | null;
  /**
   * What a `field` captures, or null for anything else.
   *
   * A field's Roles are DERIVED from this rather than declared — a field
   * capturing an email offers `email_label` and cannot offer the phone's — so
   * this is what the panel heads it with, and it is a param rather than
   * content because the field kind is part of the DESIGN (CONTEXT.md, Slot
   * Role).
   */
  readonly captures: string | null;
  /** What the merchant may fill in — the node type's content keys, in order. */
  readonly keys: readonly string[];
  /** What is in them now. */
  readonly values: Readonly<Record<string, unknown>>;
  /**
   * Whether the panel may switch it off.
   *
   * False for `button` and `field`, and not by omission: hiding the button
   * that converts leaves an Optin with no countable act, and hiding a required
   * field leaves a form the capture endpoint refuses every submission of.
   * Neither declares `hidden` in the manifest, so PHP drops the key on the way
   * in — the state is inexpressible rather than merely disallowed.
   */
  readonly hideable: boolean;
  readonly hidden: boolean;
}

/**
 * Every slot in a design, in tree order.
 *
 * The walk covers both of a `split`'s panes, which is exactly where a second
 * reader forgets to look — the same argument `ConvertingAct::offeredIn()`
 * makes on the other side of the boundary.
 */
export function slotsOf(tree: TemplateTree): Slot[] {
  const slots: Slot[] = [];

  tree.steps.forEach((step, index) => collect(step, [index], slots));

  return slots;
}

function collect(node: TemplateNode, path: Path, slots: Slot[]): void {
  const leaf = LEAVES[node.type];

  if (leaf !== undefined) {
    const values: Record<string, unknown> = {};

    for (const key of leaf.content) {
      values[key] = (node as Record<string, unknown>)[key];
    }

    const role = (node as { role?: string }).role;
    const captures = (node as { name?: string }).name;

    slots.push({
      path,
      type: node.type,
      role: typeof role === 'string' ? role : null,
      captures: node.type === 'field' && typeof captures === 'string' ? captures : null,
      keys: leaf.content,
      values,
      hideable: leaf.params.includes('hidden'),
      hidden: (node as { hidden?: boolean }).hidden === true,
    });

    return;
  }

  for (const key of childKeysOf(node.type)) {
    const children = (node as Record<string, unknown>)[key];

    if (Array.isArray(children)) {
      children.forEach((child, index) => collect(child as TemplateNode, [...path, key, index], slots));
    }
  }
}

function childKeysOf(type: string): readonly string[] {
  const shape = LAYOUTS[type]?.children;

  if (shape === 'panes') {
    return PANES;
  }

  return shape === 'list' ? ['children'] : [];
}

/**
 * The same design with one slot changed.
 *
 * `undefined` clears the key rather than writing the word "undefined" — a
 * merchant who empties the alt text of a decorative image means it has none,
 * and the renderer already draws `alt=""` for exactly that.
 */
export function withValue(tree: TemplateTree, path: Path, key: string, value: unknown): TemplateTree {
  return editNode(tree, path, (node) => {
    const next = { ...node } as Record<string, unknown>;

    if (value === undefined || value === '') {
      delete next[key];
    } else {
      next[key] = value;
    }

    return next as TemplateNode;
  });
}

/** The same design with one slot switched on or off. */
export function withHidden(tree: TemplateTree, path: Path, hidden: boolean): TemplateTree {
  return editNode(tree, path, (node) => {
    const next = { ...node } as Record<string, unknown>;

    // Absent rather than `false`, because absent is what "shown" already
    // means — and a snapshot that carries `hidden: false` on every slot pays
    // for the flag on every page view of an Optin nobody hid anything on.
    if (hidden) {
      next.hidden = true;
    } else {
      delete next.hidden;
    }

    return next as TemplateNode;
  });
}

/** The same design with one token set, or cleared back to the template's own. */
export function withToken(tokens: Tokens, name: string, value: string): Tokens {
  const next = { ...tokens };

  if (value === '') {
    delete next[name];
  } else {
    next[name] = value;
  }

  return next;
}

/**
 * Rebuild the tree down one path, replacing the node at the end of it.
 *
 * Structural sharing everywhere else: React re-renders the preview from the
 * tree, and a wholesale copy would make every slot look changed on every
 * keystroke.
 */
function editNode(tree: TemplateTree, path: Path, edit: (node: TemplateNode) => TemplateNode): TemplateTree {
  const [index, ...rest] = path;

  if (typeof index !== 'number') {
    return tree;
  }

  return {
    steps: tree.steps.map((step, at) => (at === index ? replace(step, rest, edit) : step)),
  };
}

function replace(node: TemplateNode, path: Path, edit: (node: TemplateNode) => TemplateNode): TemplateNode {
  const [key, index, ...rest] = path;

  if (typeof key !== 'string' || typeof index !== 'number') {
    return edit(node);
  }

  const children = (node as Record<string, unknown>)[key];

  if (!Array.isArray(children)) {
    return node;
  }

  return {
    ...node,
    [key]: children.map((child, at) => (at === index ? replace(child as TemplateNode, rest, edit) : child)),
  } as TemplateNode;
}
