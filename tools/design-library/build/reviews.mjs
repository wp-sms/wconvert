import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export const reviewStages = ['visual', 'journey', 'wordpress'];
const digest = value => createHash('sha256').update(value).digest('hex');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

/** Evidence is a repository document, never an external URL or arbitrary local file. */
export function evidenceFile(root, path) {
  if (!nonempty(path) || !/^docs\/reviews\/[a-zA-Z0-9_./-]+$/.test(path) || path.split('/').includes('..')) throw new Error(`Invalid evidence path: ${path}`);
  const base = realpathSync(resolve(root, 'docs/reviews')) + sep;
  const file = realpathSync(resolve(root, path));
  if (!file.startsWith(base)) throw new Error(`Evidence escapes review directory: ${path}`);
  return { path, sha256: digest(readFileSync(file)) };
}

export function emptyReviews() { return { schema: 1, records: [] }; }
export function latestReview(store, id) { return store.records.findLast(record => record.id === id) ?? null; }

export function validateStore(store) {
  if (store?.schema !== 1 || !Array.isArray(store.records)) throw new Error('Invalid shared review store');
  const seen = new Set();
  for (const record of store.records) {
    const { record_id, ...body } = record;
    if (seen.has(record_id) || record_id !== digest(JSON.stringify(body))) throw new Error('Invalid or repeated shared review record');
    seen.add(record_id);
  }
}

/** A whole export is validated before the caller can write anything. No implicit last-writer wins. */
export function mergeReviews(store, exported, entries, root) {
  validateStore(store);
  if (exported?.schema !== 2 || !Array.isArray(exported.reviews) || !exported.reviews.length) throw new Error('Export must contain schema 2 reviews');
  const next = structuredClone(store), seen = new Set();
  for (const review of exported.reviews) {
    const entry = entries.find(item => item.id === review.id);
    if (!entry || seen.has(review.id)) throw new Error(`Unknown or repeated campaign: ${review.id}`);
    seen.add(review.id);
    if (entry.revision !== review.revision) throw new Error(`Stale campaign: ${review.id}. Rebuild and review the current version.`);
    if (!['review', 'revise', 'approved'].includes(review.decision)
      || !nonempty(review.reviewer) || !nonempty(review.note)
      || typeof review.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(review.at) || !Number.isFinite(Date.parse(review.at))) throw new Error(`Incomplete review: ${review.id}`);
    const checks = {};
    for (const stage of reviewStages) {
      const check = review.checks?.[stage];
      if (!check || !['pending', 'passed', 'failed'].includes(check.status)) throw new Error(`Missing ${stage} check: ${review.id}`);
      const paths = check.evidence ?? [];
      if (!Array.isArray(paths) || paths.some(path => typeof path !== 'string') || new Set(paths).size !== paths.length
        || (check.status !== 'pending' && !paths.length)) throw new Error(`Missing or invalid ${stage} evidence: ${review.id}`);
      checks[stage] = { status: check.status, evidence: paths.map(path => evidenceFile(root, path)) };
    }
    if (review.decision === 'approved' && reviewStages.some(stage => checks[stage].status !== 'passed')) throw new Error(`All review stages must pass before editorial approval: ${review.id}`);
    const body = { id: review.id, revision: review.revision, base_id: review.base_id ?? null,
      decision: review.decision, reviewer: review.reviewer.trim(), note: review.note.trim(), at: review.at, checks };
    const record = { ...body, record_id: digest(JSON.stringify(body)) };
    if (next.records.some(item => item.record_id === record.record_id)) continue;
    const previous = latestReview(next, review.id);
    if ((previous?.record_id ?? null) !== body.base_id) throw new Error(`Review conflict: ${review.id}. Rebuild, read the shared review, then export a new decision.`);
    next.records.push(record);
  }
  return next;
}

export function reviewQueue(store, entries, root) {
  validateStore(store);
  return entries.map(entry => {
    const record = latestReview(store, entry.id);
    let state = 'review', reason = 'No shared review yet.';
    if (record) {
      state = record.decision; reason = 'Shared review for the current version.';
      if (record.revision !== entry.revision) { state = 'stale'; reason = 'Campaign or renderer changed. Review every screen again.'; }
      else {
        try {
          if (reviewStages.some(stage => record.checks[stage].evidence.some(e => evidenceFile(root, e.path).sha256 !== e.sha256))) {
            state = 'stale'; reason = 'Supporting evidence changed. Confirm the review again.';
          }
        } catch { state = 'stale'; reason = 'Supporting evidence is missing or invalid.'; }
      }
    }
    return { id: entry.id, state, reason, record };
  });
}
