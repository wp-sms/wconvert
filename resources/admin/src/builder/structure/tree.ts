import { LEAVES, childKeysOf, type Path } from '../panel';
import type { TemplateNode, TemplateTree } from '@renderer/types';

/**
 * The tree, as something that can be RESHAPED — and the five ways it may be.
 *
 * ============================================================================
 * THIS IS THE THING FOUR ADRs DELIBERATELY DID NOT BUILD, BUILT.
 * ============================================================================
 * [`ADR 0010`](../../../../../docs/adr/0010-templates-are-configuration-not-documents.md)
 * made the no-canvas decision **conditional**: a canvas may land later "as an
 * editor over a tree that already exists", precisely because nothing reshaped
 * the tree in the meantime. This is that editor, and the condition it was
 * waiting on is the one the configuration model already satisfied — there is
 * no HTML to parse and no migration to run, because a tree is what was stored
 * all along.
 *
 * So this file is not a hole in that boundary. It is the other half of the
 * bargain being collected.
 *
 * ============================================================================
 * PURE FUNCTIONS, NO REACT, AND THAT IS NOT TIDINESS.
 * ============================================================================
 * jsdom models neither focus nor roving tabindex
 * (`tests/js/setup.ts`), so the parts of this editor a test can actually prove
 * have to be reachable without rendering anything — *"test the translation, not
 * the widgets"* (ADR 0038, quoting #29). Everything that decides what a tree
 * becomes lives here; everything that decides what it LOOKS like lives in the
 * components, and is verified in a browser.
 *
 * ============================================================================
 * NOTHING HERE MAY INVENT A KEY. THE SERVER'S COPY WINS WHOLESALE.
 * ============================================================================
 * `save()` replaces `config` with what came back, and
 * {@see \WConvert\Template\TemplateVocabulary::normalize()} keeps **only the
 * keys the manifest declares** for a node type. A builder-only node id, a
 * collapse flag or a selection marker written into the tree would survive
 * exactly until the next save and then vanish, taking whatever was keyed to it
 * with it.
 *
 * That is why every function below addresses a node by {@link Path} and why the
 * UI re-resolves after a save rather than holding one across it.
 */

/**
 * Where a node sits inside its parent: which array, and where in it.
 *
 * A {@link Path} names a NODE, which is all the settings panel ever needed —
 * `editNode` walks to one and replaces it. Inserting has no node to walk to
 * yet, and a position past the end of an array is a real destination with no
 * node at it, so the structure editor needs the other half of the address.
 *
 * The steps array is deliberately not addressable this way. How many steps a
 * design has follows from its metric — two for a submit, one for a click
 * (ADR 0025) — so a step is a fact about the Goal rather than a block a
 * merchant arranges.
 */
export interface Spot {
  /** The layout node holding the array, as a path from the tree. */
  readonly parent: Path;
  /** `children`, or one of a `split`'s two panes. */
  readonly key: string;
  readonly index: number;
}

/** The spot a node occupies, or null for a step, which occupies none. */
export function spotOf(path: Path): Spot | null {
  const key = path[path.length - 2];
  const index = path[path.length - 1];

  if (path.length < 3 || typeof key !== 'string' || typeof index !== 'number') {
    return null;
  }

  return { parent: path.slice(0, -2), key, index };
}

/** The path of whatever is at a spot. The inverse of {@link spotOf}. */
export const pathOf = (spot: Spot): Path => [...spot.parent, spot.key, spot.index];

/** Whether two spots name the same position in the same array. */
export const sameSpot = (a: Spot, b: Spot): boolean =>
  a.key === b.key && a.index === b.index && a.parent.join('.') === b.parent.join('.');

/**
 * One node, with everything a row needs to draw itself and nothing it does not.
 *
 * **Layouts are in it, and that is the difference from `slotsOf`.** The
 * settings panel walks leaves only and flattens them, because a merchant
 * editing words does not care that the email field sits in a `row`. A merchant
 * MOVING it does: the row is what they are moving it within, and a tree that
 * hid the row would offer no way to say so.
 */
