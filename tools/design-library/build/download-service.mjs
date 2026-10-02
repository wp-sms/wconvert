import { createHash } from 'node:crypto';

/** Host-neutral download boundary. The host must supply the real licence adapter.
 * This is not an HTTP route and never accepts a client-supplied storage path/tier.
 */
export class DownloadError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
export async function downloadObject({ digest, credential, site }, { resources, authorize, read }) {
  const resource = resources.get(digest);
  if (!/^[a-f0-9]{64}$/.test(digest ?? '') || !resource || resource.withdrawn) throw new DownloadError('not_available', 404);
  if (resource.access !== 'free') {
    if (resource.access !== 'premium') throw new DownloadError('not_available', 404);
    if (!credential || !site) throw new DownloadError('licence_required', 403);
    let decision;
    try { decision = await authorize({ credential, site, digest, product: resource.product }); }
    catch { throw new DownloadError('verification_unavailable', 503); }
    if (decision?.status === 'unavailable') throw new DownloadError('verification_unavailable', 503);
    if (decision?.status !== 'allowed') {
      const known = ['expired', 'revoked', 'wrong_plan', 'wrong_site'];
      throw new DownloadError(known.includes(decision?.status) ? decision.status : 'verification_unavailable', known.includes(decision?.status) ? 403 : 503);
    }
    // The decision is bound to this request; a stale grant for another file/site
    // is not permission. Signature verification belongs to the real adapter.
    if (decision.digest !== digest || decision.site !== site || decision.product !== resource.product) throw new DownloadError('verification_unavailable', 503);
  }
  let bytes;
  try {
    bytes = await read(resource);
    if (!Buffer.isBuffer(bytes) || bytes.length > 5242880 || createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error('Invalid bytes');
  } catch { throw new DownloadError('storage_unavailable', 503); }
  return { bytes, headers: { 'Cache-Control': resource.access === 'free' ? 'public, max-age=31536000, immutable' : 'private, no-store', 'Content-Type': resource.mime, 'X-Content-Type-Options': 'nosniff' } };
}
