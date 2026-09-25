import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, TemplateTree } from '@renderer/types';
import { unreachableScreenIds } from './journey';

export interface JourneyRepair {
  readonly screenId: string;
  readonly section: 'content' | 'paths';
  readonly edgeId?: string;
  readonly pathPriority?: number;
}

export interface JourneyReadinessIssue {
  readonly key: string;
  readonly said: string;
  readonly repair: JourneyRepair;
}

/** Name the incomplete authoring controls we can locate before the server's final validation. */
export function journeyReadinessIssues(tree: TemplateTree): JourneyReadinessIssue[] {
  const issues: JourneyReadinessIssue[] = [];
  const incomplete = (condition: QuestionCondition | undefined) => !condition || !condition.clauses.length
    || condition.clauses.some(clause => !clause.question || !clause.values.length || clause.values.some(value => !value));
  for (const screen of tree.steps) {
    if (screen.when && incomplete(screen.when)) issues.push({ key: `show:${screen.id}`,
      said: sprintf(__('Choose an answer for when “%s” appears.', 'wconvert'), screen.name),
      repair: { screenId: screen.id, section: 'content' } });
    screen.results?.forEach((result, index) => {
      if (!result.when || !incomplete(result.when)) return;
      issues.push({ key: `result:${screen.id}:${index}`,
        said: sprintf(__('Choose an answer for result %1$d on “%2$s”.', 'wconvert'), index + 1, screen.name),
        repair: { screenId: screen.id, section: 'content' } });
    });
    screen.paths?.forEach((path, index) => {
      if (!path.when || !incomplete(path.when)) return;
      issues.push({ key: `path:${screen.id}:${index}`,
        said: sprintf(__('Choose an answer for path %1$d from “%2$s”.', 'wconvert'), index + 1, screen.name),
        repair: { screenId: screen.id, section: 'paths', pathPriority: index } });
    });
  }
  if (tree.graph) for (const edge of tree.graph.edges) {
    if (edge.kind !== 'answer' || !incomplete(edge.when)) continue;
    const source = tree.steps.find(screen => screen.id === edge.from)?.name ?? edge.from;
    const target = tree.steps.find(screen => screen.id === edge.to)?.name ?? edge.to;
    issues.push({ key: `edge:${edge.id}`,
      said: sprintf(__('Choose an answer for the path from “%1$s” to “%2$s”.', 'wconvert'), source, target),
      repair: { screenId: edge.from, section: 'paths', edgeId: edge.id } });
  }
  for (const id of unreachableScreenIds(tree)) {
    const name = tree.steps.find(screen => screen.id === id)?.name ?? id;
    issues.push({ key: `unreachable:${id}`,
      said: sprintf(__('No journey path reaches “%s”. Connect or remove this screen.', 'wconvert'), name),
      repair: { screenId: id, section: 'content' } });
  }
  return issues;
}
