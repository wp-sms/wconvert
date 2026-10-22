import { expect, it } from 'vitest';
import { fillReward } from '@loader/reward';
import type { TemplateTree } from '@renderer/types';

/** As the page prints a coupon signup's thank-you screen (ADR 0164). */
function held(): TemplateTree {
  return {
    v: 2, submissions: [], steps: [{
      id: 'received', name: 'Thanks', kind: 'acknowledgement', content: {
        type: 'stack', children: [
          { type: 'heading', text: 'Thanks' },
          { type: 'code', hidden: true, copy: true },
          { type: 'stack', hidden: true, children: [{ type: 'code', hidden: true }] },
          { type: 'split', start: [], end: [{ type: 'followup', hidden: true, label: 'Shop now' }] },
        ],
      },
    }],
  } as unknown as TemplateTree;
}
const nodes = (tree: TemplateTree) => {
  const outer = tree.steps[0].content as unknown as { children: Array<Record<string, unknown> & { children?: Array<Record<string, unknown>>; end?: Array<Record<string, unknown>> }> };
  return [outer.children[1], outer.children[2].children![0], outer.children[3].end![0]];
};

it('fills each held node by its place on the step and shows it', () => {
  const tree = held();
  fillReward(tree, { received: [{ text: 'FRIDAY25', apply_href: '/cart/?coupon=FRIDAY25' }, null, { href: 'https://example.com/shop' }] });
  const [code, off, link] = nodes(tree);
  expect(code).toEqual({ type: 'code', hidden: false, copy: true, text: 'FRIDAY25', apply_href: '/cart/?coupon=FRIDAY25' });
  expect(off).toEqual({ type: 'code', hidden: true });
  expect(link).toEqual({ type: 'followup', hidden: false, label: 'Shop now', href: 'https://example.com/shop' });
});

it('leaves held nodes hidden when the reply carries no reward', () => {
  const tree = held();
  fillReward(tree, undefined);
  fillReward(tree, { other: [{ text: 'NOPE' }] });
  expect(nodes(tree).every(node => node.hidden === true)).toBe(true);
});
