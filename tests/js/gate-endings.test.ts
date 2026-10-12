import { describe, expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import fixture from '../fixtures/journey-graph-early-endings.json';
import enquiry from '../fixtures/journey-graph-enquiry.json';
import { earlyEnding, gateEndings } from '../../resources/admin/src/builder/structure/gateEndings';
import { requiredSaveBypasses } from '../../resources/admin/src/builder/structure/graphChangeImpact';
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
    expect(earlyEnding(form.tree, 'not_fit')).toBe('details');
    expect(earlyEnding(form.tree, 'received')).toBeNull();
    expect(earlyEnding(result.tree, 'browse')).toBe('result');
    expect(earlyEnding(enquiry as unknown as TemplateTree, 'received')).toBeNull();
  });

  it('lets an early ending through readiness, and keeps refusing a shared one', () => {
    const [early, shared, earlyResult, sharedResult] = cases;
    expect(requiredSaveBypasses(early.tree)).toEqual([]);
    expect(journeyReadinessIssues(early.tree).filter(issue => issue.key.startsWith('capture-path'))).toEqual([]);
    expect(requiredSaveBypasses(shared.tree).map(item => item.endingId)).toEqual(['received']);
    expect(journeyBoundaryIssues(earlyResult.tree, 'match')).toEqual([]);
    expect(journeyBoundaryIssues(sharedResult.tree, 'match').map(issue => issue.key)).toEqual(['result-bypass:browse']);
  });
});
