/**
 * Edge counters protect Nexus issuance and authorized file delivery. Shared
 * hosting puts many sites behind one IP, so the tight counters are keyed on
 * what identifies one site (its domain, or its pass) and the IP only carries a
 * loose ceiling.
 */
export type Outcome = 'ok' | 'limited' | 'unavailable';

export const clientIp = (request: Request) =>
  // Cloudflare sets this header at ingress. Never trust a client-supplied
  // license/domain or X-Forwarded-For as an IP.
  request.headers.get('CF-Connecting-IP') || 'unknown';

export async function limit(limiter: RateLimit | undefined, key: string): Promise<Outcome> {
  try {
    if (!limiter) return 'unavailable';
    return (await limiter.limit({ key })).success ? 'ok' : 'limited';
  } catch { return 'unavailable'; /* Fail closed without logging request data. */ }
}

export function throttled(request: Request, outcome: Exclude<Outcome, 'ok'>): Response {
  return new Response(request.method === 'HEAD' ? null : JSON.stringify({
    error_code: outcome === 'limited' ? 'rate_limited' : 'rate_limit_unavailable',
  }), {
    status: outcome === 'limited' ? 429 : 503,
    headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
      'Retry-After': '60', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    },
  });
}

/** Every counter in order; the first one that refuses answers. */
export async function rateLimit(request: Request, checks: [RateLimit | undefined, string][]): Promise<Response | null> {
  for (const [limiter, key] of checks) {
    const outcome = await limit(limiter, key);
    if (outcome !== 'ok') return throttled(request, outcome);
  }
  return null;
}
