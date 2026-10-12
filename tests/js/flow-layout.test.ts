import { describe, expect, it } from 'vitest';
import type { TemplateTree } from '@renderer/types';
import { flowModel } from '../../resources/admin/src/builder/structure/flowModel';
import { flowLayout, layoutInput, linePath, type Rect } from '../../resources/admin/src/builder/structure/flowLayout';
import enquiry from '../fixtures/journey-graph-enquiry.json';
import branches from '../fixtures/journey-graph-branch-groups.json';
import coffee from '../fixtures/journey-graph-coffee.json';
import large12 from '../fixtures/journey-graph-large-12.json';
import large20 from '../fixtures/journey-graph-large-20.json';

const fixtures = { enquiry, branches, coffee: (coffee as { template?: { tree: unknown } }).template?.tree ?? coffee, large12, large20 } as unknown as Record<string, TemplateTree>;
const apart = (a: Rect, b: Rect) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

describe.each(Object.entries(fixtures))('the %s map', (_, tree) => {
  const model = flowModel(tree);
  // Varied measured heights, as cards wrap differently.
  const heights = (id: string) => 96 + (id.length % 4) * 22;
  const ltr = flowLayout(layoutInput(model, heights), {});
  const rtl = flowLayout(layoutInput(model, heights), { rtl: true });

  it('runs every line downward, from the bottom of one box to the top of the next', () => {
    for (const line of model.lines) {
      const points = ltr.lines.get(line.id)!.points;
      for (let at = 1; at < points.length; at++) expect(points[at][1], line.id).toBeGreaterThanOrEqual(points[at - 1][1]);
      expect(points[0][1]).toBeCloseTo(ltr.boxes.get(line.from)!.y + ltr.boxes.get(line.from)!.height, 3);
      expect(points.at(-1)![1]).toBeCloseTo(ltr.boxes.get(line.to)!.y, 3);
    }
  });

  it('keeps cards, labels and “+” clear of one another', () => {
    const rects = [...ltr.boxes.entries(), ...[...ltr.lines.entries()].flatMap(([id, line]) => line.label ? [[`label:${id}`, line.label] as const] : [])];
    for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
      expect(apart(rects[a][1], rects[b][1]), `${rects[a][0]} overlaps ${rects[b][0]}`).toBe(true);
    }
  });

  it('mirrors in RTL and keeps every box on the page', () => {
    for (const [id, box] of ltr.boxes) {
      const mirrored = rtl.boxes.get(id)!;
      expect(mirrored.x).toBeCloseTo(ltr.width - box.x - box.width, 3);
      expect(mirrored.y).toBeCloseTo(box.y, 3);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(ltr.width);
    }
  });

  it('reads top to bottom, and across a row in the reading direction', () => {
    expect(ltr.order[0]).toBe(model.nodeOf(tree.graph!.entry));
    expect(new Set(ltr.order)).toEqual(new Set(ltr.boxes.keys()));
    for (const order of [ltr, rtl].map(layout => layout.order.map(id => ({ id, box: (layout === ltr ? ltr : rtl).boxes.get(id)! })))) {
      for (let at = 1; at < order.length; at++) {
        const [before, after] = [order[at - 1].box, order[at].box];
        expect(before.y + before.height / 2).toBeLessThanOrEqual(after.y + after.height / 2 + 0.5);
      }
    }
    const row = (layout: typeof ltr) => layout.order.filter(id => layout.row.get(id) === layout.row.get(layout.order[1]));
    if (row(ltr).length > 1) expect(row(rtl)).toEqual(row(ltr));
  });
});

describe('a line’s path', () => {
  it('rounds its corners and never bends backwards', () => {
    expect(linePath([[10, 0], [10, 40], [60, 40], [60, 90]], 8)).toBe('M10,0 L10,32 Q10,40 18,40 L52,40 Q60,40 60,48 L60,90');
    expect(linePath([[10, 0], [10, 90]], 8)).toBe('M10,0 L10,90');
  });
});
