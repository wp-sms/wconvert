import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { publicPreview } from './public-preview.mjs';
const renderer = readFileSync(new URL('../out/renderer.iife.js', import.meta.url), 'utf8');
test('public Free and Pro previews contain every inert screen without editable trees or renderer code', () => {
  const entry = JSON.parse(readFileSync(new URL('../../../resources/templates/library/excerpt-window.json', import.meta.url)));
  const markup = publicPreview({ name: 'A & B', description: 'Try the designs', version: '1.0.0', templates: [entry, {...entry, tier: 'pro', name: 'Pro example'}] }, renderer);
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
  for (const template of templates) for (const link of template.content.querySelectorAll('[data-result-link]')) assert.equal(link.hidden, true, 'An empty optional destination must not invent a button');
  dom.window.close();
});

test('design-only v1 omits chrome and applies screen/device fragments without resetting the screen', () => {
  const design = JSON.parse(readFileSync(new URL('../../../resources/templates/library/excerpt-window.json', import.meta.url)));
  // A slash is part of the authored result ID as well as the step/result delimiter.
  design.tree.steps[1].results = [{ id: 'outcome/one', heading: 'Outcome', body: 'Sample' }];
  const markup = publicPreview({ templates: [design] }, renderer, [], { designId: design.id, designOnly: true });
  const dom = new JSDOM(markup, { runScripts: 'dangerously', url: 'https://templates.example/#screen=s2%2Foutcome%2Fone&device=mobile' });
  const document = dom.window.document, sample = document.getElementById('sample');
  assert.equal(document.querySelector('meta[name="wconvert-embed"]').content, 'design-only:1');
  assert.equal(document.querySelector('header,nav,section,.disclosure,select,button'), null);
  assert.equal(sample.dataset.screen, 's2/outcome/one');
  assert.equal(sample.dataset.device, 'mobile');
  dom.window.location.hash = 'screen=s2%2Foutcome%2Fone&device=desktop';
  dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
  assert.equal(sample.dataset.screen, 's2/outcome/one');
  assert.equal(sample.dataset.device, 'desktop');
  for (const hash of ['screen=', 'device=', 'device=tablet', 'screen=missing', 'screen=s1&screen=s1', 'foo=bar']) {
    dom.window.location.hash = hash; dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
    assert.equal(sample.hidden, true, hash);
    assert.equal(document.getElementById('error').hidden, false, hash);
  }
  dom.window.location.hash = ''; dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
  assert.equal(sample.hidden, false);
  assert.equal(sample.dataset.screen, design.tree.steps[0].id);
  assert.equal(sample.dataset.device, 'desktop');
  assert.doesNotMatch(markup, /postMessage|window\.parent|WConvertRenderer/);
  dom.window.close();
});
