import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrastReport } from './catalogue-contrast.mjs';

const renderer = readFileSync(new URL('../out/renderer.iife.js', import.meta.url), 'utf8');
const shipped = JSON.parse(readFileSync(new URL('../../../resources/templates/library/reading-slip.json', import.meta.url), 'utf8'));
// A pale photograph-like picture: a light SVG, as a picture a design might carry.
const pale = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f2f2f2"/></svg>').toString('base64');

test('text the visitor cannot read is found, on a flat colour and over a picture; a readable design passes', async () => {
  const unreadable = { ...shipped, id: 'unreadable', tokens: { ...shipped.tokens, bg: '#ffffff', fg: '#eeeeee', muted: '#efefef' } };
  const overPicture = { ...shipped, id: 'over-picture', tokens: { ...shipped.tokens, 'bg-image': `url(${pale})`, bg: '#f2f2f2', fg: '#e8e8e8', muted: '#e8e8e8' } };
  const report = await contrastReport([shipped, unreadable, overPicture], renderer);
  assert.deepEqual(report.get(shipped.id), []);
  assert.ok(report.get('unreadable').length > 0, 'Pale text on white');
  assert.ok(report.get('over-picture').length > 0, 'Pale text over a pale picture');
  assert.ok(report.get('unreadable').every(failure => failure.ratio < 4.5));
});
