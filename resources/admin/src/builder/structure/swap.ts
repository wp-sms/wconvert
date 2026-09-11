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
 * - **An action that would leave the design with the wrong number of steps.**
 *   A submit-metered design has a terminal success step and a click-metered
 *   one does not (ADR 0025), so flipping the button has to add or remove that
 *   step — and `⇄` changes one param. It said *"your goal counts form
 *   submissions … change the goal to change this"*, which was true of a Goal
 *   that declared an act and is not true of one that does not (ADR 0059).
 *   Turning the flip ON is the Success Action feature and a separate ticket;
 *   what changed here is only the reason.
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
 * ============================================================================
 * THE FLIP IS STILL REFUSED, AND THE REASON IT GIVES WAS WRONG.
 * ============================================================================
 * It said *"This Optin's goal counts form submissions, so its button has to
 * submit the form. **Change the goal to change this.**"* — two false claims in
 * one sentence. A Goal counts no act at all now (ADR 0059), and the door it
 * named was one the builder did not have.
 *
 * **What actually refuses it is the STEP COUNT.** A submit-metered design has
 * two steps, because the post-submit success state is a terminal step; a
 * click-metered one has one, because the click navigates the visitor away and
 * an interstitial is worse than the navigation it delays
 * ({@see ConvertingAct#steps}, ADR 0025). `TemplateLibrary::refuse()` holds
 * that at registration and the save holds it for an Optin — so flipping the
 * action alone produces a config that is refused whichever way it is flipped.
 *
 * **Turning it on is a real feature and a separate ticket.** It is what
 * OptinMonster calls a per-button Success Action, and the work is the STEP: a
 * flip to `link` has to drop the success step and carry its words somewhere, a
 * flip to `submit` has to build one. That is a document edit, not a param
 * edit, and this control edits params.
 *
 * The Goal comes first no longer; the step rule does, because it is the one
 * that would fail the whole save. "There are still fields" is second because
 * it is a consequence of the design the merchant is looking at.
 */
function whyActionIsRefused(tree: TemplateTree, action: string, act: ConvertingAct): string | null {
  if (action !== actionFor(act)) {
    return act === 'submit'
      ? __(
          'A design that submits has a second step for what the visitor sees afterwards, and a design that links away has none. Pick a design that links away from the Design tab.',
          'wconvert',
        )
      : __(
          'A design that links away has no second step, and one that submits needs one for what the visitor sees afterwards. Pick a design that submits from the Design tab.',
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
  let carried = withValue(tree, path, 'name', to);
  carried = withValue(carried, path, 'options', to === 'interest' ? [] : undefined);
  if (to === 'interest') carried = withValue(carried, path, 'required', false);

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
