import { earlyEnding } from '../../resources/admin/src/builder/structure/gateEndings';
import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import coffee from '../fixtures/journey-graph-coffee.json';
import enquiry from '../fixtures/journey-graph-enquiry.json';
import progressive from '../../resources/templates/library/journey-email-then-sms.json';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import { journeyBoundaryIssues } from '../../resources/admin/src/builder/structure/journeyBoundaryReadiness';

it('accepts the complete quiz, enquiry and progressive save boundaries', () => {
  expect(journeyBoundaryIssues(coffee.template.tree as TemplateTree, 'match')).toEqual([]);
  expect(journeyBoundaryIssues(enquiry as TemplateTree, 'submit')).toEqual([]);
  expect(journeyBoundaryIssues(upgradeToGraph(progressive.tree as TemplateTree), 'submit')).toEqual([]);
});

/** Some visitors may finish without the result (ADR 0142): the map says so on the ending, and nothing blocks publishing. */
it('lets some visitors skip the result on the way to a shared ending', () => {
  const original = coffee.template.tree as TemplateTree;
  const tree = { ...original, graph: { ...original.graph!, edges: [...original.graph!.edges,
    { id: 'bypass_result', from: 'brew', to: 'email', kind: 'answer' as const, when: { match: 'all' as const, clauses: [] } },
  ] } };
  expect(journeyBoundaryIssues(tree, 'match')).toEqual([]);
  expect(earlyEnding(tree, 'thanks')).toEqual([{ gate: 'result', always: false }]);
});

it('names a question added after the combined enquiry save', () => {
  const original = enquiry as TemplateTree;
  const tree: TemplateTree = { ...original, steps: [...original.steps, { id: 'late', name: 'Too late', kind: 'input', content: {
    type: 'stack', children: [{ type: 'question', id: 'late_q', label: 'Anything else?', answer_type: 'text', required: false }],
  } }], graph: { ...original.graph!, edges: [...original.graph!.edges.map(edge => edge.id === 'submitted' ? { ...edge, to: 'late' } : edge),
    { id: 'late_end', from: 'late', to: 'received', kind: 'default' }] } };
  expect(journeyBoundaryIssues(tree, 'submit')).toEqual([{ key: 'question-after-save:late',
    said: 'The questions on “Too late” come after “One enquiry” saves the answers. Move this screen before that save, or remove its questions.',
    repair: { screenId: 'late', section: 'content', focus: 'questions' } }]);
});

it('identifies a secondary-save shortcut even when the primary is already followed by a shared ending', () => {
  const original = upgradeToGraph(progressive.tree as TemplateTree);
  const secondary = original.steps[1];
  const tree: TemplateTree = { ...original, steps: [{ id: 'intro', name: 'Start', kind: 'content', content: { type: 'stack', children: [] } }, ...original.steps],
    graph: { ...original.graph!, entry: 'intro', edges: [{ id: 'normal', from: 'intro', to: original.graph!.entry, kind: 'default' },
      { id: 'shortcut', from: 'intro', to: secondary.id, kind: 'answer', when: { match: 'all', clauses: [] } }, ...original.graph!.edges] } };
  expect(journeyBoundaryIssues(tree, 'submit')).toContainEqual(expect.objectContaining({
    key: `secondary-before-primary:${tree.submissions[1].id}`, repair: { screenId: 'intro', section: 'paths', edgeId: 'shortcut', focus: 'route-target' },
  }));
});
