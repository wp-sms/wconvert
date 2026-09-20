import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks, useBlockProps } from '@wordpress/block-editor';
import { Notice, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { publishedInlineOptins } from '../../../../resources/blocks/inline-optin/src/optins';

registerBlockType('wconvert/content-lock', {
  edit({ attributes, setAttributes }) {
    const available = publishedInlineOptins();
    return <div {...useBlockProps({ style: { border: '1px dashed #64748b', padding: '16px' } })}>
      <h3>{__('WConvert Content lock', 'wconvert')}</h3>
      <SelectControl label={__('Campaign', 'wconvert')} value={attributes.optinId ?? ''}
        options={[{ label: __('Choose an inline Campaign…', 'wconvert'), value: '' }, ...(available ?? []).map(entry => ({ label: entry.name, value: entry.id }))]}
        onChange={optinId => setAttributes({ optinId })} />
      <Notice status="info" isDismissible={false}>{__('Enable Content lock in this Campaign’s Display rules. The content below stays readable if the form is unavailable. Use one region per page; keep a public introduction above it.', 'wconvert')}</Notice>
      {attributes.optinId && available && !available.some(entry => entry.id === attributes.optinId) && <Notice status="warning" isDismissible={false}>{__('This Campaign is no longer published as inline. The content stays available until a usable Campaign is selected.', 'wconvert')}</Notice>}
      <InnerBlocks allowedBlocks={['core/paragraph', 'core/heading', 'core/list', 'core/image', 'core/table', 'core/quote', 'core/buttons', 'core/separator', 'core/spacer']} />
    </div>;
  },
  save: () => <InnerBlocks.Content />,
});
