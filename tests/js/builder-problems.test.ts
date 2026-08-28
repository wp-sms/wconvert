import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { problemsIn } from '../../resources/admin/src/builder/structure/problems';
import { withRemoved } from '../../resources/admin/src/builder/structure/tree';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';
import type { Template, TemplateNode, TemplateTree } from '@renderer/types';

/**
 * ============================================================================
 * WHAT IS WRONG WITH THIS DESIGN, SAID WHILE IT IS STILL CHEAP TO FIX.
 * ============================================================================
 * Two of these the save already refuses, and it is right to — *"a screen is not
 * an enforcement mechanism"* (ADR 0026). But the merchant meets that refusal as
 * a red bar over an editor that let them get there.
 *
 * The other two are not refusals and never will be: a block whose words a
 * design switch throws away, and a colour pair a visitor cannot read. Both save
 * happily, and nothing else in the product would ever mention either.
 */

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

const BUTTON = [0, 'children', 2, 'children', 1];

const said = (template: Template, act: 'submit' | 'click' = 'submit') =>
  problemsIn(template, act).map((problem) => problem.said);

const withTokens = (tokens: Record<string, string>): Template => ({
  tree: ENTRY.tree,
  tokens: { ...ENTRY.tokens, ...tokens },
});

describe('a design with nothing wrong with it', () => {
  it('reports nothing at all', () => {
    expect(said({ tree: ENTRY.tree, tokens: ENTRY.tokens })).toEqual([]);
  });
});

describe('the converting act', () => {
  /**
   * ADR 0020's exact failure: an Optin that renders, publishes and reports zero
   * forever, looking broken while being right.
   */
  it('says when nothing on the design counts', () => {
    const template = { tree: withRemoved(ENTRY.tree, BUTTON), tokens: ENTRY.tokens };

    expect(said(template)[0]).toMatch(/report zero forever/);
  });

  /**
   * The state ⇄ cannot fix: a design picked for a different job. It fails the
   * whole save through `refuseAMetricItCannotReport`, and the answer is the
   * gallery or the Goal rather than a param.
   */
  it('says when the design converts the way the Goal does not count', () => {
    expect(said({ tree: ENTRY.tree, tokens: ENTRY.tokens }, 'click')[0]).toMatch(
      /counts click-throughs/,
    );
  });
});

/**
 * `render.ts` makes the step holding a non-`link` button the `<form>`, and that
 * follows from the tree rather than from a flag — so a field anywhere else is
 * an input inside a `<div>`: it draws, it takes typing, and nothing reads it.
 */
describe('a form that captures nothing anybody reads', () => {
  it('says so when the button that submits has been deleted', () => {
    const template = { tree: withRemoved(ENTRY.tree, BUTTON), tokens: ENTRY.tokens };

    expect(said(template)).toContainEqual(expect.stringMatching(/goes nowhere/));
  });

  it('says so for a field stranded on a step that is not the form', () => {
    const stranded: TemplateTree = {
      steps: [
        ENTRY.tree.steps[0],
        {
          type: 'stack',
          children: [{ type: 'field', name: 'name', label: 'Name' }],
        } as unknown as TemplateNode,
      ],
    };

    expect(said({ tree: stranded, tokens: ENTRY.tokens })).toContainEqual(
      expect.stringMatching(/not on the step that submits/),
    );
  });
});

/**
 * Not a refusal and never will be. It costs the merchant the next time they
 * pick a design, which is far enough away that nothing else would connect the
 * two.
 */
describe('words a design switch would throw away', () => {
  it('counts the blocks with no name of their own', () => {
    const extra: TemplateTree = {
      steps: [
        {
          ...(ENTRY.tree.steps[0] as unknown as { children: TemplateNode[] }),
          children: [
            ...(ENTRY.tree.steps[0] as unknown as { children: TemplateNode[] }).children,
            { type: 'text', text: 'A second paragraph' } as TemplateNode,
          ],
        } as unknown as TemplateNode,
        ENTRY.tree.steps[1],
      ],
    };

    expect(said({ tree: extra, tokens: ENTRY.tokens })).toContainEqual(
      expect.stringMatching(/1 block has no name of its own/),
    );
  });
});

describe('colours a visitor cannot read', () => {
  it('names the pair that fails, and only the ones that do', () => {
    const problems = said(withTokens({ muted: '#d4d4d8' }));

    expect(problems).toEqual([expect.stringMatching(/quiet text/i)]);
  });

  /**
   * **A refusal rather than a wrong warning.** A translucent colour composites
   * over whatever is behind it and this cannot know what that is, so it says
   * nothing rather than guessing in either direction.
   */
  it('says nothing about a pair it cannot measure', () => {
    expect(said(withTokens({ fg: 'rgba(0, 0, 0, 0.9)' }))).toEqual([]);
  });

  /**
   * **`backdrop` is not one of the pairs.** It sits behind the popup rather
   * than behind text, and the shipped vocabulary spells it `rgba(…)` — a
   * warning about it would be a warning about nothing.
   */
  it('says nothing about the backdrop', () => {
    expect(said(withTokens({ backdrop: 'rgba(255, 255, 255, 0.05)' }))).toEqual([]);
  });
});

describe('the order they are reported in', () => {
  /**
   * Worst first, which is also the order a merchant can act in: there is no
   * point choosing colours for a design the save refuses.
   */
  it('puts what cannot save above what will merely read badly', () => {
    const broken: Template = {
      tree: withRemoved(ENTRY.tree, BUTTON),
      tokens: { ...ENTRY.tokens, muted: '#d4d4d8' },
    };
    const problems = said(broken);

    expect(problems[0]).toMatch(/report zero forever/);
    expect(problems.at(-1)).toMatch(/quiet text/i);
  });
});
