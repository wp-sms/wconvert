import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyIssues } from './catalogue-copy.mjs';

test('objective defects in visitor words are found; sound words and non-copy keys are not', () => {
  const rules = value => copyIssues({ content: { type: 'heading', id: 'n1', text: value } }).map(issue => issue.rule);
  assert.deepEqual(rules('Join the list'), []);
  assert.deepEqual(rules('Lorem ipsum dolor'), ['placeholder']);
  assert.deepEqual(rules('Get the the guide'), ['doubled word']);
  assert.deepEqual(rules('Save  now'), ['spacing']);
  assert.deepEqual(rules('Save now (today'), ['unbalanced ()']);
  assert.deepEqual(rules('Your [company] guide'), ['placeholder']);
  assert.deepEqual(copyIssues({ content: { type: 'button', id: 'n2', action: 'submit  ' } }), [], 'An action is not copy');
  assert.deepEqual(copyIssues({ copy: { screens: { start: { headline: 'TODO headline' } } } }).map(issue => issue.rule), ['placeholder']);
});
