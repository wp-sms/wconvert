import { slotsOf } from './panel';
import type { Path, Slot } from './panel';
import type { TemplateTree } from '@renderer/types';

/**
 * The one name a slot answers to on both sides of the preview boundary.
 *
 * The editor holds a {@link Slot} — a path into the tree, a Role, a capture
 * kind. The preview holds DOM the renderer stamped. Neither can see the
 * other's handle: a `Path` is meaningless to an element, and an element is not
 * something the panel may hold a reference to across a remount, because the
 * preview is re-rendered on every keystroke.
 *
 * So the two agree on a STRING, derived on both sides from the same facts.
 * That is also what keeps ADR 0010's boundary intact — a key names a slot and
 * carries no way to reach one, so selection can travel in both directions
 * without anything gaining the ability to write.
 *
 * A [[Slot Role]] where the slot declares one, and what it captures where it
 * does not: a `field`'s Roles are DERIVED from the capture kind rather than
 * declared (CONTEXT.md, Slot Role), so it carries no `role` to be found by.
 * Prefixed, so a Role and a capture kind that happened to share a word could
 * never collide.
 */
export type SlotKey = string;

export const roleKey = (role: string): SlotKey => `role:${role}`;
export const capturesKey = (captures: string): SlotKey => `captures:${captures}`;

/**
 * What the panel calls a slot, or null for one neither side can name.
 *
 * A layout node with no Role and no capture kind is unaddressable and that is
 * correct rather than a gap: it says nothing the merchant edits, so there is no
 * block in the panel for a click to travel to.
 */
export function keyOfSlot(slot: Pick<Slot, 'role' | 'captures'>): SlotKey | null {
  if (slot.role !== null) {
    return roleKey(slot.role);
  }

  return slot.captures !== null ? capturesKey(slot.captures) : null;
}

/** What the PREVIEW calls the same slot, read off what the renderer stamped. */
export function keyOfElement(element: HTMLElement): SlotKey | null {
  const { role, captures } = element.dataset;

  if (typeof role === 'string' && role !== '') {
    return roleKey(role);
  }

  return typeof captures === 'string' && captures !== '' ? capturesKey(captures) : null;
}

/** Everything in a rendered step that the panel has a block for. */
export const SLOT_SELECTOR = '[data-role],[data-captures]';

/**
 * Where a selection came from, which decides who moves.
 *
 * A click in the PREVIEW has to bring the editor to the block it names; a click
 * in the TREE already has focus, on the row, and must not drag the caret down
 * into the inspector — arrow keys have to keep walking the list after it.
 * Same block, opposite obligations, so the origin travels with it rather than
 * being guessed from timing.
 *
 * Two arms rather than three, because there are two surfaces now. `panel` and
 * `structure` were the two halves of one editor split across two tabs, and
 * both meant *the merchant is already here*.
 */
export interface Selection {
  /**
   * **The authoritative address of the selected block**, and what the editor
   * writes through.
   *
   * ==========================================================================
   * A KEY NAMES A SLOT. IT CANNOT NAME EVERY BLOCK.
   * ==========================================================================
   * Selection was a {@link SlotKey} alone, and ADR 0040 chose that
   * deliberately: it names a slot and carries no way to REACH one, so nothing
   * receiving a selection could write. That held while the only thing being
   * selected was a slot the old settings panel had a control for.
   *
   * It cannot hold for an editor that edits a block where it is selected. A
   * block with no [[Slot Role]] has no key at all ({@link keyOfSlot} answers
   * null), and two role-less blocks of the same type are indistinguishable by
   * one — and those are precisely the blocks that most need editing, because
   * they are the ones the structure editor's own warning is about.
   *
   * **ADR 0040's boundary is untouched in the direction it was written for.**
   * The PREVIEW still receives a key, and a key still carries no way to reach a
   * node. What changed is the panel, which was always the thing that writes and
   * which has addressed nodes by `Path` since `panel.ts` was written.
   */
  readonly path: Path;
  /** What the preview outlines, or null for a block the preview cannot name. */
  readonly key: SlotKey | null;
  readonly from: 'preview' | 'tree';
}

/**
 * Where the slot a key names actually sits, or null where nothing carries it.
 *
 * The one direction a key cannot be derived in — {@link keyOfSlot} goes the
 * other way — and it exists because the PREVIEW still speaks in keys while the
 * editor now addresses by path. The lookup is the tree's, so a stale key from
 * before a save resolves to nothing rather than to whatever now occupies a
 * remembered position.
 */
export function pathOfKey(tree: TemplateTree, key: SlotKey): Path | null {
  return slotsOf(tree).find((slot) => keyOfSlot(slot) === key)?.path ?? null;
}
