import { describe, expect, it } from 'vitest';
import {
  nodeAt,
  nodesOf,
  pathOf,
  rolesLostBy,
  spotOf,
  withDuplicated,
  withInserted,
  withMoved,
  withRemoved,
} from '../../resources/admin/src/builder/structure/tree';
import {
  additionsIn,
  freeCapture,
  freeRoleFor,
  nodeFor,
} from '../../resources/admin/src/builder/structure/catalogue';
import {
  convertingActOf,
  whatRemovalTakes,
  whyDuplicationIsRefused,
  whyRemovalIsRefused,
} from '../../resources/admin/src/builder/structure/guards';
import {
  DEPTH,
  canRedo,
  canUndo,
  historyOf,
  redo,
  remember,
  undo,
} from '../../resources/admin/src/builder/structure/history';
import type { TemplateNode, TemplateTree } from '@renderer/types';

/**
 * ============================================================================
 * THE STRUCTURE EDITOR'S LOGIC, WITHOUT THE STRUCTURE EDITOR.
 * ============================================================================
 * Everything that decides what a tree BECOMES is a pure function with no React
 * in it, and this is why: jsdom models neither focus nor roving tabindex nor
 * the top layer (`tests/js/setup.ts`), so a test that rendered the treegrid
 * could assert almost nothing about the thing that matters. *"Test the
 * translation, not the widgets"* (ADR 0038, quoting #29).
 *
 * The keyboard model itself therefore has **no automated coverage**, and that
 * gap is recorded rather than papered over — Vitest 4's Browser Mode is what
 * would close it, in its own pull request.
 */

/**
 * A submit-metered design, shaped like the shipped ones: a form step holding a
 * `row` with the field and the button in it, and a terminal success step.
 */
const TREE: TemplateTree = {
  steps: [
    {
      type: 'stack',
      children: [
        { type: 'heading', role: 'headline', text: 'Join' },
        { type: 'text', role: 'body', text: 'Get the code.' },
        {
          type: 'row',
          children: [
            { type: 'field', name: 'email', label: 'Email', required: true },
            { type: 'button', role: 'cta_label', label: 'Send', action: 'submit' },
          ],
        },
        { type: 'split', start: [{ type: 'image', src: '/tote.png', alt: 'A tote' }], end: [] },
      ],
    },
    {
      type: 'stack',
      children: [{ type: 'heading', role: 'success_headline', text: 'You are in' }],
    },
  ],
};

const HEADLINE = [0, 'children', 0] as const;
const ROW = [0, 'children', 2] as const;
const FIELD = [0, 'children', 2, 'children', 0] as const;
const BUTTON = [0, 'children', 2, 'children', 1] as const;
const IMAGE = [0, 'children', 3, 'start', 0] as const;

const typesOf = (tree: TemplateTree) => nodesOf(tree).map((block) => block.type);

describe('the blocks of a design', () => {
  /**
   * **Layouts are in it, and that is the whole difference from `slotsOf`.** A
   * merchant moving the email field is moving it within the `row`, so a walk
   * that hid the row would offer no way to say where the field went.
   */
  it('is every node including the layouts, in tree order, through both panes', () => {
    expect(typesOf(TREE)).toEqual([
      'stack',
      'heading',
      'text',
      'row',
      'field',
      'button',
      'split',
      // Inside the far pane, which is where a second reader forgets to look.
      'image',
      'stack',
      'heading',
    ]);
  });

  it('gives each block the level, position and set size a treegrid row announces', () => {
    const blocks = nodesOf(TREE);
    const field = blocks.find((block) => block.type === 'field');

    expect(blocks[0]).toMatchObject({ level: 1, position: 1, setSize: 2, pane: null });
    expect(field).toMatchObject({ level: 3, position: 1, setSize: 2, pane: 'children' });
  });

  /**
   * **A row names itself by what it says, never "item 3 of 5".** The same rule
   * `Preview.tsx` already keeps when it labels a preview slot by its text.
   */
  it('names a block by its words, and an image by its alt text', () => {
    expect(nodesOf(TREE).map((block) => [block.type, block.says])).toEqual([
      ['stack', null],
      ['heading', 'Join'],
      ['text', 'Get the code.'],
      ['row', null],
      ['field', 'Email'],
      ['button', 'Send'],
      ['split', null],
      // `image` declares no copy at all, so its `alt` is the one thing it says.
      ['image', 'A tote'],
      ['stack', null],
      ['heading', 'You are in'],
    ]);
  });

  it('counts what a block holds, at any depth', () => {
    const holds = nodesOf(TREE).find((block) => block.type === 'row')?.holds;
    const step = nodesOf(TREE)[0]?.holds;

    expect(holds).toBe(2);
    expect(step).toBe(7);
  });

  /** A step occupies no spot, because steps are not blocks a merchant arranges. */
  it('gives a spot to every block but a step', () => {
    expect(spotOf(HEADLINE)).toEqual({ parent: [0], key: 'children', index: 0 });
    expect(spotOf(IMAGE)).toEqual({ parent: [0, 'children', 3], key: 'start', index: 0 });
    expect(spotOf([0])).toBeNull();
  });

  it('round-trips a spot back to the path it came from', () => {
    for (const path of [HEADLINE, FIELD, IMAGE]) {
      expect(pathOf(spotOf(path)!)).toEqual([...path]);
    }
  });
});

