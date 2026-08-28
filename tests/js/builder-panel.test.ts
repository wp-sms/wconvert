import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHOICES,
  TOKENS,
  groupOf,
  groupsOf,
  slotsOf,
  withHidden,
  withValue,
} from '../../resources/admin/src/builder/panel';
import type { TemplateNode, TemplateTree, Tokens } from '@renderer/types';

/**
 * **The panel edits tokens, slot content and slot visibility — never
 * arrangement** (ADR 0010).
 *
 * That boundary is what keeps the vocabulary the ceiling on design variety,
 * and what lets a canvas land later as an editor over a tree that already
 * exists rather than as a migration. So the panel's model of a design is a
 * flat list of slots against a tree it never restructures: each slot names
 * where it is, which words it holds, and whether it is switched on.
 */

const TREE: TemplateTree = {
  steps: [
    {
      type: 'stack',
      children: [
        { type: 'heading', role: 'headline', text: 'Join' },
        { type: 'split', start: [{ type: 'image', src: '/x.png', alt: 'A tote' }], end: [] },
        { type: 'consent', role: 'consent_text', text: 'Email me', hidden: true },
      ],
    },
  ],
};

describe('the slots of a design', () => {
  it('is every leaf that holds words or an image, in tree order, wherever it sits', () => {
    expect(slotsOf(TREE).map((slot) => [slot.type, slot.role, slot.hidden])).toEqual([
      ['heading', 'headline', false],
      // Inside a `split`'s far pane, which is exactly where a second reader
      // forgets to look.
      ['image', null, false],
      ['consent', 'consent_text', true],
    ]);
  });
});

const LIBRARY = resolve(import.meta.dirname, '../../resources/templates/library');

const SHIPPED: [string, { tree: TemplateTree; tokens: Tokens }][] = readdirSync(LIBRARY)
  .filter((file) => file.endsWith('.json'))
  .map((file) => {
    const entry = JSON.parse(readFileSync(resolve(LIBRARY, file), 'utf8')) as {
      id: string;
      tree: TemplateTree;
      tokens: Tokens;
    };

    return [entry.id, entry];
  });

/** A design's arrangement, and nothing else: node types and how they nest. */
function shapeOf(node: TemplateNode | TemplateTree): unknown {
  const branch = node as Record<string, unknown>;
  const children = ['steps', 'children', 'start', 'end']
    .filter((key) => Array.isArray(branch[key]))
    .map((key) => [key, (branch[key] as TemplateNode[]).map(shapeOf)]);

  return [(node as TemplateNode).type ?? 'tree', children];
}

/**
 * **Every shipped Template is reachable through the panel** (ADR 0010).
 *
 * That is the claim the dev-only export exists to make good on: authoring is
 * the panel plus an export rather than hand-written JSON, so a shipped design
 * the panel could not have produced is a design the merchant cannot adjust.
 * Asserted from the panel's side here, and from PHP's in
 * `tests/unit/Template/TemplateLibraryTest.php`, which re-normalises each
 * entry against the vocabulary.
 */
describe('every shipped design, through the panel', () => {
  it('has designs to check, so this is not asserted about nothing', () => {
    expect(SHIPPED.length).toBeGreaterThan(0);
  });

  it.each(SHIPPED)('offers a slot for every value in it: %s', (_id, entry) => {
    const slots = slotsOf(entry.tree);

    // Writing each slot's own values back is the identity, which is the exact
    // statement of "the panel can express this design": anything the tree says
    // that no slot carries would be lost here.
    const rebuilt = slots.reduce(
      (tree, slot) =>
        slot.keys.reduce((inner, key) => withValue(inner, slot.path, key, slot.values[key]), tree),
      entry.tree,
    );

    expect(rebuilt).toEqual(entry.tree);
  });

  it.each(SHIPPED)('names no token the panel does not offer: %s', (_id, entry) => {
    const offered = TOKENS.map((token) => token.name);

    expect(Object.keys(entry.tokens).filter((name) => !offered.includes(name))).toEqual([]);
  });

  /**
   * **The panel edits content and visibility and never arrangement.** Asserted
   * by doing everything the panel can do at once and comparing what is left:
   * node types and nesting, unchanged. A panel that could add, remove or
   * reorder a node would move the vocabulary's ceiling into a builder nobody
   * designed, and would cost the no-migration guarantee a canvas depends on.
   */
  it.each(SHIPPED)('cannot change its arrangement, whatever it edits: %s', (_id, entry) => {
    const edited = slotsOf(entry.tree).reduce((tree, slot) => {
      const withWords = slot.keys.reduce((inner, key) => withValue(inner, slot.path, key, `${key}!`), tree);

      return slot.hideable ? withHidden(withWords, slot.path, !slot.hidden) : withWords;
    }, entry.tree);

    expect(shapeOf(edited)).toEqual(shapeOf(entry.tree));
    // Not a tautology: the edits have to have landed for the comparison above
    // to mean anything.
    expect(edited).not.toEqual(entry.tree);
  });
});

