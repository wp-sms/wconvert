import { hasConsent } from '@loader/consent';
import { readPayload } from '@loader/payload';

export type AdditionState = 'added' | 'rejected' | 'unknown' | 'busy';
let busy = false;
// getRandomValues works on HTTP local stores too; randomUUID requires a secure context.
const uuid = () => '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16));
export function additionSession(id: string) {
  const mount = uuid(); let token = ''; const completed = new Map<number, AdditionState>();
  return { async add(product: number, priceKey = ''): Promise<AdditionState> {
    if (completed.has(product)) return completed.get(product)!;
    if (busy) return 'busy';
    if (!hasConsent('functional')) return 'rejected';
    busy = true; let sent = false;
    try {
      const payload = document.getElementById('wconvert-payload');
      const entry = readPayload()?.find(value => value.id === id) as unknown as { commerce_revision?: string } | undefined;
      if (!entry?.commerce_revision) return 'rejected';
      const request = async (endpoint: string, data: Record<string, string>) => {
        const value = payload?.getAttribute(`data-commerce-${endpoint}`);
        if (!value) throw Error('endpoint');
        const url = new URL(value, location.href);
        if (url.origin !== location.origin) throw Error('origin');
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
        try {
          const response = await fetch(url, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal, body: new URLSearchParams({ id, revision: entry.commerce_revision!, ...data }) });
          const result = await response.json() as Record<string, unknown>;
          if (!response.ok && (endpoint !== 'add' || result.state !== 'rejected')) throw Error('request');
          return result;
        } finally { clearTimeout(timeout); }
      };
      if (!token) {
        const protection = await request('begin', { mount });
        if (typeof protection.token !== 'string' || !protection.token) return 'rejected';
        token = protection.token;
      }
      if (!hasConsent('functional')) return 'rejected';
      sent = true;
      const response = await request('add', { token, operation: uuid(), product: String(product), price_key: priceKey, page_product: payload?.getAttribute('data-commerce-product') ?? '' });
      const state = response.state === 'added' && response.product === product ? 'added' : response.state === 'rejected' ? 'rejected' : 'unknown';
      completed.set(product, state); return state;
    } catch {
      const state = sent ? 'unknown' : 'rejected';
      if (sent) completed.set(product, state);
      return state;
    } finally { busy = false; }
  } };
}

/** Refresh native cart UI without the added-to-cart event that opens some mini-carts. */
export function refreshNativeCart(): void {
  const win = window as unknown as { wp?: { data?: { dispatch(name: string): { invalidateResolutionForStore?(): void } } }; jQuery?: (node: HTMLElement) => { trigger(event: string): void } };
  try { win.wp?.data?.dispatch('wc/store/cart')?.invalidateResolutionForStore?.(); } catch { /* Not every theme registers the Blocks cart store. */ }
  // WooCommerce 10.4+ mini-cart uses its interactivity store rather than wp.data.
  // Its existing cross-store sync bridge refreshes without opening the drawer.
  window.dispatchEvent(new CustomEvent('wc-blocks_store_sync_required', { detail: { type: 'from_@wordpress/data' } }));
  win.jQuery?.(document.body).trigger('wc_fragment_refresh');
  document.dispatchEvent(new Event('wc-blocks_cart_updated'));
}
