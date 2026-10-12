import { productPreview } from '../../../resources/admin/src/productPreview';
import type { ResultVariant } from '../../../resources/renderer/src/types';

/** Inert product placeholders, not catalogue availability or invented prices. */
export function previewResult(root: HTMLElement, result?: ResultVariant, required = false): void {
  const products = root.querySelector<HTMLElement>('[data-result-products]');
  if (!products || !result) return;
  products.replaceChildren();
  if (required || result.product_filter || result.product_ids?.length) {
    const note = document.createElement('p');
    note.className = 'wc-text';
    note.textContent = 'Sample products. Choose this shop’s products and filters in the editor.';
    products.append(note, productPreview({ type: 'products', product_ids: [], action: result.product_action ?? 'link' }));
  }
}
