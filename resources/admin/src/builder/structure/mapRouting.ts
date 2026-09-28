// Keep card clearance and rounded corners identical in the worker and geometry checks.
export const mapEdgeOptions = { nodePadding: 14, gridRatio: 12, borderRadius: 6 };
// A clear straight line does not imply a clear smooth-step elbow. Continue routing
// while dragging instead of switching every connection to an animated fallback.
export const mapRoutingOptions = { routeOnlyWhenBlocked: false, routeWhileDragging: true, debounceMs: 16 };

export interface RoutingBox { id: string; x: number; y: number; width: number; height: number; }
interface RouteEndpoints {
  corridorOffset?: number; source: string; target: string; sourceX: number; sourceY: number; targetX: number; targetY: number;
  sourcePosition: string; targetPosition: string;
}
const intersects = (x: number, y: number, width: number, height: number, box: RoutingBox, padding = 12) =>
  x < box.x + box.width + padding && x + width > box.x - padding && y < box.y + box.height + padding && y + height > box.y - padding;

/** Predictable centre corridors for forward connections; smart routing handles obstacles. */
export function structuredMapRoute(edge: RouteEndpoints, boxes: readonly RoutingBox[]) {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = edge;
  const horizontal = edge.sourcePosition === 'right' && edge.targetPosition === 'left' && tx - sx >= 48
    || edge.sourcePosition === 'left' && edge.targetPosition === 'right' && sx - tx >= 48;
  const vertical = edge.sourcePosition === 'bottom' && edge.targetPosition === 'top' && ty - sy >= 48;
  if (!horizontal && !vertical) return undefined;
  const allowance = Math.max(0, Math.abs(tx - sx) / 2 - 24);
  const lane = Math.max(-allowance, Math.min(allowance, edge.corridorOffset ?? 0));
  const centerX = (sx + tx) / 2 + lane * (tx >= sx ? 1 : -1) * (ty > sy ? -1 : 1), centerY = (sy + ty) / 2;
  const points = horizontal ? [[sx,sy],[centerX,sy],[centerX,ty],[tx,ty]] : [[sx,sy],[sx,centerY],[tx,centerY],[tx,ty]];
  const obstacles = boxes.filter(box => box.id !== edge.source && box.id !== edge.target);
  if (points.slice(1).some((b, at) => {
    const a = points[at];
    return obstacles.some(box => intersects(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),box));
  })) return undefined;
  return { points, centerX, centerY };
}

/** Reserve the full controls rectangle. If no safe spot exists, the path inspector remains available. */
export function mapLabelPlacement(points: readonly number[][], boxes: readonly RoutingBox[], width: number, height: number) {
  const candidates: { x: number; y: number; score: number }[] = [];
  let start = points[0];
  for (let at = 1; at < points.length; at++) {
    const end = points[at], next = points[at + 1];
    if (next && (start[0] === end[0] && end[0] === next[0] || start[1] === end[1] && end[1] === next[1])) continue;
    const horizontal = start[1] === end[1];
    const length = Math.hypot(end[0]-start[0],end[1]-start[1]);
    if (length) for (const fraction of [.5,.25,.75]) {
      const x = start[0] + (end[0]-start[0])*fraction, y = start[1] + (end[1]-start[1])*fraction;
      if (!boxes.some(box => intersects(x-width/2,y-height/2,width,height,box))) candidates.push({x,y,score:length + (horizontal ? 100 : 0) - Math.abs(.5-fraction)*20});
    }
    start = end;
  }
  const best = candidates.sort((a,b)=>b.score-a.score)[0];
  return best ? {x:best.x,y:best.y} : undefined;
}
