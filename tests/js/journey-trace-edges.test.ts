import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { journeyTraceEdges } from '../../resources/admin/src/builder/structure/journeyTraceEdges';

const tree: TemplateTree = { v: 2, submissions: [], steps: ['start', 'detail', 'end'].map(id => ({ id, name: id, kind: 'input', content: { type: 'stack', children: [] } })) };

it('uses map connection IDs for legacy sequential, answer and hidden transitions', () => {
  expect(journeyTraceEdges(tree, [{ from: 0, to: 1, kind: 'continue' }, { from: 1, to: 2, kind: 'hidden' }])).toEqual(['start-0', 'detail-0']);
  const branched: TemplateTree = { ...tree, steps: [{ ...tree.steps[0], paths: [{ to: 'end' }] }, ...tree.steps.slice(1)] };
  expect(journeyTraceEdges(branched, [{ from: 0, to: 2, kind: 'route', priority: 0 }])).toEqual(['start-0']);
  expect(journeyTraceEdges(branched, [{ from: 0, to: 1, kind: 'hidden' }])).toEqual(['start-hidden']);
});

it('retains graph edge IDs and does not invent a connection for malformed legacy routes', () => {
  expect(journeyTraceEdges(tree, [{ from: 'start', to: 'detail', kind: 'default', edge: 'edge-stable' }])).toEqual(['edge-stable']);
  expect(journeyTraceEdges(tree, [{ from: 0, to: 2, kind: 'continue' }])).toEqual([]);
});
