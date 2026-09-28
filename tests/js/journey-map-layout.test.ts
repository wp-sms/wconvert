import { expect, it } from 'vitest';
import { branchRegions, layoutMap, type MapBox, type MapLink } from '../../resources/admin/src/builder/structure/mapLayout';
const boxes = (ids: string[]): MapBox[] => ids.map(id => ({ id, width: 252, height: 180 }));
const links = (pairs: string[][]): MapLink[] => pairs.map(([source, target]) => ({ source, target }));
function arrange(ids: string[], pairs: string[][], sources: string[], rtl = false) {
  const nodes = boxes(ids), edges = links(pairs), regions = branchRegions(ids, edges, new Set(sources));
  return { regions, positions: layoutMap(nodes, edges, regions, rtl) };
}
it('keeps an ordinary sequence horizontal', () => {
  const { regions, positions: p } = arrange(['a','b','c'], [['a','b'],['b','c']], []);
  expect(regions).toHaveLength(0);
  expect(p.a.y).toBe(p.b.y); expect(p.b.y).toBe(p.c.y);
  expect(p.a.x).toBeLessThan(p.b.x); expect(p.b.x).toBeLessThan(p.c.x);
});
it('puts optional questions below their entry and keeps the shared result on the main row', () => {
  const { regions, positions: p } = arrange(['taste','grinder','result','signup'], [['taste','grinder'],['taste','result'],['grinder','result'],['result','signup']], ['taste']);
  expect(regions[0].detour).toBe(true);
  expect(p.grinder.x).toBe(p.taste.x); expect(p.grinder.y).toBeGreaterThan(p.taste.y + 180);
  expect(p.result.y).toBe(p.taste.y); expect(p.result.x).toBeGreaterThan(p.taste.x);
  expect(p.signup.y).toBe(p.result.y);
});
it('keeps a multi-screen detour in visit order', () => {
  const { positions: p } = arrange(['a','b','c','d'], [['a','b'],['a','d'],['b','c'],['c','d']], ['a']);
  expect(p.a.x).toBe(p.b.x); expect(p.b.x).toBe(p.c.x);
  expect(p.c.y).toBeGreaterThan(p.b.y + 180);
});
it('uses separate priority-ordered lanes for competing branches, including an empty fallback', () => {
  const { regions, positions: p } = arrange(['a','b','c','d'], [['a','b'],['a','c'],['a','d'],['b','d'],['c','d']], ['a']);
  expect(regions[0].detour).toBe(false); expect(p.b.x).toBe(p.c.x);
  expect(p.b.y).toBeLessThan(p.c.y); expect(p.b.x).toBeGreaterThan(p.a.x);
  expect(p.d.x).toBeGreaterThan(p.c.x);
});
it('does not group an arm entered by another path', () => {
  const { regions } = arrange(['a','b','c','external'], [['a','b'],['a','c'],['b','c'],['external','b']], ['a']);
  expect(regions).toHaveLength(0);
});
it('leaves nested splits and separate endings explicit', () => {
  const { regions } = arrange(['a','b','c','d','e'], [['a','b'],['a','c'],['b','d'],['b','e']], ['a','b']);
  expect(regions).toHaveLength(0);
});
it('keeps independently checked follow-ups out of exclusive branch grouping', () => {
  const { regions } = arrange(['question','group','save'], [['question','group'],['group','save'],['group','save']], []);
  expect(regions).toHaveLength(0);
});
it('reserves measured card sizes without overlapping and mirrors RTL', () => {
  const nodes = [{id:'a',width:300,height:400},{id:'b',width:420,height:650},{id:'c',width:252,height:200},{id:'other',width:252,height:200}];
  const edges = links([['a','b'],['a','c'],['b','c']]);
  const regions = branchRegions(nodes.map(n=>n.id),edges,new Set(['a']));
  const p = layoutMap(nodes,edges,regions), r = layoutMap(nodes,edges,regions,true);
  expect(r.c.x).toBeLessThan(r.a.x); expect(r.b.y).toBe(p.b.y);
  for (const a of nodes) for (const b of nodes) if (a.id!==b.id) {
    expect(p[a.id].x+a.width<=p[b.id].x || p[b.id].x+b.width<=p[a.id].x || p[a.id].y+a.height<=p[b.id].y || p[b.id].y+b.height<=p[a.id].y).toBe(true);
  }
});