export interface Block {
  readonly path: Path;
  readonly type: string;
  /** A leaf holds words; a layout holds blocks. Read off the manifest. */
  readonly leaf: boolean;
  /** 1 for a step, 2 for its children, and so on — the treegrid's `aria-level`. */
  readonly level: number;
  /** 1-based within its own array, with the size of that array. */
  readonly position: number;
  readonly setSize: number;
  /** Which of the parent's arrays it sits in, or null for a step. */
  readonly pane: string | null;
  /** The [[Slot Role]] it fills, or null. The first half of its `SlotKey`. */
  readonly role: string | null;
  /** What a `field` captures, or null. The other half. */
  readonly captures: string | null;
  /**
   * What it SAYS, where it says anything.
   *
   * A row named "item 3 of 5" tells a screen-reader user nothing about which
   * block they are on, which is the failure `Preview.tsx` already refuses when
   * it labels a preview slot by its text. The words are the manifest's `copy`
   * keys — that is what the manifest means by words — and an `image` has none,
   * so it is named by its `alt`, which is the one thing an image says.
   */
  readonly says: string | null;
  /** How many blocks it holds, at any depth. Zero for a leaf. */
  readonly holds: number;
  /** Whether it may hold blocks at all — a layout, whatever it holds now. */
  readonly holder: boolean;
}

/**
 * Every block in a design, in tree order, layouts included.
 *
 * Both of a `split`'s panes are walked, which is the place a second reader
 * forgets to look — the same argument `slotsOf` and `ConvertingAct::offeredIn()`
 * both make on their own side of the boundary.
 */
export function nodesOf(tree: TemplateTree): Block[] {
  const blocks: Block[] = [];

  tree.steps.forEach((step, index) =>
    collect(step, [index], 1, index + 1, tree.steps.length, null, blocks),
  );

  return blocks;
}

function collect(
  node: TemplateNode,
  path: Path,
  level: number,
  position: number,
  setSize: number,
  pane: string | null,
  blocks: Block[],
): void {
  const keys = childKeysOf(node.type);
  const leaf = LEAVES[node.type];
  const role = (node as { role?: string }).role;
  const captures = (node as { name?: string }).name;

  blocks.push({
    path,
    type: node.type,
    leaf: leaf !== undefined,
    level,
    position,
    setSize,
    pane,
    role: typeof role === 'string' ? role : null,
    captures: node.type === 'field' && typeof captures === 'string' ? captures : null,
    says: saysOf(node),
    holds: countIn(node),
    holder: keys.length > 0,
  });

  for (const key of keys) {
    const children = childrenAt(node, key);

    children.forEach((child, index) =>
      collect(child, [...path, key, index], level + 1, index + 1, children.length, key, blocks),
    );
  }
}

/** The block at a path, or null where the path reaches nothing. */
export function nodeAt(tree: TemplateTree, path: Path): TemplateNode | null {
  const [step, ...rest] = path;

  if (typeof step !== 'number') {
    return null;
  }

  let node: TemplateNode | null = tree.steps[step] ?? null;

  for (let at = 0; at < rest.length && node !== null; at += 2) {
    const key = rest[at];
    const index = rest[at + 1];

    node = typeof key === 'string' && typeof index === 'number'
      ? (childrenAt(node, key)[index] ?? null)
      : null;
  }

  return node;
}

/**
 * The same design with a block put at a spot.
 *
 * An index past the end appends, rather than being refused: *"after the last
 * one"* is the ordinary destination for an Add, and a caller made to clamp
 * first is a caller that can get the clamp wrong.
 */
export function withInserted(tree: TemplateTree, spot: Spot, node: TemplateNode): TemplateTree {
  return withChildren(tree, spot.parent, spot.key, (children) => {
    const at = Math.max(0, Math.min(spot.index, children.length));

    return [...children.slice(0, at), node, ...children.slice(at)];
  });
}

/**
 * The same design with a block gone — **and everything it was holding.**
 *
 * A row that holds the field and the button takes both with it. That is what
 * the affordance has to say before it is pressed and what undo is the recovery
 * for; silently promoting the children into the grandparent would be a
 * different arrangement from either the one the merchant had or the one they
 * asked for.
 */
export function withRemoved(tree: TemplateTree, path: Path): TemplateTree {
  const spot = spotOf(path);

  if (spot === null) {
    return tree;
  }

  return withChildren(tree, spot.parent, spot.key, (children) =>
    children.filter((_child, at) => at !== spot.index),
  );
}

