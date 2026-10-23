import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { TryAgain } from '@/shell/Region';
import { Disclosure } from '@/shell/Disclosure';
import type { ResultProductFilter as Filter } from '@renderer/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LiveProductMatches } from '@/builder/ResultProductFilter';
import { ProductPicker } from './ResultProductPicker';

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
      <option value="">{state.busy ? __('Loading…', 'wconvert-pro') : __('Choose…', 'wconvert-pro')}</option>
      {value && !state.items.some(item => item.id === value) && <option value={value}>{state.busy ? __('Loading selection…', 'wconvert-pro') : __('Unavailable — choose again', 'wconvert-pro')}</option>}
      {state.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {(state.more || state.items.length > 8 || !!search) && <Input type="search" aria-label={sprintf(__('Search %s', 'wconvert-pro'), label.toLowerCase())} placeholder={__('Search…', 'wconvert-pro')} value={search} maxLength={100} onChange={event => setSearch(event.target.value)} />}
    {state.more && <small>{__('Search to narrow the list.', 'wconvert-pro')}</small>}
    {!state.busy && !state.error && !state.items.length && <small>{__('No choices found. Try another search or add them in WooCommerce.', 'wconvert-pro')}</small>}
    {state.error && <p role="alert">{__('Choices could not load.', 'wconvert-pro')} <TryAgain onClick={() => setRetry(retry + 1)} /></p>}
  </div>;
}

export function ResultProductFilter({ value, onChange }: { value: Filter; onChange(value: Filter): void }) {
  const [preview, setPreview] = useState(false);
  const [curation, setCuration] = useState(false);
  const edit = (at: number, next: Filter['attributes'][number]) => onChange({ ...value, attributes: value.attributes.map((item, index) => index === at ? next : item) });
  return <div className="wconvert-result-filter">
    <CatalogChoice label={__('Category', 'wconvert-pro')} taxonomy="product_cat" value={value.category_id ? String(value.category_id) : ''} onChange={id => onChange({ ...value, category_id: Number(id) })} />
    <small>{__('Includes subcategories. Up to three available products appear.', 'wconvert-pro')}</small>
    <label>{__('Product order', 'wconvert-pro')}<select value={value.order ?? 'oldest'} onChange={event => onChange({ ...value, order: event.target.value as Filter['order'] })}>
      <option value="oldest">{__('Oldest first', 'wconvert-pro')}</option>
      <option value="newest">{__('Newest first', 'wconvert-pro')}</option>
      <option value="price_low">{__('Price: low to high', 'wconvert-pro')}</option>
      <option value="price_high">{__('Price: high to low', 'wconvert-pro')}</option>
    </select></label>
    {!!value.attributes.length && <p>{__('Products must match every filter.', 'wconvert-pro')}</p>}
    {value.attributes.map((filter, index) => <fieldset key={index}>
      <legend>{sprintf(__('Filter %d', 'wconvert-pro'), index + 1)}</legend>
      <CatalogChoice label={__('Attribute', 'wconvert-pro')} taxonomy="attributes" value={filter.taxonomy} onChange={taxonomy => edit(index, { taxonomy, term_id: 0 })} />
      {!!filter.taxonomy && <CatalogChoice key={filter.taxonomy} label={__('Value', 'wconvert-pro')} taxonomy={filter.taxonomy} value={filter.term_id ? String(filter.term_id) : ''} onChange={id => edit(index, { ...filter, term_id: Number(id) })} />}
      <Button variant="ghost" aria-label={sprintf(__('Remove filter %d', 'wconvert-pro'), index + 1)} onClick={() => onChange({ ...value, attributes: value.attributes.filter((_, at) => at !== index) })}>{__('Remove filter', 'wconvert-pro')}</Button>
    </fieldset>)}
    {value.attributes.length < 3 && <Button variant="outline" disabled={!value.category_id || value.attributes.some(item => !item.taxonomy || !item.term_id)} onClick={() => onChange({ ...value, attributes: [...value.attributes, { taxonomy: '', term_id: 0 }] })}>{__('Add attribute filter', 'wconvert-pro')}</Button>}
    <small>{__('Uses global WooCommerce attributes. Shoppers choose size or other options on the product page.', 'wconvert-pro')}</small>
    {new Set(value.attributes.map(item => item.taxonomy)).size < value.attributes.length && <p role="alert">{__('Use each attribute only once.', 'wconvert-pro')}</p>}
    <Disclosure variant="inline" onToggle={setCuration} title={__('Pin or exclude products', 'wconvert-pro')}
      summary={sprintf(__('%1$d pinned, %2$d excluded', 'wconvert-pro'), value.pinned_ids?.length ?? 0, value.excluded_ids?.length ?? 0)}>
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