describe('moving a block', () => {
  it('swaps it with the sibling in the direction asked for', () => {
    const moved = withMoved(TREE, HEADLINE, 1);

    expect(typesOf(moved).slice(0, 4)).toEqual(['stack', 'text', 'heading', 'row']);
  });

  /**
   * Unchanged **by identity**, so a caller can tell "did nothing" from "did
   * something" without comparing trees — which is what stops ↑ at the top of a
   * list from filling the undo stack with copies.
   */
  it('does nothing at either end of the array, and says so by identity', () => {
    expect(withMoved(TREE, HEADLINE, -1)).toBe(TREE);
    expect(withMoved(TREE, [0, 'children', 3], 1)).toBe(TREE);
    expect(withMoved(TREE, HEADLINE, 0)).toBe(TREE);
  });

  /**
   * One parent, deliberately. The ↑↓ buttons WCAG 2.2 SC 2.5.7 requires as the
   * drag alternative express a direction and nothing else, so a drag that could
   * reparent would be a drag no keyboard could reach.
   */
  it('never moves a block out of the array it is in', () => {
    const moved = withMoved(TREE, FIELD, 1);

    expect(nodesOf(moved).map((block) => `${block.path.join('.')}:${block.type}`)).toContain(
      '0.children.2.children.1:field',
    );
  });

  it('shares structure with the tree it came from everywhere it did not change', () => {
    const moved = withMoved(TREE, FIELD, 1);

    // The other step is the same object: the preview re-renders from the tree,
    // and a wholesale copy would make every block look changed on every edit.
    expect(moved.steps[1]).toBe(TREE.steps[1]);
  });
});

describe('inserting and removing a block', () => {
  it('puts a block at the spot named, and appends past the end', () => {
    const node = { type: 'text', text: 'New' } as TemplateNode;

    expect(typesOf(withInserted(TREE, { parent: [0], key: 'children', index: 0 }, node)).slice(0, 3)).toEqual([
      'stack',
      'text',
      'heading',
    ]);
    expect(typesOf(withInserted(TREE, { parent: [0], key: 'children', index: 99 }, node)).slice(0, 6)).toEqual(
      ['stack', 'heading', 'text', 'row', 'field', 'button'],
    );
  });

  /**
   * **A row takes what it holds.** Promoting the children into the grandparent
   * would be a third arrangement — neither the one the merchant had nor the one
   * they asked for.
   */
  it('takes the children with the block that held them', () => {
    expect(typesOf(withRemoved(TREE, ROW))).toEqual([
      'stack',
      'heading',
      'text',
      'split',
      'image',
      'stack',
      'heading',
    ]);
  });

  it('reaches into a split pane like anywhere else', () => {
    expect(typesOf(withRemoved(TREE, IMAGE))).not.toContain('image');
  });
});