/**
 * The same design with a block moved **within the array it is already in**.
 *
 * One parent, deliberately. Reparenting is a second interaction — it needs a
 * destination the merchant chooses rather than a direction, and the ↑↓ buttons
 * WCAG 2.2 SC 2.5.7 requires as the drag alternative express a direction and
 * nothing else. Two mechanisms where the buttons can only reach one of them is
 * a drag that does something no keyboard can undo.
 *
 * A move off either end returns the tree it was given, unchanged and by
 * identity, so a caller can tell "did nothing" from "did something" without
 * comparing trees.
 */
export function withMoved(tree: TemplateTree, path: Path, by: number): TemplateTree {
  const spot = spotOf(path);

  if (spot === null || by === 0) {
    return tree;
  }

  const children = childrenAt(nodeAt(tree, spot.parent), spot.key);
  const to = spot.index + by;

  if (to < 0 || to >= children.length || spot.index >= children.length) {
    return tree;
  }

  return withChildren(tree, spot.parent, spot.key, (current) => {
    const next = [...current];
    const [moved] = next.splice(spot.index, 1);

    next.splice(to, 0, moved);

    return next;
  });
}

/**
 * The same design with a copy of a block after it — **and with every [[Slot
 * Role]] in that copy stripped.**
 *
 * ============================================================================
 * THE ROLE IS STRIPPED HERE BECAUSE THE SERVER WOULD STRIP IT ANYWAY.
 * ============================================================================
 * Roles are unique across the whole tree, not per step:
 * `TemplateVocabulary::normalize()` walks with a `$seenRoles` list and keeps
 * the FIRST node claiming a Role, dropping it from every later one. So a
 * headline duplicated with its `role` intact comes back from the save with no
 * role at all — and a merchant who saw the copy appear complete watches it
 * quietly lose its heading in the Content tab one save later.
 *
 * Stripping it here makes the editor say the true thing at the moment of the
 * act, which is the only moment the merchant is looking. The caller is expected
 * to say so out loud; {@see rolesLostBy} is what it counts.
 */
export function withDuplicated(tree: TemplateTree, path: Path): TemplateTree {
  const spot = spotOf(path);
  const node = nodeAt(tree, path);

  if (spot === null || node === null) {
    return tree;
  }

  return withInserted(tree, { ...spot, index: spot.index + 1 }, withoutRoles(node));
}

/** How many Slot Roles duplicating this block would drop. Zero is the quiet case. */
export function rolesLostBy(tree: TemplateTree, path: Path): number {
  const node = nodeAt(tree, path);

  return node === null ? 0 : rolesIn(node);
}

/** The same node, and everything under it, carrying no `role` key. */
function withoutRoles(node: TemplateNode): TemplateNode {
  const next = { ...node } as Record<string, unknown>;

  delete next.role;

  for (const key of childKeysOf(node.type)) {
    if (Array.isArray(next[key])) {
      next[key] = (next[key] as TemplateNode[]).map(withoutRoles);
    }
  }

  return next as TemplateNode;
}

function rolesIn(node: TemplateNode): number {
  const held = typeof (node as { role?: unknown }).role === 'string' ? 1 : 0;

  return childKeysOf(node.type).reduce(
    (carried, key) => carried + childrenAt(node, key).reduce((sum, child) => sum + rolesIn(child), 0),
    held,
  );
}

/**
 * How many blocks sit in one of a node's child arrays.
 *
 * What an "add at the end" needs and nothing more. {@link withInserted} clamps
 * an index past the end anyway, so this exists to let a caller SAY where it
 * meant rather than to stop it going wrong — a {@link Spot} that reads
 * `index: 3` is an address a reader can check against the tree, and one that
 * reads `index: Infinity` is not.
 */
export const countAt = (tree: TemplateTree, parent: Path, key: string): number =>
  childrenAt(nodeAt(tree, parent), key).length;

/**
 * The first block a merchant may actually edit, or null for a design with none.
 *
 * Not the first ROW: that is a step, and a step is not a block a merchant
 * arranges — how many a design has follows from its metric (ADR 0025). So the
 * editor opens on the first thing inside the first step, which is what a
 * merchant reading the design top to bottom would have clicked.
 */
export function firstBlockOf(tree: TemplateTree): Path | null {
  return nodesOf(tree).find((block) => block.level > 1)?.path ?? nodesOf(tree)[0]?.path ?? null;
}

