import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCollections } from './collections.mjs';
import { latestReview, loadReviews, reviewQueue, writeReviews } from './reviews.mjs';
import { legacyCampaignRevision } from './revision.mjs';

/**
 * Carry approvals across the identity change of ADR 0156, once.
 *
 * A decision made under the old identity (renderer bytes) is carried to the new
 * one (rendered output) **only where the campaign and the renderer are exactly
 * what was decided on** — the old identity recomputed today still equals the
 * recorded one. Then nothing a reviewer saw has changed; only the name the
 * approval is filed under has. It is written as a new chained record that says
 * so, never as a review. A stale decision stays stale. Collections whose
 * revision moved only because their setups were re-keyed are carried the same
 * way. Run `npm run templates:pilot` first; idempotent.
 */
const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const digest = value => createHash('sha256').update(value).digest('hex');
const at = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const entries = read('tools/design-library/out/pilot.json');
const rendererRevision = digest(readFileSync(resolve(root, 'tools/design-library/out/renderer.iife.js'), 'utf8'));
const store = loadReviews(root);
const next = structuredClone(store);
const carry = (latest, revision, what) => {
  const body = { id: latest.id, revision, base_id: latest.record_id, decision: latest.decision,
    reviewer: 'Approval identity migration (ADR 0156)',
    note: `Same ${what} as the decision this follows; approval identity moved from renderer bytes to rendered output. Not a new review.`,
    at, checks: latest.checks };
  next.records.push({ ...body, record_id: digest(JSON.stringify(body)) });
};
let campaigns = 0;
for (const entry of entries) {
  const latest = latestReview(next, entry.id);
  if (latest && latest.revision !== entry.revision && latest.revision === legacyCampaignRevision(entry, rendererRevision)) { carry(latest, entry.revision, 'campaign content and renderer'); campaigns++; }
}
// A collection's revision folds in its setups' revisions and approval records.
const source = read('tools/design-library/collections/source.json');
const legacyEntries = entries.map(entry => ({ ...entry, revision: legacyCampaignRevision(entry, rendererRevision) }));
const before = buildCollections(root, source, legacyEntries, reviewQueue(store, legacyEntries, root), store).compiled;
const after = buildCollections(root, source, entries, reviewQueue(next, entries, root), next).compiled;
let collections = 0;
for (const collection of after) {
  const id = `collection-${collection.id}`, latest = latestReview(next, id);
  const old = before.find(item => item.id === collection.id)?.revision;
  if (latest && latest.revision !== collection.revision && latest.revision === old) { carry(latest, collection.revision, 'collection and setup decisions'); collections++; }
}
const written = writeReviews(root, store, next);
console.log(JSON.stringify({ campaigns, collections, written }, null, 2));
