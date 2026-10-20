import { createHash } from 'node:crypto';

/**
 * Approval follows this campaign and what it looks like — never its neighbours
 * in the library, and never the renderer's bytes (ADR 0156).
 *
 * `renderedIdentity` is {@link renderedIdentities}' digest of this campaign's
 * rendered screens and stylesheet. A renderer change that draws the same output
 * leaves the approval current; one that draws something different stales only
 * the campaigns it touched.
 */
export function campaignRevision(entry, renderedIdentity) {
  const campaign = { ...entry };
  delete campaign.nearest;
  delete campaign.fingerprint;
  delete campaign.revision;
  return createHash('sha256').update('campaign-content-v3\n').update(renderedIdentity).update(JSON.stringify(campaign)).digest('hex');
}

/** The identity before ADR 0156, kept only so `rekey-approvals.mjs` can recognise approvals made under it. */
export function legacyCampaignRevision(entry, rendererRevision) {
  const campaign = { ...entry };
  delete campaign.nearest;
  delete campaign.fingerprint;
  delete campaign.revision;
  return createHash('sha256').update('campaign-content-v2\n').update(rendererRevision).update(JSON.stringify(campaign)).digest('hex');
}
