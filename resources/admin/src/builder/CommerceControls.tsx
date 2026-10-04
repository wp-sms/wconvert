import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useEffect, useState, type ReactNode } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';

type Hit = { id: number; name: string };
type Results = { items: Hit[]; currency: string; decimals: number };
export function CommercePicker({ value, onChange, categories = false, max = 20, recommendations = false, itemControls }: { value: unknown; onChange(value: number[]): void; categories?: boolean; max?: number; recommendations?: boolean; itemControls?: (id: number, name: string) => ReactNode }) {
  const ids = Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : [];
  const [query, setQuery] = useState(''); const [hits, setHits] = useState<Hit[]>([]); const [names, setNames] = useState<Hit[]>([]); const [error, setError] = useState('');
  const key = ids.join(',');
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void apiFetch<Results>({ path: `/wconvert/v1/commerce/objects?kind=${categories ? 'category' : recommendations ? 'recommendation' : 'product'}&ids=${key}`, signal: controller.signal })
      .then(result => setNames(result.items)).catch(() => {});
    return () => controller.abort();
  }, [key, categories, recommendations]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (!query.trim()) { setHits([]); return; }
      void apiFetch<Results>({ path: `/wconvert/v1/commerce/objects?kind=${categories ? 'category' : recommendations ? 'recommendation' : 'product'}&search=${encodeURIComponent(query)}`, signal: controller.signal })
        .then(result => { setHits(result.items); setError(''); })
        .catch(() => { if (!controller.signal.aborted) setError(__('Could not search the store. Try again.', 'wconvert')); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, categories, recommendations]);
  return <div className="space-y-3">
    <label>{categories ? __('Find categories', 'wconvert') : recommendations ? __('Find products', 'wconvert') : __('Find products or variations', 'wconvert')}<Input value={query} onChange={event => setQuery(event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <ol className="space-y-2">{ids.map((id, i) => <li className="flex flex-wrap items-center gap-2" key={id}>{[...names, ...hits].find(hit => hit.id === id)?.name ?? `#${id}`}
      {itemControls?.(id, [...names, ...hits].find(hit => hit.id === id)?.name ?? `#${id}`)}
      {recommendations && <Button variant="outline" size="sm" type="button" disabled={i === 0} onClick={() => { const next = [...ids]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; onChange(next); }}>{__('Move earlier', 'wconvert')}</Button>}
      <Button variant="outline" size="sm" type="button" onClick={() => onChange(ids.filter(each => each !== id))}>{__('Remove', 'wconvert')}</Button></li>)}</ol>
    <ul className="space-y-2">{hits.filter(hit => !ids.includes(hit.id)).map(hit => <li className="flex items-center justify-between gap-2" key={hit.id}><span>{hit.name}</span> <Button aria-label={sprintf(__('Add %s', 'wconvert'), hit.name)} variant="outline" size="sm" type="button" disabled={ids.length >= max} onClick={() => onChange([...ids, hit.id])}>{__('Add', 'wconvert')}</Button></li>)}</ul>
  </div>;
}

type Range = { operator?: string; min?: number; max?: number; currency?: string; decimals?: number };
export function CommerceRange({ value, onChange, money }: { value: unknown; onChange(value: Range): void; money: boolean }) {
  const range: Range = value && typeof value === 'object' ? value : {};
  const [currency, setCurrency] = useState<{ currency: string; decimals: number }>();
  useEffect(() => { if (!money) return; let active = true;
    void apiFetch<Results>({ path: '/wconvert/v1/commerce/objects?kind=currency' }).then(result => { if (active) setCurrency(result); }).catch(() => {});
    return () => { active = false; };
  }, [money]);
  const update = (next: Range) => onChange({ ...range, operator: range.operator ?? 'min', ...(money && currency ? { currency: currency.currency, decimals: currency.decimals } : {}), ...next });
  return <div className="space-y-3">
    <select className="w-full rounded-md border border-input bg-background p-2" aria-label={__('Comparison', 'wconvert')} value={range.operator ?? 'min'} onChange={event => update({ operator: event.target.value })}>
      <option value="min">{__('At least', 'wconvert')}</option><option value="max">{__('At most', 'wconvert')}</option><option value="between">{__('Between', 'wconvert')}</option>
    </select>
    <Input aria-label={__('Amount or quantity', 'wconvert')} type="number" min="0" step={money ? 10 ** -(currency?.decimals ?? 2) : 1} value={range.min ?? ''} onChange={event => update({ min: event.target.value === '' ? undefined : Number(event.target.value) })} />
    {range.operator === 'between' && <Input aria-label={__('Upper limit', 'wconvert')} type="number" min="0" step={money ? 'any' : 1} value={range.max ?? ''} onChange={event => update({ max: event.target.value === '' ? undefined : Number(event.target.value) })} />}
    {money && <p>{range.currency ?? currency?.currency ?? __('Loading store currency…', 'wconvert')} · {__('Products after discounts, excluding tax and shipping.', 'wconvert')}</p>}
  </div>;
}
