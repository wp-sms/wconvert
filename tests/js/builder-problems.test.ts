import enquiry from '../../resources/templates/library/journey-enquiry.json';
import optionalSignup from '../../resources/templates/library/journey-email-then-sms.json';
import { treeFixture } from './support/journey';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { problemsIn } from '../../resources/admin/src/builder/structure/problems';
import { nodesOf, withRemoved } from '../../resources/admin/src/builder/structure/tree';
import { withValue } from '../../resources/admin/src/builder/panel';
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

/**
 * The Optin's own end date, defaulted because every case but one is about the
 * DESIGN and a design carrying no countdown does not care.
 *
 * `null` and not `undefined` is how a caller says "no end date": a default
 * parameter fires on an explicit `undefined` too, so the obvious spelling would
 * have quietly handed the check a date on the one test that is about not having
 * one.
 */
const said = (
  template: Template,
  endsAt: string | null = '2026-11-30 23:59',
) => problemsIn(template, endsAt ?? undefined).map((problem) => problem.said);

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
   * **And it says nothing at all about which act the design offers.**
   *
   * Two problems here were *"your goal counts form submissions and this design
   * converts on a click, so saving it will be refused"* and its mirror. A
   * [[Goal]] counts no act now (ADR 0059), so the act this design offers is
   * this Optin's act by definition — there is nothing left for it to disagree
   * with, and the sentences ended *"…or change the goal"* against a builder
   * that had no such control.
   */
  it('never says a design converts the way something else does not count', () => {
    expect(said({ tree: ENTRY.tree, tokens: ENTRY.tokens })).toEqual([]);
    expect(said({ tree: CLICKS, tokens: ENTRY.tokens })).toEqual([]);
  });
});

/** A one-step design that converts on a click and asks for nothing. */
const CLICKS: TemplateTree = treeFixture({
  steps: [
    {
      type: 'stack',
      children: [
        { type: 'heading', role: 'headline', text: 'Half price this week' },
        { type: 'button', action: 'link', role: 'cta_label', label: 'Shop the sale' },
      ],
    } as unknown as TemplateNode,
  ],
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
    const stranded: TemplateTree = treeFixture({
      steps: [
        ENTRY.tree.steps[0],
        {
          type: 'stack',
          children: [{ type: 'field', name: 'name', label: 'Name' }],
        } as unknown as TemplateNode,
      ],
    });

    expect(said({ tree: stranded, tokens: ENTRY.tokens })).toContainEqual(
      expect.stringMatching(/Assign this field to a submission/),
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
    const extra: TemplateTree = treeFixture({
      steps: [
        {
          ...(ENTRY.tree.steps[0].content as unknown as { children: TemplateNode[] }),
          children: [
            ...(ENTRY.tree.steps[0].content as unknown as { children: TemplateNode[] }).children,
            { type: 'text', text: 'A second paragraph' } as TemplateNode,
          ],
        } as unknown as TemplateNode,
        ENTRY.tree.steps[1],
      ],
    });

    expect(said({ tree: extra, tokens: ENTRY.tokens })).toContainEqual(
      expect.stringMatching(/1 block has no name of its own/),
    );
  });
});

describe('colors a visitor cannot read', () => {
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

/**
 * ============================================================================
 * A CLOCK WITH NOTHING TO COUNT TO IS THE ONLY WAY A COUNTDOWN CAN BE WRONG.
 * ============================================================================
 * The deadline is the Optin's `ends_at` and nothing else (ADR 0052), so the
 * timer that keeps running after the offer ended — the thing every competitor
 * lets a merchant configure by accident — is not expressible. What is left is a
 * design carrying a clock on an Optin with no end: it renders, saves and
 * publishes, and the clock is simply empty.
 */
describe('a countdown with no end date', () => {
  // The real entry with a clock added at the top of its first step, so
  // everything else about it stays a design with nothing wrong.
  const withClock: Template = {
    tree: treeFixture({
      ...ENTRY.tree,
      steps: ENTRY.tree.steps.map((step, at) =>
        at === 0
          ? { ...step.content, children: [{ type: 'countdown' }, ...((step.content as { children?: unknown[] }).children ?? [])] }
          : step,
      ) as Template['tree']['steps'],
    }),
    tokens: ENTRY.tokens,
  };

  /**
   * ==========================================================================
   * IT NAMES A DESTINATION, AND THE DESTINATION IS NOT A BLOCK.
   * ==========================================================================
   * It used to carry the clock's own `path`, so pressing the sentence took the
   * merchant to the **Content** tab and selected the countdown — away from the
   * thing to change — with the route carried entirely by the words *"under 'How
   * often' on the Rules tab"*. A door that opens onto the wrong room is worse
   * than no door (ADR 0042 rule 4), so the words dropped the route and the
   * button took it.
   */
  it('sends the merchant to the schedule rather than to the clock', () => {
    const problems = problemsIn(withClock, undefined);

    expect(problems).toHaveLength(1);
    expect(problems[0].said).toMatch(/Set an end date/);
    expect(problems[0].go).toBe('schedule');
    // No block path: following this must not select the countdown.
    expect(problems[0].path).toBeNull();
  });

  it('says nothing once the merchant has set one', () => {
    expect(said(withClock)).toEqual([]);
  });

  /** A design with no clock in it is not asked the question at all. */
  it('says nothing about a design that does not count down', () => {
    expect(said({ tree: ENTRY.tree, tokens: ENTRY.tokens }, null)).toEqual([]);
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


describe('resource link readiness', () => {
  it('requires a reachable success screen, a label and a safe address', () => {
    const link = { type: 'followup' as const, label: 'Read guide', href: '/guide.pdf' };
    const check = (node: typeof link & { hidden?: boolean }, step = 1) => {
      const tree: TemplateTree = treeFixture({ steps: [
        { type: 'stack', children: [{ type: 'field', name: 'email' }, { type: 'button', label: 'Send' }, ...(step === 0 ? [node] : [])] },
        { type: 'stack', children: step === 1 ? [node] : [] },
      ] });
      return problemsIn({ tree, tokens: ENTRY.tokens }, undefined).filter(problem => problem.said.includes('resource link'));
    };
    expect(check(link)).toEqual([]);
    expect(check({ ...link, href: '' })[0]?.blocksPublish).toBe(true);
    expect(check({ ...link, href: 'javascript:alert(1)' })[0]?.blocksPublish).toBe(true);
    expect(check({ ...link, label: '' })[0]?.blocksPublish).toBe(true);
    expect(check(link, 0)[0]?.blocksPublish).toBe(true);
    expect(check({ ...link, href: '', hidden: true })).toEqual([]);
  });
});

describe('journey readiness', () => {
  it('accepts fields across screens and a resource after primary capture', () => {
    for (const source of [enquiry, optionalSignup]) {
      let template = structuredClone(source) as Template;
      const phone = nodesOf(template.tree).find(node => node.captures === 'phone');
      if (phone) template = { ...template, tree: withValue(template.tree, phone.path, 'phone_country', 'US') };
      const acknowledgement = template.tree.steps.at(-1)!.content as unknown as { children: unknown[] };
      acknowledgement.children.push({ type: 'followup', label: 'Open guide', href: '/guide.pdf' });
      const problems = problemsIn(template, undefined);
      expect(problems.filter(p => p.check === 'captures' || p.said.includes('resource link'))).toEqual([]);
    }
  });
});
