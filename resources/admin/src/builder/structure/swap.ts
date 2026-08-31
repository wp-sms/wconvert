import { __, sprintf } from '@wordpress/i18n';
import { FIELDS, withValue, type Path } from '../panel';
import { nameOf, type TemplateLabels } from '../../templates/api';
import { ACTIONS, actionFor, formStep, type ConvertingAct } from './catalogue';
import { capturesTaken, nodeAt } from './tree';
import type { TemplateNode, TemplateTree } from '@renderer/types';

/**
 * What a block may be **changed into**, and what that costs its words.
 *
 * ============================================================================
 * TWO PARAMS THAT DECIDE WHAT A BLOCK IS, AND NEITHER HAS A CONTROL TODAY.
 * ============================================================================
 * A `field`'s `name` is what it captures and a `button`'s `action` is what it
 * does. Both are params rather than content, so the editor has never offered
 * either — which means **an email field can never become a phone field**. The
 * only route is to delete the block and add a new one, which loses the
 * merchant's wording and, for the button, is refused outright because an Optin
 * has exactly one converting act.
 *
 * That is a hole rather than a boundary. `nodeFor` already sets both at the
 * moment of creation, from the tree and the [[Goal]]; this is the same decision
 * made a second time, on a block that already exists.
 *
 * ============================================================================
 * IT REFUSES WHAT THE SERVER WOULD REFUSE, AND SAYS WHY BEFORE IT HAPPENS.
 * ============================================================================
 * Every refusal below mirrors something that would otherwise be decided
 * elsewhere — silently, or loudly and after the fact:
 *
 * - **A kind already captured.** The renderer derives an input's `id` from the
 *   capture kind so two renders of one tree agree, so two `email` fields are
 *   two elements carrying `id="wc-email"`; their derived [[Slot Role]]s collide
 *   beside, and `TemplateVocabulary::normalize()` settles that by dropping the
 *   later one's. The same refusal `additionsIn` already makes for adding one.
 * - **An action the Goal does not count.** A `link` button on a submit-metered
 *   Optin fails the **whole save** through `refuseAMetricItCannotReport` — a
 *   red bar over an editor that had happily allowed it, which is the error this
 *   editor exists to make a merchant never meet.
 * - **A `link` while the form still captures.** `render.ts` makes the step
 *   holding a non-`link` button the `<form>`; take that away and every field on
 *   it draws, takes typing, and is read by nothing. The mirror of the refusal
 *   `whyRefused` already makes for adding a field outside the form step.
 *
 * ============================================================================
 * IT CARRIES WHAT THE MERCHANT CHANGED. THAT RULE IS ALREADY IN THE CODEBASE.
 * ============================================================================
 * `label` and `placeholder` are rewritten **only where they still match the old
 * kind's stock wording**, which is exactly the comparison
 * {@see \WConvert\Template\MerchantsOwn} makes across a Template switch:
 * different from what was shipped means the merchant's, and it travels.
 *
 * A design shipping its own wording — `stacked-signup` says *"Mobile number"*
 * rather than *"Phone number"* — therefore reads as the merchant's and is kept.
 * That is the safe direction and it is chosen rather than tolerated: the two are
 * genuinely indistinguishable from here, and of the two failures, silently
 * overwriting words someone wrote is the one that costs more.
 */

/** One thing a block could become. */
export interface Swap {
  /** The param value it would take: a capture kind, or a button action. */
  readonly to: string;
  /** Whether this is what it already is. */
  readonly current: boolean;
  /**
   * Why it may not become this, or null.
   *
   * Present rather than filtered out, for the reason {@link Addition} gives:
   * *"you cannot capture a phone as well"* is an answer and a missing menu row
   * is not — and here the refusals are the only place a merchant ever learns
   * why their button is the kind of button it is.
   */
  readonly refused: string | null;
}

/**
 * Everything this block could be changed into, or nothing where it is not the
 * kind of block that has such a question.
 *
 * A layout is what it is: changing a `row` into a `grid` is arrangement rather
 * than identity, and the tree already moves blocks between layouts. A `heading`
 * is not offered as a `text` either — those differ in what the RENDERER draws
 * rather than in a param, and the vocabulary has no way to say "the same block,
 * differently".
 */
export function swapsFor(tree: TemplateTree, path: Path, act: ConvertingAct): Swap[] {
  const node = nodeAt(tree, path);

  if (node === null) {
    return [];
  }

  if (node.type === 'field') {
    const mine = capturesOf(node);
    const taken = capturesTaken(tree);

    return FIELDS.map((kind) => ({
      to: kind,
      current: kind === mine,
      refused:
        kind === mine || !taken.includes(kind)
          ? null
          : __('This form already captures that, and two fields of one kind collide.', 'wconvert'),
    }));
  }

  if (node.type === 'button') {
    const mine = actionOf(node);

    return ACTIONS.map((action) => ({
      to: action,
      current: action === mine,
      refused: action === mine ? null : whyActionIsRefused(tree, action, act),
    }));
  }

  return [];
}

