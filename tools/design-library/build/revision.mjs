import { createHash } from 'node:crypto';

/** What a setup ships: everything else in a studio entry is the planning brief. */
const SHIPPED = ['id', 'tier', 'design_tier', 'name', 'goal', 'display_type', 'template_id', 'notes', 'config', 'tree', 'tokens'];

/**
 * Approval follows what a visitor and an administrator get from this setup —
 * its rendered screens and the configuration that ships — and nothing else:
 * not its neighbours in the library, not the renderer's bytes, and not the
 * brief it was planned from (ADR 0156). Editing a brief or moving a setup to
 * another batch leaves its approval current.
 *
 * `renderedIdentity` is {@link renderedIdentities}' digest of this campaign's
 * rendered screens and stylesheet. A renderer change that draws the same output
 * leaves the approval current; one that draws something different stales only
 * the campaigns it touched.
 */
export function campaignRevision(entry, renderedIdentity) {
  const shipped = Object.fromEntries(SHIPPED.map(key => [key, entry[key] ?? null]));
  return createHash('sha256').update('campaign-content-v4\n').update(renderedIdentity).update(JSON.stringify(shipped)).digest('hex');
}
