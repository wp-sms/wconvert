import type { Path } from './panel';

/**
 * The one address a block answers to on both sides of the preview boundary.
 *
 * ============================================================================
 * IT WAS A [[Slot Role]] AND AN ORDINAL. IT IS THE PATH NOW, AND THAT IS ONE
 * SCHEME INSTEAD OF TWO.
 * ============================================================================
 * The editor holds a {@link Path} — where a node sits in the tree. The preview
 * holds DOM. Neither can hold the other's handle across a remount, because the
 * preview is re-rendered on every keystroke, so the two have to agree on
 * something derived independently on both sides.
 *
 * That used to be `role:headline`, `captures:email`, plus an ordinal where a
 * Role repeated — and it **could not name a container at all.** A `panel`, a
 * `split`, a `stack`, a `media` carry no Role and capture nothing, so
 * `SLOT_SELECTOR` did not match one and a click on a coloured box reached the
 * nearest leaf inside it. For a SCOPE editor whose primary gesture is *select
 * that box* that is not a gap, it is the feature missing. `image`, `icon`,
 * `divider` and `countdown` were unclickable for the same reason.
 *
 * So the renderer stamps the address itself, on every element, when the admin
 * asks for it — `render()`'s `paths` option, off for every visitor on every
 * page (ADR 0040, amended). Both sides then read the same string off the same
 * fact, and there is one scheme rather than a naming convention beside a
 * fallback.
 *
 * **What is given up is that a key survived a MOVE.** `role:headline` named the
 * headline wherever it went; `0.children.2` names the third child. Selection is
 * re-derived from the path the editor is already holding after every edit
 * ({@see useBlockEdits}'s `onMove`), so the cost is that the PREVIEW's
 * selection follows the position rather than the block — and the editor's does
 * not, because the editor never spoke in keys.
 *
 * **ADR 0010's boundary is untouched.** This module edits nothing and the
 * preview edits nothing: a press reports where it landed and stops there. What
 * changed is only how precisely it can say where.
 */
export type SlotKey = string;

/** The address a path spells, which is what the renderer stamps. */
export const keyOf = (path: Path): SlotKey => path.join('.');

/**
 * What the PREVIEW calls the same block, read off what the renderer stamped.
 *
 * Null where nothing stamped one, which is the gallery: a card is a picture and
 * mounts without `paths`, so there is nothing to select and nobody asking.
 */
export function keyOfElement(element: HTMLElement): SlotKey | null {
  const at = element.dataset.path;

  return typeof at === 'string' && at !== '' ? at : null;
}

/**
 * The path a key spells, back again.
 *
 * ============================================================================
 * A SEGMENT IS A NUMBER OR A KEY NAME, AND WHICH IT IS DECIDES INDEXING.
 * ============================================================================
 * `0.children.2` is `[0, 'children', 2]`: the step index, the child key the
 * layout keeps its children under, the position. A `'2'` where a `2` belongs
 * would index nothing on an array, so the two are told apart here rather than
 * at every reader.
 *
 * It is a parse and not a lookup, which is the other half of collapsing the
 * two schemes: the old key had to be searched for in the tree, so a stale one
 * resolved to whatever now occupied a remembered Role. A path is either a real
 * position in the tree the caller holds or it is not, and every reader of one
 * already checks ({@see nodeAt}).
 */
export function pathOfKey(key: SlotKey): Path {
  return key.split('.').map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

/**
 * Everything in a rendered step a press may land on.
 *
 * Every element, because every element is a block the editor has a row for —
 * which is the whole change. A `.wc-pane` is the one thing the renderer draws
 * that is NOT a node, and it carries no `data-path`, so it is excluded by
 * construction rather than by name.
 */
export const SLOT_SELECTOR = '[data-path]';

/**
 * Where a selection came from, which decides who moves.
 *
 * A click in the PREVIEW has to bring the editor to the block it names; a click
 * in the TREE already has focus, on the row, and must not drag the caret down
 * into the inspector — arrow keys have to keep walking the list after it.
 * Same block, opposite obligations, so the origin travels with it rather than
 * being guessed from timing.
 *
 * **One address, and it used to be two.** This carried a `path` for the editor
 * and a `key` for the preview, because a key could not name every block; the
 * key IS the path now, so there is one field and {@link keyOf} spells it where
 * the DOM needs a string.
 */
export interface Selection {
  /** Where the selected block sits, and what the editor writes through. */
  readonly path: Path;
  readonly from: 'preview' | 'tree';
}
