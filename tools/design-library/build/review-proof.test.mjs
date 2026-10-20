import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evidenceFile } from './reviews.mjs';
import { checkProof } from './review-proof.mjs';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'template-proof-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs/reviews'), { recursive: true });
  writeFileSync(join(root, 'docs/reviews/screen.png'), 'test screenshot bytes');
  const file = evidenceFile(root, 'docs/reviews/screen.png');
  const entries = [{ id: 'one', batch: 'batch', revision: 'current', tree: { steps: [{ id: 'input' }, { id: 'result', results: [{ id: 'a' }, { id: 'b' }] }] } }];
  const captures = entries[0].tree.steps.flatMap(screen => (screen.results ?? [null]).flatMap(result =>
    [['studio', [320, 390, 768, 1440]], ['wordpress', [320, 1280]]].flatMap(([surface, widths]) =>
      widths.map(width => ({ ...file, screen: screen.id, result: result?.id ?? null, surface, width })))));
  return { root, entries, proof: { schema: 1, batch: 'batch', setups: [{ id: 'one', revision: 'current', judgement: 'Inspected', captures }] } };
}
test('every result and viewport must have current immutable evidence', t => {
  const { proof, entries, root } = fixture(t);
  assert.equal(checkProof(proof, entries, root).checked, 18);
  proof.setups[0].captures.pop();
  assert.throws(() => checkProof(proof, entries, root), /Missing wordpress 1280px result\/b/);
});
test('later campaign edits and changed screenshots invalidate proof', t => {
  const { proof, entries, root } = fixture(t);
  entries[0].revision = 'changed';
  assert.throws(() => checkProof(proof, entries, root), /Stale proof/);
  entries[0].revision = 'current';
  writeFileSync(join(root, 'docs/reviews/screen.png'), 'replaced');
  assert.throws(() => checkProof(proof, entries, root), /changed screenshot/);
});
test('missing setups and empty judgements cannot pass', t => {
  const { proof, entries, root } = fixture(t);
  assert.throws(() => checkProof({ ...proof, setups: [] }, entries, root), /entire batch/);
  proof.setups[0].judgement = '';
  assert.throws(() => checkProof(proof, entries, root), /Missing visual judgement/);
});
