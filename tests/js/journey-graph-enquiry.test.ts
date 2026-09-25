import { expect, it } from 'vitest';
import { graphTrace } from '../../resources/loader/src/journey-graph';
import type { TemplateTree } from '@renderer/types';
import fixture from '../fixtures/journey-graph-enquiry.json';

it('visits every relevant follow-up for all seven three-interest combinations', () => {
  const tree = fixture as unknown as TemplateTree;
  const interests = ['garden', 'indoors', 'balcony'];
  const answerIds: Record<string, string> = { garden: 'n2', indoors: 'n3', balcony: 'n4' };
  for (let mask = 1; mask <= 7; mask++) {
    const selected = interests.filter((_, index) => !!(mask & 1 << index));
    const supplied = { n1: selected, n2: 'small', n3: 'bright', n4: 'small' };
    const trace = graphTrace(tree.steps, tree.graph!, supplied);
    expect(trace.indices.map(index => tree.steps[index].id)).toEqual([
      'interests', ...interests.filter(value => selected.includes(value)), 'contact', 'received',
    ]);
    expect(Object.keys(trace.answers)).toEqual(['n1', ...selected.map(value => answerIds[value])]);
  }
});
