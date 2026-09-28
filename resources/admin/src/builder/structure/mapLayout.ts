import dagre from '@dagrejs/dagre';

export interface MapBox { id: string; width: number; height: number; }
export interface MapLink { source: string; target: string; }
export interface BranchRegion { source: string; join: string; arms: string[][]; detour: boolean; }

/** Only group closed, single-entry arms. Nested/custom graphs remain explicit. */
export function branchRegions(ids: readonly string[], links: readonly MapLink[], branches: ReadonlySet<string>): BranchRegion[] {
  const outgoing = new Map(ids.map(id => [id, [...new Set(links.filter(e => e.source === id && e.target !== id).map(e => e.target))]]));
  const incoming = new Map(ids.map(id => [id, [...new Set(links.filter(e => e.target === id && e.source !== id).map(e => e.source))]]));
  const claimed = new Set<string>();
  const result: BranchRegion[] = [];
  for (const source of ids) {
    const targets = outgoing.get(source) ?? [];
    if (!branches.has(source) || targets.length < 2 || claimed.has(source)) continue;
    const walks = targets.map(target => {
      const path: string[] = [], seen = new Set([source]);
      let next: string | undefined = target;
      while (next && outgoing.has(next) && !seen.has(next)) {
        path.push(next); seen.add(next);
        const after: string[] = outgoing.get(next)!;
        next = after.length === 1 ? after[0] : undefined;
      }
      return path;
    });
    const join = walks[0].find(id => walks.every(path => path.includes(id)));
    if (!join || claimed.has(join)) continue;
    const arms = walks.map(path => path.slice(0, path.indexOf(join)));
    const members = arms.flat();
    if (!members.length || new Set(members).size !== members.length || members.some(id => claimed.has(id))) continue;
    if (arms.some(path => path.some((id, at) => incoming.get(id)?.length !== 1 || incoming.get(id)?.[0] !== (at ? path[at - 1] : source)))) continue;
    result.push({ source, join, arms, detour: targets.length === 2 && arms.some(path => path.length === 0) });
    claimed.add(source); members.forEach(id => claimed.add(id));
  }
  return result;
}

/** Measured cards, semantic branch regions, then Dagre for the remaining DAG. */
export function layoutMap(boxes: readonly MapBox[], links: readonly MapLink[], regions: readonly BranchRegion[], rtl = false) {
  const sizes = new Map(boxes.map(box => [box.id, box]));
  const owner = new Map(boxes.map(box => [box.id, box.id]));
  const blocks = new Map(boxes.map(box => [box.id, { width: box.width, height: box.height, anchor: box.height / 2,
    children: new Map([[box.id, { x: 0, y: 0 }]]) }]));
  for (const region of regions) {
    const source = sizes.get(region.source)!;
    const block = blocks.get(region.source)!;
    if (region.detour) {
      for (const id of region.arms.flat()) {
        const box = sizes.get(id)!;
        block.children.set(id, { x: 0, y: block.height + 144 });
        block.height += 144 + box.height;
        block.width = Math.max(block.width, box.width);
      }
    } else {
      let y = 0;
      for (const arm of region.arms) {
        let x = source.width + 240;
        const height = Math.max(80, ...arm.map(id => sizes.get(id)!.height));
        for (const id of arm) {
          const box = sizes.get(id)!;
          block.children.set(id, { x, y });
          x += box.width + 240;
        }
        block.width = Math.max(block.width, x - 240);
        y += height + 100;
      }
      block.height = Math.max(source.height, y - 100);
      block.anchor = block.height / 2;
      block.children.set(source.id, { x: 0, y: block.anchor - source.height / 2 });
    }
    for (const id of region.arms.flat()) { owner.set(id, source.id); blocks.delete(id); }
  }
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', ranksep: 240, nodesep: 80 });
  graph.setDefaultEdgeLabel(() => ({}));
  // Symmetric reservation around the source's centre keeps the main continuation
  // aligned while leaving collision-free space for the downward detour.
  blocks.forEach((block, id) => graph.setNode(id, { width: block.width, height: 2 * Math.max(block.anchor, block.height - block.anchor) }));
  links.forEach(edge => {
    const from = owner.get(edge.source), to = owner.get(edge.target);
    if (from && to && from !== to) graph.setEdge(from, to);
  });
  dagre.layout(graph);
  const positions: Record<string, { x: number; y: number }> = {};
  blocks.forEach((block, id) => {
    const node = graph.node(id);
    block.children.forEach((offset, child) => { positions[child] = { x: node.x - block.width / 2 + offset.x, y: node.y - block.anchor + offset.y }; });
  });
  const right = Math.max(0, ...boxes.map(box => positions[box.id].x + box.width));
  if (rtl) boxes.forEach(box => { positions[box.id].x = right - positions[box.id].x - box.width; });
  return positions;
}
