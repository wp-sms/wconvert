import type { TemplateTree } from '@renderer/types';
import { walkNodes } from './journey';

export const MAX_PATH_QUESTIONS = 10;
interface QuestionPath { count: number; screens: readonly string[]; }

/** Conservative route capacity: answer rules can narrow it, never increase it. */
export function questionPath(tree: TemplateTree, addAt?: string): QuestionPath | null {
  const weights = new Map(tree.steps.map(screen => [screen.id,
    walkNodes(screen.content).filter(node => node.type === 'question').length + Number(screen.id === addAt)]));
  if (!tree.graph) return { count: [...weights.values()].reduce((sum, count) => sum + count, 0), screens: tree.steps.filter(screen => weights.get(screen.id)).map(screen => screen.id) };
  const outgoing = new Map<string, typeof tree.graph.edges[number][]>();
  tree.graph.edges.forEach(edge => outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]));
  const memo = new Map<string, QuestionPath>();
  const visiting = new Set<string>();
  const visit = (id: string): QuestionPath | null => {
    if (!weights.has(id) || visiting.has(id)) return null;
    if (memo.has(id)) return memo.get(id)!;
    visiting.add(id);
    const weight = weights.get(id)!;
    let best: QuestionPath = { count: weight, screens: weight ? [id] : [] };
    for (const edge of outgoing.get(id) ?? []) {
      const next = visit(edge.to);
      if (!next) return null;
      const own = edge.kind === 'hidden' ? 0 : weight;
      const candidate = { count: own + next.count, screens: [...(own ? [id] : []), ...next.screens] };
      if (candidate.count > best.count) best = candidate;
    }
    visiting.delete(id); memo.set(id, best);
    return best;
  };
  return visit(tree.graph.entry);
}
