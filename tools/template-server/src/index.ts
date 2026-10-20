import { premium, bearer, sha256, type NexusEnv } from './premium';
import { rateLimit, clientIp } from './rate-limit';
/** Public reads stay independent of Nexus and private storage. Bucket keys are the URL paths. */
const HASH = '[a-f0-9]{64}';
const PUBLIC = new RegExp(`^v3/(manifest\\.json|(releases|index|designs|setups)/${HASH}\\.json|assets/${HASH}\\.(png|jpg|webp)|thumbs/${HASH}(@2x)?\\.webp|og/${HASH}\\.jpg|previews/${HASH}\\.html)$`);
// TEMPORARY: the live website still reads catalogue v2 until it migrates to v3.
// These routes are read-only, serve whatever v2 objects remain in the bucket and
// get no new data. Delete this pattern (and its tests) once the website is on v3.
const LEGACY = new RegExp(`^(manifest\\.json|packs/${HASH}\\.json|releases/${HASH}/(manifest|designs|page-[1-9][0-9]?)\\.json|previews/${HASH}\\.html|thumbnails/${HASH}\\.jpg|assets/free/${HASH}\\.(png|jpg|webp))$`);
const PREMIUM = new RegExp(`^/v3/premium/((designs|setups)/${HASH}\\.json|assets/${HASH}\\.(png|jpg|webp))$`);
const DESIGN = new RegExp(`^/v3/(premium/)?designs/(${HASH})\\.json$`);
const POINTERS = new Set(['v3/manifest.json', 'manifest.json']);
const TYPES: Record<string, string> = { json: 'application/json; charset=utf-8', html: 'text/html; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const NO_STORE = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
function embeddingOrigins(value: string | undefined): string {
  const origins = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!origins.length || origins.length > 10) return "'none'";
  try {
    if (origins.some(origin => {
      const url = new URL(origin);
      return !/^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])$/i.test(url.hostname) || url.protocol !== 'https:' || url.origin !== origin || !!url.username || !!url.password;
    })) return "'none'";
    return origins.join(' ');
  } catch { return "'none'"; }
}
function message(request: Request, status: number, error: string, headers = {}) {
  return new Response(request.method === 'HEAD' ? null : JSON.stringify({ error }), {
    status, headers: { ...NO_STORE, 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}
/**
 * One Analytics Engine point per plugin design download, written before any
 * storage, cache or grant work so a refusal or outage still counts the ask.
 * Only the object digest and tier: never an IP, domain, licence or pass.
 */
function count(request: Request, path: string, env: Env) {
  const match = DESIGN.exec(path);
  if (!match || !request.headers.get('User-Agent')?.startsWith('WConvert template')) return;
  try { env.DOWNLOADS?.writeDataPoint({ blobs: [match[2], match[1] ? 'premium' : 'free'], doubles: [1], indexes: [match[2]] }); }
  catch { /* Counting never breaks a download. */ }
}
function limits(key: string) {
  // Nothing but the object kind decides the cap; a mislabelled object is refused.
  if (POINTERS.has(key)) return key === 'manifest.json' ? 262144 : 65536;
  if (key.endsWith('.html')) return 2097152;
  return key.endsWith('.json') ? 262144 : 5242880;
}
export default {
  async fetch(request: Request, env: NexusEnv): Promise<Response> {
    const url = new URL(request.url);
    // Never accept credentials or arbitrary storage keys from query parameters.
    if (url.search) return message(request, 400, 'Query parameters are not supported');
    const ip = clientIp(request);
    if (url.pathname === '/v3/grants') {
      if (request.method !== 'POST') return message(request, 405, 'Use POST', { Allow: 'POST' });
      // The per-site counter needs the parsed domain, so premium() applies it.
      return await rateLimit(request, [[env.GRANT_IP_RATE_LIMITER, `wconvert:grants-ip:${ip}`]]) ?? premium(request, env);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return message(request, 405, 'Read-only service', { Allow: 'GET, HEAD' });
    if (request.method === 'GET') count(request, url.pathname, env);
    if (PREMIUM.test(url.pathname)) {
      const token = bearer(request);
      return await rateLimit(request, [
        [env.DOWNLOAD_IP_RATE_LIMITER, `wconvert:downloads-ip:${ip}`],
        // A request without a well-formed pass is refused before any storage read.
        ...(token ? [[env.DOWNLOAD_RATE_LIMITER, `wconvert:downloads:${await sha256(new TextEncoder().encode(token))}`] as [RateLimit, string]] : []),
      ]) ?? premium(request, env);
    }
    const key = url.pathname.slice(1);
    if (!PUBLIC.test(key) && !LEGACY.test(key)) return message(request, 404, 'Not found');
    try {
      const object = await env.PUBLIC_TEMPLATES.get(key);
      if (!object) return message(request, 404, 'Not found');
      if (!object.size || object.size > limits(key)) {
        await object.body.cancel();
        return message(request, 503, 'Stored object unavailable');
      }
      const html = key.endsWith('.html');
      const headers = new Headers({
        'Content-Type': TYPES[key.split('.').pop()!], 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': POINTERS.has(key) ? 'no-cache, must-revalidate' : 'public, max-age=31536000, immutable',
        ETag: object.httpEtag, 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': html
          ? `sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors ${embeddingOrigins(env.PREVIEW_EMBED_ORIGINS)}`
          : "default-src 'none'; frame-ancestors 'none'",
      });
      // GET/HEAD validators use weak comparison; no Range support is advertised.
      const matches = request.headers.get('If-None-Match')?.split(',').some(tag => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === object.httpEtag);
      if (matches || request.method === 'HEAD') {
        await object.body.cancel();
        if (!matches) headers.set('Content-Length', String(object.size));
        return new Response(null, { status: matches ? 304 : 200, headers });
      }
      headers.set('Content-Length', String(object.size));
      return new Response(object.body, { headers });
    } catch {
      // Do not log request headers, tokens or object contents.
      console.error(JSON.stringify({ event: 'template_storage_unavailable' }));
      return message(request, 503, 'Template service temporarily unavailable', { 'Retry-After': '60' });
    }
  },
} satisfies ExportedHandler<Env>;
