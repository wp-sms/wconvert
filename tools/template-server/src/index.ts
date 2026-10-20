import { premium, type NexusEnv } from './premium';
import { rateLimit } from './rate-limit';
/** Public reads stay independent of Nexus and private storage. */
const HASH = '[a-f0-9]{64}';
const PUBLIC = new RegExp(`^(manifest\\.json|packs/${HASH}\\.json|releases/${HASH}/(manifest|designs|page-[1-9][0-9]?)\\.json|previews/${HASH}\\.html|thumbnails/${HASH}\\.jpg|assets/free/${HASH}\\.(png|jpg|webp))$`);
const PREMIUM = new RegExp(`^/(downloads/${HASH}\\.json|assets/premium/${HASH}\\.(png|jpg|webp))$`);
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
export default {
  async fetch(request: Request, env: NexusEnv): Promise<Response> {
    const url = new URL(request.url);
    // Never accept credentials or arbitrary storage keys from query parameters.
    if (url.search) return message(request, 400, 'Query parameters are not supported');
    if (url.pathname === '/grants') {
      if (request.method !== 'POST') return message(request, 405, 'Use POST', { Allow: 'POST' });
      return await rateLimit(request, env.GRANT_RATE_LIMITER, 'grants') ?? premium(request, env);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return message(request, 405, 'Read-only service', { Allow: 'GET, HEAD' });
    if (PREMIUM.test(url.pathname)) return await rateLimit(request, env.DOWNLOAD_RATE_LIMITER, 'downloads') ?? premium(request, env);
    const key = url.pathname.slice(1);
    if (!PUBLIC.test(key)) return message(request, 404, 'Not found');
    try {
      const object = await env.PUBLIC_TEMPLATES.get(key);
      if (!object) return message(request, 404, 'Not found');
      const html = key.startsWith('previews/'), asset = key.startsWith('assets/') || key.startsWith('thumbnails/');
      const limit = html ? 2097152 : asset ? 5242880 : 262144;
      if (!object.size || object.size > limit) {
        await object.body.cancel();
        return message(request, 503, 'Stored object unavailable');
      }
      const type = html ? 'text/html; charset=utf-8' : asset
        ? ({ png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[key.split('.').pop()!]!)
        : 'application/json; charset=utf-8';
      const headers = new Headers({
        'Content-Type': type, 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': key === 'manifest.json' ? 'no-cache, must-revalidate' : 'public, max-age=31536000, immutable',
        ETag: object.httpEtag, 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': html
          ? `sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors ${embeddingOrigins(env.PREVIEW_EMBED_ORIGINS)}`
          : "default-src 'none'; frame-ancestors 'none'",
      });
      let body: ReadableStream | string = object.body;
      // Discovery stays additive at the HTTP layer: older plugins reject extra JSON keys.
      if (key === 'manifest.json' || /^releases\/[a-f0-9]{64}\/manifest\.json$/.test(key)) {
        body = await object.text();
        const release = JSON.parse(body).release;
        if (typeof release !== 'string' || !/^[a-f0-9]{64}$/.test(release)) return message(request, 503, 'Stored object unavailable');
        const catalogue = `releases/${release}/designs.json`;
        if (await env.PUBLIC_TEMPLATES.head(catalogue)) headers.set('Link', `</${catalogue}>; rel="describedby"; type="application/json"`);
      }
      // GET/HEAD validators use weak comparison; no Range support is advertised.
      const matches = request.headers.get('If-None-Match')?.split(',').some(tag => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === object.httpEtag);
      if (matches || request.method === 'HEAD') {
        if (typeof body !== 'string') await body.cancel();
        if (!matches) headers.set('Content-Length', String(object.size));
        return new Response(null, { status: matches ? 304 : 200, headers });
      }
      headers.set('Content-Length', String(object.size));
      return new Response(body, { headers });
    } catch {
      // Do not log request headers, tokens or object contents.
      console.error(JSON.stringify({ event: 'template_storage_unavailable' }));
      return message(request, 503, 'Template service temporarily unavailable', { 'Retry-After': '60' });
    }
  },
} satisfies ExportedHandler<Env>;
