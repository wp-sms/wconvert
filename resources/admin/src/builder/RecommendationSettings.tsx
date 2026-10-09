import { useId } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowRight } from 'lucide-react';
import type { ProductsNode } from '@renderer/types';
import { CommercePicker } from './CommerceControls';
import { Button } from '../components/ui/button';

/** One recommendation editor; campaign placement remains owned by Display rules. */
export function RecommendationSettings({ value, onChange, onPlacement }: {
  value: ProductsNode;
  onChange(patch: Partial<ProductsNode>): void;
  onPlacement?: () => void;
}) {
  const contextName = useId();
  const legacyBasket = !('main_product_id' in value) && value.context !== 'product';
  return <div className="wconvert-recommendations">
    <section aria-label={__('Main product', 'wconvert')}>
      <h4>{__('Main product', 'wconvert')}</h4>
      <CommercePicker recommendations compact max={1} searchLabel={__('Find the main product', 'wconvert')} value={value.main_product_id ? [value.main_product_id] : []} onChange={ids => onChange({ main_product_id: ids[0] ?? 0, product_ids: (value.product_ids ?? []).filter(id => id !== ids[0]) })} />
      {legacyBasket && <p className="wconvert-recommendations__help">{__('Currently uses any nonempty basket. Choose a product to narrow it.', 'wconvert')}</p>}
    </section>
    <section aria-label={__('Recommended extras', 'wconvert')}>
      <h4>{__('Recommended extras', 'wconvert')}</h4>
      <label className="wconvert-recommendations__source"><span className="sr-only">{__('Product source', 'wconvert')}</span>
        <select value={value.source ?? 'selected'} onChange={event => onChange({ source: event.target.value as ProductsNode['source'] })}>
          <option value="selected">{__('Choose products', 'wconvert')}</option>
          <option value="cross_sells">{__('WooCommerce cross-sells', 'wconvert')}</option>
        </select>
      </label>
      {value.source === 'cross_sells' ? <p className="wconvert-recommendations__help">{value.main_product_id ? __('Uses cross-sells saved on the main product.', 'wconvert') : __('Uses cross-sells saved on basket products.', 'wconvert')}</p> : <>
        <p className="wconvert-recommendations__help">{__('Pick up to 6. The first 3 available products appear.', 'wconvert')}</p>
        <CommercePicker value={value.product_ids} max={6} recommendations compact searchLabel={__('Find an extra', 'wconvert')} excludeIds={value.main_product_id ? [value.main_product_id] : []} onChange={ids => onChange({ product_ids: ids })} />
      </>}
      <label><input type="checkbox" checked={value.exclude_cart !== false} onChange={event => onChange({ exclude_cart: event.target.checked })}/><span>{__('Hide items already in the basket', 'wconvert')}</span></label>
    </section>
    <fieldset className="wconvert-recommendations__when">
      <legend>{__('Show when', 'wconvert')}</legend>
      <div className="wconvert-radio-cards">
        <label className="wconvert-radio-card"><input type="radio" name={contextName} checked={value.context === 'product'} onChange={() => onChange({ context: 'product' })}/><span>{__('Viewing the main product', 'wconvert')}</span></label>
        <label className="wconvert-radio-card"><input type="radio" name={contextName} checked={value.context !== 'product'} onChange={() => onChange({ context: 'cart' })}/><span>{legacyBasket ? __('Basket has items', 'wconvert') : __('Main product is in the basket', 'wconvert')}</span></label>
      </div>
      <p className="wconvert-recommendations__help">{value.context === 'product' ? __('Works with an empty basket, too.', 'wconvert') : __('Appears on pages allowed by your display rules.', 'wconvert')}</p>
      {onPlacement ? <Button type="button" variant="outline" className="wconvert-recommendations__placement" onClick={onPlacement}>{__('Placement & rules', 'wconvert')}<ArrowRight aria-hidden="true" /></Button> : <p className="wconvert-recommendations__help">{__('Set placement in Display rules.', 'wconvert')}</p>}
    </fieldset>
    <section aria-label={__('Product action', 'wconvert')}>
      <h4>{__('Product action', 'wconvert')}</h4>
      <label className="wconvert-recommendations__source"><span className="sr-only">{__('Product action', 'wconvert')}</span>
        <select value={value.action ?? 'link'} onChange={event => onChange({ action: event.target.value as ProductsNode['action'] })}>
          <option value="link">{__('Open product page', 'wconvert')}</option>
          <option value="add_to_cart">{__('Add to cart', 'wconvert')}</option>
        </select>
      </label>
      <p className="wconvert-recommendations__help">{value.action === 'add_to_cart'
        ? __('Adds one item. Products needing options open their product page.', 'wconvert')
        : __('Results count product clicks.', 'wconvert')}</p>
      {value.action === 'add_to_cart' && <p className="wconvert-recommendations__help">{__('Use the Increase basket value goal. Counts campaign appearances with an addition, not purchases.', 'wconvert')}</p>}
    </section>
  </div>;
}
