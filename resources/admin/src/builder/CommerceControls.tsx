import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { NativeSelect } from '../components/ui/native-select';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { refusable } from '../lib/refusable';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { LineSkeleton } from '../shell/LineSkeleton';
import { TryAgain } from '../shell/Region';

type Hit = { id: number; name: string };
type Results = { items: Hit[]; currency: string; decimals: number };
function ReadFailure({ message, onRetry }: { message: string; onRetry(): void }) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 text-note text-destructive"><span>{message}</span><TryAgain onClick={onRetry} /></div>;
}
export function CommercePicker({ value, onChange, categories = false, max = 20, recommendations = false, compact = false, searchLabel, excludeIds = [], itemControls }: { value: unknown; onChange(value: number[]): void; categories?: boolean; max?: number; recommendations?: boolean; compact?: boolean; searchLabel?: string; excludeIds?: readonly number[]; itemControls?: (id: number, name: string) => ReactNode }) {
  const ids = Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : [];
  const [query, setQuery] = useState(''); const [hits, setHits] = useState<Hit[]>([]); const [names, setNames] = useState<Hit[]>([]); const [error, setError] = useState('');
  const [namesFailed, setNamesFailed] = useState(false);
  const [namesAttempt, setNamesAttempt] = useState(0);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [changing, setChanging] = useState(false);
  const [searched, setSearched] = useState('');
  const inputId = useId();
  const fullId = useId();
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (changing) searchInput.current?.focus(); }, [changing]);
  const key = ids.join(',');
  useEffect(() => {
    setNamesFailed(false);
    if (!key) return;
    const controller = new AbortController();
    void apiFetch<Results>({ path: `/wconvert/v1/commerce/objects?kind=${categories ? 'category' : recommendations ? 'recommendation' : 'product'}&ids=${key}`, signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setNames(result.items); }).catch(() => { if (!controller.signal.aborted) setNamesFailed(true); });
    return () => controller.abort();
  }, [key, categories, recommendations, namesAttempt]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (!query.trim()) { setHits([]); return; }
      void apiFetch<Results>({ path: `/wconvert/v1/commerce/objects?kind=${categories ? 'category' : recommendations ? 'recommendation' : 'product'}&search=${encodeURIComponent(query)}`, signal: controller.signal })
        .then(result => { if (!controller.signal.aborted) { setHits(result.items); setSearched(query); setError(''); } })
        .catch(() => { if (!controller.signal.aborted) setError(__('Could not search the store.', 'wconvert')); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, categories, recommendations, searchAttempt]);
  const searchFailure = error && <ReadFailure message={error} onRetry={() => { setError(''); setSearchAttempt(current => current + 1); }} />;
  const namesFailure = namesFailed && <ReadFailure onRetry={() => setNamesAttempt(current => current + 1)}
    message={categories ? __('Category names could not load. Your selection is kept.', 'wconvert') : __('Product names could not load. Your selection is kept.', 'wconvert')} />;
  if (compact) {
    const single = max === 1;
    const showSearch = !single || ids.length === 0 || changing;
    const matches = searched === query ? hits.filter(hit => !ids.includes(hit.id) && !excludeIds.includes(hit.id)) : [];
    const nameOf = (id: number) => [...names, ...hits].find(hit => hit.id === id)?.name ?? `#${id}`;
    const move = (index: number, by: number) => {
      const next = [...ids];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      onChange(next);
    };
    return <div className="wconvert-product-picker">
      {namesFailure}
      {ids.length > 0 && <ol className="wconvert-product-picker__selected" aria-label={single ? __('Selected product', 'wconvert') : __('Selected extras, in display order', 'wconvert')}>
        {ids.map((id, i) => <li key={id}>
          {!single && <span className="wconvert-product-picker__number" aria-hidden="true">{i + 1}</span>}
          <span className="wconvert-product-picker__name">{nameOf(id)}</span>
          <span className="wconvert-product-picker__actions">
            {single ? <Button type="button" variant="ghost" aria-expanded={changing} aria-controls={changing ? inputId : undefined} onClick={() => setChanging(!changing)}>{changing ? __('Cancel', 'wconvert') : __('Change', 'wconvert')}</Button> : <>
              <Button type="button" variant="ghost" size="icon" disabled={i === 0} aria-label={sprintf(/* translators: %s: a product's name. */ __('Move %s up', 'wconvert'), nameOf(id))} title={__('Move up', 'wconvert')} onClick={() => move(i, -1)}><ArrowUp aria-hidden="true"/></Button>
              <Button type="button" variant="ghost" size="icon" disabled={i === ids.length - 1} aria-label={sprintf(/* translators: %s: a product's name. */ __('Move %s down', 'wconvert'), nameOf(id))} title={__('Move down', 'wconvert')} onClick={() => move(i, 1)}><ArrowDown aria-hidden="true"/></Button>
            </>}
            <Button type="button" variant="ghost" size="icon" aria-label={sprintf(/* translators: %s: a product's name. */ __('Remove %s', 'wconvert'), nameOf(id))} title={__('Remove', 'wconvert')} onClick={() => onChange(ids.filter(each => each !== id))}><X aria-hidden="true"/></Button>
          </span>
        </li>)}
      </ol>}
      {showSearch && <div className="wconvert-product-picker__search">
        <label className="sr-only" htmlFor={inputId}>{searchLabel ?? __('Find products', 'wconvert')}</label>
        <Input ref={searchInput} id={inputId} type="search" autoComplete="off" placeholder={searchLabel ?? __('Find products', 'wconvert')} value={query} onChange={event => { setQuery(event.target.value); setError(''); }}/>
        {searchFailure || query.trim() && <div role="status" className="wconvert-panel-hint">{searched !== query ? <><span className="sr-only">{__('Searching…', 'wconvert')}</span><Skeleton aria-hidden="true" className="h-[1lh] w-40 max-w-full" /></> : matches.length === 0 ? __('No matching products.', 'wconvert') : null}</div>}
        {matches.length > 0 && <ul className="wconvert-product-picker__results" aria-label={__('Matching products', 'wconvert')}>{matches.map(hit => <li key={hit.id}>
          <span className="wconvert-product-picker__name">{hit.name}</span>
          <Button type="button" variant="outline" aria-label={sprintf(single ? /* translators: %s: a product's name. */ __('Use %s', 'wconvert') : /* translators: %s: a product's name. */ __('Add %s', 'wconvert'), hit.name)} {...refusable(!single && ids.length >= max ? fullId : null, () => { setNames(current => [...current.filter(item => item.id !== hit.id), hit]); onChange(single ? [hit.id] : [...ids, hit.id]); setQuery(''); setChanging(false); })}>{single ? __('Use', 'wconvert') : __('Add', 'wconvert')}</Button>
        </li>)}</ul>}
        {!single && ids.length >= max && <p id={fullId} className="wconvert-panel-hint">{__('Remove a product to add another.', 'wconvert')}</p>}
      </div>}
    </div>;
  }
  return <div className="space-y-3">
    <label>{categories ? __('Find categories', 'wconvert') : recommendations ? __('Find products', 'wconvert') : __('Find products or variations', 'wconvert')}<Input value={query} onChange={event => setQuery(event.target.value)} /></label>
    {searchFailure}
    {namesFailure}
    <ol className="space-y-2">{ids.map((id, i) => <li className="flex flex-wrap items-center gap-2" key={id}>{[...names, ...hits].find(hit => hit.id === id)?.name ?? `#${id}`}
      {itemControls?.(id, [...names, ...hits].find(hit => hit.id === id)?.name ?? `#${id}`)}
      {recommendations && <Button variant="outline" type="button" disabled={i === 0} onClick={() => { const next = [...ids]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; onChange(next); }}>{__('Move earlier', 'wconvert')}</Button>}
      <Button variant="outline" type="button" onClick={() => onChange(ids.filter(each => each !== id))}>{__('Remove', 'wconvert')}</Button></li>)}</ol>
    {ids.length >= max && <p id={fullId} className="wconvert-panel-hint">{__('Remove a product to add another.', 'wconvert')}</p>}
    <ul className="space-y-2">{hits.filter(hit => !ids.includes(hit.id)).map(hit => <li className="flex items-center justify-between gap-2" key={hit.id}><span>{hit.name}</span> <Button aria-label={sprintf(/* translators: %s: the name of a product, variation or category. */ __('Add %s', 'wconvert'), hit.name)} variant="outline" type="button" {...refusable(ids.length >= max ? fullId : null, () => onChange([...ids, hit.id]))}>{__('Add', 'wconvert')}</Button></li>)}</ul>
  </div>;
}

