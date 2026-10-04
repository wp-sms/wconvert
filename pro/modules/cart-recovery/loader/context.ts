export { renderProductNode } from './products';
import { readPayload } from '@loader/payload';
import { hasConsent, onConsentChange } from '@loader/consent';

export interface ProductCard { id: number; name: string; url: string; image: string; price: string; label: string }
interface Snapshot { rules: Record<string, boolean>; cards: ProductCard[]; known: boolean }
let snapshots: Record<string, Snapshot> = {};
let state = 'pending';
let generation = 0;
let controller: AbortController | undefined;
let expiry: ReturnType<typeof setTimeout> | undefined;
let release: (() => void) | undefined;
const listeners = new Set<() => void>();
const notify = () => { for (const fn of [...listeners]) fn(); };
export function contextStatus(): string { return state; }
export function cartMatch(key: unknown): boolean {
  if (typeof key !== 'string' || state !== 'ready') return false;
  return snapshots[key.split(':')[0]]?.rules[key] === true;
}
export function cartCards(id: string): ProductCard[] { return state === 'ready' ? snapshots[id]?.cards ?? [] : []; }

/** One read per batch; invalidation cancels old responses before notifying evaluators. */
async function refresh(): Promise<void> {
  const current = ++generation;
  controller?.abort(); clearTimeout(expiry); snapshots = {};
  state = hasConsent('functional') ? 'pending' : 'consent-blocked';
  notify();
  if (!hasConsent('functional') || document.visibilityState === 'hidden' || !listeners.size) return;
  const endpoint = document.getElementById('wconvert-payload')?.getAttribute('data-commerce');
  const entries = (readPayload() ?? []).filter(entry => typeof (entry as unknown as Record<string, unknown>).commerce_revision === 'string');
  if (!endpoint || !entries.length) { state = 'unavailable'; notify(); return; }
  const requestController = new AbortController(); controller = requestController;
  const timeout = setTimeout(() => requestController.abort(), 8000);
  try {
    const url = new URL(endpoint, location.href);
    if (url.origin !== location.origin) throw Error('origin');
    const next: Record<string, Snapshot> = {};
    for (let i = 0; i < entries.length; i += 20) {
      const campaigns = Object.fromEntries(entries.slice(i, i + 20).map(entry => [entry.id, (entry as unknown as Record<string, unknown>).commerce_revision]));
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: requestController.signal,
        body: new URLSearchParams({ campaigns: JSON.stringify(campaigns) }) });
      if (!response.ok) throw Error('request');
      const body: unknown = await response.json();
      if (current !== generation) return;
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('response');
      for (const [id, value] of Object.entries(body)) {
        if (!(id in campaigns) || !value || typeof value !== 'object' || value.known !== true || !value.rules || typeof value.rules !== 'object' || Array.isArray(value.rules) || !Object.values(value.rules).every(rule => typeof rule === 'boolean') || !Array.isArray(value.cards) || value.cards.length > 3 || !value.cards.every((card: ProductCard) => card && typeof card.id === 'number' && ['name', 'url', 'image', 'price', 'label'].every(key => typeof card[key as keyof ProductCard] === 'string'))) continue;
        next[id] = value as Snapshot;
      }
    }
    if (current !== generation || !hasConsent('functional')) return;
    snapshots = next; state = Object.keys(next).length ? 'ready' : 'unavailable'; notify();
    if (listeners.size) expiry = setTimeout(() => { void refresh(); }, 30000);
  } catch {
    if (current !== generation) return;
    state = 'unavailable'; notify();
    if (listeners.size) expiry = setTimeout(() => { void refresh(); }, 30000);
  } finally { clearTimeout(timeout); }
}

export function watchCart(changed: () => void): () => void {
  listeners.add(changed);
  if (!release) {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      ++generation; controller?.abort(); clearTimeout(expiry); snapshots = {}; state = 'pending'; notify();
      clearTimeout(debounce); debounce = setTimeout(() => { void refresh(); }, 50);
    };
    const events = ['wc-blocks_added_to_cart', 'wc-blocks_removed_from_cart', 'wc-blocks_cart_updated'];
    for (const event of events) document.addEventListener(event, invalidate);
    window.addEventListener('pageshow', invalidate);
    window.addEventListener('focus', invalidate);
    document.addEventListener('visibilitychange', invalidate);
    const consent = onConsentChange(invalidate);
    const jq = (window as unknown as { jQuery?: (element: HTMLElement) => { on(events: string, handler: () => void): void; off(events: string, handler: () => void): void } }).jQuery;
    const classic = ' added_to_cart.wconvert removed_from_cart.wconvert updated_wc_div.wconvert updated_cart_totals.wconvert applied_coupon.wconvert removed_coupon.wconvert wc_fragments_refreshed.wconvert';
    // Mutation starts invalidate immediately; only completion permits another read.
    const begin = () => { ++generation; controller?.abort(); clearTimeout(expiry); clearTimeout(debounce); snapshots = {}; state = 'pending'; notify(); debounce = setTimeout(() => { void refresh(); }, 8000); };
    jq?.(document.body).on(classic, invalidate);
    jq?.(document.body).on('adding_to_cart.wconvert', begin);
    // Blocks quantity/coupon changes do not emit the add/remove DOM events.
    // Observe Woo's existing store, retaining only its current object identity.
    const data = (window as unknown as { wp?: { data?: { select(name: string): { getCartData?(): unknown } | undefined; subscribe(fn: () => void): () => void } } }).wp?.data;
    let previous = data?.select('wc/store/cart')?.getCartData?.();
    const stopStore = data?.subscribe(() => {
      const next = data.select('wc/store/cart')?.getCartData?.();
      if (next !== previous) { previous = next; invalidate(); }
    });
    release = () => {
      ++generation; controller?.abort(); clearTimeout(expiry); clearTimeout(debounce); snapshots = {}; state = 'pending';
      for (const event of events) document.removeEventListener(event, invalidate);
      window.removeEventListener('pageshow', invalidate); window.removeEventListener('focus', invalidate);
      document.removeEventListener('visibilitychange', invalidate); consent(); stopStore?.(); jq?.(document.body).off(classic, invalidate); jq?.(document.body).off('adding_to_cart.wconvert', begin);
      release = undefined;
    };
    // Avoid invoking the shell before its evaluator has been registered.
    queueMicrotask(() => { if (listeners.size) void refresh(); });
  }
  return () => { listeners.delete(changed); if (!listeners.size) release?.(); };
}
