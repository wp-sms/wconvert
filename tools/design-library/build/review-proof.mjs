import { evidenceFile } from './reviews.mjs';

/** Completeness check, never a visual judgement or an editorial approval. */
export function checkProof(proof, entries, root) {
  if (proof?.schema !== 1 || !proof.batch || !Array.isArray(proof.setups)) throw Error('Invalid proof ledger');
  const expected = entries.filter(e => e.batch === proof.batch);
  if (!expected.length) throw Error('Unknown or empty review batch');
  if (proof.setups.length !== expected.length || new Set(proof.setups.map(e => e.id)).size !== expected.length
    || proof.setups.some(e => !expected.some(x => x.id === e.id))) throw Error('Ledger must cover the entire batch exactly once');
  let checked = 0;
  for (const entry of expected) {
    const record = proof.setups.find(e => e.id === entry.id);
    if (record.revision !== entry.revision) throw Error(`Stale proof: ${entry.id}`);
    if (!record.judgement?.trim() || !Array.isArray(record.captures)) throw Error(`Missing visual judgement: ${entry.id}`);
    for (const capture of record.captures) {
      if (!/\.(png|jpe?g|webp)$/.test(capture.path ?? '') || !capture.sha256
        || evidenceFile(root, capture.path).sha256 !== capture.sha256) throw Error(`Missing or changed screenshot: ${entry.id}`);
    }
    for (const screen of entry.tree.steps) for (const result of screen.results?.length ? screen.results : [null]) {
      for (const [surface, widths] of [['studio', [320, 390, 768, 1440]], ['wordpress', [320, 1280]]]) {
        for (const width of widths) {
          if (!record.captures.some(c => c.surface === surface && c.width === width && c.screen === screen.id && (c.result ?? null) === (result?.id ?? null))) {
            throw Error(`Missing ${surface} ${width}px ${screen.id}/${result?.id ?? 'default'}: ${entry.id}`);
          }
          checked++;
        }
      }
    }
  }
  return { setups: expected.length, checked, notice: 'Coverage and screenshot hashes match. A reviewer must still inspect composition, journeys and native behaviour before approval.' };
}
