import { captureEndpoint } from './payload';
import type { Challenge } from './protection';
export interface Reply { id?: string; grant?: string; challenge?: Challenge; message?: string; data?: { field?: string }; }
export async function request(body: Record<string, unknown>): Promise<Reply> {
  const endpoint = captureEndpoint();
  if (!endpoint) throw {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    const reply: unknown = await response.json();
    if (!reply || typeof reply !== 'object' || Array.isArray(reply)) throw {};
    if (!response.ok) throw reply;
    return reply as Reply;
  } finally { clearTimeout(timeout); }
}