/**
 * Why this button may not do that, or null.
 *
 * The Goal comes first because it is the refusal that would fail the whole
 * save, and because it is the one a merchant can actually act on — changing
 * the Goal is a thing they can do, whereas "there are still fields" is a
 * consequence of the design they are looking at.
 */
function whyActionIsRefused(tree: TemplateTree, action: string, act: ConvertingAct): string | null {
  if (action !== actionFor(act)) {
    return act === 'submit'
      ? __(
          'This Optin’s goal counts form submissions, so its button has to submit the form. Change the goal to change this.',
          'wconvert',
        )
      : __(
          'This Optin’s goal counts click-throughs, so its button has to go somewhere. Change the goal to change this.',
          'wconvert',
        );
  }

  if (action === 'link' && formStep(tree) !== null && fieldsIn(tree) > 0) {
    return __(
      'Only the step with the submit button is a form, so the fields on it would draw and be read by nothing. Remove them first.',
      'wconvert',
    );
  }

  return null;
}

/**
 * The same design with one block changed into something else.
 *
 * Returns the tree it was given, unchanged and by identity, where the swap is
 * refused or reaches nothing — the same answer every function in `tree.ts`
 * gives for a no-op, so a caller can tell "did nothing" from "did something"
 * without comparing trees, and so a caller that ignored a refusal still cannot
 * write a tree the save would reject.
 */
export function withSwapped(
  tree: TemplateTree,
  path: Path,
  to: string,
  act: ConvertingAct,
  labels: TemplateLabels,
): TemplateTree {
  const node = nodeAt(tree, path);
  const swap = swapsFor(tree, path, act).find((each) => each.to === to);

  if (node === null || swap === undefined || swap.refused !== null || swap.current) {
    return tree;
  }

  if (node.type === 'button') {
    return withValue(tree, path, 'action', to);
  }

  const was = capturesOf(node);
  const carried = withValue(tree, path, 'name', to);

  return ['label', 'placeholder'].reduce(
    (design, key) =>
      withValue(design, path, key, rewritten(node, key, was, to, labels)),
    carried,
  );
}

/**
 * What one of a field's words becomes: the new kind's stock wording where it
 * still held the old kind's, and what is there otherwise.
 *
 * `undefined` clears the key, which {@link withValue} already treats as "it has
 * none" — the right answer for a placeholder on a kind that ships without one.
 */
function rewritten(
  node: TemplateNode,
  key: string,
  was: string | null,
  to: string,
  labels: TemplateLabels,
): unknown {
  const held = (node as Record<string, unknown>)[key];
  const stock = (kind: string | null) =>
    kind === null ? '' : nameOf(key === 'label' ? labels.fields : labels.placeholders, kind);

  // Empty is not the merchant's wording, it is the absence of any — so the new
  // kind's fills it rather than the field arriving unlabelled.
  if (typeof held === 'string' && held !== '' && held !== stock(was)) {
    return held;
  }

  const next = stock(to);

  // `nameOf` falls back to the key itself where a build's vocabulary is ahead
  // of its translations, and `phone` is not a placeholder. Nothing beats a
  // wrong example.
  return next === to ? undefined : next;
}

/** How many fields the tree has that the renderer would actually draw. */
const fieldsIn = (tree: TemplateTree): number => capturesTaken(tree).length;

const capturesOf = (node: TemplateNode): string | null => {
  const name = (node as { name?: string }).name;

  return typeof name === 'string' ? name : null;
};

/**
 * What a button does, with an omitted param read as `submit`.
 *
 * The same default the renderer takes and the same one `ConvertingAct::collect`
 * takes, so an absent param cannot mean one thing here and another to whatever
 * counts.
 */
const actionOf = (node: TemplateNode): string => {
  const action = (node as { action?: string }).action;

  return typeof action === 'string' ? action : 'submit';
};

/**
 * What the ⇄ control is called for this block, or null where it has no such
 * question.
 *
 * Named for the axis rather than "Change this", because *"Change this"* on a
 * field and *"Change this"* on a button are two different questions and a
 * screen reader hears only the words.
 */
export function swapNameOf(tree: TemplateTree, path: Path): string | null {
  const type = nodeAt(tree, path)?.type;

  if (type === 'field') {
    return __('Capture something else', 'wconvert');
  }

  return type === 'button' ? __('Change what this button does', 'wconvert') : null;
}

/** What one option is called, in the vocabulary's own words. */
export const swapLabel = (tree: TemplateTree, path: Path, to: string, labels: TemplateLabels): string =>
  nameOf(nodeAt(tree, path)?.type === 'field' ? labels.fields : labels.params, to);

/** Announced after a swap, because the row's name and its Slot Roles both change. */
export const swapSaid = (name: string): string =>
  sprintf(
    /* translators: %s: what the block now is, e.g. “Phone number”. */
    __('Changed to %s. Your own wording is kept.', 'wconvert'),
    name,
  );
