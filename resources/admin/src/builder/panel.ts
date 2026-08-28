import vocabulary from '../../../templates/manifest.json';
import type { TemplateNode, TemplateTree, Tokens } from '@renderer/types';

/**
 * The model of a design a merchant EDITS: tokens, slot content and slot
 * visibility, over a tree it never restructures.
 *
 * ============================================================================
 * THIS FILE STILL OFFERS NO WAY TO CHANGE ARRANGEMENT. `structure/` DOES.
 * ============================================================================
 * Every function here takes a tree and returns one with the SAME shape — same
 * node types, same order, same nesting. What changes is what a node says and
 * whether it is shown.
 *
 * That is a division of labour rather than a ceiling on the product. The two
 * halves meet on one screen now: {@see BlockTree} lists the blocks and moves
 * them, and {@see BlockInspector} under it writes what the selected one says
 * through the functions below. Keeping them in separate files is what stops a
 * change to the words being able to change the shape by accident.
 *
 * That is ADR 0010's own escape clause collected rather than a hole in it:
 * *"a canvas lands later as an editor over a tree that already exists, with no
 * migration"*, and the tree it edits is the tree that was always stored.
 *
 * The ceiling did not move with it. `structure/catalogue.ts` reads the same
 * manifest this file does and can express nothing outside it, so the editor
 * arranges what the vocabulary offers and cannot invent design variety. The
 * gallery is still where a design comes from.
 *
 * **The vocabulary is imported rather than fetched.** It is a static file with
 * nothing per-install to resolve — unlike the rule vocabulary, whose
 * [[Availability]] is a fact about this install and therefore the server's to
 * answer. A REST route for it would be a second copy of a file both sides
 * already read, and the admin bundle has no byte budget to protect (the
 * loader's is what `bin/check-loader.mjs` guards, and it must never import
 * this).
 */

export interface LeafDeclaration {
  readonly content: readonly string[];
  readonly copy: readonly string[];
  readonly params: readonly string[];
  /**
   * The [[Slot Role]]s this node type may carry, or none where it carries no
   * `role` key at all.
   *
   * `image` has none because it holds no words, and `field` has none because
   * its Roles are DERIVED from what it captures rather than declared
   * (CONTEXT.md, Slot Role). Everything else names the Roles that suit it, so
   * {@see structure/catalogue} can hand a newly added block a Role that is
   * actually free without a mapping of its own — the same property `TOKENS`
   * gives the token list.
   */
  readonly roles: readonly string[];
}

/**
 * The vocabulary's leaves and layouts, as the structure editor reads them.
 *
 * **Exported for `structure/`, and that is the whole reason they are not
 * private any more.** The editor decides what may be added where by reading
 * this manifest, so a node type added to
 * `resources/templates/manifest.json` costs the editor nothing — no list to
 * extend, no switch to widen. A second copy of these two objects under
 * `structure/` would be the fifth hand-maintained cross-cutting list this
 * project has refused (ADR 0019).
 */
export const LEAVES = vocabulary.nodes as Readonly<Record<string, LeafDeclaration>>;
export const LAYOUTS = vocabulary.layouts as Readonly<Record<string, { readonly children: string }>>;

/** Where a layout keeps its children. `split` is the one with two. */
export const PANES = ['start', 'end'] as const;

/** Every Slot Role the vocabulary declares, in the order it declares them. */
export const ROLES = vocabulary.roles as readonly string[];

/** What a `field` may capture. Closed, because the capture path canonicalises per kind. */
export const FIELDS = vocabulary.fields as readonly string[];

/**
 * Every token the vocabulary declares, with the value it falls back to.
 *
 * The Design tab draws one control per entry, so a token added to the manifest
 * appears there without anything else being edited — and an unconsumed one
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
   * Whether the merchant may switch it off.
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
 *
 * Leaves only, which is the difference from `nodesOf`: a slot is something with
 * words in it, and a `row` has none. The inspector asks this what the selected
 * block may say and gets nothing back for a layout, which is why it says so
 * rather than drawing an empty box.
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

/**
 * Where a node of this type keeps its children, or nothing where it keeps
 * none.
 *
 * The one answer to "can this hold anything", asked by the slot walk above and
 * by every function in `structure/`. `split` is the one with two, and it is
 * exactly the case a second copy of this would forget.
 */
export function childKeysOf(type: string): readonly string[] {
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