/**
 * ============================================================================
 * THE ADR 0010 GUARD: A TOKEN THIS BUNDLE HAS NEVER HEARD OF STILL APPEARS.
 * ============================================================================
 * *"A token added to `resources/templates/manifest.json` appears in the editor
 * with no change to this bundle"* is ADR 0010's promise, and grouping the panel
 * is the first thing that could quietly break it: a `switch` over three known
 * groups drops anything it does not recognise on the floor, and the token would
 * be declared, shipped in the payload, read by the stylesheet — and invisible.
 *
 * So the trailing group is load-bearing rather than tidy, and this is the test
 * that says so.
 */
describe('grouping the Design panel', () => {
  const declared = (name: string, fallback: string) => ({ name, fallback });

  it('puts a token it recognises nothing about in the trailing group', () => {
    const grouped = groupsOf([declared('shadow', '0 10px 40px rgba(0, 0, 0, 0.18)')]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].id).toBe('other');
    expect(grouped[0].tokens.map((token) => token.name)).toEqual(['shadow']);
  });

  /**
   * Each arm is a SHAPE rather than a name, so this file names no token and a
   * new one lands where its value says it belongs.
   */
  it('reads the group off the value, never off the token name', () => {
    const grouped = groupsOf([
      declared('brand-tint', '#ff0055'),
      declared('veil', 'rgba(0, 0, 0, 0.4)'),
      declared('display-face', "Georgia, 'Times New Roman', serif"),
      declared('rhythm', '1.25rem'),
    ]);

    expect(grouped.map((group) => group.id)).toEqual(['colour', 'type', 'space']);
    expect(grouped[0].tokens.map((token) => token.name)).toEqual(['brand-tint', 'veil']);
    expect(grouped[1].tokens.map((token) => token.name)).toEqual(['display-face']);
    expect(grouped[2].tokens.map((token) => token.name)).toEqual(['rhythm']);
  });

  /**
   * A keyword the manifest offers a list for is a control even though its value
   * says nothing — which is the whole reason `choices` exists. `align` is the
   * one in the shipped vocabulary.
   */
  it('groups a keyword the manifest offers choices for, which its value could not', () => {
    expect(groupOf(declared('align', 'start'))).toBe('space');
    // The same shape with no choices declared has nothing to go on, so it falls
    // to the trailing group and gets a text box.
    expect(groupOf(declared('made-up', 'start'))).toBe('other');
  });

  /** Every token the manifest declares reaches a group, and none reaches two. */
  it('places every declared token exactly once', () => {
    const placed = groupsOf().flatMap((group) => group.tokens.map((token) => token.name));

    expect([...placed].sort()).toEqual(TOKENS.map((token) => token.name).sort());
    expect(new Set(placed).size).toBe(placed.length);
  });
});

/**
 * `choices` is a SIBLING section rather than `tokens` becoming objects, so it
 * has to be kept honest against the section it describes: a list for a token
 * the manifest does not declare would be a control the panel draws for
 * something the renderer never reads.
 *
 * (The mirror assertion — every offered value has a translated name — is PHP's,
 * because the words are PHP's: `TemplateLabelParityTest::testEveryTokenChoiceIsNamed`.)
 */
describe('the manifest’s choices', () => {
  it('offers nothing for a token the manifest does not declare', () => {
    const declared = new Set(TOKENS.map((token) => token.name));

    expect(Object.keys(CHOICES).filter((name) => !declared.has(name))).toEqual([]);
  });

  it('offers at least two values wherever it offers any', () => {
    for (const [token, values] of Object.entries(CHOICES)) {
      expect(values.length, token).toBeGreaterThan(1);
      expect(new Set(values).size, token).toBe(values.length);
    }
  });
});
