import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyReviews, mergeReviews, reviewQueue, evidenceFile } from './reviews.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'wconvert-reviews-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs/reviews'), { recursive: true });
  writeFileSync(join(root, 'docs/reviews/proof.md'), 'Observed screens, routes and native capture.');
  const entries = [{ id: 'welcome', revision: 'current' }];
  const review = { id: 'welcome', revision: 'current', base_id: null, decision: 'approved', reviewer: 'Reviewer', note: 'All steps reviewed.', at: '2026-09-28T12:00:00.000Z', checks: Object.fromEntries(['visual','journey','wordpress'].map(stage => [stage,{status:'passed',evidence:['docs/reviews/proof.md']}])) };
  return { root, entries, review, exported: { schema: 2, reviews: [review] } };
}

test('shared approval is revision-bound and invalidated by changed or missing evidence', t => {
  const {root, entries, exported} = fixture(t);
  const store = mergeReviews(emptyReviews(), exported, entries, root);
  assert.equal(reviewQueue(store, entries, root)[0].state, 'approved');
  assert.equal(reviewQueue(store, [{...entries[0], revision:'changed'}], root)[0].state, 'stale');
  writeFileSync(join(root, 'docs/reviews/proof.md'), 'Changed evidence');
  assert.equal(reviewQueue(store, entries, root)[0].state, 'stale');
  rmSync(join(root, 'docs/reviews/proof.md'));
  assert.equal(reviewQueue(store, entries, root)[0].state, 'stale');
});
test('imports are idempotent, keep history and reject concurrent decisions', t => {
  const {root, entries, exported, review} = fixture(t);
  const store = mergeReviews(emptyReviews(), exported, entries, root);
  assert.deepEqual(mergeReviews(store, exported, entries, root), store);
  assert.throws(() => mergeReviews(store, {schema:2,reviews:[{...review,note:'Another reviewer'}]}, entries, root), /conflict/);
  const next = mergeReviews(store, {schema:2,reviews:[{...review,base_id:store.records[0].record_id,decision:'revise',note:'Revise the acknowledgement.'}]}, entries, root);
  assert.equal(next.records.length, 2);
  assert.equal(reviewQueue(next, entries, root)[0].state, 'revise');
  assert.equal(store.records.length, 1);
});
test('rejects stale, unknown, duplicate, incomplete and unsupported exports atomically', t => {
  const {root, entries, exported, review} = fixture(t);
  const store = emptyReviews();
  for(const candidate of [ {...exported,schema:1}, {schema:2,reviews:[{...review,revision:'old'}]}, {schema:2,reviews:[review,{...review,id:'missing'}]}, {schema:2,reviews:[review,review]}, {schema:2,reviews:[{...review,reviewer:''}]}, {schema:2,reviews:[{...review,checks:{...review.checks,visual:{status:'pending'}}}]} ]) assert.throws(() => mergeReviews(store,candidate,entries,root));
  assert.deepEqual(store, emptyReviews());
});
test('refuses evidence outside the review directory, including symlinks', t => {
  const {root} = fixture(t);
  writeFileSync(join(root,'private.txt'),'private');
  symlinkSync(join(root,'private.txt'),join(root,'docs/reviews/link.md'));
  for(const path of ['../../private.txt','docs/reviews/../../private.txt','https://example.com','docs/reviews/link.md']) assert.throws(() => evidenceFile(root,path));
});
test('unreviewed entries stay pending and record tampering fails closed', t => {
  const {root,entries,exported} = fixture(t);
  assert.equal(reviewQueue(emptyReviews(),entries,root)[0].state,'review');
  const store=mergeReviews(emptyReviews(),exported,entries,root);
  store.records[0].note='Silently edited';
  assert.throws(()=>reviewQueue(store,entries,root),/Invalid/);
});

test('the record store is one file per decision, and a fork in a chain is refused', async () => {
  const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { createHash } = await import('node:crypto');
  const { loadReviews, writeReviews, emptyReviews, RECORDS } = await import('./reviews.mjs');
  const root = mkdtempSync(join(tmpdir(), 'wconvert-records-'));
  try {
    const record = (id, base_id, note) => { const body = { id, revision: 'r', base_id, decision: 'review', reviewer: 'a', note, at: '2026-10-20T00:00:00Z', checks: {} }; return { ...body, record_id: createHash('sha256').update(JSON.stringify(body)).digest('hex') }; };
    const first = record('card', null, 'one'), second = record('card', first.record_id, 'two'), other = record('bar', null, 'x');
    assert.equal(writeReviews(root, emptyReviews(), { schema: 1, records: [second, other, first] }), 3);
    assert.deepEqual(loadReviews(root).records.map(r => r.note), ['x', 'one', 'two'], 'Chains are read in order whatever the file order');
    const fork = record('card', first.record_id, 'parallel');
    writeFileSync(join(root, RECORDS, fork.record_id + '.json'), JSON.stringify(fork));
    assert.throws(() => loadReviews(root), /two decisions over the same earlier review/);
    rmSync(join(root, RECORDS, fork.record_id + '.json'));
    const orphan = record('card', 'f'.repeat(64), 'lost');
    writeFileSync(join(root, RECORDS, orphan.record_id + '.json'), JSON.stringify(orphan));
    assert.throws(() => loadReviews(root), /out of chain/);
    rmSync(join(root, RECORDS, orphan.record_id + '.json'));
    writeFileSync(join(root, RECORDS, first.record_id + '.json'), JSON.stringify({ ...first, note: 'edited' }));
    assert.throws(() => loadReviews(root), /does not match its contents/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
