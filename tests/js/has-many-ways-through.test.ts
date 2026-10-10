import { describe, expect, it } from 'vitest';
import { hasManyWaysThrough } from '../../resources/admin/src/builder/structure/journey';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import { treeFixture } from './support/journey';
import coffee from '../fixtures/journey-graph-coffee.json';
import type { TemplateTree } from '@renderer/types';

/**
 * **Flow appears only when there is more than one way through** (D4). A
 * two-screen popup is a straight line and never meets a map; a question with
 * paths, a follow-up or a "Show only if…" is not.
 */
const straight = (): TemplateTree => treeFixture({ steps: [
  { type: 'stack', children: [{ type: 'field', name: 'email', required: true }, { type: 'button', action: 'submit', label: 'Join' }] },
  { type: 'stack', children: [{ type: 'heading', text: 'Thanks' }] },
] });

describe('whether a campaign has more than one way through', () => {
  it('is not for a straight line, linear or graph', () => {
    expect(hasManyWaysThrough(straight())).toBe(false);
    expect(hasManyWaysThrough(upgradeToGraph(straight()))).toBe(false);
  });

  it('is for a graph with answer paths', () => {
    expect(hasManyWaysThrough((coffee as unknown as { template: { tree: TemplateTree } }).template.tree)).toBe(true);
  });

  it('is for a screen shown only if an earlier answer matched', () => {
    const tree = straight();
    expect(hasManyWaysThrough({ ...tree, steps: tree.steps.map((screen, at) => at === 1
      ? { ...screen, when: { match: 'all', clauses: [{ question: 'q', operator: 'is', values: ['a'] }] } } : screen) })).toBe(true);
  });

  it('is for a linear screen with more than one path', () => {
    const tree = straight();
    expect(hasManyWaysThrough({ ...tree, steps: tree.steps.map((screen, at) => at === 0
      ? { ...screen, paths: [{ to: 's2', when: { match: 'all', clauses: [{ question: 'q', operator: 'is', values: ['a'] }] } }, { to: 's2' }] } : screen) })).toBe(true);
  });

  /** A straight quiz picks a result on one screen; visitors still take one way through. */
  it('is not for results that depend on the answers', () => {
    const tree = straight();
    const withResults = (results: unknown[]) => ({ ...tree, steps: [...tree.steps.slice(0, 1),
      { id: 'r', name: 'Result', kind: 'result', content: { type: 'stack', children: [] }, results }, ...tree.steps.slice(1)] }) as unknown as TemplateTree;
    expect(hasManyWaysThrough(withResults([{ id: 'only', heading: 'Yours' }]))).toBe(false);
    expect(hasManyWaysThrough(withResults([
      { id: 'a', heading: 'A', when: { match: 'all', clauses: [{ question: 'q', operator: 'is', values: ['a'] }] } },
      { id: 'b', heading: 'B' },
    ]))).toBe(false);
  });
});
