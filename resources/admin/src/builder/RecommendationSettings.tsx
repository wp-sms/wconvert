import { useId } from 'react';
import { __ } from '@wordpress/i18n';
import type { ProductsNode } from '@renderer/types';
import { CommercePicker } from './CommerceControls';
import { CheckRow } from '../shell/CheckRow';
import { FactList, FactRow, PanelField, PanelHint, PanelSection } from './PanelSection';

/** One recommendation editor; campaign placement remains owned by Display rules. */
export function RecommendationSettings({ value, onChange, onPlacement, placement }: {
  value: ProductsNode;
  /** Where the campaign sits on the page, as Display rules says it ("After the product summary"). */
  placement?: string;
  onChange(patch: Partial<ProductsNode>): void;
  onPlacement?: () => void;
}) {
  const contextName = useId();
  const legacyBasket = !('main_product_id' in value) && value.context !== 'product';
  const sourceId = `${contextName}-source`;
  const actionId = `${contextName}-action`;
  // Four sections in the panel grammar (ADR 0136); each sentence that stayed is one line, and the rest are InfoTips.
  return <div className="wconvert-recommendations">
    <PanelSection title={__('Main product', 'wconvert')}>
      <CommercePicker recommendations compact max={1} searchLabel={__('Find the main product', 'wconvert')} value={value.main_product_id ? [value.main_product_id] : []} onChange={ids => onChange({ main_product_id: ids[0] ?? 0, product_ids: (value.product_ids ?? []).filter(id => id !== ids[0]) })} />
      {legacyBasket && <PanelHint>{__('Currently uses any nonempty basket. Choose a product to narrow it.', 'wconvert')}</PanelHint>}
    </PanelSection>
    <PanelSection title={__('Recommended extras', 'wconvert')}>
      <PanelField label={__('Product source', 'wconvert')} htmlFor={sourceId}
        hint={value.source === 'cross_sells' ? value.main_product_id ? __('Uses cross-sells saved on the main product.', 'wconvert') : __('Uses cross-sells saved on basket products.', 'wconvert') : undefined}>
        <select id={sourceId} value={value.source ?? 'selected'} onChange={event => onChange({ source: event.target.value as ProductsNode['source'] })}>
          <option value="selected">{__('Choose products', 'wconvert')}</option>
          <option value="cross_sells">{__('WooCommerce cross-sells', 'wconvert')}</option>
        </select>
      </PanelField>
      {value.source !== 'cross_sells' && <div className="wconvert-panel-field">
        <CommercePicker value={value.product_ids} max={6} recommendations compact searchLabel={__('Find an extra', 'wconvert')} excludeIds={value.main_product_id ? [value.main_product_id] : []} onChange={ids => onChange({ product_ids: ids })} />
        <PanelHint>{__('Up to 6. The first 3 available appear.', 'wconvert')}</PanelHint>
      </div>}
      <CheckRow className="wconvert-check" label={__('Hide items already in the basket', 'wconvert')} checked={value.exclude_cart !== false} onChange={event => onChange({ exclude_cart: event.target.checked })} />
    </PanelSection>
    <PanelSection title={__('Show when', 'wconvert')}
      tip={value.context === 'product' ? __('Works with an empty basket, too.', 'wconvert') : __('Appears on pages allowed by your display rules.', 'wconvert')}>
      <div className="wconvert-radio-cards" role="radiogroup" aria-label={__('Show when', 'wconvert')}>
        <label className="wconvert-radio-card"><input type="radio" name={contextName} checked={value.context === 'product'} onChange={() => onChange({ context: 'product' })}/><span>{__('Viewing the main product', 'wconvert')}</span></label>
        <label className="wconvert-radio-card"><input type="radio" name={contextName} checked={value.context !== 'product'} onChange={() => onChange({ context: 'cart' })}/><span>{legacyBasket ? __('Basket has items', 'wconvert') : __('Main product is in the basket', 'wconvert')}</span></label>
      </div>
      <FactList><FactRow label={__('Placement', 'wconvert')} action={onPlacement ? __('Display rules', 'wconvert') : undefined} onAction={onPlacement}>{placement ?? __('Set in Display rules', 'wconvert')}</FactRow></FactList>
    </PanelSection>
    <PanelSection title={__('Product action', 'wconvert')}
      tip={value.action === 'add_to_cart' ? __('Adds one item; products needing options open their product page. It counts additions to the cart, not purchases.', 'wconvert') : __('Results count product clicks.', 'wconvert')}>
      <label className="sr-only" htmlFor={actionId}>{__('Product action', 'wconvert')}</label>
      <select id={actionId} value={value.action ?? 'link'} onChange={event => onChange({ action: event.target.value as ProductsNode['action'] })}>
        <option value="link">{__('Open the product page', 'wconvert')}</option>
        <option value="add_to_cart">{__('Add to cart', 'wconvert')}</option>
      </select>
      {/* It changes which goal to pick, so it stays a line rather than a tip (ADR 0136 §2). */}
      {value.action === 'add_to_cart' && <PanelHint>{__('Use the Increase basket value goal to count these.', 'wconvert')}</PanelHint>}
    </PanelSection>
  </div>;
}
