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

it('locates missing continuations and hidden exits without calling an input screen an ending', () => {
  const tree = { ...base, graph: { ...base.graph!, edges: base.graph!.edges.filter(edge => edge.from !== 'garden') } };
  const issues = journeyReadinessIssues(tree);
  expect(issues).toContainEqual({ key: 'continue:garden', said: 'Choose where visitors continue after “Garden details”.',
    repair: { screenId: 'garden', section: 'paths', pathPriority: 0 } });
  expect(issues).toContainEqual({ key: 'hidden:garden', said: 'Choose where visitors go when “Garden details” is hidden.',
    repair: { screenId: 'garden', section: 'paths' } });
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
