import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { TryAgain } from '../shell/Region';
import type { ResultProductFilter as Filter } from '@renderer/types';

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
  if (state.error) return <div><p role="alert">{__('Matches could not load. Check your category and filters, then try again.', 'wconvert')}</p><TryAgain onClick={() => setRetry(retry + 1)} /></div>;
  if (!state.items.length) return <p role="status">{__('No available matches. Visitors can still use the result’s link.', 'wconvert')}</p>;
  const missingPins = (filter.pinned_ids ?? []).some(id => !filter.excluded_ids?.includes(id) && !state.items.some(item => item.id === id));
  return <>{missingPins && <p role="status">{__('A pinned product is unavailable or does not match. Other matches appear below.', 'wconvert')}</p>}<ul className="wc-products-list wconvert-product-matches">{state.items.map(product => <li key={product.id}>
    {product.images?.[0]?.thumbnail && <img src={product.images[0].thumbnail} alt="" width="40" height="40" />}
    <a href={product.permalink} target="_blank" rel="noreferrer">{product.name}</a>
  </li>)}</ul></>;
}
