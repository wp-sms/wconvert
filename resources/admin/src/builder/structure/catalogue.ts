import { commerceSupported } from '../../settings';
import { __ } from '@wordpress/i18n';
import { AUTHORED_ROLES, FIELDS, LAYOUTS, LEAVES, ROLES, childKeysOf } from '../panel';
import { capturesTaken, nodeAt, rolesTaken, type Spot } from './tree';
import { submissionScreen, walkNodes } from './journey';
import { graphReaches } from './graph';
import { MAX_PATH_QUESTIONS, questionPath } from './questionBudget';
import { journeysSupported } from '../../settings';
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
 * Which converting act an [[Optin]] is measured by.
 *
 * **Spelled the way {@see \WConvert\Template\ConvertingAct} spells it** —
 * `submit` and `click` — rather than the way a `button` node spells its own
 * `action` param, which is `submit` and **`link`**. Those are two vocabularies
 * for one distinction and PHP already keeps them apart: `ConvertingAct::collect`
 * reads `action === 'link'` and answers `Click`. Keeping the metric's words
 * here is what lets a value read off a tree and a value read off a node be
 * told apart at a glance.
 *
 * ============================================================================
 * THE EDITOR USED TO BE TOLD. IT READS THE DOCUMENT NOW.
 * ============================================================================
 * This came from `converting_act` on the [[Goal]] registry entry, and the
 * argument for being told rather than guessing was that guessing would fail
 * the whole save. It fails nothing now: a Goal declares no act (ADR 0059), so
 * the act is `convertingActOf(template.tree)` — the same walk
 * `ConvertingAct::offeredIn()` makes on the server, over the same tree the
 * builder is already holding.
 *
 * That also deleted a real defect. The registry answered one round trip after
 * the design did, so the builder spent its first renders with no act and
 * passed `act ?? 'submit'` — the structure editor briefly offering a
 * click-metered Optin the wrong menu. There is nothing left to wait for.
 */
export type ConvertingAct = 'submit' | 'click' | 'match' | 'add_to_cart';

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

  /*
    **A layout is asked the same question a leaf is**, and it used to be handed
    `refused: null` unconditionally. That was fine while nothing could refuse
    one and became a hole the moment something could: `nodeFor` has always
    consulted `whyRefused` for every type, so a layout the guard refused was
    offered by the menu and then silently built nothing when pressed.
  */
  return [...Object.keys(LEAVES).filter(offeredHere), ...Object.keys(LAYOUTS)].map((type) => ({
    type,
    leaf: LEAVES[type] !== undefined,
    refused: whyRefused(tree, type, at, act),
  }));
}

/**
 * The one per-install exception to "the manifest decides": a `question` runs
 * only where Pro registered journeys (its `journeys` module shipped), so a free install is not
 * offered one at all — not even disabled, which would be an upsell by another
 * name (ADR 0116). The manifest still declares it, because free's validator
 * has to recognise one arriving in an import.
 */
