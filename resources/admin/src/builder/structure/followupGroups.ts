import type { TemplateTree } from '@renderer/types';
import { graphDisplayOrder } from './graph';
import { walkNodes } from './journey';

export interface FollowupGroup { id: string; screens: readonly number[]; next: string; }

/** A view of an independently checked sequence, never a new routing node. */
export function followupGroups(tree: TemplateTree): FollowupGroup[] {
  if (!tree.graph) return [];
  const graph = tree.graph;
  const eligible = new Map<string, { index: number; next: string; sources: string }>();
  tree.steps.forEach((screen, index) => {
    if (screen.id === graph.entry || !screen.when?.clauses.length || !['input', 'content'].includes(screen.kind)) return;
    const nodes = walkNodes(screen.content);
    if (!nodes.some(node => node.type === 'question') || nodes.some(node => node.type === 'field' || node.type === 'consent'
      || node.type === 'button' && 'action' in node && node.action === 'submit')) return;
    const routes = graph.edges.filter(edge => edge.from === screen.id);
    const normal = routes.find(edge => edge.kind === 'default');
    if (routes.length !== 2 || !normal || !routes.some(edge => edge.kind === 'hidden' && edge.to === normal.to)) return;
    eligible.set(screen.id, { index, next: normal.to, sources: [...new Set(screen.when.clauses.map(clause => clause.question))].sort().join('|') });
  });
  const follows = (from: string, to: string) => {
    const before = eligible.get(from), after = eligible.get(to);
    return !!before && !!after && before.next === to && before.sources === after.sources
      && graph.edges.filter(edge => edge.to === to).every(edge => edge.from === from);
  };
  const groups: FollowupGroup[] = [];
  const seen = new Set<string>();
  for (const index of graphDisplayOrder(tree)) {
    const first = tree.steps[index].id;
    if (!eligible.has(first) || seen.has(first) || graph.edges.some(edge => edge.to === first && follows(edge.from, first))) continue;
    const screens = [index];
    seen.add(first);
    let current = first;
    while (follows(current, eligible.get(current)!.next) && !seen.has(eligible.get(current)!.next)) {
      current = eligible.get(current)!.next; seen.add(current); screens.push(eligible.get(current)!.index);
    }
    if (screens.length < 2) continue;
    // Rules depending on an answer inside the sequence are not independent.
    const ownQuestions = new Set(screens.flatMap(at => walkNodes(tree.steps[at].content))
      .filter(node => node.type === 'question' && 'id' in node).map(node => (node as { id: string }).id));
    if (screens.some(at => tree.steps[at].when!.clauses.some(clause => ownQuestions.has(clause.question)))) continue;
    groups.push({ id: `followups:${first}`, screens, next: eligible.get(current)!.next });
  }
  return groups;
}
