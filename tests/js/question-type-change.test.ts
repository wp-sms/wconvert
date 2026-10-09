import { expect, it } from 'vitest';
import type { TemplateTree, QuestionNode } from '@renderer/types';
import fixture from '../fixtures/journey-graph-coffee.json';
import enquiry from '../fixtures/journey-graph-enquiry.json';
import { questionTypeChange } from '../../resources/admin/src/builder/structure/questionTypeChange';
import { journeyReadinessIssues } from '../../resources/admin/src/builder/structure/journeyReadiness';
import { walkNodes } from '../../resources/admin/src/builder/structure/journey';
const tree = fixture.template.tree as unknown as TemplateTree;
const question = tree.steps.flatMap(screen => walkNodes(screen.content)).find(node => node.type === 'question' && 'answer_type' in node && node.answer_type === 'single') as QuestionNode & { id: string };
it('preserves choices, results and branch priority while adapting every condition operator', () => {
  const next = questionTypeChange(tree, question.id, 'multi')!;
  expect(next).not.toBeNull();
  const edited = next.steps.flatMap(screen => walkNodes(screen.content)).find(node => 'id' in node && node.id === question.id) as QuestionNode;
  expect(edited.options).toEqual(question.options);
  expect(edited.answer_type).toBe('multi');
  expect(next.graph?.edges.map(edge => [edge.id, edge.from, edge.to])).toEqual(tree.graph?.edges.map(edge => [edge.id, edge.from, edge.to]));
  expect(journeyReadinessIssues(next)).toEqual(journeyReadinessIssues(tree));
  expect(questionTypeChange(next, question.id, 'single')).toEqual(tree);
});
it('refuses to discard choice conditions when switching to free text', () => {
  expect(questionTypeChange(tree, question.id, 'text')).toBeNull();
  expect(question.answer_type).toBe('single');
});
it('requires repair rather than dropping values from a multi-answer comparison', () => {
  const base = structuredClone(enquiry) as unknown as TemplateTree;
  const id = base.steps.find(screen => screen.when)?.when?.clauses[0].question;
  const changed = { ...base, steps: base.steps.map(screen => screen.when ? { ...screen, when: { ...screen.when, clauses: screen.when.clauses.map(clause => ({ ...clause, values: ['garden', 'indoors'] })) } } : screen) };
  expect(questionTypeChange(changed, id!, 'single')).toBeNull();
});
