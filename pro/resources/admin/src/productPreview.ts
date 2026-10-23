import { __ } from '@wordpress/i18n';
import { registerLeafRenderer } from '@renderer/render';
import type { ProductsNode } from '@renderer/types';
/** Inert design preview. It never reads a cart or counts a visitor. */
export function registerProductPreview(): void {
  registerLeafRenderer(raw => {
    if (raw.type !== 'products') return null;
    return productPreview(raw as ProductsNode);
  });
}

/** Shared inert sample cards for the picker and the internal studio. */
export function productPreview(node: ProductsNode): HTMLElement {
  const host = document.createElement('div'); host.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr));gap:1rem;text-align:start';
  const count = Math.min(3, node.product_ids?.length || 2);
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div'); card.style.cssText = 'display:grid;gap:.5rem;min-width:0';
    const image = document.createElement('div'); image.style.cssText = 'aspect-ratio:1;background:#edf0ec;color:#34463c;border-radius:var(--wc-radius,.5rem);display:grid;place-items:center'; image.textContent = __('Product image', 'wconvert-pro');
    const name = document.createElement('strong'); name.textContent = node.product_ids?.[i] ? `${__('Selected product', 'wconvert-pro')} #${node.product_ids[i]}` : __('Your product', 'wconvert-pro');
    const price = document.createElement('span'); price.textContent = __('Current store price', 'wconvert-pro');
    const action = document.createElement('span'); action.className = 'wc-button'; action.textContent = node.action === 'add_to_cart' ? __('Add to cart', 'wconvert-pro') : __('View product', 'wconvert-pro');
    card.append(image, name, price, action); host.append(card);
  }
  return host;
}
