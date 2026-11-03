import { useEffect, useId, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { refusable } from '@/lib/refusable';
import { TryAgain } from '@/shell/Region';
import { Disclosure } from '@/shell/Disclosure';
import { LineSkeleton } from '@/shell/LineSkeleton';
import type { ResultProductFilter as Filter } from '@renderer/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LiveProductMatches } from '@/builder/ResultProductFilter';
import { ProductPicker } from './ResultProductPicker';
import { NativeSelect } from '@/components/ui/native-select';
import { formatCount } from '@/lib/format';

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
  const held = state.items.some(item => item.id === value);
  // A bar in the control's place until the list can name what is chosen: an option cannot hold one.
  const waiting = state.busy && (!state.items.length || (!!value && !held));
  return <div className="wconvert-catalog-choice">
    <label>{label}{waiting ? <LineSkeleton inline status={__('Loading choices…', 'wconvert-pro')} className="block h-9 w-full" /> : <NativeSelect value={value} onChange={event => onChange(event.target.value)} disabled={state.error}>
      <option value="">{__('Choose…', 'wconvert-pro')}</option>
      {value && !held && <option value={value}>{__('Unavailable — choose again', 'wconvert-pro')}</option>}
      {state.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </NativeSelect>}</label>
    {(state.more || state.items.length > 8 || !!search) && <Input type="search" aria-label={sprintf(/* translators: %s: what is being searched, in lowercase: “category”, “attribute” or “value”. */ __('Search %s', 'wconvert-pro'), label.toLowerCase())} placeholder={__('Search…', 'wconvert-pro')} value={search} maxLength={100} onChange={event => setSearch(event.target.value)} />}
    {state.more && <small>{__('Search to narrow the list.', 'wconvert-pro')}</small>}
    {!state.busy && !state.error && !state.items.length && <small>{__('No choices found. Try another search or add them in WooCommerce.', 'wconvert-pro')}</small>}
    {state.error && <p role="alert">{__('Choices could not load.', 'wconvert-pro')} <TryAgain onClick={() => setRetry(retry + 1)} /></p>}
  </div>;
}

export function ResultProductFilter({ value, onChange }: { value: Filter; onChange(value: Filter): void }) {
  const addReason = useId();
  const addRefused = !value.category_id || value.attributes.some(item => !item.taxonomy || !item.term_id);
  const [preview, setPreview] = useState(false);
  const [curation, setCuration] = useState(false);
  const edit = (at: number, next: Filter['attributes'][number]) => onChange({ ...value, attributes: value.attributes.map((item, index) => index === at ? next : item) });
  return <div className="wconvert-result-filter">
    <CatalogChoice label={__('Category', 'wconvert-pro')} taxonomy="product_cat" value={value.category_id ? String(value.category_id) : ''} onChange={id => onChange({ ...value, category_id: Number(id) })} />
    <small>{__('Includes subcategories. Up to three available products appear.', 'wconvert-pro')}</small>
    <label>{__('Product order', 'wconvert-pro')}<NativeSelect value={value.order ?? 'oldest'} onChange={event => onChange({ ...value, order: event.target.value as Filter['order'] })}>
      <option value="oldest">{__('Oldest first', 'wconvert-pro')}</option>
      <option value="newest">{__('Newest first', 'wconvert-pro')}</option>
      <option value="price_low">{__('Price: low to high', 'wconvert-pro')}</option>
      <option value="price_high">{__('Price: high to low', 'wconvert-pro')}</option>
    </NativeSelect></label>
    {!!value.attributes.length && <p>{__('Products must match every filter.', 'wconvert-pro')}</p>}
    {value.attributes.map((filter, index) => <fieldset key={index}>
      <legend>{sprintf(/* translators: %s: the product filter's position in the list, e.g. 1. */ __('Filter %s', 'wconvert-pro'), formatCount(index + 1))}</legend>
      <CatalogChoice label={__('Attribute', 'wconvert-pro')} taxonomy="attributes" value={filter.taxonomy} onChange={taxonomy => edit(index, { taxonomy, term_id: 0 })} />
      {!!filter.taxonomy && <CatalogChoice key={filter.taxonomy} label={__('Value', 'wconvert-pro')} taxonomy={filter.taxonomy} value={filter.term_id ? String(filter.term_id) : ''} onChange={id => edit(index, { ...filter, term_id: Number(id) })} />}
      <Button variant="ghost" aria-label={sprintf(/* translators: %s: the product filter's position in the list, e.g. 1. */ __('Remove filter %s', 'wconvert-pro'), formatCount(index + 1))} onClick={() => onChange({ ...value, attributes: value.attributes.filter((_, at) => at !== index) })}>{__('Remove filter', 'wconvert-pro')}</Button>
    </fieldset>)}
    {value.attributes.length < 3 && <>
      {addRefused && <span id={addReason} className="sr-only">{value.category_id ? __('Finish this filter first.', 'wconvert-pro') : __('Choose a category first.', 'wconvert-pro')}</span>}
      <Button variant="outline" {...refusable(addRefused ? addReason : null, () => onChange({ ...value, attributes: [...value.attributes, { taxonomy: '', term_id: 0 }] }))}>{__('Add attribute filter', 'wconvert-pro')}</Button>
    </>}
    <small>{__('Uses global WooCommerce attributes. Shoppers choose options on the product page.', 'wconvert-pro')}</small>
    {new Set(value.attributes.map(item => item.taxonomy)).size < value.attributes.length && <p role="alert">{__('Use each attribute only once.', 'wconvert-pro')}</p>}
    <Disclosure variant="inline" onToggle={setCuration} title={__('Pin or exclude', 'wconvert-pro')}
      summary={sprintf(/* translators: 1: how many products are pinned to show first for this quiz result, 2: how many products are left out of it. */ __('%1$s pinned, %2$s excluded', 'wconvert-pro'), formatCount(value.pinned_ids?.length ?? 0), formatCount(value.excluded_ids?.length ?? 0))}>
      {curation && <div className="wconvert-result-filter__body"><fieldset><legend>{__('Pinned products', 'wconvert-pro')}</legend>
        <ProductPicker ids={value.pinned_ids ?? []} max={3} label={__('Find products to pin', 'wconvert-pro')} actionLabel={__('Pin', 'wconvert-pro')} help={__('Choose up to three. Shown first when available and matching all filters.', 'wconvert-pro')} onChange={pinned_ids => onChange({ ...value, pinned_ids })} />
      </fieldset>
      <fieldset><legend>{__('Excluded products', 'wconvert-pro')}</legend>
        <ProductPicker ids={value.excluded_ids ?? []} max={12} ordered={false} allowUnavailable label={__('Find products to exclude', 'wconvert-pro')} actionLabel={__('Exclude', 'wconvert-pro')} help={__('Choose up to twelve. Never shown in this result, even if pinned.', 'wconvert-pro')} onChange={excluded_ids => onChange({ ...value, excluded_ids })} />
      </fieldset>
      </div>}
    </Disclosure>
    <Disclosure variant="inline" onToggle={setPreview} title={__('Preview matches', 'wconvert-pro')}>
      {preview && <div className="wconvert-result-filter__body"><LiveProductMatches filter={value} /><small>{__('Live catalog preview. No clicks or conversions are counted.', 'wconvert-pro')}</small></div>}
    </Disclosure>
  </div>;
}