describe('duplicating a block', () => {
  /**
   * ==========================================================================
   * THE COPY COMES BACK ROLE-LESS WHATEVER THE EDITOR DOES, SO THE EDITOR
   * STRIPS IT AND SAYS SO.
   * ==========================================================================
   * `TemplateVocabulary::normalize()` deduplicates Slot Roles across the WHOLE
   * tree, keeping the first node that claims one. A headline duplicated with
   * its `role` intact therefore looks complete until the next save, and then
   * quietly is not.
   */
  it('strips every Slot Role from the copy, at any depth', () => {
    const doubled = withDuplicated(TREE, HEADLINE);
    const headings = nodesOf(doubled).filter((block) => block.type === 'heading');

    expect(headings.map((block) => block.role)).toEqual(['headline', null, 'success_headline']);
  });

  it('strips the Roles inside a duplicated layout too', () => {
    const split = withDuplicated(TREE, [0, 'children', 3]);
    const images = nodesOf(split).filter((block) => block.type === 'image');

    expect(images).toHaveLength(2);
  });

  it('puts the copy directly after the original', () => {
    expect(typesOf(withDuplicated(TREE, HEADLINE)).slice(0, 3)).toEqual(['stack', 'heading', 'heading']);
  });

  /** What the caller has to say out loud, counted rather than guessed. */
  it('counts the Roles the copy will lose', () => {
    expect(rolesLostBy(TREE, HEADLINE)).toBe(1);
    expect(rolesLostBy(TREE, ROW)).toBe(1);
    expect(rolesLostBy(TREE, IMAGE)).toBe(0);
  });
});

describe('what the catalogue offers', () => {
  const at = { parent: [0], key: 'children', index: 0 } as const;

  /**
   * **Read from the manifest, so a node type added there costs the editor
   * nothing.** The assertion is against the manifest's own keys rather than a
   * list spelled here, which is the property being protected.
   */
  it('offers every leaf and every layout the vocabulary declares', () => {
    expect(additionsIn(TREE, at, 'submit').map((addition) => addition.type)).toEqual([
      'heading',
      'text',
      'image',
      'field',
      'button',
      'consent',
      'stack',
      'row',
      'split',
      'grid',
    ]);
  });

  /** One Optin has exactly one converting act (CONTEXT.md, Conversion). */
  it('refuses a second button, with a reason rather than a gap', () => {
    const button = additionsIn(TREE, at, 'submit').find((addition) => addition.type === 'button');

    expect(button?.refused).toMatch(/exactly one/i);
    expect(nodeFor(TREE, 'button', at, 'submit')).toBeNull();
  });

  /**
   * `render.ts` makes the step holding the submit button the `<form>`. A field
   * on the success step is an input inside a `<div>` — it draws, it takes
   * typing, and nothing reads it.
   */
  it('refuses a field outside the step that submits', () => {
    const onSuccess = { parent: [1], key: 'children', index: 0 } as const;
    const refused = additionsIn(TREE, onSuccess, 'submit').find((addition) => addition.type === 'field');

    expect(refused?.refused).toMatch(/submit button/i);
  });

  it('refuses a field once every capture kind is taken', () => {
    const full = [...((TREE.steps[0] as unknown) as { children: TemplateNode[] }).children];
    const crowded: TemplateTree = {
      steps: [
        {
          type: 'stack',
          children: [
            ...full,
            { type: 'field', name: 'name' },
            { type: 'field', name: 'phone' },
          ],
        },
        TREE.steps[1],
      ],
    };

    expect(freeCapture(crowded)).toBeNull();
    expect(
      additionsIn(crowded, at, 'submit').find((addition) => addition.type === 'field')?.refused,
    ).toMatch(/already on the form/i);
  });

  /**
   * **A click-metered Optin captures nothing** (ADR 0025), and it says so as an
   * absence — there is no step holding a submit, so there is no form.
   */
  it('refuses a field on an Optin that converts on a click', () => {
    const clicked: TemplateTree = {
      steps: [
        {
          type: 'stack',
          children: [{ type: 'button', role: 'cta_label', label: 'Shop', action: 'link' }],
        },
      ],
    };

    expect(
      additionsIn(clicked, at, 'link').find((addition) => addition.type === 'field')?.refused,
    ).toMatch(/captures nothing/i);
  });
});

