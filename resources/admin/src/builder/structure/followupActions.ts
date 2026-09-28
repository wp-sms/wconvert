import type { TemplateTree } from '@renderer/types';
import { followupGroups, followupGroupSource } from './followupGroups';
import { walkNodes } from './journey';
import { answerInsertionEdge } from './graphInsertion';

/** Move within a closed independent group; both shown and skipped paths travel together. */
export function moveFollowup(tree: TemplateTree, screenId: string, direction: -1 | 1): TemplateTree {
  const group = followupGroups(tree).find(item => item.screens.some(at => tree.steps[at].id === screenId));
  if (!tree.graph || !group || followupGroupSource(tree, group) === undefined) return tree;
  const order = group.screens.map(at => tree.steps[at].id);
  const from = order.indexOf(screenId), to = from + direction;
  if (to < 0 || to >= order.length) return tree;
  const first = order[0];
  [order[from], order[to]] = [order[to], order[from]];
  const members = new Set(order);
  return { ...tree, graph: { ...tree.graph, edges: tree.graph.edges.map(edge => members.has(edge.from)
    ? { ...edge, to: order[order.indexOf(edge.from) + 1] ?? group.next }
    : edge.to === first ? { ...edge, to: order[0] } : edge) } };
}

/** Keep explicit custom ordering; otherwise insert alongside the source's choice order. */
export function followupInsertionEdge(tree: TemplateTree, source: string, questionId: string, value: string) {
  const entry = answerInsertionEdge(tree, source, questionId, value);
  const group = followupGroups(tree).find(item => tree.steps[item.screens[0]].id === entry?.to);
  if (!entry || !group || followupGroupSource(tree, group) === undefined) return entry;
  const question = tree.steps.flatMap(screen => walkNodes(screen.content)).find(node => node.type === 'question' && 'id' in node && node.id === questionId);
  if (!question || question.type !== 'question' || !('options' in question)) return entry;
  const options = question.options ?? [];
  const rank = (choice: string) => options.findIndex(option => option.value === choice);
  const ranks = group.screens.map(at => {
    const clauses = tree.steps[at].when?.clauses;
    return clauses?.length === 1 && clauses[0].question === questionId && clauses[0].values.length === 1
      && ['is', 'includes_any'].includes(clauses[0].operator) ? rank(clauses[0].values[0]) : -1;
  });
  const ordered = ranks.every((at, i) => at >= 0 && (i === 0 || at >= ranks[i - 1]));
  const before = ordered ? ranks.findIndex(at => at > rank(value)) : -1;
  if (before === 0) return entry;
  const previous = tree.steps[group.screens[before < 0 ? group.screens.length - 1 : before - 1]].id;
  return tree.graph?.edges.find(edge => edge.from === previous && edge.kind === 'default') ?? entry;
}