/**
 * The nearest surviving block to a path, or null for a design with none.
 *
 * **A save replaces the tree wholesale**, and the server's copy may not hold
 * what the merchant had selected — `normalize()` drops an unknown type, and a
 * Slot Role claimed twice loses its later claimant. Clearing the selection
 * there would blank the inspector for a reason nothing on screen explains, so
 * the address is walked outward instead: the block, else whatever was holding
 * it, else the design's first block.
 */
export function nearestTo(tree: TemplateTree, path: Path): Path | null {
  let at: Path = path;

  while (at.length > 0) {
    if (nodeAt(tree, at) !== null) {
      return at;
    }

    // Out one level: a path is `[step, key, index, …]`, so dropping the last
    // pair leaves whatever was holding this. A bare step index has no pair to
    // drop and falls through to the design's first block.
    at = at.length >= 3 ? at.slice(0, -2) : [];
  }

  return firstBlockOf(tree);
}

/** Whether two paths address the same node. */
export const samePath = (a: Path, b: Path): boolean => a.length === b.length && a.join('.') === b.join('.');

/** Every Slot Role the tree is already using, so a new block can be given a free one. */
export function rolesTaken(tree: TemplateTree): string[] {
  return nodesOf(tree)
    .map((block) => block.role)
    .filter((role): role is string => role !== null);
}

/** Every capture kind the tree is already using. Two fields of one kind collide. */
export function capturesTaken(tree: TemplateTree): string[] {
  return nodesOf(tree)
    .map((block) => block.captures)
    .filter((captures): captures is string => captures !== null);
}

/**
 * Rebuild one of a node's child arrays, sharing structure everywhere else.
 *
 * The same reason `editNode` gives: the preview re-renders from the tree, and a
 * wholesale copy would make every block look changed on every edit.
 */
function withChildren(
  tree: TemplateTree,
  parent: Path,
  key: string,
  edit: (children: readonly TemplateNode[]) => readonly TemplateNode[],
): TemplateTree {
  const [step, ...rest] = parent;

  if (typeof step !== 'number' || tree.steps[step] === undefined) {
    return tree;
  }

  return {
    steps: tree.steps.map((node, at) => (at === step ? rebuild(node, rest, key, edit) : node)),
  };
}

function rebuild(
  node: TemplateNode,
  path: Path,
  key: string,
  edit: (children: readonly TemplateNode[]) => readonly TemplateNode[],
): TemplateNode {
  const [step, index, ...rest] = path;

  if (typeof step !== 'string' || typeof index !== 'number') {
    // The end of the walk: this is the node holding the array being edited.
    if (!childKeysOf(node.type).includes(key)) {
      return node;
    }

    return { ...node, [key]: edit(childrenAt(node, key)) } as TemplateNode;
  }

  const children = childrenAt(node, step);

  if (children[index] === undefined) {
    return node;
  }

  return {
    ...node,
    [step]: children.map((child, at) => (at === index ? rebuild(child, rest, key, edit) : child)),
  } as TemplateNode;
}

function childrenAt(node: TemplateNode | null, key: string): readonly TemplateNode[] {
  const children = node === null ? undefined : (node as Record<string, unknown>)[key];

  return Array.isArray(children) ? (children as TemplateNode[]) : [];
}

function countIn(node: TemplateNode): number {
  return childKeysOf(node.type).reduce(
    (carried, key) =>
      carried + childrenAt(node, key).reduce((sum, child) => sum + 1 + countIn(child), 0),
    0,
  );
}

/**
 * What a node says, read off the manifest rather than off its type.
 *
 * The `copy` keys are what the manifest calls words, which is the same list
 * `TemplateVocabulary::withoutCopy()` strips against — so a node type added to
 * the manifest names its own rows without a line here being edited. `alt` is
 * the tail because an `image` declares no copy at all and still has one thing
 * it says to a reader.
 */
function saysOf(node: TemplateNode): string | null {
  const leaf = LEAVES[node.type];

  if (leaf === undefined) {
    return null;
  }

  for (const key of [...leaf.copy, ...(leaf.content.includes('alt') ? ['alt'] : [])]) {
    const value = (node as Record<string, unknown>)[key];

    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  return null;
}