describe('a block the catalogue builds', () => {
  const at = { parent: [0], key: 'children', index: 0 } as const;

  /**
   * **The Goal decides, at the moment of creation.** `action` is a param rather
   * than content, so the Content tab never offers it — a button that arrives
   * with the wrong one stays wrong until the save refuses the WHOLE config
   * through `refuseAMetricItCannotReport`.
   */
  it('gives a button the act its Goal is measured by', () => {
    const empty: TemplateTree = { steps: [{ type: 'stack', children: [] }] };

    expect(nodeFor(empty, 'button', at, 'link')).toMatchObject({ action: 'link' });
    expect(nodeFor(empty, 'button', at, 'submit')).toMatchObject({ action: 'submit' });
  });

  /**
   * A block with no Role has no `SlotKey`, so clicking it in the preview
   * reaches nothing. It is given a free one where one exists, and the caller
   * is told where none does.
   */
  it('gives a new block a Slot Role that is actually free', () => {
    const empty: TemplateTree = { steps: [{ type: 'stack', children: [] }] };

    expect(nodeFor(empty, 'heading', at, 'submit')).toMatchObject({ role: 'headline' });
    // `headline` is taken in TREE, so the next heading gets the other one a
    // heading may carry rather than an invented name.
    expect(freeRoleFor(TREE, 'heading')).toBeNull();
    expect(nodeFor(TREE, 'heading', at, 'submit')).not.toHaveProperty('role');
  });

  /** A field capturing nothing the build knows renders NOTHING (`render.ts`). */
  it('gives a new field a capture kind, or is not built at all', () => {
    expect(nodeFor(TREE, 'field', at, 'submit')).toMatchObject({ name: 'name', required: true });
  });

  /** ADR 0032's "off by default", expressed as the key the manifest declares. */
  it('ships a consent block hidden', () => {
    expect(nodeFor(TREE, 'consent', at, 'submit')).toMatchObject({ hidden: true });
  });

  /** So the walk finds the arrays, and the merchant can put something in them. */
  it('gives a layout its child arrays, present and empty', () => {
    expect(nodeFor(TREE, 'split', at, 'submit')).toEqual({ type: 'split', start: [], end: [] });
    expect(nodeFor(TREE, 'stack', at, 'submit')).toEqual({ type: 'stack', children: [] });
  });

  /** Only keys the manifest declares — anything else vanishes at the first save. */
  it('writes no key the vocabulary does not declare', () => {
    const node = nodeFor(TREE, 'text', at, 'submit') as Record<string, unknown>;

    expect(Object.keys(node).every((key) => ['type', 'role'].includes(key))).toBe(true);
  });
});

describe('the safety net', () => {
  it('reads the converting act the same way the renderer and PHP do', () => {
    expect(convertingActOf(TREE)).toEqual(['submit']);
    expect(convertingActOf({ steps: [{ type: 'button', label: 'Go' }] })).toEqual(['submit']);
    expect(convertingActOf({ steps: [{ type: 'button', action: 'link' }] })).toEqual(['link']);
    expect(convertingActOf({ steps: [] })).toEqual([]);
  });

  /**
   * ==========================================================================
   * THIS IS THE HOLE `TemplateLibrary::refuse()` DOES NOT COVER.
   * ==========================================================================
   * It refuses a Template with no converting act **at registration**, of a
   * library entry from disk. It has never applied to an Optin's own config,
   * because nothing could remove the button until this editor existed.
   */
  it('refuses removing the only converting act', () => {
    expect(whyRemovalIsRefused(TREE, BUTTON)).toMatch(/reporting nothing/i);
  });

  /** Asked of the tree that would RESULT, so a layout holding the button counts. */
  it('refuses removing a layout that holds the only converting act', () => {
    expect(whyRemovalIsRefused(TREE, ROW)).toMatch(/reporting nothing/i);
  });

  it('refuses removing the last field while the form still submits', () => {
    const loose: TemplateTree = {
      steps: [
        {
          type: 'stack',
          children: [
            { type: 'field', name: 'email', label: 'Email' },
            { type: 'button', label: 'Send', action: 'submit' },
          ],
        },
      ],
    };

    expect(whyRemovalIsRefused(loose, [0, 'children', 0])).toMatch(/captures nothing/i);
  });

  it('allows removing anything that is neither', () => {
    expect(whyRemovalIsRefused(TREE, HEADLINE)).toBeNull();
    expect(whyRemovalIsRefused(TREE, IMAGE)).toBeNull();
  });

  it('refuses duplicating the button or a field, wherever they sit', () => {
    expect(whyDuplicationIsRefused(TREE, BUTTON)).toMatch(/exactly one/i);
    expect(whyDuplicationIsRefused(TREE, FIELD)).toMatch(/collide/i);
    expect(whyDuplicationIsRefused(TREE, ROW)).toMatch(/exactly one/i);
    expect(whyDuplicationIsRefused(TREE, HEADLINE)).toBeNull();
  });

  /** Undo is the recovery, but only for a surprise the merchant noticed. */
  it('says what a removal takes with it, and stays quiet where it takes nothing', () => {
    const blocks = nodesOf(TREE);
    const row = blocks.find((block) => block.type === 'row')!;
    const heading = blocks.find((block) => block.type === 'heading')!;

    expect(whatRemovalTakes(row)).toMatch(/2 blocks inside/i);
    expect(whatRemovalTakes(heading)).toBeNull();
  });
});

