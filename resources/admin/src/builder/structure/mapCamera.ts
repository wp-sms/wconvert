import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';

/** Overview can be tiny; selecting a screen must still make it readable. */
export const mapMinZoom = 0.02;

export function cameraTargets(nodes: Node[], selectedId: string, nextId: string | undefined, width: number, height: number, contextIds: readonly string[] = []) {
  const selected = nodes.find(node => node.id === selectedId);
  const next = nodes.find(node => node.id === nextId);
  const targets = [{ id: selectedId }];
  if (!selected || width < 600) return targets;
  const zoom = (items: Node[]) => getViewportForBounds(getNodesBounds(items), width, height, mapMinZoom, 1, .2).zoom;
  const context = nodes.filter(node => node.id === selectedId || contextIds.includes(node.id));
  if (context.length > 1 && zoom(context) >= Math.min(.65, zoom([selected]) * .85)) return context.map(node => ({ id: node.id }));
  if (!next || next.id === selected.id) return targets;
  // A distant branch or merge must not shrink the selected card into a thumbnail.
  if (zoom([selected, next]) >= Math.min(.65, zoom([selected]) * .85)) targets.push({ id: next.id });
  return targets;
}
