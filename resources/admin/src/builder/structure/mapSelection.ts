interface MapConnection { id: string; source: string; target: string }

/** A screen highlights its neighbours; a path highlights the route after it.
 * These are structural relationships, not a prediction of the visitor's answers. */
export function relatedMapElements(edges: readonly MapConnection[], screenId?: string, edgeId?: string) {
  const screens = new Set<string>();
  const paths = new Set<string>();
  const edge = edgeId ? edges.find(item => item.id === edgeId) : undefined;
  if (edge) {
    screens.add(edge.source);
    paths.add(edge.id);
    const pending = [edge.target];
    const visited = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id); screens.add(id);
      for (const next of edges.filter(item => item.source === id)) {
        paths.add(next.id); pending.push(next.target);
      }
    }
  } else if (screenId) {
    screens.add(screenId);
    for (const item of edges) if (item.source === screenId || item.target === screenId) {
      paths.add(item.id); screens.add(item.source); screens.add(item.target);
    }
  }
  return { screens, paths };
}
