import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectionLabels } from './collections.mjs';
import { FIX, releasable } from './releasable.mjs';
import { emptyReviews, mergeReviews } from './reviews.mjs';
import { carriedRecords, carryCandidates } from './visual-diff.mjs';

const checks = { visual: { status: 'passed', evidence: ['docs/reviews/proof.md'] }, journey: { status: 'passed', evidence: ['docs/reviews/proof.md'] }, wordpress: { status: 'passed', evidence: ['docs/reviews/proof.md'] } };
const review = (id, revision, decision = 'approved') => ({ id, revision, base_id: null, decision, reviewer: 'Reviewer', note: 'Reviewed.', at: '2026-10-21T12:00:00Z', checks });

/** Four setups reviewed under the base renderer: two approved, one sent back, one never reviewed. */
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'wconvert-releasable-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs/reviews'), { recursive: true });
  writeFileSync(join(root, 'docs/reviews/proof.md'), 'Observed.');
  mkdirSync(join(root, 'tools/design-library/collections'), { recursive: true });
  writeFileSync(join(root, 'tools/design-library/collections/source.json'), JSON.stringify({ schema: 1, collections: [] }));
  mkdirSync(join(root, 'resources/collections'), { recursive: true });
  writeFileSync(join(root, 'resources/collections/labels.php'), collectionLabels([]));
  const before = ['a', 'b', 'c', 'd'].map(id => ({ id, revision: `${id}@base` }));
  const store = mergeReviews(emptyReviews(), { schema: 2, reviews: [review('a', 'a@base'), review('b', 'b@base'), review('c', 'c@base', 'revise')] }, before, root);
  // A renderer edit moves every revision, whether or not a pixel changed.
  const entries = before.map(entry => ({ ...entry, revision: `${entry.id}@head` }));
  const previous = new Map(before.map(entry => [entry.id, ['v1', entry.revision]]));
  return { root, store, entries, previous };
}

test('A1: a renderer edit that changes no pixels fails with the command, and the command makes it green', t => {
  const { root, store, entries, previous } = fixture(t);
  assert.deepEqual(releasable(root, entries, store).map(line => line.split(':')[0]), ['a', 'b']);
  assert.equal(FIX, 'npm run templates:visual-diff -- --apply');
  const candidates = carryCandidates(entries, store, previous).map(entry => entry.id);
  assert.deepEqual(candidates, ['a', 'b', 'c'], 'A sent-back decision is carried as what it was, never promoted');
  const carried = { ...store, records: [...store.records, ...carriedRecords({ carried: candidates, entries, store, base: 'main', at: '2026-10-21T13:00:00Z' })] };
  assert.deepEqual(releasable(root, entries, carried), []);
});

test('A2: a setup whose pixels changed is not carried and keeps the check red', t => {
  const { root, store, entries } = fixture(t);
  const carried = { ...store, records: [...store.records, ...carriedRecords({ carried: ['a'], entries, store, base: 'main', at: '2026-10-21T13:00:00Z' })] };
  assert.deepEqual(releasable(root, entries, carried).map(line => line.split(':')[0]), ['b']);
});

test('A3: a content edit is never a carry candidate, and leaves the others alone', t => {
  const { store, entries, previous } = fixture(t);
  previous.set('b', ['v1', 'b@base-with-new-words']);
  assert.deepEqual(carryCandidates(entries, store, previous).map(entry => entry.id), ['a', 'c']);
});

test('A4: a setup never approved does not fail the check', t => {
  const { root, store, entries } = fixture(t);
  const current = entries.map(entry => ['a', 'b'].includes(entry.id) ? { ...entry, revision: `${entry.id}@base` } : entry);
  assert.deepEqual(releasable(root, current, store), [], 'c was sent back and d never reviewed; neither was on the website');
});

test('A6: missing approval evidence fails the check and names the setup', t => {
  const { root, store, entries } = fixture(t);
  const current = entries.map(entry => ({ ...entry, revision: `${entry.id}@base` }));
  rmSync(join(root, 'docs/reviews/proof.md'));
  assert.deepEqual(releasable(root, current, store), ['a: Supporting evidence is missing.', 'b: Supporting evidence is missing.']);
});

test('a runtime Collection out of step with its review fails the check', t => {
  const { root, store, entries } = fixture(t);
  const current = entries.map(entry => ({ ...entry, revision: `${entry.id}@base` }));
  writeFileSync(join(root, 'resources/collections/retired.json'), '{}');
  assert.match(releasable(root, current, store).join('\n'), /^Collections: Retire obsolete runtime collections/);
});
