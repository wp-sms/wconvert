import { premium, type NexusEnv } from './premium';
/** Public reads stay independent of Nexus and private storage. */
const HASH = '[a-f0-9]{64}';
const PUBLIC = new RegExp(`^(manifest\\.json|packs/${HASH}\\.json|releases/${HASH}/(manifest|page-[1-9][0-9]?)\\.json|previews/${HASH}\\.html|assets/free/${HASH}\\.(png|jpg|webp))$`);
const PREMIUM = new RegExp(`^/(downloads/${HASH}\\.json|assets/premium/${HASH}\\.(png|jpg|webp))$`);
const NO_STORE = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
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
    if (url.pathname === '/grants') return request.method === 'POST' ? premium(request, env) : message(request, 405, 'Use POST', { Allow: 'POST' });
    if (!['GET', 'HEAD'].includes(request.method)) return message(request, 405, 'Read-only service', { Allow: 'GET, HEAD' });
    if (PREMIUM.test(url.pathname)) return premium(request, env);
    const key = url.pathname.slice(1);
    if (!PUBLIC.test(key)) return message(request, 404, 'Not found');
    try {
      const object = await env.PUBLIC_TEMPLATES.get(key);
      if (!object) return message(request, 404, 'Not found');
      const html = key.startsWith('previews/'), asset = key.startsWith('assets/');
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
          ? "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"
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
