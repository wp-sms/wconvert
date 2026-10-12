import dagre from '@dagrejs/dagre';
import type { FlowCard, FlowGroupBox, FlowLine, FlowModel } from './flowModel';

/**
 * Where the Flow map's boxes and lines go (ADR 0142): dagre, top to bottom.
 * A line's label and "+" are dagre edge labels, so the layout reserves their
 * room and nothing lands on them; lines are then drawn square, turning only in
 * the gaps between rows, which hold nothing. RTL mirrors x. `order` is the
 * reading order the DOM and the arrow keys follow.
 */

export interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export interface LayoutBox { readonly id: string; readonly width: number; readonly height: number }
export interface LayoutLine { readonly id: string; readonly from: string; readonly to: string; readonly label: { width: number; height: number } | null; readonly weight: number }
export interface PlacedLine { readonly points: readonly (readonly [number, number])[]; readonly path: string; readonly label?: Rect }
export interface FlowLayout {
  readonly width: number;
  readonly height: number;
  /** Top-left corners, in map pixels at 100%. */
  readonly boxes: ReadonlyMap<string, Rect>;
  readonly lines: ReadonlyMap<string, PlacedLine>;
  readonly order: readonly string[];
  /** Which row each box sits in, for ← and →. */
  readonly row: ReadonlyMap<string, number>;
}

export const CARD_WIDTH = 240;
export const GROUP_WIDTH = 272;
const RANK_GAP = 36;

/** Room for a line's label and its "+": generous, so the real pill always fits inside it. */
export function pillSize(line: Pick<FlowLine, 'label' | 'color' | 'insertEdgeId'>, coarse = false): { width: number; height: number } | null {
  const plus = line.insertEdgeId ? (coarse ? 44 : 26) + 4 : 0;
  // A label wraps at 220px rather than cutting a condition short (GUIDELINES §21).
  const text = line.label ? line.label.length * 7.2 + (line.color ? 13 : 0) : 0;
  const rows = Math.max(1, Math.ceil(text / 196));
  const label = line.label ? Math.min(220, 24 + text) : 0;
  if (!plus && !label) return null;
  return { width: Math.ceil(label + plus), height: Math.max(coarse ? 44 : 26, 10 + rows * 16) };
}

/** A first guess at a card's height, until the browser has measured it. */
export function estimateCard(card: FlowCard): number {
  const rows = [16, 20, ...(card.onlyIf || card.unreachable ? [20] : []), ...(card.kind === 'form' ? [17] : []),
    ...(card.results ? [...card.results.slice(0, 3).map(() => 17), ...(card.results.length > 3 ? [17] : [])] : []), 18, ...(card.skip ? [18] : [])];
  return 22 + (card.color ? 2 : 0) + rows.reduce((sum, row) => sum + row, 0) + 4 * (rows.length - 1);
}

export function estimateGroup(group: FlowGroupBox): number {
  const rows = [18, 16, ...group.members.map(() => 30), 18];
  return 23 + rows.reduce((sum, row) => sum + row, 0) + 4 * (rows.length - 1);
}

export function layoutInput(model: FlowModel, measured: (id: string) => number | undefined = () => undefined, coarse = false): { boxes: LayoutBox[]; lines: LayoutLine[] } {
  return {
    boxes: [...model.cards.map(card => ({ id: card.id, width: CARD_WIDTH, height: measured(card.id) ?? estimateCard(card) })),
      ...model.groups.map(group => ({ id: group.id, width: GROUP_WIDTH, height: measured(group.id) ?? estimateGroup(group) }))],
    lines: model.lines.map(line => ({ id: line.id, from: line.from, to: line.to, label: pillSize(line, coarse),
      // An answer line holds its target in the row below its question, as the
      // prototype does; a line around a screen bends to make room.
      weight: line.style === 'answer' ? 8 : line.style === 'plain' ? 2 : 0.5 })),
  };
}

