import type { JourneyGraph, TemplateNode, TemplateScreen } from '@renderer/types';
import { matches, type Answers } from './journey-rules';

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
      const nodes: TemplateNode[] = [screen.content];
      while (nodes.length) {
        const node = nodes.shift()!;
        if (node.type === 'question' && 'id' in node && typeof node.id === 'string' && answers[node.id] !== undefined) active[node.id] = answers[node.id];
        const layout = node as { children?: TemplateNode[]; start?: TemplateNode[]; end?: TemplateNode[] };
        nodes.push(...(layout.children ?? []), ...(layout.start ?? []), ...(layout.end ?? []));
      }
    } else hidden.push(id);
    const outgoing = graph.edges.filter(edge => edge.from === id);
    const choices = outgoing.filter(edge => edge.kind === 'answer');
    const priority = shown ? choices.findIndex(edge => edge.when && matches(edge.when, active)) : -1;
    const edge = shown ? priority >= 0 ? choices[priority] : outgoing.find(item => item.kind === 'default')
      : outgoing.find(item => item.kind === 'hidden');
    if (!edge) break;
    decisions.push({ edge: edge.id, from: id, to: edge.to, kind: edge.kind, ...(priority >= 0 ? { priority } : {}) });
    id = edge.to;
  }
  return { indices, answers: active, decisions, hidden };
}
