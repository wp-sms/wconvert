import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { publicPreview } from './public-preview.mjs';
const renderer = readFileSync(new URL('../out/renderer.iife.js', import.meta.url), 'utf8');
test('public Free and Pro previews contain every inert screen without editable trees or renderer code', () => {
  const entry = JSON.parse(readFileSync(new URL('../../../resources/templates/library/excerpt-window.json', import.meta.url)));
  const markup = publicPreview({ name: 'A & B', description: 'Try the designs', version: '1.0.0', templates: [entry, {...entry, tier: 'basic', name: 'Pro example'}] }, renderer);
  const dom = new JSDOM(markup);
  assert.equal(dom.window.document.querySelectorAll('template').length, 4);
  assert.equal(dom.window.document.querySelectorAll('#screen option').length, 4);
  assert.match(markup, /Pro example/); assert.match(markup, / · Pro/); assert.match(markup, / · Free/);
  assert.doesNotMatch(markup, /WConvertRenderer|"submissions"|"template_id"/);
  for (const template of dom.window.document.querySelectorAll('template')) {
    for (const input of template.content.querySelectorAll('input,select,button,textarea')) assert.equal(input.disabled, true);
    assert.equal(template.content.querySelectorAll('a[href]').length, 0);
  }
  dom.window.close();
});

test('includes each result variant and labels countdowns as examples', () => {
  const journey = JSON.parse(readFileSync(new URL('../../../pro/modules/journeys/templates/journey-content-guide.json', import.meta.url)));
  const countdown = JSON.parse(readFileSync(new URL('../../../pro/modules/display-types/templates/bar-countdown.json', import.meta.url)));
  const markup = publicPreview({ name: 'Pro screens', description: 'All alternatives', version: '1.0.0', templates: [journey, countdown] }, renderer);
  const dom = new JSDOM(markup);
  const templates = [...dom.window.document.querySelectorAll('template')];
  const headings = templates.flatMap(t => [...t.content.querySelectorAll('[data-result-heading]')].map(h => h.textContent));
  assert.deepEqual(headings, journey.tree.steps.flatMap(step => (step.results ?? []).map(result => result.heading)));
  assert.match(markup, /Example countdown, not a live deadline/);
  dom.window.close();
});
