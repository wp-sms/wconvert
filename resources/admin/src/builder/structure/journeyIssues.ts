import type { TemplateTree } from '@renderer/types';
import { journeyReadinessIssues } from './journeyReadiness';
import { journeyBoundaryIssues } from './journeyBoundaryReadiness';

/** The map and publish review share both validation and repair addresses. */
export function journeyIssues(tree: TemplateTree, action?: string) {
  return [...new Map([...journeyReadinessIssues(tree), ...journeyBoundaryIssues(tree, action)]
    .map(issue => [issue.key, issue])).values()];
}
