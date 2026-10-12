import { describe, expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import fixture from '../fixtures/journey-graph-early-endings.json';
import enquiry from '../fixtures/journey-graph-enquiry.json';
import { earlyEnding, gateEndings } from '../../resources/admin/src/builder/structure/gateEndings';
import { graphChangeImpact, requiredSaveBypasses } from '../../resources/admin/src/builder/structure/graphChangeImpact';
import { journeyBoundaryIssues } from '../../resources/admin/src/builder/structure/journeyBoundaryReadiness';
import { journeyReadinessIssues } from '../../resources/admin/src/builder/structure/journeyReadiness';

const cases = fixture.cases as unknown as { name: string; goal: string; gate: string; tree: TemplateTree; after: string[]; early: string[]; shared: string[] }[];

describe('endings either side of a gate (ADR 0142)', () => {
  it.each(cases.map(item => [item.name, item] as const))('matches the server: %s', (_, item) => {
    const sides = gateEndings(item.tree, item.gate);
    expect({ after: sides.after, early: sides.early, shared: sides.shared }).toEqual({ after: item.after, early: item.early, shared: item.shared });
  });

  it('names an early ending by what it skips', () => {
    const form = cases[0], result = cases[2];
    expect(earlyEnding(form.tree, 'not_fit')).toEqual([{ gate: 'details', always: true }]);
    expect(earlyEnding(form.tree, 'received')).toEqual([]);
    expect(earlyEnding(result.tree, 'browse')).toEqual([{ gate: 'result', always: true }]);
    expect(earlyEnding(cases[1].tree, 'received')).toEqual([{ gate: 'details', always: false }]);
    expect(earlyEnding(enquiry as unknown as TemplateTree, 'received')).toEqual([]);
  });

  it('lets early and shared endings through readiness, and names both for a change review', () => {
    const [early, shared, earlyResult, sharedResult] = cases;
    for (const item of [early, shared]) expect(journeyReadinessIssues(item.tree).filter(issue => issue.key.startsWith('capture-path'))).toEqual([]);
    expect(requiredSaveBypasses(early.tree, { endings: true }).map(item => item.endingId)).toEqual(['not_fit']);
    expect(requiredSaveBypasses(shared.tree, { endings: true }).map(item => item.endingId)).toEqual(['not_fit', 'received']);
    expect(journeyBoundaryIssues(earlyResult.tree, 'match')).toEqual([]);
    expect(journeyBoundaryIssues(sharedResult.tree, 'match')).toEqual([]);
  });

  it('asks to check a change that adds an early ending, once', () => {
    const early = cases[0];
    // Before: the answer that now ends early still went on to the form.
    const before: TemplateTree = { ...early.tree, graph: { ...early.tree.graph!, edges: early.tree.graph!.edges.map(edge => edge.id === 'to_not_fit' ? { ...edge, to: 'repair' } : edge) } };
    expect(graphChangeImpact(before, early.tree)).toContain('A line could reach “Not a fit” without saving at “Contact details”.');
    expect(graphChangeImpact(early.tree, early.tree)).toBeNull();
  });

  it('refuses a disconnected form for being disconnected, not for its endings', () => {
    for (const item of cases.filter(entry => entry.name.startsWith('no ending comes after'))) {
      const said = journeyReadinessIssues(item.tree).map(issue => issue.said);
      expect(said.some(text => text.startsWith('No line reaches'))).toBe(true);
      expect(said.filter(text => text.includes('without saving') || text.includes('without showing'))).toEqual([]);
    }
  });
});
