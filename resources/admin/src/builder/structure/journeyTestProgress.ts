import type { TemplateTree } from '@renderer/types';
import type { GraphTrace } from '../../../../loader/src/journey-graph';
import type { JourneyTrace } from '../../../../loader/src/journey-rules';

type ScreenProgress = 'current' | 'visited' | 'pending' | 'hidden' | 'bypassed';

/** A test records completed transitions, not the fallback route for unanswered questions. */
export function journeyTestProgress(tree: TemplateTree, step: number, visited: readonly number[], trace: GraphTrace | JourneyTrace) {
  const currentId = tree.steps[step]?.id;
  const boundary = trace.decisions.findIndex(decision => decision.from === (tree.graph ? currentId : step));
  const decisions = !trace.indices.includes(step) ? [] : boundary < 0 ? trace.decisions : trace.decisions.slice(0, boundary);
  const hidden = new Set(decisions.filter(decision => decision.kind === 'hidden').map(decision => decision.from));
  const reachable = new Set<string>();
  if (tree.graph) {
    const targets = new Map<string, string[]>();
    for (const edge of tree.graph.edges) targets.set(edge.from, [...(targets.get(edge.from) ?? []), edge.to]);
    const pending = [currentId];
    while (pending.length) {
      const id = pending.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      pending.push(...(targets.get(id) ?? []));
    }
  }
  const states: ScreenProgress[] = tree.steps.map((screen, at) => {
    if (at === step) return 'current';
    if (visited.includes(at)) return 'visited';
    if (hidden.has(tree.graph ? screen.id : at)) return 'hidden';
    // Future conditions have not been evaluated by the visitor yet. Consider all
    // structural continuations, including branches that today's answers do not match.
    const possible = tree.graph ? reachable.has(screen.id) : at > step;
    return possible ? 'pending' : 'bypassed';
  });
  return { decisions, states };
}
