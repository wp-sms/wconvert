import { __ } from '@wordpress/i18n';
import { FIELDS, LAYOUTS, LEAVES, ROLES, childKeysOf } from '../panel';
import { capturesTaken, nodeAt, rolesTaken, type Spot } from './tree';
import type { TemplateNode, TemplateTree } from '@renderer/types';

/**
 * What may be added where — **entirely from `manifest.json`, with no per-type
 * code anywhere in this file.**
 *
 * ============================================================================
 * ADDING A NODE TYPE TO THE MANIFEST MUST COST THE EDITOR NOTHING.
 * ============================================================================
 * `panel.ts` already holds this property for tokens and for slot controls: a
 * token added to `resources/templates/manifest.json` grows a control, and a
 * node type grows a block, without a line of the admin being edited. The Add
 * menu has to hold it too, or the vocabulary acquires a second list — the
 * fifth hand-maintained cross-cutting list this project has refused
 * (ADR 0019), and the one that would silently make a new node type
 * unreachable rather than merely unlabelled.
 *
 * So every question below is asked of the manifest:
 *
 * - **Can this hold blocks?** `layouts[type].children` — `childKeysOf`.
 * - **What kinds are there?** the keys of `nodes` and of `layouts`.
 * - **Which [[Slot Role]]s suit this kind?** `nodes[type].roles`, which now
 *   names the Roles themselves rather than the word `role`. That is the one
 *   manifest change this needed, and it is what lets a new block arrive
 *   already wired to the Content tab instead of arriving anonymous.
 * - **What may a `field` capture?** `fields`, minus what the tree already uses.
 *
 * ============================================================================
 * THE VOCABULARY IS STILL THE CEILING. THIS ONLY REACHES IT.
 * ============================================================================
 * Nothing here can express a node the manifest does not declare, so ADR 0010's
 * bargain is intact in the way that matters: the editor cannot invent design
 * variety, it can only arrange what the vocabulary already offers. The gallery
 * is still where a design comes from; this is where a merchant adjusts one.
 */

/** A kind of block, as the Add menu offers it. */
export interface Addition {
  readonly type: string;
  /** A leaf holds words; a layout holds blocks. */
  readonly leaf: boolean;
  /**
   * Why this kind is not on offer here, or null where it is.
   *
   * Present rather than filtered out, because *"you cannot add a second email
   * field"* is an answer and a missing menu row is not. The caller decides
   * whether to draw it disabled or to leave it out; both are honest, and only
   * one of them is possible if this list has already dropped it.
   */
  readonly refused: string | null;
}

/**
 * Which converting act this Optin's [[Goal]] is measured by.
 *
 * **Spelled the way {@see \WConvert\Template\ConvertingAct} spells it** —
 * `submit` and `click` — rather than the way a `button` node spells its own
 * `action` param, which is `submit` and **`link`**. Those are two vocabularies
 * for one distinction and PHP already keeps them apart: `ConvertingAct::collect`
 * reads `action === 'link'` and answers `Click`. Using the metric's words here
 * is what lets `converting_act` off `GET /wconvert/v1/goals` be handed straight
 * in without a translation nobody would remember to keep.
 *
 * The editor is TOLD which it is rather than guessing, because guessing is
 * exactly the failure this prevents: a `link` button added to a submit-metered
 * Optin makes `refuseAMetricItCannotReport` fail **the whole save**, and the
 * merchant would meet that as a red bar over an editor that had happily let
 * them do it.
 */
export type ConvertingAct = 'submit' | 'click';

/**
 * Everything that may be added inside this parent, in the manifest's own order.
 *
 * Layouts come after leaves because a merchant reaching for Add wants a
 * heading far more often than a grid, and the vocabulary's own order within
 * each half is left alone — the manifest is the source, including of what
 * "first" means.
 */
export function additionsIn(tree: TemplateTree, at: Spot, act: ConvertingAct): Addition[] {
  const holder = nodeAt(tree, at.parent);

  if (holder === null || !childKeysOf(holder.type).includes(at.key)) {
    return [];
  }

  return [
    ...Object.keys(LEAVES).map((type) => ({ type, leaf: true, refused: whyRefused(tree, type, at, act) })),
    ...Object.keys(LAYOUTS).map((type) => ({ type, leaf: false, refused: null })),
  ];
}

/**
 * Why a kind may not be added HERE, or null.
 *
 * Three refusals, and every one of them is something the server would
 * otherwise decide silently, or loudly and after the fact:
 *
 * - **A second converting act.** One Optin has exactly one (CONTEXT.md,
 *   Conversion). Two buttons are two things the merchant believes are counted,
 *   and `ConvertingAct::offeredIn()` returns ONE act for both — so nothing
 *   refuses it and the second button reports nothing, forever.
 * - **A second field of a kind already captured.** The renderer derives an
 *   input's `id` from the capture kind precisely so two renders of one tree
 *   agree, so two `email` fields are two elements carrying `id="wc-email"`;
 *   their derived Roles collide too, and `TemplateVocabulary::normalize()`
 *   settles that by dropping the later one's.
 * - **Anything captured outside the step that submits.** `render.ts` makes the
 *   step holding the submit button the `<form>`, and that follows from the tree
 *   rather than from a flag. A field on any other step is an input inside a
 *   `<div>`: it draws, it takes typing, and nothing on earth reads it. On a
 *   click-metered Optin there is no such step at all, which is ADR 0025's
 *   "captures nothing" arriving as an absence rather than as a rule.
 */
