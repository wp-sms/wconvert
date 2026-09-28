import { expect, it } from 'vitest';
import { Position, type Node } from '@xyflow/react';
import { getSmartEdge, smartEdgePresets, svgDrawSmoothStepLinePath } from '@tisoap/react-flow-smart-edge';
import { mapEdgeOptions, mapLabelPlacement, structuredMapRoute } from '../../resources/admin/src/builder/structure/mapRouting';

// Measured from the real 13-screen enquiry: Garden's hidden continuation goes
// straight to capture, past the remaining independent Home follow-ups.
const cards: Node[] = [
  ['scope', 0, 207.25, 252, 306], ['home', 308, 431, 252, 188],
  ['business', 616, 64.5, 252, 206], ['garden', 616, 344.5, 252, 361],
  ['business-followups', 924, 0, 320, 335], ['home-followups', 924, 465.5, 320, 304],
  ['capture', 1300, 308.5, 252, 248], ['ending', 1608, 394, 176, 77],
].map(([id, x, y, width, height]) => ({ id: String(id), position: { x: Number(x), y: Number(y) },
  data: {}, measured: { width: Number(width), height: Number(height) } }));

it.each([false, true])('routes a hidden continuation around cards after moving an obstacle (RTL: %s)', rtl => {
  const mirror = (x: number) => rtl ? 1784 - x : x;
  let previous = '';
  // The second position blocks the old route, despite not touching either endpoint.
  for (const groupY of [465.5, 406.889, 360, 500]) {
    const nodes = cards.map(node => ({ ...node, position: {
      x: rtl ? mirror(node.position.x + node.measured!.width!) : node.position.x,
      y: node.id === 'home-followups' ? groupY : node.position.y,
    } }));
    const route = getSmartEdge({ nodes, sourceX: mirror(878), sourceY: 646.2421875,
      targetX: mirror(1295), targetY: 432.5546875,
      sourcePosition: rtl ? Position.Left : Position.Right, targetPosition: rtl ? Position.Right : Position.Left,
      options: { ...smartEdgePresets.smoothstep, ...mapEdgeOptions,
        drawEdge: svgDrawSmoothStepLinePath({ borderRadius: mapEdgeOptions.borderRadius }) },
    });
    expect(route).not.toBeInstanceOf(Error);
    if (route instanceof Error) throw route;
    expect(route.svgPathString).not.toMatch(/NaN|undefined/);
    expect(route.points.length).toBeGreaterThan(2);
    // Check every segment, not just its vertices: a long segment can pass through
    // a card with both ends outside. Exclude only the source and target cards.
    const obstacles = nodes.filter(node => !['garden', 'capture'].includes(node.id));
    for (let index = 1; index < route.points.length; index++) {
      const [ax, ay] = route.points[index - 1], [bx, by] = route.points[index];
      const samples = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let sample = 0; sample <= samples; sample++) {
        const x = ax + (bx - ax) * sample / samples, y = ay + (by - ay) * sample / samples;
        expect(obstacles.filter(node => x > node.position.x && x < node.position.x + node.measured!.width!
          && y > node.position.y && y < node.position.y + node.measured!.height!).map(node => node.id)).toEqual([]);
      }
    }
    if (groupY === 406.889) expect(route.svgPathString).not.toBe(previous);
    previous = route.svgPathString;
  }
});


it.each([false,true])('uses a central corridor for clear forward paths (RTL: %s)', rtl => {
  const edge={source:'a',target:'b',sourceX:rtl?500:250,sourceY:400,targetX:rtl?250:500,targetY:100,sourcePosition:rtl?'left':'right',targetPosition:rtl?'right':'left'};
  const route=structuredMapRoute(edge,[]);
  expect(route?.points).toEqual([[edge.sourceX,400],[375,400],[375,100],[edge.targetX,100]]);
  expect(structuredMapRoute(edge,[{id:'obstacle',x:360,y:200,width:30,height:40}])).toBeUndefined();
});
it('reserves the label and action rectangle away from cards, including on vertical sections', () => {
  const boxes=[{id:'a',x:0,y:300,width:252,height:300},{id:'b',x:492,y:0,width:252,height:200}];
  const points=[[252,500],[270,500],[270,100],[492,100]];
  const place=mapLabelPlacement(points,boxes,216,100)!;
  expect(place).toEqual({x:270,y:200});
  for (const box of boxes) expect(place.x+108 <= box.x-12 || place.x-108 >= box.x+box.width+12 || place.y+50 <= box.y-12 || place.y-50 >= box.y+box.height+12).toBe(true);
  expect(mapLabelPlacement([[252,500],[270,500]],boxes,216,100)).toBeUndefined();
});
it('keeps a vertical detour and defers backwards or obstructed connections to the smart router', () => {
  const edge={source:'a',target:'b',sourceX:126,sourceY:200,targetX:126,targetY:400,sourcePosition:'bottom',targetPosition:'top'};
  expect(structuredMapRoute(edge,[])?.points).toEqual([[126,200],[126,300],[126,300],[126,400]]);
  expect(structuredMapRoute({...edge,targetY:100},[])).toBeUndefined();
});
