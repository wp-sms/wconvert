import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountDesignPreview } from '../../template-server/examples/design-only-consumer.mjs';

const base = 'https://templates.example/v3/';
const design = {
  id: 'quiz', name: 'Quiz', design_only: 'a'.repeat(64), preview: 'b'.repeat(64),
  screens: [{ id: 'first', label: 'Start' }, { id: 'results/other/choice', label: 'Other' }],
};
test('website example keeps exact screen while switching device and restores it after outage', () => {
  const dom = new JSDOM('<main></main>', { url: 'https://wconvert.io/' });
  const doc = dom.window.document;
  const controller = mountDesignPreview(doc.querySelector('main'), design,
    { base, serviceAvailable: true, reviewedSnapshotUrl: '/reviewed/quiz.html' });
  const select = doc.querySelector('select');
  select.value = 'results/other/choice'; select.dispatchEvent(new dom.window.Event('change'));
  doc.querySelectorAll('button')[1].click();
  assert.equal(new URL(doc.querySelector('iframe').src).hash, '#screen=results%2Fother%2Fchoice&device=mobile');
  assert.equal(new URL(doc.querySelector('iframe').src).pathname, '/v3/previews/' + 'a'.repeat(64) + '.html');
  controller.setServiceAvailable(false);
  assert.equal(doc.querySelector('iframe').src, 'https://wconvert.io/reviewed/quiz.html');
  controller.setServiceAvailable(true);
  assert.equal(new URL(doc.querySelector('iframe').src).hash, '#screen=results%2Fother%2Fchoice&device=mobile');
  assert.equal(doc.querySelector('iframe').getAttribute('sandbox'), 'allow-scripts');
  dom.window.close();
});
test('no design-only preview, no service or no catalogue address shows the prepared message, never a guess', () => {
  for (const [item, options] of [
    [{ ...design, design_only: undefined }, { base, serviceAvailable: true }],
    [design, { base, serviceAvailable: false }],
    [design, { serviceAvailable: true }],
  ]) {
    const dom = new JSDOM('<main></main>');
    const doc = dom.window.document;
    mountDesignPreview(doc.querySelector('main'), item, options);
    assert.equal(doc.querySelector('iframe').hidden, true);
    assert.equal(doc.querySelector('iframe').hasAttribute('src'), false);
    assert.match(doc.querySelector('[role=status]').textContent, /being prepared/);
    dom.window.close();
  }
});
