import { captureEndpoint } from './payload';
import { verify, type Challenge } from './protection';

export interface Reply { code?: string; id?: string; grant?: string; challenge?: Challenge; message?: string; data?: { field?: string }; }

/** The same bounded capture request is used by Free and paid journeys. */
export async function requestCapture(body: Record<string, unknown>): Promise<Reply> {
  const endpoint = captureEndpoint();
  if (!endpoint) throw {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    const reply: unknown = await response.json();
    if (!reply || typeof reply !== 'object' || Array.isArray(reply)) throw {};
    if (!response.ok) throw reply;
    const result = reply as Reply;
    if (result.challenge && !body.verification_token) return requestCapture({ ...body, verification_token: await verify(result.challenge) });
    return result;
  } finally { clearTimeout(timeout); }
}
