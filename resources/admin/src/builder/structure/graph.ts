import type { JourneyGraph, JourneyGraphEdge, TemplateNode, TemplateScreen, TemplateTree } from '@renderer/types';

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

/** Storage order is deliberately irrelevant to graph navigation. */
export function graphReaches(graph: JourneyGraph, from: string, to: string): boolean {
  const pending = [from];
  const visited = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (id === to) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    graph.edges.filter(edge => edge.from === id).forEach(edge => pending.push(edge.to));
  }
  return false;
}

export function graphTargets(tree: TemplateTree, source: string): readonly TemplateScreen[] {
  if (!tree.graph) return [];
  return tree.steps.filter(screen => screen.id !== source && !graphReaches(tree.graph!, screen.id, source));
}

export function graphEdgeId(graph: JourneyGraph): string {
  const used = new Set(graph.edges.map(edge => edge.id));
  let serial = 1;
  while (used.has(`edge_${serial}`)) serial++;
  return `edge_${serial}`;
}

/** A stable topological reading order for labels and the Screens inventory. */
export function graphDisplayOrder(tree: TemplateTree): readonly number[] {
  if (!tree.graph) return tree.steps.map((_, index) => index);
  const graph = tree.graph;
  const positions = new Map(tree.steps.map((step, index) => [step.id, index]));
  const incoming = new Map(tree.steps.map(step => [step.id, 0]));
  graph.edges.forEach(edge => incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1));
  const ready = [graph.entry];
  const order: number[] = [];
  const seen = new Set<string>();
  while (ready.length) {
    const id = ready.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const at = positions.get(id);
    if (at !== undefined) order.push(at);
    const outgoing = graph.edges.filter(edge => edge.from === id);
    [...outgoing.filter(edge => edge.kind === 'answer'), ...outgoing.filter(edge => edge.kind === 'default'),
      ...outgoing.filter(edge => edge.kind === 'hidden')].forEach(edge => {
      const left = (incoming.get(edge.to) ?? 1) - 1;
      incoming.set(edge.to, left);
      if (left === 0) ready.push(edge.to);
    });
  }
  return [...order, ...tree.steps.map((_, index) => index).filter(index => !order.includes(index))];
}

/** Insert on a named connection; the existing edge keeps its identity and rule. */
export function insertOnGraphEdge(tree: TemplateTree, edgeId: string, screen: TemplateScreen): TemplateTree {
  if (!tree.graph || tree.steps.some(item => item.id === screen.id)) return tree;
  const edge = tree.graph.edges.find(item => item.id === edgeId);
  if (!edge) return tree;
  const continuation: JourneyGraphEdge = { id: graphEdgeId(tree.graph), from: screen.id, to: edge.to, kind: 'default' };
  const hidden: JourneyGraphEdge | null = screen.when
    ? { id: graphEdgeId({ ...tree.graph, edges: [...tree.graph.edges, continuation] }), from: screen.id, to: edge.to, kind: 'hidden' }
    : null;
  return { ...tree, steps: [...tree.steps, screen], graph: { ...tree.graph,
    edges: [...tree.graph.edges.map(item => item.id === edgeId ? { ...item, to: screen.id } : item), continuation, ...(hidden ? [hidden] : [])] } };
}

export function graphRemoval(tree: TemplateTree, screenId: string): { next: TemplateTree; destination: string; incoming: number } | null {
  if (!tree.graph || tree.graph.entry === screenId) return null;
  const screen = tree.steps.find(item => item.id === screenId);
  if (!screen || screen.kind === 'result' || screen.kind === 'acknowledgement') return null;
  const flatten = (node: TemplateNode): TemplateNode[] => {
    const branches = node as TemplateNode & { children?: readonly TemplateNode[]; start?: readonly TemplateNode[]; end?: readonly TemplateNode[] };
    return [node, ...[...(branches.children ?? []), ...(branches.start ?? []), ...(branches.end ?? [])].flatMap(flatten)];
  };
  const referenced = (question: string) => tree.steps.some(item => [item.when, ...(item.paths?.map(path => path.when) ?? []),
    ...(item.results?.map(result => result.when) ?? [])].some(condition => condition?.clauses.some(clause => clause.question === question)))
    || tree.graph!.edges.some(edge => edge.when?.clauses.some(clause => clause.question === question));
  const nodes = flatten(screen.content);
  if (nodes.some(node => node.type === 'field' || node.type === 'consent'
    || node.type === 'button' && 'action' in node && node.action === 'submit'
    || node.type === 'question' && 'id' in node && typeof node.id === 'string' && referenced(node.id))) return null;
  const outgoing = tree.graph.edges.filter(edge => edge.from === screenId);
  const fallback = outgoing.find(edge => edge.kind === 'default');
  if (!fallback || outgoing.some(edge => edge.kind === 'answer' || edge.to !== fallback.to)) return null;
  const incoming = tree.graph.edges.filter(edge => edge.to === screenId);
  if (!incoming.length) return null;
  return { destination: fallback.to, incoming: incoming.length,
    next: { ...tree, steps: tree.steps.filter(item => item.id !== screenId), graph: { ...tree.graph,
      edges: tree.graph.edges.filter(edge => edge.from !== screenId).map(edge => edge.to === screenId ? { ...edge, to: fallback.to } : edge) } } };
}
