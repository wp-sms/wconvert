import { expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { journeyReadinessIssues } from '../../resources/admin/src/builder/structure/journeyReadiness';
import fixture from '../fixtures/journey-graph-enquiry.json';

const base = fixture as unknown as TemplateTree;

it('accepts graph conditions whose question is available on at least one incoming path', () => {
  const tree: TemplateTree = { ...base, graph: { ...base.graph!, edges: [...base.graph!.edges,
    { id: 'shortcut', from: 'interests', to: 'contact', kind: 'answer', when: { match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: ['balcony'] }] } },
    { id: 'large-garden', from: 'contact', to: 'received', kind: 'answer', when: { match: 'all', clauses: [{ question: 'n2', operator: 'is', values: ['large'] }] } },
  ] } };
  expect(journeyReadinessIssues(tree)).toEqual([]);
});

it('names a rule source that can only be answered after the rule', () => {
  const tree: TemplateTree = { ...base, graph: { ...base.graph!, edges: [...base.graph!.edges,
    { id: 'too-early', from: 'interests', to: 'contact', kind: 'answer', when: { match: 'all', clauses: [{ question: 'n2', operator: 'is', values: ['large'] }] } },
  ] } };
  const issue = journeyReadinessIssues(tree).find(issue => issue.key === 'edge:too-early');
  expect(issue?.said).toContain('“Garden size?” cannot be answered before this rule');
  expect(issue?.repair).toEqual({ screenId: 'interests', section: 'paths', edgeId: 'too-early' });
});

it('locates a missing continuation without calling an input screen an ending', () => {
  const tree = { ...base, graph: { ...base.graph!, edges: base.graph!.edges.filter(edge => edge.from !== 'garden') } };
  const issues = journeyReadinessIssues(tree);
  expect(issues).toContainEqual({ key: 'continue:garden', said: 'Choose where visitors continue after “Garden details”.',
    repair: { screenId: 'garden', section: 'paths', pathPriority: 0 } });
});

/** ADR 0135: a skipped screen continues along its default edge, so a missing hidden edge is not an issue. */
it('asks nothing about where a skipped screen goes when it has somewhere to continue', () => {
  const tree = { ...base, graph: { ...base.graph!, edges: base.graph!.edges.filter(edge => edge.kind !== 'hidden') } };
  expect(journeyReadinessIssues(tree).map(issue => issue.key).filter(key => key.startsWith('hidden:'))).toEqual([]);
});

it('points a removed answer back to its screen visibility rule', () => {
  const tree: TemplateTree = { ...base, steps: base.steps.map(screen => screen.id === 'garden' ? { ...screen,
    when: { match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: ['removed'] }] } } : screen) };
  const issue = journeyReadinessIssues(tree).find(issue => issue.key === 'show:garden');
  expect(issue?.said).toContain('no longer available in “What interests you?”');
  expect(issue?.repair).toEqual({ screenId: 'garden', section: 'content' });
});

it('names the exact graph path with an unfinished answer and its repair target', () => {
  const tree: TemplateTree = { ...base, graph: { ...base.graph!, edges: [...base.graph!.edges,
    { id: 'new_branch', from: 'interests', to: 'balcony', kind: 'answer',
      when: { match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: [] }] } },
  ] } };
  expect(journeyReadinessIssues(tree)).toContainEqual({ key: 'edge:new_branch',
    said: 'Choose an answer for the path from “Interests” to “Balcony details”.',
    repair: { screenId: 'interests', section: 'paths', edgeId: 'new_branch' } });
});

it('locates a disconnected screen by stable ID even when names can change', () => {
  const tree: TemplateTree = { ...base, graph: { ...base.graph!, edges: base.graph!.edges.filter(edge => edge.id !== 'submitted') } };
  expect(journeyReadinessIssues(tree)).toContainEqual({ key: 'unreachable:received',
    said: 'No journey path reaches “Received”. Connect or remove this screen.',
    repair: { screenId: 'received', section: 'content' } });
});

