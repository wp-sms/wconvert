import type { TemplateTree } from '@renderer/types';
import type { GraphDecision } from '../../../../loader/src/journey-graph';
import type { JourneyDecision } from '../../../../loader/src/journey-rules';

/** Translate evaluator decisions into the connection IDs rendered by the map. */
export function journeyTraceEdges(tree: TemplateTree, decisions: readonly (GraphDecision | JourneyDecision)[]): string[] {
  return decisions.flatMap(decision => {
    if ('edge' in decision) return [decision.edge];
    const screen = tree.steps[decision.from];
    const target = tree.steps[decision.to]?.id;
    if (!screen || !target) return [];
    const paths = screen.paths ?? (tree.steps[decision.from + 1] ? [{ to: tree.steps[decision.from + 1].id }] : []);
    const priority = decision.kind === 'route' ? decision.priority ?? -1 : paths.findIndex(path => path.to === target);
    if (priority >= 0 && paths[priority]?.to === target) return [`${screen.id}-${priority}`];
    return decision.kind === 'hidden' ? [`${screen.id}-hidden`] : [];
  });
}
