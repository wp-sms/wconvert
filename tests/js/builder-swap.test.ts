import { treeFixture } from './support/journey';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { swapsFor, withSwapped } from '../../resources/admin/src/builder/structure/swap';
import { nodeAt } from '../../resources/admin/src/builder/structure/tree';
import type { TemplateEntry, TemplateLabels } from '../../resources/admin/src/templates/api';
import type { TemplateNode, TemplateTree } from '@renderer/types';

/**
 * ============================================================================
 * WHAT A BLOCK MAY BE CHANGED INTO, AND WHAT THAT COSTS ITS WORDS.
 * ============================================================================
 * A `field`'s capture kind and a `button`'s action are the two params that
 * decide what a block IS, and until now neither had a control anywhere in the
 * plugin — so an email field could never become a phone field.
 *
 * Pure, so it is tested here rather than through a screen. What only the screen
 * can answer — that the ⇄ menu reaches these and that the refusals are printed
 * where the pointer is — is in `builder-structure-view.test.tsx`.
 */

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

/**
 * Stand-ins for the words the gallery route serves. The real ones are PHP's,
 * asserted against the manifest in `TemplateLabelParityTest`.
 */
const LABELS: TemplateLabels = {
  roles: {},
  nodes: {},
  layouts: {},
  layoutNotes: {},
  layoutParams: {},
  layoutParamValues: {},
  nodeParams: {},
  nodeParamValues: {},
  fields: { email: 'Email address', name: 'Name', phone: 'Phone number' },
  placeholders: { email: 'you@example.com', name: 'Your name', phone: '+44 7700 900000' },
  keys: {},
  params: { submit: 'Sends the form', link: 'Goes somewhere else' },
  tokenValues: {},
  tokens: {},
};

/** `centred-card`: a stack holding heading, text, row(field, button), consent, text. */
const FIELD = [0, 'children', 2, 'children', 0];
const BUTTON = [0, 'children', 2, 'children', 1];
const HEADLINE = [0, 'children', 0];

const at = (tree: TemplateTree, path: readonly (string | number)[]): Record<string, unknown> =>
  nodeAt(tree, path) as unknown as Record<string, unknown>;

const offered = (tree: TemplateTree, path: readonly (string | number)[], act: 'submit' | 'click' = 'submit') =>
  Object.fromEntries(swapsFor(tree, path, act).map((swap) => [swap.to, swap.refused]));

describe('what a block may become', () => {
  it('offers every capture kind for a field, and marks the one it already is', () => {
    const swaps = swapsFor(ENTRY.tree, FIELD, 'submit');

    expect(swaps.map((swap) => swap.to)).toEqual(['email', 'name', 'phone', 'interest']);
    expect(swaps.find((swap) => swap.current)?.to).toBe('email');
  });

  /**
   * **The renderer derives an input's `id` from the capture kind**, so two
   * `email` fields are two elements carrying `id="wc-email"` — and their
   * derived [[Slot Role]]s collide beside, which `normalize()` settles by
   * dropping the later one's. The same refusal `additionsIn` already makes.
   */
  it('refuses a kind the form already captures, and says why', () => {
    const withPhone = withSwapped(ENTRY.tree, FIELD, 'phone', 'submit', LABELS);
    // Two fields now: the swapped one, and a copy of it left as email.
    const two: TemplateTree = treeFixture({
      steps: [
        {
          ...(withPhone.steps[0].content as unknown as { children: TemplateNode[] }),
          children: [
            ...(withPhone.steps[0].content as unknown as { children: TemplateNode[] }).children,
            { type: 'field', name: 'email' } as TemplateNode,
          ],
        } as unknown as TemplateNode,
      ],
    });

    expect(offered(two, FIELD).email).toMatch(/already captures/);
    expect(offered(two, FIELD).phone).toBeNull();
  });

  it('offers nothing for a block with no such question', () => {
    expect(swapsFor(ENTRY.tree, HEADLINE, 'submit')).toEqual([]);
    expect(swapsFor(ENTRY.tree, [0], 'submit')).toEqual([]);
    expect(swapsFor(ENTRY.tree, [9, 'children', 0], 'submit')).toEqual([]);
  });
});

/**
 * ============================================================================
 * THE BUTTON'S REFUSALS ARE THE SAVE'S, MET EARLY — AND THE REASON CHANGED.
 * ============================================================================
 * The flip is still refused and it said the wrong thing: *"This Optin's goal
 * counts form submissions, so its button has to submit the form. **Change the
 * goal to change this.**"* — a Goal counts no act now (ADR 0059), and the door
 * it named was one the builder did not have.
 *
 * What actually refuses it is the STEP COUNT. A design that submits has a
 * terminal success step and one that links away has none (ADR 0025), so
 * flipping the action alone leaves a config the save rejects whichever way it
 * went. Turning the flip ON is the Success Action feature and a separate
 * ticket: it has to add or drop that step, which is a document edit and not a
 * param edit.
 */
