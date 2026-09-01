import vocabulary from '../../../templates/manifest.json';
import { isColour, isFontStack, measureOf } from './themes';
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
export const LAYOUTS = vocabulary.layouts as Readonly<
  Record<
    string,
    {
      readonly children: string;
      /** Its own settings — `split`'s `ratio` is the one the vocabulary declares. */
      readonly params?: readonly string[];
      /**
       * What the editor OFFERS for each of those settings.
       *
       * A suggestion and never a limit, exactly like a token's `choices`: the
       * renderer takes any fraction for `ratio`, so a design shipping `0.4`
       * keeps it and the control simply shows nothing checked.
       */
      readonly choices?: Readonly<Record<string, readonly string[]>>;
    }
  >
>;

/** Where a layout keeps its children. `split` is the one with two. */
export const PANES = ['start', 'end'] as const;

/** Every Slot Role the vocabulary declares, in the order it declares them. */
export const ROLES = vocabulary.roles as readonly string[];

/** What a `field` may capture. Closed, because the capture path canonicalises per kind. */
export const FIELDS = vocabulary.fields as readonly string[];

/**
 * The key a leaf carries to name itself, for a translator — `id`.
 *
 * **The editor never mints one.** They are minted on the way in by
 * `WConvert\Template\NodeIdentities`, because a save replaces `config` with
 * what came back and an admin-invented key would survive exactly until then
 * (see `structure/tree.ts`). What the editor has to do is the opposite: STRIP
 * it from a duplicated block, so the copy is given a fresh one rather than
 * sharing the original's translation.
 *
 * Read from the manifest rather than written here, for the reason every other
 * member of the vocabulary is: one spelling, on both sides of the boundary.
 */
export const IDENTITY = vocabulary.identity as string;

/**
 * Every token the vocabulary declares, with the value it falls back to.
 *
 * The Design tab draws one control per entry, so a token added to the manifest
 * appears there without anything else being edited — and an unconsumed one
 * cannot hide, because `tests/js/renderer-manifest-parity.test.ts` fails the
 * day the stylesheet stops reading it.
 */
export interface TokenDeclaration {
  readonly name: string;
  readonly fallback: string;
}

export const TOKENS: readonly TokenDeclaration[] = Object.entries(
  vocabulary.tokens as Readonly<Record<string, string>>,
).map(([name, fallback]) => ({ name, fallback }));

/**
 * What the Design panel OFFERS for a token, where offering a list is the only
 * usable control.
 *
 * ============================================================================
 * A CONTROL THAT ENUMERATES READS ITS ENUMERATION FROM THE MANIFEST.
 * ============================================================================
 * A control that INFERS reads the value — which is how a colour gets a picker
 * and a length gets a slider, with nothing in this bundle naming either token.
 * But two shapes say nothing about themselves: `align` is a three-value enum
 * that looks like the word `start`, and `font` is a curated choice that looks
 * like any other string. Both were text boxes, and *"type `center` into this
 * box"* is the defect this whole panel exists to remove.
 *
 * A table in `Tokens.tsx` mapping `align → segmented` would be the "second
 * spelling" this codebase refuses everywhere else. So the manifest says, in a
 * **sibling section** rather than by `tokens` becoming objects: every reader of
 * `tokens` today takes `array_keys`/`Object.keys` of it —
 * `TemplateVocabulary`, `TemplateLabelParityTest`, `renderer-manifest-parity`,
 * `builder-panel` — except `builder-themes.test.ts`, which types it
 * `Record<string, string>` and uses the values as strings four more times. A
 * sibling section breaks none of them.
 *
 * **It is never what is ALLOWED.** Token values stay unvalidated on both sides
 * of the boundary — `TemplateVocabulary` does not read this — which is what
 * keeps `clamp(20rem, 50vw, 30rem)` typeable, and every choice control keeps a
 * text box beside it. So a token this bundle has never heard of still gets the
 * control its VALUE earns it, which is ADR 0010's promise unchanged.
 */
export const CHOICES = vocabulary.choices as Readonly<Record<string, readonly string[]>>;

/**
 * The four groups the Design panel draws, in order.
 *
 * `other` is the trailing one and is the whole point: a token added to the
 * manifest that this bundle recognises nothing about **lands there wearing a
 * text box**, rather than vanishing from a panel that only knows three groups.
 * That is ADR 0010's *"a token added to the manifest appears in the editor with
 * no change to this bundle"*, kept literally.
 */
export const TOKEN_GROUPS = ['colour', 'type', 'space', 'other'] as const;

export type TokenGroupId = (typeof TOKEN_GROUPS)[number];

/**
 * Which group a token belongs to.
 *
 * **Decided by the token's FALLBACK — the design's own value, else the
 * manifest's — and never by what the merchant has typed.** The control is
 * dispatched on the resolved value (see `Tokens.tsx`), because a merchant who
 * typed `var(--brand)` must not keep a hex picker that would overwrite it on
 * the first drag. But a token that changed GROUP as they typed would jump
 * across the panel mid-edit, so grouping reads the value that does not move.
 *
 * Every arm is a shape rather than a name, so this file names no token.
 */
export function groupOf(token: TokenDeclaration): TokenGroupId {
  if (isColour(token.fallback)) {
    return 'colour';
  }

  if (isFontStack(token.fallback)) {
    return 'type';
  }

  // A length, or a keyword the manifest offers a list for — `align` is the
  // second, and it is the reason this arm is not `measureOf` alone.
  if (measureOf(token.fallback) !== null || CHOICES[token.name] !== undefined) {
    return 'space';
  }

  return 'other';
}

/**
 * Every token the manifest declares, in groups, in the panel's own order.
 *
 * Groups with nothing in them are dropped, so the trailing group costs an empty
 * install nothing and appears the moment something lands in it.
 */
export function groupsOf(
  tokens: readonly TokenDeclaration[] = TOKENS,
): readonly { readonly id: TokenGroupId; readonly tokens: readonly TokenDeclaration[] }[] {
  return TOKEN_GROUPS.map((id) => ({
    id,
    tokens: tokens.filter((token) => groupOf(token) === id),
  })).filter((group) => group.tokens.length > 0);
}

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
