import type { JourneyGraph, JourneyGraphEdge, TemplateTree } from '@renderer/types';

/** One-time v2 migration. Storage order seeds edges; it never routes v3 visitors. */
export function graphFromOrderedJourney(tree: TemplateTree): JourneyGraph {
  const edges: JourneyGraphEdge[] = [];
  let serial = 0;
  const edge = (from: string, to: string, kind: JourneyGraphEdge['kind'], when?: JourneyGraphEdge['when']) => {
    edges.push({ id: `edge_${++serial}`, from, to, kind, ...(when ? { when } : {}) });
  };
  tree.steps.forEach((screen, index) => {
    const next = tree.steps[index + 1];
    if (screen.paths) {
      screen.paths.forEach(path => edge(screen.id, path.to, path.when ? 'answer' : 'default', path.when));
    } else if (next) edge(screen.id, next.id, 'default');
    if (screen.when && next) edge(screen.id, next.id, 'hidden');
  });
  return { entry: tree.steps[0]?.id ?? '', edges };
}

export function upgradeToGraph(tree: TemplateTree): TemplateTree {
  if (tree.graph) return tree;
  const graph = graphFromOrderedJourney(tree);
  return { ...tree, v: 3, graph, steps: tree.steps.map(screen => { const next = { ...screen }; delete next.paths; return next; }) };
}
