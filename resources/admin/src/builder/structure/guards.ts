import { __, _n, sprintf } from '@wordpress/i18n';
import { childKeysOf } from '../panel';
import { nodeAt, nodesOf, withRemoved, type Block } from './tree';
import type { ConvertingAct } from './catalogue';
import type { Path } from '../panel';
import type { TemplateNode, TemplateTree } from '@renderer/types';

/**
 * The safety net: **what an editor with a Delete key must not let a merchant
 * do to themselves.**
 *
 * ============================================================================
 * THIS IS THE HOLE, AND IT IS OPEN TODAY.
 * ============================================================================
 * `TemplateLibrary::refuse()` enforces one converting act, and it enforces it
 * **at registration** — of a library entry, from a JSON file on disk. It has
 * never applied to an Optin's own `config`, because before this editor there
 * was no way for an Optin's tree to lose its button: the settings panel could
 * not remove a node, and `hidden` is not a param `button` declares, so hiding
 * it was inexpressible rather than merely disallowed
 * (`resources/renderer/src/types.ts`).
 *
 * An editor that can delete closes neither of those doors. Deleting the only
 * button leaves an Optin that renders, publishes, shows, and **reports zero
 * forever** — which ADR 0020 names as the exact failure that looks broken while
 * being right, and which nothing in the save path refuses.
 *
 * So the net is two-sided by construction, and this is only the near side.
 * {@see \WConvert\Rest\OptinController::refuseADesignThatCannotConvert()} is
 * the far one. **Client-side prevention alone is not a safety net**: `PUT
 * /wconvert/v1/optins/{id}` takes a whole `config` and is scriptable by anyone
 * holding `manage_options`, which is the same argument ADR 0026 already made
 * about the goal screen — *"a screen is not an enforcement mechanism"*.
 *
 * ============================================================================
 * REFUSED WITH A REASON, NEVER JUST DISABLED.
 * ============================================================================
 * Every function here answers with a SENTENCE or null. A greyed-out Delete
 * with no explanation is a merchant filing a support ticket; the reason is the
 * whole product of the check, and the caller is expected to put it where the
 * pointer already is.
 */

/**
 * Every converting act the tree offers, once each.
 *
 * The mirror of {@see \WConvert\Template\ConvertingAct::offeredIn()}, down to
 * the default: a `button` whose `action` is anything but `link` submits, which
 * is what `render.ts` assumes too — so an omitted param cannot mean one thing
 * to the renderer and another to whatever counts.
 */
export function convertingActOf(tree: TemplateTree): ConvertingAct[] {
  const found: ConvertingAct[] = [];

  for (const step of tree.steps) {
    collectActs(step, found);
  }

  return (['submit', 'click'] as const).filter((act) => found.includes(act));
}

function collectActs(node: TemplateNode, found: ConvertingAct[]): void {
  if (node.type === 'button') {
    const act: ConvertingAct = (node as { action?: string }).action === 'link' ? 'click' : 'submit';

    if (!found.includes(act)) {
      found.push(act);
    }
  }

  for (const key of childKeysOf(node.type)) {
    const children = (node as Record<string, unknown>)[key];

    if (Array.isArray(children)) {
      for (const child of children as TemplateNode[]) {
        collectActs(child, found);
      }
    }
  }
}

/**
 * Is this the block the Optin's conversions are counted on?
 *
 * A `button` and nothing else. `ConvertingAct::collect()` and
 * {@link convertingActOf} both read a tree and answer WHICH act it offers; this
 * answers *which block it is*, which is what a row needs to say **counted** on
 * exactly one of them.
 *
 * It is said once in the status line today and then forgotten, and it is the
 * single most consequential fact about any block in the design: delete it and
 * the Optin reports zero forever (ADR 0020). A list of blocks that does not
 * point at it is a list missing its most important row.
 */
export const isConvertingAct = (block: Block): boolean => block.type === 'button';

/**
 * Why this block may not be removed, or null.
 *
 * ============================================================================
 * ASKED BY SIMULATING THE REMOVAL, NEVER BY INSPECTING THE BLOCK.
 * ============================================================================
 * "Is this the only button" is the wrong question and it is wrong in the
 * direction that costs the merchant: the block being deleted may be a `row`, or
 * a `split`, holding the button three levels down. Every rule below is
 * therefore asked of **the tree that would result**, which is by construction
 * the same tree the save would send — so the editor and the server cannot
 * disagree about what is left.
 *
 * Two rules, and the second is not the first read twice:
 *
 * 1. **The converting act.** An Optin with none can never report anything. This
 *    is the rule the PHP side mirrors.
 * 2. **The last field, while the form still submits.** A form with a submit
 *    button and no inputs captures nothing and produces no [[Lead]] — the
 *    submission is a Conversion with no content. Client-side only, deliberately:
 *    it is a design mistake rather than a data-integrity one, and refusing it at
 *    the write would block a merchant mid-rearrangement who is about to add the
 *    field back.
 */