function whyRefused(
  tree: TemplateTree,
  type: string,
  at: Spot,
  act: ConvertingAct,
): string | null {
  if (type === 'button') {
    return buttonsIn(tree) > 0
      ? __('This design already has the button that counts. An Optin has exactly one.', 'wconvert')
      : null;
  }

  if (type === 'field' || type === 'consent') {
    const form = formStep(tree);

    if (form === null) {
      return act === 'click'
        ? __(
            'This Optin converts on a click and captures nothing, so it has no form to add to.',
            'wconvert',
          )
        : __('Add the button that submits the form first — the form is the step that holds it.', 'wconvert');
    }

    if (at.parent[0] !== form) {
      return __('Only the step with the submit button is a form, so this is the step that captures.', 'wconvert');
    }
  }

  if (type === 'field' && freeCapture(tree) === null) {
    return __('Every kind of detail this vocabulary can capture is already on the form.', 'wconvert');
  }

  return null;
}

/**
 * A new block of this kind, filled with what the vocabulary says it needs.
 *
 * **Everything it carries is a key the manifest declares**, which is not a
 * nicety: `TemplateVocabulary::normalize()` keeps only declared keys, so a
 * builder-only marker would vanish at the first save and take whatever the
 * editor keyed to it with it.
 *
 * Returns null where the kind cannot be added — the same answer
 * {@link additionsIn} gives as a `refused` string, so a caller that ignored the
 * refusal still cannot write a broken tree.
 */
export function nodeFor(
  tree: TemplateTree,
  type: string,
  at: Spot,
  act: ConvertingAct,
): TemplateNode | null {
  if (whyRefused(tree, type, at, act) !== null) {
    return null;
  }

  if (LAYOUTS[type] !== undefined) {
    return blankLayout(type);
  }

  if (LEAVES[type] === undefined) {
    return null;
  }

  const node: Record<string, unknown> = { type };
  const role = freeRoleFor(tree, type);

  if (role !== null) {
    node.role = role;
  }

  if (type === 'field') {
    const captures = freeCapture(tree);

    if (captures === null) {
      return null;
    }

    // A field capturing nothing the build can canonicalise renders NOTHING —
    // `render.ts` skips it the way it skips an unknown node type — so a new
    // field arrives with a kind or does not arrive.
    node.name = captures;
    node.required = true;
  }

  if (type === 'button') {
    // The Goal decides, and it decides at the moment of creation because
    // `action` is a param rather than content: the Content tab never offers it,
    // so a button that arrives wrong stays wrong until a save refuses the whole
    // config. This is the one place the metric's word becomes the node's.
    node.action = act === 'click' ? 'link' : 'submit';
  }

  // A `consent` node ships hidden, which is the same "off by default" every
  // shipped design already spells and the reason ADR 0032 and ADR 0010's
  // no-arrangement bargain were both true at once before this editor existed.
  if (type === 'consent') {
    node.hidden = true;
  }

  return node as TemplateNode;
}

/** A layout with its child arrays present and empty, so the walk finds them. */
function blankLayout(type: string): TemplateNode {
  const node: Record<string, unknown> = { type };

  for (const key of childKeysOf(type)) {
    node[key] = [];
  }

  return node as TemplateNode;
}

/**
 * A [[Slot Role]] this kind may carry that nothing in the tree has claimed, or
 * null where they are all spoken for.
 *
 * **Null is a real answer and the caller has to say it out loud.** A block with
 * no Role still edits — `slotsOf` walks every leaf and the Content tab heads a
 * role-less one by its node type — but it has no `SlotKey`, so clicking it in
 * the preview reaches nothing and focusing its block outlines nothing. That is
 * a quiet degradation of exactly the two-way selection ADR 0040 built, and a
 * merchant who is not told will read it as a bug.
 */
export function freeRoleFor(tree: TemplateTree, type: string): string | null {
  const declared = LEAVES[type]?.roles ?? [];
  const taken = rolesTaken(tree);

  return (
    declared.find((role) => ROLES.includes(role) && !taken.includes(role)) ?? null
  );
}

/** A capture kind no field in the tree is using, or null. */
export function freeCapture(tree: TemplateTree): string | null {
  const taken = capturesTaken(tree);

  return FIELDS.find((kind) => !taken.includes(kind)) ?? null;
}

/**
 * Which step IS the form, or null where none is.
 *
 * Read exactly the way `render.ts` reads it — the step holding a button that is
 * not a `link` — so the editor and the renderer cannot disagree about which
 * step captures. A click-metered design has no such step, which is ADR 0025's
 * whole point rather than a missing case.
 */
function formStep(tree: TemplateTree): number | null {
  const at = tree.steps.findIndex(submits);

  return at === -1 ? null : at;
}

function submits(node: TemplateNode): boolean {
  if (node.type === 'button') {
    return (node as { action?: string }).action !== 'link';
  }

  return childKeysOf(node.type).some((key) => childrenOf(node, key).some(submits));
}

function buttonsIn(tree: TemplateTree): number {
  return tree.steps.reduce((carried, step) => carried + buttonsUnder(step), 0);
}

function buttonsUnder(node: TemplateNode): number {
  return childKeysOf(node.type).reduce(
    (carried, key) => carried + childrenOf(node, key).reduce((sum, child) => sum + buttonsUnder(child), 0),
    node.type === 'button' ? 1 : 0,
  );
}

function childrenOf(node: TemplateNode, key: string): readonly TemplateNode[] {
  const children = (node as Record<string, unknown>)[key];

  return Array.isArray(children) ? (children as TemplateNode[]) : [];
}
