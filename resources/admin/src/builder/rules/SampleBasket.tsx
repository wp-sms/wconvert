import { useEffect, useMemo, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { CommercePicker } from '../CommerceControls';
import { Input } from '../../components/ui/input';
import type { ProductsNode } from '@renderer/types';
import type { Rule } from '@loader/types';

export type Basket = { items: { id: number; quantity: number }[]; amount: number; total: number; state: 'known' | 'unknown' | 'blocked' };
export const emptyBasket = (): Basket => ({ items: [], amount: 0, total: 0, state: 'known' });
type Card = { id: number; name: string; price: string; image: string; label: string };
export type BasketResult = { rules: Record<string, boolean>; cards: Card[]; reason: string; eligible: boolean; state: Basket['state']; currency: string; decimals: number };

/** Every response belongs to exact draft/sample inputs; stale or failed reads never match. */
export function useBasketPreview(enabled: boolean, basket: Basket, rules: readonly Rule[], products?: ProductsNode) {
  const key = JSON.stringify({ ...basket, rules, products: products ? { source: products.source ?? 'selected', product_ids: products.product_ids ?? [], exclude_cart: products.exclude_cart !== false } : null });
  const request = useMemo(() => ({ key }), [key]);
  const [reply, setReply] = useState<{ request: typeof request; result?: BasketResult; error?: boolean }>();
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const timeout = setTimeout(() => controller.abort(), 8000);
      void apiFetch<BasketResult>({ path: '/wconvert/v1/commerce/preview', method: 'POST', data: JSON.parse(key), signal: controller.signal })
        .then(result => { if (current) setReply({ request, result }); })
        .catch(() => { if (current) setReply({ request, error: true }); }).finally(() => clearTimeout(timeout));
    }, 250);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [enabled, key, request]);
  return { result: enabled && reply?.request === request ? reply.result : undefined, error: enabled && reply?.request === request && reply.error === true };
}

export function SampleBasket({ value, onChange, result, error, products, legacyTotal }: { value: Basket; onChange(value: Basket): void; result?: BasketResult; error: boolean; products?: ProductsNode; legacyTotal: boolean }) {
  const reason: Record<string, string> = {
    unknown: __('The sample basket is unavailable or consent is not given.', 'wconvert'),
    empty: __('Add a product to the sample basket to see suggestions.', 'wconvert'),
    no_relationships: __('No WooCommerce cross-sells are configured for these basket products. Add linked cross-sells in WooCommerce, or choose products yourself.', 'wconvert'),
    none_selected: __('Choose recommendation products in your draft first.', 'wconvert'),
    unavailable: __('All suggestions are already in the basket or are unavailable to buy.', 'wconvert'),
  };
  return <section aria-labelledby="wconvert-sample-basket" className="space-y-3">
    <h3 id="wconvert-sample-basket">{__('Sample basket', 'wconvert')}</h3>
    <p className="wconvert-sample-help">{__('These are pretend basket contents and totals. Product categories, relationships and availability come from your store. Nothing is added to a real cart.', 'wconvert')}</p>
    <label>{__('Basket status', 'wconvert')}<select value={value.state} onChange={event => onChange({ ...value, state: event.target.value as Basket['state'] })}>
      <option value="known">{__('Known basket', 'wconvert')}</option><option value="unknown">{__('Basket unavailable', 'wconvert')}</option><option value="blocked">{__('Consent not given', 'wconvert')}</option>
    </select></label>
    <CommercePicker value={value.items.map(item => item.id)} onChange={ids => onChange({ ...value, items: ids.map(id => value.items.find(item => item.id === id) ?? { id, quantity: 1 }) })}
      itemControls={(id, name) => <label>{__('Quantity', 'wconvert')}<Input className="w-24" type="number" min={1} max={10000} step={1} aria-label={sprintf(__('Quantity for %s', 'wconvert'), name)} value={value.items.find(item => item.id === id)?.quantity ?? 1}
        onChange={event => onChange({ ...value, items: value.items.map(item => item.id === id ? { ...item, quantity: Math.max(1, Math.min(10000, Math.floor(Number(event.target.value) || 1))) } : item) })} /></label>} />
    <label>{__('Merchandise amount after discounts', 'wconvert')}<Input type="number" min={0} max={1000000000} step="any" value={value.amount} onChange={event => onChange({ ...value, amount: Number(event.target.value) })} /></label>
    <p className="wconvert-sample-help">{result?.currency ?? ''} · {__('Enter a pretend amount, excluding shipping and tax. It is not calculated from product prices.', 'wconvert')}</p>
    {legacyTotal && <label>{__('Cart total including shipping and tax', 'wconvert')}<Input type="number" min={0} max={1000000000} step="any" value={value.total} onChange={event => onChange({ ...value, total: Number(event.target.value) })} /></label>}
    {error ? <p role="alert">{__('Could not test this basket. Review the values or reopen the sample visit to try again.', 'wconvert')}</p> : !result ? <p>{__('Checking the sample basket…', 'wconvert')}</p> : null}
    {products && <div className="space-y-3"><h4>{__('Recommendations for this sample basket', 'wconvert')}</h4>
      <p className="wconvert-sample-help">{__('Product availability preview only. The campaign also needs to pass the display rules above. No clicks or sales are recorded.', 'wconvert')}</p>
      {result && !result.cards.length && <p>{reason[result.reason] ?? __('No eligible suggestions.', 'wconvert')}</p>}
      {!!result?.cards.length && <ul className="grid gap-3 sm:grid-cols-3">{result.cards.map(card => <li className="min-w-0 rounded-md border p-3 space-y-2" key={card.id}>
        {card.image && <img className="w-full aspect-square object-cover" src={card.image} alt="" />}
        <strong className="block">{card.name}</strong><span className="block">{card.price}</span><span>{card.label}</span>
      </li>)}</ul>}
    </div>}
  </section>;
}