type Range = { operator?: string; min?: number; max?: number; currency?: string; decimals?: number };
export function CommerceRange({ value, onChange, money }: { value: unknown; onChange(value: Range): void; money: boolean }) {
  const range: Range = value && typeof value === 'object' ? value : {};
  const [currency, setCurrency] = useState<{ currency: string; decimals: number }>();
  const [currencyFailed, setCurrencyFailed] = useState(false);
  const [currencyAttempt, setCurrencyAttempt] = useState(0);
  useEffect(() => { if (!money) return; let active = true;
    setCurrencyFailed(false);
    void apiFetch<Results>({ path: '/wconvert/v1/commerce/objects?kind=currency' }).then(result => { if (active) setCurrency(result); }).catch(() => { if (active) setCurrencyFailed(true); });
    return () => { active = false; };
  }, [money, currencyAttempt]);
  const currencyCode = range.currency ?? currency?.currency;
  const update = (next: Range) => onChange({ ...range, operator: range.operator ?? 'min', ...(money && currency ? { currency: currency.currency, decimals: currency.decimals } : {}), ...next });
  return <div className="space-y-3">
    <NativeSelect className="w-full" aria-label={__('Comparison', 'wconvert')} value={range.operator ?? 'min'} onChange={event => update({ operator: event.target.value })}>
      <option value="min">{__('At least', 'wconvert')}</option><option value="max">{__('At most', 'wconvert')}</option><option value="between">{__('Between', 'wconvert')}</option>
    </NativeSelect>
    <Input aria-label={__('Amount or quantity', 'wconvert')} type="number" min="0" step={money ? 10 ** -(currency?.decimals ?? 2) : 1} value={range.min ?? ''} onChange={event => update({ min: event.target.value === '' ? undefined : Number(event.target.value) })} />
    {range.operator === 'between' && <Input aria-label={__('Upper limit', 'wconvert')} type="number" min="0" step={money ? 'any' : 1} value={range.max ?? ''} onChange={event => update({ max: event.target.value === '' ? undefined : Number(event.target.value) })} />}
    {money && currencyFailed && <ReadFailure message={__('Could not load the store currency.', 'wconvert')} onRetry={() => setCurrencyAttempt(current => current + 1)} />}
    {money && <p>{currencyCode ?? (!currencyFailed && <LineSkeleton inline status={__('Loading store currency…', 'wconvert')} className="w-8" />)}{(currencyCode || !currencyFailed) && ' · '}{__('Products after discounts, excluding tax and shipping.', 'wconvert')}</p>}
  </div>;
}
