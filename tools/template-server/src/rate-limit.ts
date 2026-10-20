/** Separate edge counters protect Nexus issuance and authorized file delivery. */
export async function rateLimit(request: Request, limiter: RateLimit | undefined, scope: 'grants' | 'downloads'): Promise<Response | null> {
  let status = 503;
  try {
    // Cloudflare sets this header at ingress. Never trust a client-supplied
    // license/domain or X-Forwarded-For as the counter key.
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (limiter) {
      const { success } = await limiter.limit({ key: `wconvert:${scope}:${ip}` });
      if (success) return null;
      status = 429;
    }
  } catch { /* Fail closed without logging request data. */ }
  return new Response(request.method === 'HEAD' ? null : JSON.stringify({
    error_code: status === 429 ? 'rate_limited' : 'rate_limit_unavailable',
  }), {
    status,
    headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
      'Retry-After': '60', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    },
  });
}