export function flowLayout({ boxes, lines }: { boxes: readonly LayoutBox[]; lines: readonly LayoutLine[] }, { rtl = false }: { rtl?: boolean } = {}): FlowLayout {
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({ rankdir: 'TB', nodesep: 48, edgesep: 24, ranksep: RANK_GAP, marginx: 24, marginy: 24 });
  graph.setDefaultEdgeLabel(() => ({}));
  const ids = new Set(boxes.map(box => box.id));
  boxes.forEach(box => graph.setNode(box.id, { width: box.width, height: box.height }));
  const drawn = lines.filter(line => ids.has(line.from) && ids.has(line.to) && line.from !== line.to);
  // Dagre lays a box's lines out in the reverse of the order they were added.
  // Added last to first, a question's lines read left to right in the order
  // they are checked, with "All other answers" last (ADR 0142).
  [...drawn].reverse().forEach(line => graph.setEdge({ v: line.from, w: line.to, name: line.id },
    { width: line.label?.width ?? 0, height: line.label?.height ?? 0, labelpos: 'c', weight: line.weight, minlen: 1 }));
  dagre.layout(graph);
  const { width = 0, height = 0 } = graph.graph() as { width?: number; height?: number };
  const centre = (id: string) => graph.node(id) as { x: number; y: number; width: number; height: number };

  // How far each row reaches above and below its centre line: the gaps between rows hold nothing.
  const reach = new Map<number, number>();
  const note = (y: number, half: number) => { const key = Math.round(y); reach.set(key, Math.max(reach.get(key) ?? 0, half)); };
  boxes.forEach(box => note(centre(box.id).y, box.height / 2));
  const placed = drawn.map(line => ({ line, edge: graph.edge({ v: line.from, w: line.to, name: line.id }) as { points: { x: number; y: number }[]; x?: number; y?: number } }));
  placed.forEach(({ line, edge }) => { if (line.label && edge.y !== undefined) note(edge.y, line.label.height / 2); edge.points.slice(1, -1).forEach(point => note(point.y, 0)); });
  const half = (y: number) => reach.get(Math.round(y)) ?? 0;

  // Lines leaving one box spread across its edge, in the order they travel;
  // lines into one box meet at the middle of its top, under one arrowhead.
  const spread = (id: string, list: { line: LayoutLine; x: number }[]) => {
    const box = centre(id);
    const step = Math.min(16, (box.width - 24) / Math.max(1, list.length));
    return new Map([...list].sort((a, b) => a.x - b.x).map((item, at) => [item.line.id, box.x + (at - (list.length - 1) / 2) * step]));
  };
  const starts = new Map<string, number>(), ends = new Map<string, number>();
  for (const id of ids) {
    spread(id, placed.filter(item => item.line.from === id).map(item => ({ line: item.line, x: item.edge.points[1]?.x ?? centre(item.line.to).x }))).forEach((x, line) => starts.set(line, x));
    placed.filter(item => item.line.to === id).forEach(item => ends.set(item.line.id, centre(id).x));
  }

  const flip = (x: number) => rtl ? width - x : x;
  const routed = new Map<string, PlacedLine>();
  for (const { line, edge } of placed) {
    const source = centre(line.from), target = centre(line.to);
    // Each stop is [x, the row it sits in, where the line touches it].
    const stops: [number, number, number][] = [[starts.get(line.id)!, source.y, source.y + source.height / 2],
      ...edge.points.slice(1, -1).map(point => [point.x, point.y, point.y] as [number, number, number]),
      [ends.get(line.id)!, target.y, target.y - target.height / 2]];
    const points: [number, number][] = [[stops[0][0], stops[0][2]]];
    for (let at = 1; at < stops.length; at++) {
      const [ax, ay] = stops[at - 1], [bx, by, bTouch] = stops[at];
      if (Math.abs(ax - bx) > 0.5) {
        const turn = (ay + half(ay) + by - half(by)) / 2;
        points.push([ax, turn], [bx, turn]);
      }
      points.push([bx, bTouch]);
    }
    const mirrored = points.map(([x, y]) => [flip(x), y] as [number, number]);
    const clean = mirrored.filter((point, at) => at === 0 || point[0] !== mirrored[at - 1][0] || point[1] !== mirrored[at - 1][1]);
    routed.set(line.id, { points: clean, path: linePath(clean),
      ...(line.label && edge.x !== undefined && edge.y !== undefined ? { label: { x: flip(edge.x) - line.label.width / 2, y: edge.y - line.label.height / 2, width: line.label.width, height: line.label.height } } : {}) });
  }

  const rects = new Map(boxes.map(box => {
    const node = centre(box.id);
    return [box.id, { x: flip(node.x) - box.width / 2, y: node.y - box.height / 2, width: box.width, height: box.height }] as const;
  }));
  const rows = [...new Set(boxes.map(box => Math.round(centre(box.id).y)))].sort((a, b) => a - b);
  const row = new Map(boxes.map(box => [box.id, rows.indexOf(Math.round(centre(box.id).y))]));
  const order = [...boxes].map(box => box.id).sort((a, b) => row.get(a)! - row.get(b)!
    || (rtl ? rects.get(b)!.x - rects.get(a)!.x : rects.get(a)!.x - rects.get(b)!.x));
  return { width, height, boxes: rects, lines: routed, order, row };
}

/** A square line with rounded corners, through points that only ever turn at right angles. */
export function linePath(points: readonly (readonly [number, number])[], radius = 8): string {
  if (!points.length) return '';
  const parts = [`M${points[0][0]},${points[0][1]}`];
  for (let at = 1; at < points.length; at++) {
    const [x, y] = points[at];
    const next = points[at + 1];
    if (!next) { parts.push(`L${x},${y}`); break; }
    const [px, py] = points[at - 1];
    const r = Math.min(radius, Math.hypot(x - px, y - py) / 2, Math.hypot(next[0] - x, next[1] - y) / 2);
    const into = [x - Math.sign(x - px) * r, y - Math.sign(y - py) * r];
    const out = [x + Math.sign(next[0] - x) * r, y + Math.sign(next[1] - y) * r];
    parts.push(`L${into[0]},${into[1]}`, `Q${x},${y} ${out[0]},${out[1]}`);
  }
  return parts.join(' ');
}
