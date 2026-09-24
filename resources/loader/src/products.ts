import type { ResultVariant } from '@renderer/types';
import { productsEndpoint } from './payload';

interface StoreProduct {
  id: number;
  name: string;
  permalink: string;
  images?: { thumbnail?: string; src?: string; alt?: string }[];
  is_purchasable?: boolean;
  is_in_stock?: boolean;
  is_password_protected?: boolean;
  prices?: { price?: string; currency_code?: string; currency_minor_unit?: number };
}

/** Public, same-origin Store API read; only selected IDs leave the visitor page. */
export function showProducts(container: HTMLElement, variant: ResultVariant | undefined, onProductClick?: () => void): () => void {
  const ids = [...new Set(variant?.product_ids ?? [])].filter(id => Number.isInteger(id) && id > 0).slice(0, 6);
  const endpoint = productsEndpoint();
  if (!ids.length) return () => undefined;
  const controller = new AbortController();
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  container.replaceChildren(status);
  const load = async () => {
    status.textContent = 'Loading current products…';
    if (!endpoint) { status.textContent = 'Products are unavailable right now. Please use the link below.'; return; }
    try {
      const url = new URL(endpoint, document.baseURI);
      if (url.origin !== location.origin) throw Error('Different origin');
      ids.forEach(id => url.searchParams.append('include[]', String(id)));
      url.searchParams.set('catalog_visibility', 'visible');
      url.searchParams.set('per_page', String(ids.length));
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw Error('Product read failed');
      const raw: unknown = await response.json();
      if (!Array.isArray(raw)) throw Error('Unexpected product response');
      const byId = new Map<number, StoreProduct>();
      for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const p = item as StoreProduct;
        if (ids.includes(p.id) && typeof p.name === 'string' && typeof p.permalink === 'string'
          && p.is_purchasable === true && p.is_in_stock === true && p.is_password_protected !== true) byId.set(p.id, p);
      }
      if (controller.signal.aborted) return;
      const eligible = ids.map(id => byId.get(id)).filter((p): p is StoreProduct => !!p).slice(0, 3);
      if (!eligible.length) { status.textContent = 'These products are unavailable right now. Please use the link below.'; return; }
      const list = document.createElement('ul');
      list.className = 'wc-products-list';
      for (const product of eligible) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = product.permalink;
        if (new URL(link.href, location.href).origin !== location.origin) continue;
        link.textContent = `View ${product.name}`;
        if (onProductClick) link.addEventListener('click', onProductClick);
        const image = product.images?.[0];
        if (image?.thumbnail || image?.src) {
          const img = document.createElement('img');
          img.src = image.thumbnail || image.src || '';
          img.alt = image.alt || '';
          img.loading = 'lazy';
          item.append(img);
        }
        const name = document.createElement('strong'); name.textContent = product.name; item.append(name);
        const price = product.prices;
        if (price?.price && price.currency_code && Number.isInteger(price.currency_minor_unit)) {
          const amount = Number(price.price) / Math.pow(10, price.currency_minor_unit!);
          if (Number.isFinite(amount)) {
            const value = document.createElement('span');
            try { value.textContent = new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency_code }).format(amount); }
            catch { value.textContent = `${amount} ${price.currency_code}`; }
            item.append(value);
          }
        }
        item.append(link); list.append(item);
      }
      container.replaceChildren(list);
    } catch {
      if (controller.signal.aborted) return;
      status.textContent = 'Products could not load. You can still use the link below.';
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'wc-button'; retry.textContent = 'Retry products';
      retry.addEventListener('click', () => { retry.remove(); void load(); }, { once: true });
      container.append(retry);
    }
  };
  void load();
  return () => controller.abort();
}
