import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { publicPreview } from './public-preview.mjs';
import { createHash } from 'node:crypto';
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

test('public countdown samples preserve the renderer’s boxes, density and authored unit labels', () => {
  const design = JSON.parse(readFileSync(new URL('../../../pro/modules/display-types/templates/halloween-countdown.json', import.meta.url)));
  for (const options of [{}, { designId: design.id, designOnly: true }]) {
    const markup = publicPreview({ name: 'Countdown', templates: [design] }, renderer, [], options);
    const dom = new JSDOM(markup);
    const timer = dom.window.document.querySelector('template').content.querySelector('[role=timer]');
    assert.equal(timer.classList.contains('wc-boxes'), true);
    assert.equal(timer.classList.contains('wc-compact'), true);
    assert.deepEqual([...timer.querySelectorAll('.wc-unit')].map(unit => ({
      value: unit.querySelector('.wc-count')?.textContent,
      label: unit.querySelector('small')?.textContent,
    })), [
      { value: '2', label: 'Days' },
      { value: '14', label: 'Hrs' },
      { value: '00', label: 'Mins' },
      { value: '00', label: 'Secs' },
    ]);
    assert.equal(timer.getAttribute('aria-label'), 'Example countdown, not a live deadline');
    assert.equal(timer.getAttribute('aria-atomic'), 'true');
    assert.doesNotMatch(markup, /setInterval|Date\.now|endsAt/);
    dom.window.close();
  }
});

test('plain countdown samples keep the inline slot and renderer time format', () => {
  const design = JSON.parse(readFileSync(new URL('../../../pro/modules/display-types/templates/bar-countdown.json', import.meta.url)));
  const markup = publicPreview({ templates: [design] }, renderer, [], { designId: design.id, designOnly: true });
  const dom = new JSDOM(markup);
  const timer = dom.window.document.querySelector('template').content.querySelector('[role=timer]');
  assert.equal(timer.classList.contains('wc-boxes'), false);
  assert.equal(timer.querySelectorAll('.wc-count').length, 1);
  assert.equal(timer.querySelector('.wc-count').textContent, '2d 14:00:00');
  assert.equal(timer.getAttribute('aria-label'), 'Example countdown, not a live deadline');
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

test('a public preview never embeds an original premium image, only a downscaled copy', () => {
  const entry = JSON.parse(readFileSync(new URL('../../../resources/templates/library/excerpt-window.json', import.meta.url)));
  entry.tree.steps[0].content.start.push({ type: 'image', id: 'n90', src: '', alt: 'Pixel' });
  const original = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=', 'base64');
  const asset = { id: 'pixel', sha256: createHash('sha256').update(original).digest('hex'), mime: 'image/png', bytes: original.length, width: 1, height: 1, access: 'premium' };
  const pack = { name: 'Pro', description: '', version: 'r1', assets: [asset], image_bindings: [{ template_id: entry.id, slot: 'tree/steps/0/content/start/' + (entry.tree.steps[0].content.start.length - 1) + '/src', asset_id: 'pixel' }], templates: [{ ...entry, tier: 'pro' }] };
  assert.throws(() => publicPreview(pack, renderer, [{ id: 'pixel', bytes: original }]), /never embeds an original premium image/);
  const small = Buffer.from('small-webp');
  const markup = publicPreview(pack, renderer, [{ id: 'pixel', bytes: small, mime: 'image/webp', verified: false }], { designId: entry.id });
  assert.match(markup, new RegExp('data:image/webp;base64,' + small.toString('base64')));
  assert.doesNotMatch(markup, new RegExp(original.toString('base64').slice(0, 24)));
});

test('C13: a background picture bound by slot shows in the preview, on every screen that shares it', () => {
  const design = JSON.parse(readFileSync(new URL('../../../resources/templates/library/halloween-monster.json', import.meta.url)));
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=', 'base64');
  const asset = { id: 'monster', sha256: createHash('sha256').update(bytes).digest('hex'), mime: 'image/png', bytes: bytes.length, width: 1, height: 1, access: 'free' };
  const slots = ['tree/steps/0/content/tokens/bg-image', 'tree/steps/1/content/tokens/bg-image'];
  for (const step of design.tree.steps) step.content.tokens['bg-image'] = 'none';
  const pack = { name: 'Halloween', description: '', version: 'r1', assets: [asset], image_bindings: slots.map(slot => ({ template_id: design.id, slot, asset_id: 'monster' })), templates: [design] };
  const markup = publicPreview(pack, renderer, [{ id: 'monster', bytes }], { designId: design.id });
  const dom = new JSDOM(markup);
  const painted = [...dom.window.document.querySelectorAll('template')].map(template => [...template.content.querySelectorAll('[style]')]
    .some(node => node.getAttribute('style').includes(`url("data:image/png;base64,${bytes.toString('base64')}")`)));
  assert.deepEqual(painted, [true, true]);
  dom.window.close();
  const filled = structuredClone(pack); filled.templates[0].tree.steps[0].content.tokens['bg-image'] = 'url("data:image/png;base64,AAAA")';
  assert.throws(() => publicPreview(filled, renderer, [{ id: 'monster', bytes }]), /empty picture slot/);
});

test('winter previews embed declared fonts and preserve fullscreen geometry with an inert dismiss control', () => {
  const design = JSON.parse(readFileSync(new URL('../../../pro/modules/display-types/templates/winter-gift-atelier.json', import.meta.url)));
  const markup = publicPreview({ templates: [design] }, renderer, [], { designId: design.id, designOnly: true });
  const dom = new JSDOM(markup);
  const fonts = dom.window.document.querySelector('[data-preview-fonts]');
  assert.match(fonts.textContent, /font-family:"Instrument Serif"/);
  assert.doesNotMatch(fonts.textContent, /https?:/);
  const root = dom.window.document.querySelector('template').content.querySelector('.wc-root');
  assert.equal(root.style.minBlockSize, '900px');
  assert.equal(root.style.padding, 'var(--wc-pad)');
  assert.equal(root.querySelector('.wc-close').disabled, true);
  dom.window.close();
});
