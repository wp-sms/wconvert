import type { Slot } from './panel';

/**
 * The one name a slot answers to on both sides of the preview boundary.
 *
 * The settings panel holds a {@link Slot} — a path into the tree, a Role, a
 * capture kind. The preview holds DOM the renderer stamped. Neither can see the
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
 * A click in the PREVIEW has to put the caret in the panel; a focus in the
 * PANEL must not then drag the caret back out of the field the merchant just
 * reached. Same key, opposite obligations — so the origin travels with it
 * rather than being guessed from timing.
 *
 * `structure` is the third surface and it behaves like `panel` on purpose: a
 * merchant clicking a row in the block tree already has focus, on the row, and
 * dragging the caret into a control on a tab they are not looking at would be a
 * selection they never see. It is named rather than folded into `panel` because
 * the two are different surfaces and a reader should not have to know that one
 * of them is currently spelled as the other.
 */
export interface Selection {
  readonly key: SlotKey;
  readonly from: 'preview' | 'panel' | 'structure';
}
