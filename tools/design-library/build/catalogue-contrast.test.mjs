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

test('the close control and the error message are measured too (ADR 0159)', async () => {
  // A design with a field, so there is something to refuse.
  const popup = { ...JSON.parse(readFileSync(new URL('../../../resources/templates/library/centred-card.json', import.meta.url), 'utf8')), display_type: 'popup' };
  const vanished = { ...popup, id: 'vanished-close', tokens: { ...popup.tokens, bg: '#0f172a', fg: '#f8fafc', 'close-bg': 'transparent', 'close-border': 'transparent', 'close-fg': '#1e293b' } };
  const bare = { ...vanished, id: 'bare-close', tokens: { ...vanished.tokens, 'close-fg': 'fg' } };
  const faint = { ...popup, id: 'faint-error', tokens: { ...popup.tokens, 'error-fg': '#fca5a5', 'error-bg': '#fef2f2' } };
  const report = await contrastReport([popup, vanished, bare, faint], renderer);
  assert.deepEqual(report.get(popup.id), [], 'The default × and error read');
  assert.ok(report.get('vanished-close').some(failure => failure.text === '× (close)'), 'A dark × on a dark card');
  assert.ok(!report.get('bare-close').some(failure => failure.text === '× (close)'), 'A bare × in the design text colour');
  assert.ok(report.get('faint-error').some(failure => failure.text.startsWith('Enter a valid')), 'Pale error text');
});
