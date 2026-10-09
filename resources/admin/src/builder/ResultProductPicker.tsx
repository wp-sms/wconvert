import { useEffect, useId, useRef, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { TryAgain } from '../shell/Region';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

interface Product { id: number; name: string; is_in_stock?: boolean; images?: { thumbnail?: string }[]; prices?: { price?: string; currency_code?: string; currency_minor_unit?: number } }
function productPrice(product: Product): string {
  const price = product.prices;
  if (!price?.price || !price.currency_code || !Number.isInteger(price.currency_minor_unit)) return '';
  const amount = Number(price.price) / Math.pow(10, price.currency_minor_unit!);
  if (!Number.isFinite(amount)) return '';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency_code }).format(amount); }
  catch { return `${amount} ${price.currency_code}`; }
}
export function ProductPicker({ ids, onChange, max = 6, ordered = true, allowUnavailable = false, label, help, actionLabel = __('Add', 'wconvert') }: {
  ids: readonly number[]; onChange(ids: number[]): void; max?: number; ordered?: boolean; allowUnavailable?: boolean; label?: string; help?: string; actionLabel?: string;
}) {
  const [query, setQuery] = useState(''); const [found, setFound] = useState<Product[]>([]); const [selected, setSelected] = useState<Product[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const selectedKey = ids.join(',');
  const helpId = useId();
  const [searched, setSearched] = useState(false);
  const [namesFailed, setNamesFailed] = useState(false);
  const [namesRetry, setNamesRetry] = useState(0);
  const searchRequest = useRef<AbortController | null>(null);
  useEffect(() => () => searchRequest.current?.abort(), []);
  useEffect(() => {
    if (!selectedKey) { setSelected([]); setNamesFailed(false); return; }
    const controller = new AbortController();
    setNamesFailed(false);
    void apiFetch<Product[]>({ path: `/wc/store/v1/products?${selectedKey.split(',').map(id => `include%5B%5D=${id}`).join('&')}&per_page=${max}&catalog_visibility=visible`, signal: controller.signal })
      .then(products => { if (!controller.signal.aborted) setSelected(products); })
      .catch(() => { if (!controller.signal.aborted) setNamesFailed(true); });
    return () => controller.abort();
  }, [selectedKey, max, namesRetry]);
  const productName = (id: number) => [...found, ...selected].find(product => product.id === id)?.name ?? sprintf(__('Product #%d', 'wconvert'), id);
  const move = (index: number, direction: -1 | 1) => { const next = [...ids]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; onChange(next); };
  const search = async () => {
    if (!query.trim()) return;
    searchRequest.current?.abort();
    const controller = new AbortController(); searchRequest.current = controller;
    setBusy(true); setError(''); setFound([]); setSearched(false);
    try {
      const products = await apiFetch<Product[]>({ path: `/wc/store/v1/products?search=${encodeURIComponent(query.trim())}&per_page=12&catalog_visibility=visible`, signal: controller.signal });
      if (!controller.signal.aborted) { setFound(products); setSearched(true); }
    } catch { if (!controller.signal.aborted) setError(__('Products could not load. Try again.', 'wconvert')); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <div className="wconvert-journey-settings__products">
    <p id={helpId}>{help ?? __('Choose up to six. The first three available products appear.', 'wconvert')}</p>
    <label>{label ?? __('Find products', 'wconvert')}<Input type="search" autoComplete="off" aria-describedby={helpId} value={query} onChange={event => { searchRequest.current?.abort(); setQuery(event.target.value); setFound([]); setError(''); setBusy(false); setSearched(false); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void search(); } }} /></label>
    <Button variant="outline" type="button" onClick={() => void search()} disabled={busy || !query.trim()}>{busy ? __('Searching…', 'wconvert') : error ? __('Retry search', 'wconvert') : __('Search catalog', 'wconvert')}</Button>
    {error && <p role="alert">{error}</p>}
    {searched && !found.length && <p role="status">{__('No products found. Try another name.', 'wconvert')}</p>}
    {ids.length >= max && <p>{__('Selection full. Remove a product to choose another.', 'wconvert')}</p>}
    {namesFailed && <div className="wconvert-result-filter__body"><p role="alert">{__('Product names could not load. Your selection is kept.', 'wconvert')}</p><TryAgain onClick={() => setNamesRetry(n => n + 1)} /></div>}
    {!!ids.length && <ol aria-label={ordered ? __('Selected products, in display order', 'wconvert') : __('Selected products', 'wconvert')}>{ids.map((id, index) => <li key={id} className="wconvert-result-picker__selection"><span>{productName(id)}</span><div className="wconvert-result-picker__actions">
      {ordered && ids.length > 1 && <Button variant="outline" type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`${__('Move earlier', 'wconvert')}: ${productName(id)}`}>{__('Earlier', 'wconvert')}</Button>}
      {ordered && ids.length > 1 && <Button variant="outline" type="button" disabled={index === ids.length - 1} onClick={() => move(index, 1)} aria-label={`${__('Move later', 'wconvert')}: ${productName(id)}`}>{__('Later', 'wconvert')}</Button>}
      <Button variant="outline" type="button" data-destructive="true" aria-label={`${__('Remove', 'wconvert')}: ${productName(id)}`} onClick={() => onChange(ids.filter(item => item !== id))}>{__('Remove', 'wconvert')}</Button></div></li>)}</ol>}
    {!!found.length && <ul aria-label={__('Search results', 'wconvert')}>{found.map(product => <li key={product.id}>
      {product.images?.[0]?.thumbnail && <img alt="" src={product.images[0].thumbnail} width="36" height="36" />}
      <span>{product.name} {product.is_in_stock === false ? __('Out of stock', 'wconvert') : ''} {productPrice(product)}</span>
      <Button variant="outline" type="button" aria-label={sprintf(__('%1$s: %2$s', 'wconvert'), actionLabel, product.name)} disabled={ids.includes(product.id) || ids.length >= max || (!allowUnavailable && product.is_in_stock === false)} onClick={() => onChange([...ids, product.id])}>{ids.includes(product.id) ? __('Selected', 'wconvert') : actionLabel}</Button>
    </li>)}</ul>}
  </div>;
}

