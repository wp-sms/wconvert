import { createHash } from 'node:crypto';

/** Approval follows this campaign and renderer, never its neighbours in the library. */
export function campaignRevision(entry, rendererRevision) {
  const campaign = { ...entry };
  delete campaign.nearest;
  delete campaign.fingerprint;
  delete campaign.revision;
  return createHash('sha256').update('campaign-content-v2\n').update(rendererRevision).update(JSON.stringify(campaign)).digest('hex');
}
