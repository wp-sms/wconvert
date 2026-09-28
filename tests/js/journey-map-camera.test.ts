import { expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { cameraTargets } from '../../resources/admin/src/builder/structure/mapCamera';
const card = (id: string, x: number, y: number, height = 240): Node => ({ id, position: { x, y }, width: 252, height, data: {} });
it('includes a nearby next screen when both stay readable', () => {
  expect(cameraTargets([card('a', 0, 0), card('b', 360, 0)], 'a', 'b', 900, 600)).toEqual([{ id: 'a' }, { id: 'b' }]);
});
it.each([3000, -3000])('focuses the selected screen instead of a distant branch or merge at %d', y => {
  expect(cameraTargets([card('a', 0, 0), card('b', 360, y)], 'a', 'b', 900, 600)).toEqual([{ id: 'a' }]);
});
it('keeps useful nearby context for a tall question even below the preferred reading zoom', () => {
  expect(cameraTargets([card('a', 0, 0, 1000), card('b', 360, 400)], 'a', 'b', 900, 600)).toEqual([{ id: 'a' }, { id: 'b' }]);
});
it('focuses one screen on narrow displays and ignores an absent or identical next screen', () => {
  const nodes = [card('a', 0, 0), card('b', 360, 0)];
  expect(cameraTargets(nodes, 'a', 'b', 390, 600)).toEqual([{ id: 'a' }]);
  expect(cameraTargets(nodes, 'a', 'missing', 900, 600)).toEqual([{ id: 'a' }]);
  expect(cameraTargets(nodes, 'a', 'a', 900, 600)).toEqual([{ id: 'a' }]);
});

it('frames the optional detour and its shared result when all three stay readable', () => {
  const nodes = [card('entry',0,0),card('extra',0,400),card('result',492,0)];
  expect(cameraTargets(nodes,'entry','extra',924,984,['entry','extra','result'])).toEqual([{id:'entry'},{id:'extra'},{id:'result'}]);
  expect(cameraTargets(nodes,'extra','result',924,984,['entry','extra','result'])).toEqual([{id:'entry'},{id:'extra'},{id:'result'}]);
  expect(cameraTargets(nodes,'entry','extra',390,600,['entry','extra','result'])).toEqual([{id:'entry'}]);
});
