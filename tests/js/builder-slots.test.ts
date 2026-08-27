import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '../../resources/renderer/src/render';
import { slotsOf, withHidden } from '../../resources/admin/src/builder/panel';
import {
  SLOT_SELECTOR,
  capturesKey,
  keyOfElement,
  keyOfSlot,
  roleKey,
} from '../../resources/admin/src/builder/slots';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';

/**
 * **The two sides of the preview name the same slot the same way**, which is
 * the whole of what makes a click in the preview reach the block that edits it
 * (ADR 0040).
 *
 * That is not a layout question and so it is not on the wrong side of #29's
 * line: the panel derives a key from a {@link Slot} and the preview derives one
 * from DOM the renderer stamped, in two files that share no code path. If the
 * two ever disagree, nothing throws and nothing looks broken — clicking a
 * headline simply does nothing, silently, forever. That is exactly the failure
 * shape worth a test.
 *
 * It runs against a REAL library entry through the REAL renderer, so it cannot
 * pass against a vocabulary the product does not ship.
 */

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

/** Every key the PREVIEW offers, for one rendered step. */
function keysInPreview(step: number): string[] {
  const root = render(ENTRY.tree, ENTRY.tokens, step);

  return Array.from(root.querySelectorAll<HTMLElement>(SLOT_SELECTOR))
    .map(keyOfElement)
    .filter((key): key is string => key !== null);
}

/** Every key the PANEL offers, across every step. */
function keysInPanel(tree = ENTRY.tree): string[] {
  return slotsOf(tree)
    .map(keyOfSlot)
    .filter((key): key is string => key !== null);
}

describe('the key a slot is known by', () => {
  /**
   * A [[Slot Role]] where one is declared, and the capture kind where one is
   * not — because a `field`'s Roles are DERIVED from what it captures rather
   * than declared, so it carries no `role` to be found by (CONTEXT.md, Slot
   * Role). That derivation is the reason the renderer stamps `data-captures` at
   * all.
   */
  it('is the Role, or what the field captures', () => {
    expect(keysInPanel()).toContain(roleKey('headline'));
    expect(keysInPanel()).toContain(capturesKey('email'));
  });

  /** A key from one side is a key on the other, for the same rendered step. */
  it('agrees between the panel and the preview', () => {
    const panel = new Set(keysInPanel());

    for (const step of [0, 1]) {
      const preview = keysInPreview(step);

      expect(preview.length).toBeGreaterThan(0);

      for (const key of preview) {
        expect(panel).toContain(key);
      }
    }
  });

  /**
   * **Every slot the merchant can see is clickable.** The consent slot ships
   * hidden (ADR 0032) and the renderer skips it, so the first step's visible
   * keys are the rest of the step and nothing else.
   */
  it('covers every slot the renderer actually drew', () => {
    expect(keysInPreview(0)).toEqual([
      roleKey('headline'),
      roleKey('body'),
      capturesKey('email'),
      roleKey('cta_label'),
      roleKey('fine_print'),
    ]);
  });

  /**
   * And a slot switched ON in the panel becomes clickable, with no second
   * spelling anywhere: the key was always derivable, the element simply was not
   * being drawn.
   */
  it('reaches a slot the merchant switches back on', () => {
    const consent = slotsOf(ENTRY.tree).find((slot) => slot.type === 'consent');

    expect(consent).toBeDefined();

    const shown = render(withHidden(ENTRY.tree, consent!.path, false), ENTRY.tokens, 0);

    expect(
      Array.from(shown.querySelectorAll<HTMLElement>(SLOT_SELECTOR)).map(keyOfElement),
    ).toContain(roleKey('consent_text'));
  });

  /**
   * A layout node is unaddressable, and that is correct rather than a gap: it
   * says nothing the merchant edits, so there is no block in the panel for a
   * click to travel to.
   */
  it('names nothing for a node with neither a Role nor a capture kind', () => {
    expect(keyOfSlot({ role: null, captures: null })).toBeNull();
    expect(keyOfElement(document.createElement('div'))).toBeNull();
  });
});