function offeredHere(type: string): boolean {
  if (type === 'products') return commerceSupported() === true;
  return type !== 'question' || journeysSupported();
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
 *   design that converts on a click there is no such step at all, which is
 *   ADR 0025's "captures nothing" arriving as an absence rather than as a
 *   rule — and it is a fact about the design rather than about the [[Goal]]
 *   over it (ADR 0059).
 */
function whyRefused(
  tree: TemplateTree,
  type: string,
  at: Spot,
  act: ConvertingAct,
): string | null {
  const screen = tree.steps[Number(at.parent[0])];
  const products = tree.steps.some(step => walkNodes(step.content).some(node => node.type === 'products'));
  if (type === 'products' && (tree.steps.length !== 1 || tree.submissions.length > 0 || tree.graph || buttonsIn(tree) > 0 || products)) return __('Use one product recommendation block as the action of a single offer screen.', 'wconvert');
  if (products && ['button', 'field', 'question', 'consent'].includes(type)) return __('This campaign converts through its recommendations.', 'wconvert');
  if (type === 'button' && act === 'click' && buttonsIn(tree) > 0) {
    return __('This design already has its converting link.', 'wconvert');
  }
  if (type === 'followup') {
    const primary = tree.submissions[0]?.id;
    const acceptedAt = submissionScreen(tree, primary);
    if (acceptedAt < 0 || !screen || (tree.graph
      ? screen.id === tree.steps[acceptedAt].id || !graphReaches(tree.graph, tree.steps[acceptedAt].id, screen.id)
      : Number(at.parent[0]) <= acceptedAt)) {
      return __('Resource links belong after capture.', 'wconvert');
    }
  }
  if ((type === 'field' || type === 'consent') && screen?.kind !== 'input') {
    return __('Add contact fields to a question screen.', 'wconvert');
  }
  if (type === 'question') {
    const boundary = tree.steps.findIndex(item => item.kind === 'result' || walkNodes(item.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit'));
    if (screen?.kind !== 'input') return __('Add questions to a question screen.', 'wconvert');
    if (!tree.graph && boundary >= 0 && Number(at.parent[0]) >= boundary) return __('Add questions on a screen before the result or contact submission.', 'wconvert');
    if ((questionPath(tree, screen.id)?.count ?? 0) > MAX_PATH_QUESTIONS) return tree.graph
      ? __('Adding here would put more than ten questions on one path. Use a separate path or remove a question from that path.', 'wconvert')
      : __('This journey already has ten questions.', 'wconvert');
  }

  if (type === 'field' && freeCapture(tree) === null) {
    return __('Every kind of detail this vocabulary can capture is already on the form.', 'wconvert');
  }

  /*
    ==========================================================================
    A COLUMN AT THE TOP OF A STEP IS A NO-OP, SO IT IS NOT OFFERED THERE.
    ==========================================================================
    **Every step IS a column** — `.wc-stack` is `flex-direction: column`, and a
    step renders as one. So adding a Column directly inside a step produces a
    column inside a column: nothing a merchant can see, on the one menu item
    they meet most often. That is most of why *"what is Column for?"* was the
    hardest question this vocabulary asked.

    Its real job is GROUPING — making several blocks behave as one item inside a
    `row`, or as one pane's contents — and that is exactly where it is still
    offered. Refusing it elsewhere is not a narrowing of the vocabulary: the
    tree it would have produced renders identically without it.
  */
  if (type === 'stack' && at.parent.length === 1) {
    return __(
      'A step is already a column. Add one inside a Row, to group blocks into a single item.',
      'wconvert',
    );
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
  capture?: string,
): TemplateNode | null {
  if (!offeredHere(type) || whyRefused(tree, type, at, act) !== null) {
    return null;
  }

  if (LAYOUTS[type] !== undefined) {
    return blankLayout(type);
  }

  if (LEAVES[type] === undefined) {
    return null;
  }

  const node: Record<string, unknown> = { type };
  if (type === 'followup') node.label = __('Open resource', 'wconvert');
  const role = freeRoleFor(tree, type);

  if (role !== null) {
    node.role = role;
  }

  if (type === 'field') {
    const captures = capture ?? freeCapture(tree);

    if (captures === null || !FIELDS.includes(captures) || capturesTaken(tree).includes(captures)) {
      return null;
    }

    // A field capturing nothing the build can canonicalise renders NOTHING —
    // `render.ts` skips it the way it skips an unknown node type — so a new
    // field arrives with a kind or does not arrive.
    node.name = captures;
    node.required = captures !== 'interest';
    if (captures === 'interest') node.options = [];
  }

  if (type === 'products') { node.product_ids = []; node.exclude_cart = true; node.action = act === 'add_to_cart' ? 'add_to_cart' : 'link'; }
  if (type === 'question') {
    node.label = __('What matters most to you?', 'wconvert');
    node.answer_type = 'single';
    node.required = false;
    node.options = [{ value: 'first', label: __('First option', 'wconvert') }, { value: 'second', label: __('Second option', 'wconvert') }];
  }

  if (type === 'button') {
    // The DESIGN decides, and it decides at the moment of creation because
    // `action` is a param rather than content: the Content tab never offers
    // it, so a button that arrives wrong stays wrong until a save refuses the
    // whole config. This is the one place the metric's word becomes the
    // node's.
    //
    // It is unreachable in practice — an Optin has exactly one converting act
    // and `whyRefused` refuses a second button — and it is here because
    // deleting the only button and adding one back is the route that reaches
    // it, and the act to restore is the one the design had (ADR 0059).
    node.action = act === 'click' ? 'link' : 'next';
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
  if (type === 'followup') node.label = __('Open resource', 'wconvert');

  for (const key of childKeysOf(type)) {
    node[key] = [];
  }

  return node as TemplateNode;
}

/**
 * The [[Slot Role]] a newly added block of this kind should carry.
 *
 * ============================================================================
 * AN UNCLAIMED ROLE FIRST, AND A REPEAT RATHER THAN NOTHING.
 * ============================================================================
 * Roles repeat now (ADR 0051), so "they are all spoken for" is no longer a
 * refusal — a third `body` is a third benefit line, and it binds. What the
 * preference preserves is the reason the closed list has thirteen names rather
 * than five: `success_headline` is a different slot from `headline`, and a
 * heading added to a design that has no success headline yet should take that
 * one before it doubles up on a Role something already holds.
 *
 * **Null now means the kind declares no Roles at all** — `image`, because it
 * holds no words, and `field`, because its Roles are derived from what it
 * captures. Both are carried across a Template switch by other means, which is
 * why {@link losesWordsOnSwitch} asks the manifest rather than asking whether
 * `role` is set.
 *
 * ============================================================================
 * AN AUTHORED ROLE IS NEVER HANDED OUT, ONLY EVER CHOSEN.
 * ============================================================================
 * `wordmark` and `code_value` name something only one site has — a shop's name,
 * a coupon in one merchant's WooCommerce — which is why a [[Playbook]] may not
 * fill either ({@see AUTHORED_ROLES}). They are unclaimed on nearly every
 * design, so the *first unclaimed Role* preference would reach for one the
 * moment a design's own headline was taken: adding a second heading handed the
 * merchant a block called **Your name**.
 *
 * A default is a guess, and these are the two Roles nobody can guess. They stay
 * OFFERED in the ⇄ menu, because a masthead is a real thing to add; what they
 * are not is what a new block silently becomes.
 */
export function freeRoleFor(tree: TemplateTree, type: string): string | null {
  const declared = (LEAVES[type]?.roles ?? [])
    .filter((role) => ROLES.includes(role))
    .filter((role) => !AUTHORED_ROLES.includes(role));
  const taken = rolesTaken(tree);

  return declared.find((role) => !taken.includes(role)) ?? declared[0] ?? null;
}

/**
 * Would this block's words be **lost** the next time the merchant switches
 * design?
 *
 * ============================================================================
 * THIS IS THE SHARP VERSION OF A LIMIT THAT IS OTHERWISE INVISIBLE.
 * ============================================================================
 * A block whose kind declares [[Slot Role]]s and carries none has no seam for
 * words to travel on: {@see \WConvert\Template\SlotRoles} carries copy across
 * a Template switch **by Role**, and there is no Role to carry this one by.
 *
 * So it is not that the block *"is not linked to the preview"*, which is true
 * and trivial. It is that a merchant can type a second paragraph, switch
 * design, and find those words gone. `MerchantsOwn` rescues an `image`'s `src`
 * and a `button`'s `href` precisely because no Role does; a role-less block's
 * TEXT has no such rescue, and adding one would mean matching prose by ordinal.
 *
 * **The editor no longer PRODUCES one, and this still has to be asked.** Roles
 * repeat (ADR 0051), so {@link freeRoleFor} always has a name to hand a new
 * block of a kind that declares any — the state this reports is now reachable
 * only from a hand-authored design or an older tree, which is exactly the state
 * a design library brings in. `bin/verify-templates.php` reports the same fact
 * at the keyboard; this reports it to the merchant looking at it.
 *
 * **A kind declaring no Roles is not at risk**, which is why this asks the
 * manifest rather than asking whether `role` is set. An `image` declares none
 * because it holds no words, and a `field` declares none because its Roles are
 * derived from what it captures — both are carried, by `MerchantsOwn` and by
 * the derived Roles respectively.
 */
export function losesWordsOnSwitch(block: { type: string; role: string | null }): boolean {
  return block.role === null && (LEAVES[block.type]?.roles.length ?? 0) > 0;
}

/**
 * The `action` a `button` carries to produce this act.
 *
 * **The one place the metric's word becomes the node's**, on this side of the
 * boundary — the mirror of `ConvertingAct::action()`. `submit` and `click` are
 * how a [[Goal]] is METERED; `submit` and `link` are what a `button` node
 * carries, and those are two vocabularies for one distinction that PHP already
 * keeps apart.
 */
export const actionFor = (act: ConvertingAct): string => (act === 'click' ? 'link' : act === 'match' ? 'next' : act === 'add_to_cart' ? 'add_to_cart' : 'submit');

/** Every `action` a `button` may carry, in the order the acts are declared. */
export const ACTIONS: readonly string[] = ['submit', 'link', 'next', 'back', 'skip', 'close'];

/** A capture kind no field in the tree is using, or null. */
export function freeCapture(tree: TemplateTree): string | null {
  const taken = capturesTaken(tree);

  return FIELDS.find((kind) => !taken.includes(kind)) ?? null;
}

/** First screen with an explicit Submit; navigation buttons do not submit answers. */
export function formStep(tree: TemplateTree): number | null {
  const at = tree.steps.findIndex((step) => submits(step.content));

  return at === -1 ? null : at;
}

function submits(node: TemplateNode): boolean {
  if (node.type === 'button') {
    return (node as { action?: string }).action === 'submit';
  }

  return childKeysOf(node.type).some((key) => childrenOf(node, key).some(submits));
}

function buttonsIn(tree: TemplateTree): number {
  return tree.steps.reduce((carried, step) => carried + buttonsUnder(step.content), 0);
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
