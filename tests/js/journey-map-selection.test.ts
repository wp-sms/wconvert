import { expect, it } from 'vitest';
import { relatedMapElements } from '../../resources/admin/src/builder/structure/mapSelection';

const edges = [
  { id: 'a-b', source: 'a', target: 'b' },
  { id: 'b-c', source: 'b', target: 'c' },
  { id: 'b-d', source: 'b', target: 'd' },
  { id: 'c-end', source: 'c', target: 'end' },
  { id: 'd-end', source: 'd', target: 'end' },
];
it('shows direct neighbours of a screen without implying that every downstream screen is next', () => {
  const related = relatedMapElements(edges, 'b');
  expect([...related.screens].sort()).toEqual(['a', 'b', 'c', 'd']);
  expect([...related.paths].sort()).toEqual(['a-b', 'b-c', 'b-d']);
});
it('follows a selected branch through its shared ending without highlighting the alternative branch', () => {
  const related = relatedMapElements(edges, 'b', 'b-c');
  expect([...related.screens].sort()).toEqual(['b', 'c', 'end']);
  expect([...related.paths].sort()).toEqual(['b-c', 'c-end']);
});
it('has no highlight without selection and terminates even on a malformed cyclic draft', () => {
  expect(relatedMapElements(edges).screens.size).toBe(0);
  expect([...relatedMapElements([...edges, { id: 'cycle', source: 'end', target: 'c' }], 'b', 'b-c').paths].sort()).toEqual(['b-c', 'c-end', 'cycle']);
});
