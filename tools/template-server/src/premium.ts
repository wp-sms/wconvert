import { limit, clientIp } from './rate-limit';
/** Nexus is the authority. R2 holds only short-lived, verified download contexts. */
const HEX = /^[a-f0-9]{64}$/;
const encoder = new TextEncoder();
export const sha256 = async (bytes: BufferSource) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
const noStore = { 'Cache-Control': 'private, no-store', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
class Refusal extends Error {
  constructor(readonly status: number, readonly code: string, readonly retry = 0) { super(code); }
}
function requireThat(ok: unknown, status = 401, code = 'invalid_grant'): asserts ok { if (!ok) throw new Refusal(status, code); }
export type NexusEnv = Env & { NEXUS_SERVICE_KEY?: string };
type File = { path: string; sha256: string; bytes: number };
type Claims = { iss: string; aud: string; environment: string; store: string; item: string; permission: string; site: string; activation_id: string; resource_digest: string; version: number; iat: number; exp: number; jti: string };
type SigningKey = JsonWebKey & { kid: string; alg: string; use: string };
type Context = { claims: Claims; key: SigningKey; files: File[] };
const now = () => Math.floor(Date.now() / 1000);
function decode(value: string): Uint8Array<ArrayBuffer> {
  requireThat(/^[A-Za-z0-9_-]+$/.test(value));
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
function parts(token: string) {
  requireThat(token.length <= 8192 && token.split('.').length === 3);
  const [head, body, signature] = token.split('.');
  const header = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(decode(head)));
  requireThat(header?.alg === 'EdDSA' && header.typ === 'nexus-entitlement+jwt' && /^[A-Za-z0-9_-]{1,64}$/.test(header.kid)
    && header.crit === undefined && header.b64 === undefined && header.jku === undefined && header.jwk === undefined);
  return { head, body, signature, header };
}
async function verify(token: string, key: SigningKey, env: NexusEnv): Promise<Claims> {
  const p = parts(token);
  requireThat(key.kid === p.header.kid && key.kty === 'OKP' && key.crv === 'Ed25519' && key.alg === 'EdDSA' && key.use === 'sig' && key.d === undefined);
  const imported = await crypto.subtle.importKey('jwk', key, { name: 'Ed25519' }, false, ['verify']);
  const signature = decode(p.signature);
  requireThat(signature.length === 64 && await crypto.subtle.verify('Ed25519', imported, signature, encoder.encode(`${p.head}.${p.body}`)));
  const c = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(decode(p.body)));
  for (const [name, expected] of Object.entries({ iss: env.NEXUS_ISSUER, aud: env.NEXUS_AUDIENCE, environment: env.NEXUS_ENVIRONMENT, store: 'wconvert', item: 'wconvert-pro', permission: 'templates:download' })) requireThat(c?.[name] === expected);
  requireThat(c.version === 1 && typeof c.site === 'string' && c.site.length > 0 && c.site.length <= 253
    && typeof c.activation_id === 'string' && c.activation_id.length > 0 && c.activation_id.length <= 128
    && typeof c.resource_digest === 'string' && HEX.test(c.resource_digest)
    && typeof c.jti === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(c.jti)
    && Number.isInteger(c.iat) && Number.isInteger(c.exp) && c.iat <= now() + 5 && c.exp > now() && c.exp > c.iat && c.exp - c.iat <= 300);
  return c;
}
async function bounded(response: Response | Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  requireThat(response.body, response instanceof Request ? 400 : 503, response instanceof Request ? 'invalid_request' : 'verification_unavailable');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.length; requireThat(total <= limit, response instanceof Request ? 413 : 503, response instanceof Request ? 'payload_too_large' : 'verification_unavailable'); chunks.push(value); } }
  finally { await reader.cancel(); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } return bytes;
}
async function jsonResponse(response: Response | Request, limit: number) { return JSON.parse(new TextDecoder().decode(await bounded(response, limit))); }
async function stored(bucket: R2Bucket, path: string, limit: number) {
  const object = await bucket.get(path); requireThat(object, 404, 'not_found');
  if (!object.size || object.size > limit) { await object.body.cancel(); throw new Refusal(503, 'storage_unavailable'); }
  return new Uint8Array(await object.arrayBuffer());
}
/** Keys are fetched only from configured Nexus; unknown kids refresh at most once per 30s per edge cache. */
async function signingKey(kid: string, env: NexusEnv): Promise<SigningKey> {
  const request = new Request(env.NEXUS_KEYS_URL);
  const cache = caches.default;
  const cached = await cache.match(request);
  let document = cached ? await cached.json<{ at: number; keys: SigningKey[] }>() : null;
  if (!document || (now() - document.at >= 30 && !document.keys.some(k => k.kid === kid))) {
    const response = await fetch(request, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    requireThat(response.ok, 503, 'verification_unavailable');
    const body = await jsonResponse(response, 32768);
    requireThat(Array.isArray(body?.keys) && body.keys.length <= 16, 503, 'verification_unavailable');
    document = { at: now(), keys: body.keys };
    await cache.put(request, new Response(JSON.stringify(document), { headers: { 'Cache-Control': 'public, max-age=60' } }));
  }
  const matches = document.keys.filter(k => k.kid === kid);
  requireThat(matches.length === 1, 503, 'verification_unavailable'); return matches[0];
}
function configured(env: NexusEnv) {
  requireThat(env.PRIVATE_TEMPLATES && env.NEXUS_SERVICE_KEY && env.NEXUS_ENVIRONMENT && env.NEXUS_ISSUER && env.NEXUS_AUDIENCE, 503, 'service_not_configured');
  for (const value of [env.NEXUS_GRANT_URL, env.NEXUS_KEYS_URL, env.NEXUS_ISSUER, env.NEXUS_AUDIENCE]) {
    const url = new URL(value); requireThat(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash, 503, 'service_not_configured');
  }
  // A custom API hostname can differ from the stable signed issuer. Both API
  // endpoints must share their explicitly configured origin; verify() still pins iss.
  requireThat(new URL(env.NEXUS_GRANT_URL).origin === new URL(env.NEXUS_KEYS_URL).origin, 503, 'service_not_configured');
}
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
/** One batch: designs and setups by digest, each a premium object, plus the premium images designs bind. */
async function files(env: NexusEnv, designs: string[], setups: string[]): Promise<File[]> {
  const list = new Map<string, File>();
  for (const [kind, digests] of [['designs', designs], ['setups', setups]] as const) {
    for (const digest of digests) {
      const bytes = await stored(env.PRIVATE_TEMPLATES, `v3/${kind}/${digest}.json`, 262144);
      requireThat(await sha256(bytes) === digest, 503, 'storage_unavailable');
      list.set(`/v3/premium/${kind}/${digest}.json`, { path: `/v3/premium/${kind}/${digest}.json`, sha256: digest, bytes: bytes.length });
      if (kind === 'setups') continue;
      let assets: unknown;
      try { assets = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)).assets; } catch { throw new Refusal(503, 'storage_unavailable'); }
      // VerifiedAssets::MAX_ASSETS: the plugin refuses a design with more.
      requireThat(Array.isArray(assets) && assets.length <= 16, 503, 'storage_unavailable');
      for (const asset of assets) {
        const ext = EXTENSIONS[asset?.mime];
        requireThat(ext && typeof asset.sha256 === 'string' && HEX.test(asset.sha256) && ['free', 'premium'].includes(asset.access) && Number.isInteger(asset.bytes) && asset.bytes > 0 && asset.bytes <= 5242880, 503, 'storage_unavailable');
        // A Free image is public at /v3/assets/ and needs no pass.
        if (asset.access === 'premium') list.set(`/v3/premium/assets/${asset.sha256}.${ext}`, { path: `/v3/premium/assets/${asset.sha256}.${ext}`, sha256: asset.sha256, bytes: asset.bytes });
      }
    }
  }
  // Bounds the grant context, which every file request reads back (256 KiB).
  requireThat(list.size <= 1000, 400, 'invalid_request');
  return [...list.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
async function issue(request: Request, env: NexusEnv) {
  requireThat(request.headers.get('Content-Type')?.split(';')[0] === 'application/json', 400, 'invalid_request');
  let input;
  try { input = await jsonResponse(request, 8192); } catch (error) { if (error instanceof Refusal) throw error; throw new Refusal(400, 'invalid_request'); }
  const digests = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string' && HEX.test(item));
  requireThat(input && typeof input === 'object' && Object.keys(input).sort().join(',') === 'designs,domain,setups' && digests(input.designs) && digests(input.setups)
    && typeof input.domain === 'string' && input.domain.length > 0 && input.domain.length <= 253 && !/[\s?#@]/.test(input.domain), 400, 'invalid_request');
  const all = [...input.designs, ...input.setups];
  requireThat(all.length >= 1 && all.length <= 50 && new Set(all).size === all.length, 400, 'invalid_request');
  // IP plus site: shared hosting puts many sites behind one address.
  const outcome = await limit(env.GRANT_RATE_LIMITER, `wconvert:grants:${clientIp(request)}:${await sha256(encoder.encode(input.domain.toLowerCase()))}`);
  if (outcome !== 'ok') throw outcome === 'limited' ? new Refusal(429, 'rate_limited', 60) : new Refusal(503, 'rate_limit_unavailable', 60);
  const license = request.headers.get('X-License-Key');
  requireThat(license && license.length <= 1024, 401, 'invalid_key');
  const list = await files(env, input.designs, input.setups);
  const digest = await sha256(encoder.encode(JSON.stringify(list.map(f => [f.path, f.sha256, f.bytes]))));
  const response = await fetch(env.NEXUS_GRANT_URL, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.NEXUS_SERVICE_KEY}`, 'X-License-Key': license },
    body: JSON.stringify({ domain: input.domain, permission: 'templates:download', resource_digest: digest }) });
  const body = await jsonResponse(response, 16384);
  if (!response.ok) {
    const customerCodes = ['invalid_key', 'license_expired', 'key_disabled', 'license_suspended', 'license_revoked', 'domain_not_allowed'];
    if ([401, 403].includes(response.status) && customerCodes.includes(body?.error_code)) throw new Refusal(response.status, body.error_code);
    if (response.status === 429) throw new Refusal(429, 'rate_limited', Math.min(3600, Math.max(1, Number(response.headers.get('Retry-After')) || 60)));
    throw new Refusal(503, 'verification_unavailable', 30);
  }
  requireThat(body?.success === true && body.token_type === 'Bearer' && typeof body.grant === 'string', 503, 'verification_unavailable');
  const key = await signingKey(parts(body.grant).header.kid, env);
  const claims = await verify(body.grant, key, env);
  // The SDK sends its canonical domain. Nexus must authorize that exact installation.
  requireThat(claims.site === input.domain && claims.resource_digest === digest, 503, 'verification_unavailable');
  const context: Context = { claims, key, files: list };
  // Strong read-after-write storage avoids eventual-consistency failures on the next file.
  // A one-day R2 lifecycle rule removes expired contexts; exp is enforced at every read.
  await env.PRIVATE_TEMPLATES.put(`grants/${await sha256(encoder.encode(body.grant))}.json`, JSON.stringify(context));
  return new Response(JSON.stringify({ grant: body.grant, expires_in: claims.exp - now() }), { headers: noStore });
}
/** The pass, if the request carries a well-formed one. */
export const bearer = (request: Request) => request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_.-]{1,8192})$/)?.[1];
async function download(request: Request, env: NexusEnv) {
  const token = bearer(request);
  requireThat(token);
  const key = `grants/${await sha256(encoder.encode(token))}.json`;
  let bytes: Uint8Array<ArrayBuffer>;
  try { bytes = await stored(env.PRIVATE_TEMPLATES, key, 262144); } catch (e) { if (e instanceof Refusal && e.status === 404) throw new Refusal(401, 'invalid_grant'); throw e; }
  const context: Context = JSON.parse(new TextDecoder().decode(bytes));
  const claims = await verify(token, context.key, env);
  for (const name of ['site', 'activation_id', 'resource_digest', 'exp', 'jti'] as const) requireThat(claims[name] === context.claims[name]);
  const path = new URL(request.url).pathname;
  const file = context.files.find(f => f.path === path); requireThat(file, 403, 'resource_not_allowed');
  // /v3/premium/designs/<sha>.json is private key v3/designs/<sha>.json.
  const content = await stored(env.PRIVATE_TEMPLATES, 'v3/' + path.slice('/v3/premium/'.length), Math.min(file.bytes, 5242880));
  requireThat(content.length === file.bytes && await sha256(content) === file.sha256, 503, 'storage_unavailable');
  requireThat(claims.exp > now());
  const type = path.endsWith('.json') ? 'application/json' : path.endsWith('.png') ? 'image/png' : path.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
  return new Response(request.method === 'HEAD' ? null : content, { headers: { ...noStore, 'Content-Type': type, 'Content-Length': String(content.length) } });
}
export async function premium(request: Request, env: NexusEnv): Promise<Response> {
  try { configured(env); return await (new URL(request.url).pathname === '/v3/grants' ? issue(request, env) : download(request, env)); }
  catch (error) {
    const known = error instanceof Refusal;
    const invalidIssuance = known && error.code === 'invalid_grant' && new URL(request.url).pathname === '/v3/grants';
    const status = known && !invalidIssuance ? error.status : 503;
    return new Response(request.method === 'HEAD' ? null : JSON.stringify({ error_code: known && !invalidIssuance ? error.code : 'verification_unavailable' }), {
      status, headers: { ...noStore, ...(known && error.retry ? { 'Retry-After': String(error.retry) } : status === 503 ? { 'Retry-After': '30' } : {}) },
    });
  }
}
