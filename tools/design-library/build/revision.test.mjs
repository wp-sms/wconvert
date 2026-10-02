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

test('actual copy, layout, purpose, requirements, timing and renderer changes still invalidate approval', () => {
  const revision = campaignRevision(campaign, 'renderer');
  for (const change of [
    { goal: 'collect_enquiries' }, { requirements: ['Configure resource delivery'] },
    { tokens: { bg: '#000' } }, { config: { display_rules: { seconds: 20 } } },
    { tree: { ...template.tree, steps: [] } }, { name: 'A different campaign' },
  ]) assert.notEqual(campaignRevision({ ...campaign, ...change }, 'renderer'), revision);
  const changedCopy = structuredClone(campaign);
  changedCopy.tree.steps[0].content.children[0].text = 'New promise';
  assert.notEqual(campaignRevision(changedCopy, 'renderer'), revision);
  assert.notEqual(campaignRevision(campaign, 'renderer-v2'), revision);
});