export function whyRemovalIsRefused(tree: TemplateTree, path: Path): string | null {
  if (nodeAt(tree, path) === null) {
    return null;
  }

  const after = withRemoved(tree, path);

  if (convertingActOf(tree).length > 0 && convertingActOf(after).length === 0) {
    /*
      **Shortened, and the cut is the rule rather than a word count.** These
      sentences print under a disabled menu item, in a menu of six — so a
      merchant reads them while hunting for a control, not while studying. Each
      one now says the fact and the door, and nothing else: the paragraph the
      first version added ("change what it says instead, or pick a different
      design") is two doors for a state where the first one is enough.
    */
    return __('The only thing here that counts as a conversion.', 'wconvert');
  }

  if (convertingActOf(after).includes('submit') && fieldsIn(after) === 0 && fieldsIn(tree) > 0) {
    return __('The only field. A form with none captures nothing.', 'wconvert');
  }

  return null;
}

/**
 * Why this block may not be duplicated, or null.
 *
 * The two things a copy cannot be. A second `button` is a second converting
 * act the Optin does not have and cannot report; a second `field` of a kind
 * already captured collides on the `id` the renderer derives from that kind,
 * and on the [[Slot Role]]s derived from it beside — which
 * `TemplateVocabulary::normalize()` settles by silently dropping the later
 * one's.
 *
 * Asked of the SUBTREE rather than the block, for the same reason removal is:
 * duplicating a `row` duplicates whatever the row holds.
 */
export function whyDuplicationIsRefused(tree: TemplateTree, path: Path): string | null {
  const node = nodeAt(tree, path);

  if (node === null) {
    return null;
  }

  if (typesUnder(node).includes('button')) {
    return __('An Optin counts exactly one conversion, so it has one button.', 'wconvert');
  }

  if (typesUnder(node).includes('field')) {
    return __('Two fields capturing the same detail collide. Add one instead.', 'wconvert');
  }

  return null;
}

/**
 * What a Delete has to say before it happens, or null where it says nothing.
 *
 * ============================================================================
 * THE AFFORDANCE IS THE WARNING, BECAUSE THE CONFIRM DIALOG IS NOT COMING.
 * ============================================================================
 * ADR 0039 says a destructive action **always confirms**, and it is right about
 * the actions it was written for — deleting an Optin, clearing the Lead log.
 * It is wrong about a block, and the reason is arithmetic: a merchant
 * rearranging a design deletes and re-adds a dozen times in a minute, and a
 * dialog on every one of them is a dialog they learn to dismiss without
 * reading, which is strictly worse than no dialog at all.
 *
 * **Undo is what buys that exemption**, and it is a precondition rather than a
 * nicety — a Delete with no history behind it is an unconfirmed destructive
 * action with no way back, which is the thing ADR 0039 actually forbids. The
 * amendment is recorded there rather than only here.
 *
 * What is left for this sentence is the one thing undo cannot fix in advance:
 * *"it takes its children"* is a surprise, and a merchant who is surprised has
 * already had to notice, find and press Undo.
 */
export function whatRemovalTakes(block: Block): string | null {
  return block.holds === 0
    ? null
    : sprintf(
        /* translators: %d: how many blocks sit inside the one being removed. */
        _n('This takes the %d block inside it too.', 'This takes the %d blocks inside it too.', block.holds, 'wconvert'),
        block.holds,
      );
}

/** How many fields the tree has that the renderer would actually draw. */
function fieldsIn(tree: TemplateTree): number {
  return nodesOf(tree).filter((block) => block.type === 'field' && block.captures !== null).length;
}

function typesUnder(node: TemplateNode): string[] {
  return childKeysOf(node.type).reduce<string[]>((carried, key) => {
    const children = (node as Record<string, unknown>)[key];

    return Array.isArray(children)
      ? [...carried, ...(children as TemplateNode[]).flatMap(typesUnder)]
      : carried;
  }, [node.type]);
}
