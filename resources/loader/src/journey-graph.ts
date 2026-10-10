import type { JourneyGraph, TemplateScreen } from '@renderer/types';
import { matches, screenQuestionIds, type Answers } from './journey-rules';

export interface GraphDecision { readonly edge: string; readonly from: string; readonly to: string; readonly kind: 'answer' | 'default' | 'hidden'; readonly priority?: number; }
export interface GraphTrace { readonly indices: readonly number[]; readonly answers: Answers; readonly decisions: readonly GraphDecision[]; readonly hidden: readonly string[]; }

export function graphReaches(graph: JourneyGraph, from: string, to: string): boolean {
  const seen = new Set<string>();
  const pending = [from];
  while (pending.length) {
    const current = pending.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const edge of graph.edges) if (edge.from === current) {
      if (edge.to === to) return true;
      pending.push(edge.to);
    }
  }
  return false;
}

/** Route by stable screen and edge IDs. Array position and canvas layout have no effect. */
export function graphTrace(steps: readonly TemplateScreen[], graph: JourneyGraph, answers: Answers): GraphTrace {
  const positions = new Map(steps.map((screen, index) => [screen.id, index]));
  const active: Answers = {};
  const indices: number[] = [];
  const decisions: GraphDecision[] = [];
  const hidden: string[] = [];
  const seen = new Set<string>();
  let id: string | undefined = graph.entry;
  while (id && positions.has(id) && !seen.has(id)) {
    seen.add(id);
    const index = positions.get(id)!;
    const screen = steps[index];
    const shown = matches(screen.when, active);
    if (shown) {
      indices.push(index);
      for (const question of screenQuestionIds(screen)) if (answers[question] !== undefined) active[question] = answers[question];
    } else hidden.push(id);
    const outgoing = graph.edges.filter(edge => edge.from === id);
    const choices = outgoing.filter(edge => edge.kind === 'answer');
    const priority = shown ? choices.findIndex(edge => edge.when && matches(edge.when, active)) : -1;
    // A skipped screen takes its hidden edge where it has one, else falls through
    // along its default edge (ADR 0135) — the same rule as JourneyGraph::trace.
    const fallback = outgoing.find(item => item.kind === 'default');
    const edge = shown ? priority >= 0 ? choices[priority] : fallback
      : outgoing.find(item => item.kind === 'hidden') ?? fallback;
    if (!edge) break;
    decisions.push({ edge: edge.id, from: id, to: edge.to, kind: edge.kind, ...(priority >= 0 ? { priority } : {}) });
    id = edge.to;
  }
  return { indices, answers: active, decisions, hidden };
}
