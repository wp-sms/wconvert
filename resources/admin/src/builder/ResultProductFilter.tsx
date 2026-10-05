import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import type { ResultProductFilter as Filter } from '@renderer/types';
import { Button } from '../components/ui/button';

interface Choice { id: string; name: string }
function CatalogChoice({ label, taxonomy, value, onChange }: { label: string; taxonomy: string; value: string; onChange(value: string): void }) {
  const [search, setSearch] = useState('');
  const [state, setState] = useState<{ items: Choice[]; more: boolean; busy: boolean; error: boolean }>({ items: [], more: false, busy: true, error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ ...previous, busy: true, error: false }));
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ taxonomy, search, selected: value });
      void apiFetch<{ items: Choice[]; more: boolean }>({ path: `/wconvert/v1/product-filters?${query}`, signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) setState({ ...data, busy: false, error: false }); })
        .catch(() => { if (!controller.signal.aborted) setState({ items: [], more: false, busy: false, error: true }); });
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [taxonomy, search, value, retry]);
  return <div className="wconvert-catalog-choice">
    <label>{label}<select value={value} onChange={event => onChange(event.target.value)} disabled={state.error || state.busy && !state.items.length}>
      <option value="">{state.busy ? __('Loading…', 'wconvert') : __('Choose…', 'wconvert')}</option>
      {value && !state.items.some(item => item.id === value) && <option value={value}>{state.busy ? __('Loading selection…', 'wconvert') : __('Unavailable — choose again', 'wconvert')}</option>}
      {state.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {(state.more || state.items.length > 8 || !!search) && <input aria-label={sprintf(__('Search %s', 'wconvert'), label.toLowerCase())} placeholder={__('Search…', 'wconvert')} value={search} maxLength={100} onChange={event => setSearch(event.target.value)} />}
    {state.more && <small>{__('Search to narrow the list.', 'wconvert')}</small>}
    {!state.busy && !state.error && !state.items.length && <small>{__('No choices found. Try another search or add them in WooCommerce.', 'wconvert')}</small>}
    {state.error && <p role="alert">{__('Choices could not load.', 'wconvert')} <button type="button" onClick={() => setRetry(retry + 1)}>{__('Retry', 'wconvert')}</button></p>}
  </div>;
}

interface Product { id: number; name: string; permalink: string; images?: { thumbnail?: string; alt?: string }[] }
export function LiveProductMatches({ filter }: { filter: Filter }) {
  const key = JSON.stringify(filter);
  const [state, setState] = useState<{ key: string; items: Product[]; error: boolean }>();
  const [retry, setRetry] = useState(0);
  const ready = filter.category_id > 0 && filter.attributes.every(item => item.taxonomy && item.term_id > 0);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setState(undefined);
    void apiFetch<Product[]>({ path: `/wconvert/v1/product-matches?filter=${encodeURIComponent(key)}`, signal: controller.signal })
      .then(items => { if (!controller.signal.aborted) setState({ key, items: items.filter(item => { try { const url = new URL(item.permalink, document.baseURI); return url.origin === location.origin && /^https?:$/.test(url.protocol); } catch { return false; } }), error: false }); })
      .catch(() => { if (!controller.signal.aborted) setState({ key, items: [], error: true }); });
    return () => controller.abort();
  }, [key, ready, retry]);
  if (!ready) return <p role="status">{__('Choose a category and complete each filter.', 'wconvert')}</p>;
  if (!state || state.key !== key) return <p role="status">{__('Loading matches…', 'wconvert')}</p>;
  if (state.error) return <div><p role="alert">{__('Matches could not load. Check your category and filters, then retry.', 'wconvert')}</p><button type="button" onClick={() => setRetry(retry + 1)}>{__('Retry', 'wconvert')}</button></div>;
  if (!state.items.length) return <p role="status">{__('No available matches. Visitors can use your fallback link.', 'wconvert')}</p>;
  return <ul className="wc-products-list wconvert-product-matches">{state.items.map(product => <li key={product.id}>
    {product.images?.[0]?.thumbnail && <img src={product.images[0].thumbnail} alt="" width="40" height="40" />}
    <a href={product.permalink} target="_blank" rel="noreferrer">{product.name}</a>
  </li>)}</ul>;
}

export function ResultProductFilter({ value, onChange }: { value: Filter; onChange(value: Filter): void }) {
  const [preview, setPreview] = useState(false);
  const edit = (at: number, next: Filter['attributes'][number]) => onChange({ ...value, attributes: value.attributes.map((item, index) => index === at ? next : item) });
  return <div className="wconvert-result-filter">
    <CatalogChoice label={__('Category', 'wconvert')} taxonomy="product_cat" value={value.category_id ? String(value.category_id) : ''} onChange={id => onChange({ ...value, category_id: Number(id) })} />
    <small>{__('Includes subcategories. Up to three available products appear, oldest first.', 'wconvert')}</small>
    {!!value.attributes.length && <p>{__('Products must match every filter.', 'wconvert')}</p>}
    {value.attributes.map((filter, index) => <fieldset key={index}>
      <legend>{sprintf(__('Filter %d', 'wconvert'), index + 1)}</legend>
      <CatalogChoice label={__('Attribute', 'wconvert')} taxonomy="attributes" value={filter.taxonomy} onChange={taxonomy => edit(index, { taxonomy, term_id: 0 })} />
      {!!filter.taxonomy && <CatalogChoice key={filter.taxonomy} label={__('Value', 'wconvert')} taxonomy={filter.taxonomy} value={filter.term_id ? String(filter.term_id) : ''} onChange={id => edit(index, { ...filter, term_id: Number(id) })} />}
      <Button variant="ghost" size="sm" aria-label={sprintf(__('Remove filter %d', 'wconvert'), index + 1)} onClick={() => onChange({ ...value, attributes: value.attributes.filter((_, at) => at !== index) })}>{__('Remove filter', 'wconvert')}</Button>
    </fieldset>)}
    {value.attributes.length < 3 && <Button variant="outline" size="sm" disabled={!value.category_id || value.attributes.some(item => !item.taxonomy || !item.term_id)} onClick={() => onChange({ ...value, attributes: [...value.attributes, { taxonomy: '', term_id: 0 }] })}>{__('Add attribute filter', 'wconvert')}</Button>}
    <small>{__('Uses global WooCommerce attributes. Shoppers choose size or other options on the product page.', 'wconvert')}</small>
    {new Set(value.attributes.map(item => item.taxonomy)).size < value.attributes.length && <p role="alert">{__('Use each attribute only once.', 'wconvert')}</p>}
    <details onToggle={event => setPreview(event.currentTarget.open)}><summary>{__('Preview matches', 'wconvert')}</summary>
      {preview && <><LiveProductMatches filter={value} /><small>{__('Live catalog preview. No clicks or conversions are counted.', 'wconvert')}</small></>}
    </details>
  </div>;
}
