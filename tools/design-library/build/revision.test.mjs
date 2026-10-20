import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignRevision } from './revision.mjs';
import { analyseDesigns } from './inventory.mjs';

const template = {
  id: 'original', name: 'Original', display_type: 'popup', tier: 'free', tokens: { bg: '#fff' },
  tree: { steps: [{ id: 'start', kind: 'input', content: {
    type: 'stack', children: [{ type: 'heading', id: 'n1', text: 'Original', role: 'headline' }],
  } }] },
};
const campaign = {
  id: 'sample', goal: 'grow_email_list', requirements: ['Connect a destination'],
  tree: template.tree, tokens: template.tokens, config: { display_rules: { seconds: 10 } },
};

test('adding, renaming or removing another design updates comparison data without invalidating this approval', () => {
  const alone = analyseDesigns([template])[0];
  const neighbour = { ...template, id: 'neighbour', name: 'A new neighbour' };
  const afterAdding = analyseDesigns([template, neighbour])[0];
  assert.notDeepEqual(alone.nearest, afterAdding.nearest);
  const revision = campaignRevision({ ...campaign, ...alone, tree: campaign.tree }, 'renderer');
  for (const library of [[template, neighbour], [template, { ...neighbour, name: 'Renamed neighbour' }], [template]]) {
    const analysis = analyseDesigns(library)[0];
    assert.equal(campaignRevision({ ...campaign, ...analysis, tree: campaign.tree }, 'renderer'), revision);
  }
  assert.equal(campaignRevision({ ...campaign, fingerprint: 'new-analysis', revision: 'previous' }, 'renderer'), campaignRevision(campaign, 'renderer'));
});

test('editing the planning brief or moving the setup to another batch keeps the approval', () => {
  const revision = campaignRevision(campaign, 'renderer');
  for (const change of [{ requirements: ['Configure resource delivery'] }, { batch: 'later' }, { visitor_need: 'Reworded' }, { measure: 'Other' }, { difference: 'Other' }]) {
    assert.equal(campaignRevision({ ...campaign, ...change }, 'renderer'), revision);
  }
});

test('actual copy, layout, purpose, timing and rendered-output changes still invalidate approval', () => {
  const revision = campaignRevision(campaign, 'renderer');
  for (const change of [
    { goal: 'collect_enquiries' },
    { tokens: { bg: '#000' } }, { config: { display_rules: { seconds: 20 } } },
    { tree: { ...template.tree, steps: [] } }, { name: 'A different campaign' },
  ]) assert.notEqual(campaignRevision({ ...campaign, ...change }, 'renderer'), revision);
  const changedCopy = structuredClone(campaign);
  changedCopy.tree.steps[0].content.children[0].text = 'New promise';
  assert.notEqual(campaignRevision(changedCopy, 'renderer'), revision);
  assert.notEqual(campaignRevision(campaign, 'renderer-v2'), revision);
});

test('a renderer change that draws the same output keeps the approval; one that draws something else does not', async () => {
  const { renderedIdentities } = await import('./rendered-identity.mjs');
  const { readFileSync } = await import('node:fs');
  const renderer = readFileSync(new URL('../out/renderer.iife.js', import.meta.url), 'utf8');
  const entry = { ...campaign, tree: { v: 2, steps: template.tree.steps, submissions: [] } };
  const same = renderedIdentities(renderer + '\n// a comment the renderer gained\n', [entry]).get('sample');
  assert.equal(same, renderedIdentities(renderer, [entry]).get('sample'));
  const restyled = renderer.replace('WConvertRenderer', 'WConvertRenderer').replace(/(SHADOW_CSS\s*=\s*)/, '$1"/* new */" + ');
  assert.notEqual(renderedIdentities(restyled, [entry]).get('sample'), same, 'A stylesheet change is a rendered change');
  assert.equal(campaignRevision(entry, same), campaignRevision(entry, renderedIdentities(renderer, [entry]).get('sample')));
});