describe('undo and redo', () => {
  const a = { n: 1 };
  const b = { n: 2 };
  const c = { n: 3 };

  it('goes back and forward over whole snapshots', () => {
    const history = remember(remember(historyOf(a), b), c);

    expect(undo(history).present).toBe(b);
    expect(undo(undo(history)).present).toBe(a);
    expect(redo(undo(history)).present).toBe(c);
  });

  /**
   * Itself, by identity — which is what lets ⌘Z be wired without asking
   * `canUndo` first: on a fresh screen it does nothing, quietly, the way it
   * does everywhere else.
   */
  it('has nothing to go back to when it starts, and returns itself rather than throwing', () => {
    const fresh = historyOf(a);

    expect(canUndo(fresh)).toBe(false);
    expect(canRedo(fresh)).toBe(false);
    expect(undo(fresh)).toBe(fresh);
    expect(redo(fresh)).toBe(fresh);
  });

  /** The behaviour every text editor has: a new edit is not a branch. */
  it('clears the redo stack on a new edit', () => {
    const stepped = undo(remember(remember(historyOf(a), b), c));

    expect(canRedo(stepped)).toBe(true);
    expect(canRedo(remember(stepped, { n: 4 }))).toBe(false);
  });

  /**
   * Every function in `tree.ts` returns its input unchanged on a no-op, so an
   * ↑ at the top of a list must not become an undo entry.
   */
  it('does not remember an edit that changed nothing', () => {
    const history = remember(historyOf(a), b);

    expect(remember(history, b)).toBe(history);
  });

  it('forgets the oldest snapshot past its depth', () => {
    let history = historyOf(0);

    for (let step = 1; step <= DEPTH + 10; step += 1) {
      history = remember(history, step);
    }

    expect(history.past).toHaveLength(DEPTH);
    expect(history.past[0]).toBe(DEPTH + 10 - DEPTH);
  });

  /**
   * **Undoing across a save is allowed.** `config` is the draft and
   * `published_config` is what the site serves, so a save is not a commit — and
   * a history that refused to cross one would read as "your last save is
   * permanent", which is what a separate draft column exists to make untrue.
   */
  it('treats the tree that comes back from a save as one more entry', () => {
    const edited = remember(historyOf(a), b);
    const saved = remember(edited, c);

    expect(canUndo(saved)).toBe(true);
    expect(undo(saved).present).toBe(b);
  });
});

/** The path walker every mutation above shares, asked directly. */
describe('reaching a node by path', () => {
  it('finds one at any depth, through both panes', () => {
    expect(nodeAt(TREE, HEADLINE)).toMatchObject({ type: 'heading' });
    expect(nodeAt(TREE, IMAGE)).toMatchObject({ type: 'image' });
    expect(nodeAt(TREE, [0])).toMatchObject({ type: 'stack' });
  });

  it('answers null rather than throwing where the path reaches nothing', () => {
    expect(nodeAt(TREE, [9])).toBeNull();
    expect(nodeAt(TREE, [0, 'children', 99])).toBeNull();
    expect(nodeAt(TREE, [0, 'nope', 0])).toBeNull();
  });
});