it('blocks a required-save bypass and locates its hidden continuation', () => {
  const tree: TemplateTree = { ...base, graph: { ...base.graph!, edges: base.graph!.edges.map(edge =>
    edge.id === 'balcony_hidden' ? { ...edge, to: 'received' } : edge) } };
  expect(journeyReadinessIssues(tree)).toContainEqual({ key: 'capture-path:enquiry:received',
    said: 'A path reaches “Received” without the required save at “One enquiry”. Reconnect this path through the save screen.',
    repair: { screenId: 'balcony', section: 'paths', edgeId: 'balcony_hidden', focus: 'hidden-route' } });
  const optional: TemplateTree = { ...tree, submissions: tree.submissions.map(item => ({ ...item, required: false })) };
  expect(journeyReadinessIssues(optional).some(issue => issue.key.startsWith('capture-path:'))).toBe(false);
});

/** A result's link is optional (ADR 0133): no address hides its button. An address needs words. */
it('lets a product result go without a link, but not a link without words', () => {
  const result: TemplateTree = { ...base, steps: [{ id: 'match', name: 'Your match', kind: 'result', content: { type: 'stack', children: [] },
    results: [{ id: 'default', heading: 'Garden picks', body: '', product_ids: [12] }] }], submissions: [], graph: { entry: 'match', edges: [] } };
  expect(journeyReadinessIssues(result)).toEqual([]);
  const unlabelled: TemplateTree = { ...result, steps: result.steps.map(screen => ({ ...screen, results: screen.results!.map(variant => ({ ...variant, href: '/shop/' })) })) };
  expect(journeyReadinessIssues(unlabelled)).toContainEqual({ key: 'result-link:match:default',
    said: 'Add words for the link button on “Garden picks” (“Your match”), or remove its address.',
    repair: { screenId: 'match', section: 'content', resultId: 'default', focus: 'result-link' } });
  const fixed: TemplateTree = { ...unlabelled, steps: unlabelled.steps.map(screen => ({ ...screen, results: screen.results!.map(variant => ({ ...variant, link_label: 'Browse plants' })) })) };
  expect(journeyReadinessIssues(fixed)).toEqual([]);
});

it('names incomplete question text and answers by stable question identity', () => {
  const tree: TemplateTree = { ...base, steps: base.steps.map(screen => screen.id === 'interests' ? { ...screen, content: { type: 'stack', children: [
    { type: 'question', id: 'first', label: 'A complete question', answer_type: 'text', required: false },
    { type: 'question', id: 'second', label: '', answer_type: 'single', required: false, options: [{ value: 'a', label: 'Named' }, { value: 'b', label: '' }] },
  ] } } : screen) };
  const issues = journeyReadinessIssues(tree);
  expect(issues.find(issue => issue.key === 'question-label:second')?.repair).toEqual({ screenId: 'interests', section: 'content', focus: 'questions', questionId: 'second' });
  expect(issues.find(issue => issue.key === 'choice-label:second:1')?.repair).toEqual({ screenId: 'interests', section: 'content', focus: 'questions', questionId: 'second', choiceIndex: 1 });
});

it('locates missing result headings and conditions instead of allowing a generic server refusal', () => {
  const tree: TemplateTree = { ...base, steps: [...base.steps, { id: 'result', name: 'Your match', kind: 'result', content: { type: 'stack', children: [] },
    results: [{ id: 'first', heading: '', body: '', product_ids: [] }, { id: 'fallback', heading: 'All other answers', body: '', product_ids: [] }] }] };
  const issues = journeyReadinessIssues(tree);
  expect(issues.find(issue => issue.key === 'result-heading:result:first')?.repair).toEqual({ screenId: 'result', section: 'content', resultId: 'first', focus: 'result-heading' });
  expect(issues.find(issue => issue.key === 'result:result:0')?.said).toContain('Only the last one, for all other answers, has none');
});
