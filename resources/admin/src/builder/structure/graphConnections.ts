import type { QuestionNode, TemplateTree } from '@renderer/types';
import { graphEdgeId, graphReaches } from './graph';
import { walkNodes } from './journey';

/** A branch can use a question available on at least one path to its source. */
export function graphChoiceSources(tree: TemplateTree, source: string): (QuestionNode & { id: string })[] {
  if (!tree.graph) return [];
  return tree.steps.filter(screen => graphReaches(tree.graph!, screen.id, source))
    .flatMap(screen => walkNodes(screen.content))
    .filter((node): node is QuestionNode & { id: string } => node.type === 'question' && 'id' in node
      && typeof node.id === 'string' && 'answer_type' in node && node.answer_type !== 'text');
}

export function canTargetGraphScreen(tree: TemplateTree, source: string, target: string): boolean {
  return !!tree.graph && tree.steps.some(screen => screen.id === source)
    && tree.steps.some(screen => screen.id === target) && !graphReaches(tree.graph, target, source);
}

export function canAddGraphConnection(tree: TemplateTree, source: string, target: string): boolean {
  if (!canTargetGraphScreen(tree, source, target)) return false;
  const graph = tree.graph!;
  const screen = tree.steps.find(screen => screen.id === source)!;
  const routes = graph.edges.filter(edge => edge.from === source);
  const fallback = routes.find(edge => edge.kind === 'default');
  if (screen.kind === 'acknowledgement') return false;
  if (!fallback) return screen.kind !== 'result' || routes.some(edge => edge.kind === 'answer');
  if (routes.some(edge => edge.kind !== 'hidden' && edge.to === target)) return false;
  return graphChoiceSources(tree, source).length > 0;
}

/** Drawing adds a draft condition, never guesses which visitors should take it. */
export function addGraphConnection(tree: TemplateTree, source: string, target: string): TemplateTree {
  if (!canAddGraphConnection(tree, source, target)) return tree;
  const graph = tree.graph!;
  const fallback = graph.edges.find(edge => edge.from === source && edge.kind === 'default');
  const question = graphChoiceSources(tree, source)[0];
  return { ...tree, graph: { ...graph, edges: [...graph.edges, { id: graphEdgeId(graph), from: source, to: target,
    kind: fallback ? 'answer' : 'default', ...(fallback ? { when: { match: 'all', clauses: [{ question: question.id,
      operator: question.answer_type === 'multi' ? 'includes_any' : 'is', values: [''] }] } } : {}) }] } };
}

/**
 * Reconnection changes only the destination; identity, condition and priority
 * survive. Moving a screen's default drops a skip edge that only copied the old
 * destination, so a skipped screen keeps falling through (ADR 0135).
 */
export function reconnectGraphEdge(tree: TemplateTree, edgeId: string, target: string): TemplateTree {
  const edge = tree.graph?.edges.find(edge => edge.id === edgeId);
  if (!edge || edge.to === target || !canTargetGraphScreen(tree, edge.from, target)) return tree;
  const copied = (item: { from: string; to: string; kind: string }) => edge.kind === 'default' && item.kind === 'hidden' && item.from === edge.from && item.to === edge.to;
  return { ...tree, graph: { ...tree.graph!, edges: tree.graph!.edges.filter(item => !copied(item)).map(item => item.id === edgeId ? { ...item, to: target } : item) } };
}
