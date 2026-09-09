import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '../../resources/renderer/src/render';
import { slotsOf, withHidden } from '../../resources/admin/src/builder/panel';
import { nodesOf } from '../../resources/admin/src/builder/structure/tree';
import {
  SLOT_SELECTOR,
  keyOf,
  keyOfElement,
  pathOfKey,
} from '../../resources/admin/src/builder/slots';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';

/**
 * **The two sides of the preview address the same block the same way**, which
 * is the whole of what makes a click in the preview reach the row that edits it
 * (ADR 0040).
 *
 * That is not a layout question and so it is not on the wrong side of #29's
 * line: the editor holds a `Path` and the preview reads a string the renderer
 * stamped, in two files that share no code path. If the two ever disagree,
 * nothing throws and nothing looks broken — clicking a headline simply does
 * nothing, silently, forever. That is exactly the failure shape worth a test.
 *
 * ============================================================================
 * IT WAS A [[Slot Role]] AND AN ORDINAL, AND IT COULD NOT NAME A BOX.
 * ============================================================================
 * `role:headline`, `captures:email`, `role:body#2`. Every container carries
 * neither, so `SLOT_SELECTOR` did not match one — a click on a coloured box
 * reached the nearest leaf inside it, and a *scope* editor whose primary
 * gesture is *select that box* could not select a box. `image`, `icon`,
 * `divider` and `countdown` were unclickable for the same reason.
 *
 * The renderer stamps the address now, on every element, when the admin asks
 * (ADR 0040, amended). So these assertions are about one scheme rather than
 * two lists agreeing.
 *
 * It runs against a REAL library entry through the REAL renderer, so it cannot
 * pass against a vocabulary the product does not ship.
 */

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

/** A design with a container in it, so the case that was missing is covered. */
const FIELDWORK = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/fieldwork.json'), 'utf8'),
) as TemplateEntry;

/** Every address the PREVIEW offers, for one rendered step. */
function inPreview(entry: TemplateEntry, step: number): string[] {
  const root = render(entry.tree, entry.tokens, step, { paths: true });

  return Array.from(root.querySelectorAll<HTMLElement>(SLOT_SELECTOR))
    .map(keyOfElement)
    .filter((key): key is string => key !== null);
}

/** Every address the EDITOR offers, across every step. */
const inEditor = (entry: TemplateEntry): string[] => nodesOf(entry.tree).map((block) => keyOf(block.path));

describe('the address a block is known by', () => {
  it('is off by default, because a visitor has nothing to select', () => {
    const root = render(ENTRY.tree, ENTRY.tokens, 0);

    expect(root.querySelectorAll(SLOT_SELECTOR)).toHaveLength(0);
    expect(root.outerHTML).not.toContain('data-path');
  });

  it('is the path, spelled the same on both sides', () => {
    const editor = inEditor(ENTRY);

    expect(editor).toContain('0');
    expect(inPreview(ENTRY, 0).every((key) => editor.includes(key))).toBe(true);
  });

  /**
   * **The case the old scheme could not express at all.** `fieldwork`'s step is
   * a `split` holding a `media` and a `panel`, and none of the three carries a
   * Role or a capture kind.
   */
  it('names a container, which is the whole reason it changed', () => {
    const boxes = inPreview(FIELDWORK, 0);

    // The step root, the media, the panel — and the leaves inside both.
    expect(boxes).toContain('0');
    expect(boxes).toContain('0.start.0');
    expect(boxes).toContain('0.end.0');
    expect(boxes).toContain('0.start.0.children.0');
    expect(boxes.every((key) => inEditor(FIELDWORK).includes(key))).toBe(true);
  });

  /** A `.wc-pane` is the one thing the renderer draws that is not a node. */
  it('addresses nothing the renderer invented, so a pane is not selectable', () => {
    const root = render(FIELDWORK.tree, FIELDWORK.tokens, 0, { paths: true });

    for (const pane of root.querySelectorAll<HTMLElement>('.wc-pane')) {
      expect(pane.dataset.path).toBeUndefined();
    }
  });

  it('reads back as the path it spelled, with numbers as numbers', () => {
    expect(pathOfKey('0.start.0.children.1')).toEqual([0, 'start', 0, 'children', 1]);
    expect(keyOf(pathOfKey('1.children.0'))).toBe('1.children.0');
  });

  /**
   * A Role repeats (ADR 0051), and a design may claim `body` three times. The
   * old scheme needed an ordinal for that and the ordinal had to be counted in
   * document order on one side and tree order on the other; a path is distinct
   * by construction.
   */
  it('tells three same-named slots apart with no ordinal to keep in step', () => {
    const three = {
      steps: [
        {
          type: 'stack',
          children: [
            { type: 'text', role: 'body', text: 'one' },
            { type: 'text', role: 'body', text: 'two' },
            { type: 'text', role: 'body', text: 'three' },
          ],
        },
      ],
    };
    const root = render(three as never, {}, 0, { paths: true });

    expect(
      Array.from(root.querySelectorAll<HTMLElement>(SLOT_SELECTOR)).map(keyOfElement),
    ).toEqual(['0', '0.children.0', '0.children.1', '0.children.2']);
  });

  /**
   * **A hidden slot is absent from both sides**, and it always was: the
   * renderer skips it, so there is nothing in the preview to click or outline.
   * The row is still selectable in the tree, by path — which is now the same
   * address, so the two cannot disagree about which block a gap belongs to.
   */
  it('is absent from the preview for a slot the merchant switched off', () => {
    const consent = slotsOf(ENTRY.tree).find((slot) => slot.role === 'consent_text');

    expect(consent, 'the fixture has no consent slot to hide').toBeDefined();

    const shown = { ...ENTRY, tree: withHidden(ENTRY.tree, (consent as { path: never }).path, false) };
    const hidden = { ...ENTRY, tree: withHidden(ENTRY.tree, (consent as { path: never }).path, true) };
    const at = keyOf((consent as { path: never }).path);

    expect(inPreview(shown, 0)).toContain(at);
    expect(inPreview(hidden, 0)).not.toContain(at);
    // And the editor still has a row for it, so it can be switched back on.
    expect(inEditor(hidden)).toContain(at);
  });

  it('answers null for an element nothing stamped', () => {
    expect(keyOfElement(document.createElement('div'))).toBeNull();
  });

  /** The success step is a step of its own, and its addresses say so. */
  it('carries the step, so a block on step 2 is not a block on step 1', () => {
    expect(inPreview(ENTRY, 1).every((key) => key.startsWith('1'))).toBe(true);
    expect(inPreview(ENTRY, 0).every((key) => key.startsWith('0'))).toBe(true);
  });
});
