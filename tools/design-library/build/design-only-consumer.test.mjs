import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountDesignPreview } from '../../template-server/examples/design-only-consumer.mjs';

const design = {
  name: 'Quiz', preview_status: 'available', embed_url: 'https://templates.example/old-green-viewer',
  design_only_embed: { version: 1 },
  screens: [{ id: 'first', label: 'Start', design_only_embed_url: 'https://templates.example/clean#screen=first' },
    { id: 'results/other/choice', label: 'Other', design_only_embed_url: 'https://templates.example/clean#screen=results%2Fother%2Fchoice' }],
};
test('website example keeps exact screen while switching device and restores it after outage', () => {
  const dom = new JSDOM('<main></main>', { url: 'https://wconvert.io/' });
  const doc = dom.window.document;
  const controller = mountDesignPreview(doc.querySelector('main'), design,
    { serviceAvailable: true, reviewedSnapshotUrl: '/reviewed/quiz.html' });
  const select = doc.querySelector('select');
  select.value = 'results/other/choice'; select.dispatchEvent(new dom.window.Event('change'));
  doc.querySelectorAll('button')[1].click();
  assert.equal(new URL(doc.querySelector('iframe').src).hash, '#screen=results%2Fother%2Fchoice&device=mobile');
  controller.setServiceAvailable(false);
  assert.equal(doc.querySelector('iframe').src, 'https://wconvert.io/reviewed/quiz.html');
  controller.setServiceAvailable(true);
  assert.equal(new URL(doc.querySelector('iframe').src).hash, '#screen=results%2Fother%2Fchoice&device=mobile');
  assert.equal(doc.querySelector('iframe').getAttribute('sandbox'), 'allow-scripts');
  dom.window.close();
});
test('missing capability, unavailable service and unreviewed snapshots never use the old viewer', () => {
  for (const [item, options] of [
    [{ ...design, design_only_embed: undefined }, { serviceAvailable: true }],
    [design, { serviceAvailable: false }],
    [{ ...design, preview_status: 'unavailable' }, { serviceAvailable: true }],
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