describe('what a button may do', () => {
  it('refuses the flip in both directions, and says the step count is why', () => {
    expect(offered(ENTRY.tree, BUTTON, 'submit').link).toMatch(/second step/);
    expect(offered(ENTRY.tree, BUTTON, 'submit').link).not.toMatch(/goal/i);
    expect(offered(ENTRY.tree, BUTTON, 'submit').submit).toBeNull();

    /*
     * The other way round needs a button that is already a link, because a
     * refusal is never reported against what the block ALREADY is.
     */
    const clicky: TemplateTree = treeFixture({
      steps: [
        {
          type: 'stack',
          children: [{ type: 'button', action: 'link', label: 'Shop the sale' }],
        } as unknown as TemplateNode,
      ],
    });

    expect(offered(clicky, [0, 'children', 0], 'click').submit).toMatch(/second step/);
    expect(offered(clicky, [0, 'children', 0], 'click').link).toBeNull();
  });

  /**
   * **The mirror of the refusal `whyRefused` already makes.** `render.ts` makes
   * the step holding a non-`link` button the `<form>`; take that away and every
   * field on it draws, takes typing, and is read by nothing.
   */
  it('refuses a link while the form still captures, even where the Goal allows it', () => {
    expect(offered(ENTRY.tree, BUTTON, 'click').link).toMatch(/read by nothing/);
  });

  it('allows a link once nothing is being captured', () => {
    const noFields: TemplateTree = treeFixture({
      steps: [{ type: 'stack', children: [{ type: 'button', action: 'submit' }] } as unknown as TemplateNode],
    });

    expect(offered(noFields, [0, 'children', 0], 'click').link).toBeNull();
  });
});

describe('changing a field', () => {
  /**
   * ==========================================================================
   * IT CARRIES WHAT THE MERCHANT CHANGED — MerchantsOwn's OWN RULE.
   * ==========================================================================
   * Still the old kind's stock wording means nobody touched it, so the new
   * kind's goes in. Different means it is theirs, and it travels.
   */
  it('rewrites stock wording to the new kind’s', () => {
    const swapped = withSwapped(ENTRY.tree, FIELD, 'phone', 'submit', LABELS);

    expect(at(swapped, FIELD).name).toBe('phone');
    expect(at(swapped, FIELD).label).toBe('Phone number');
    expect(at(swapped, FIELD).placeholder).toBe('+44 7700 900000');
  });

  it('keeps wording the merchant wrote, and does not touch the rest of the node', () => {
    const mine: TemplateTree = treeFixture({
      steps: [
        {
          type: 'stack',
          children: [
            { type: 'field', name: 'email', label: 'Where do we send it?', placeholder: 'you@example.com', required: true },
            { type: 'button', action: 'submit' },
          ],
        } as unknown as TemplateNode,
      ],
    });
    const swapped = withSwapped(mine, [0, 'children', 0], 'phone', 'submit', LABELS);

    expect(at(swapped, [0, 'children', 0]).label).toBe('Where do we send it?');
    // The placeholder WAS stock, so it moves with the kind. The two are judged
    // one at a time: a merchant who renamed the label did not thereby adopt
    // `you@example.com` as their own.
    expect(at(swapped, [0, 'children', 0]).placeholder).toBe('+44 7700 900000');
    expect(at(swapped, [0, 'children', 0]).required).toBe(true);
  });

  /** An empty value is the absence of wording, not wording worth keeping. */
  it('fills wording that was not there at all', () => {
    const bare: TemplateTree = treeFixture({
      steps: [
        { type: 'stack', children: [{ type: 'field', name: 'email' }] } as unknown as TemplateNode,
      ],
    });
    const swapped = withSwapped(bare, [0, 'children', 0], 'name', 'submit', LABELS);

    expect(at(swapped, [0, 'children', 0]).label).toBe('Name');
  });

  /**
   * A no-op is the tree by IDENTITY, like every function in `tree.ts` — so a
   * caller can tell "did nothing" from "did something" without comparing trees,
   * and the undo history does not fill with copies.
   */
  it('returns the same tree for a refused swap and for the kind it already is', () => {
    expect(withSwapped(ENTRY.tree, BUTTON, 'link', 'submit', LABELS)).toBe(ENTRY.tree);
    expect(withSwapped(ENTRY.tree, FIELD, 'email', 'submit', LABELS)).toBe(ENTRY.tree);
    expect(withSwapped(ENTRY.tree, HEADLINE, 'phone', 'submit', LABELS)).toBe(ENTRY.tree);
  });
});

describe('changing what a button does', () => {
  it('writes the action and nothing else', () => {
    const noFields: TemplateTree = treeFixture({
      steps: [
        {
          type: 'stack',
          children: [{ type: 'button', role: 'cta_label', label: 'Shop the sale', action: 'submit' }],
        } as unknown as TemplateNode,
      ],
    });
    const swapped = withSwapped(noFields, [0, 'children', 0], 'link', 'click', LABELS);

    expect(at(swapped, [0, 'children', 0]).action).toBe('link');
    expect(at(swapped, [0, 'children', 0]).label).toBe('Shop the sale');
    expect(at(swapped, [0, 'children', 0]).role).toBe('cta_label');
  });
});
