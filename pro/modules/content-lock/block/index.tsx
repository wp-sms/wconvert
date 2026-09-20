import { cloneBlock, createBlock, registerBlockType } from '@wordpress/blocks';
import { BlockControls, InspectorControls, InnerBlocks, useBlockProps } from '@wordpress/block-editor';
import { Button, Notice, PanelBody, ToolbarButton } from '@wordpress/components';
import { select, useSelect, useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { CampaignPickerFields, CampaignStatus, useCampaignChoices } from './CampaignPicker';
import './editor.css';
import './Divider';
import { ALLOWED_BLOCKS, LOCK_BLOCK, lockCount, supportedContent } from './selection';

registerBlockType(LOCK_BLOCK, {
  transforms: {
    from: [{
      type: 'block', blocks: ['*'], isMultiBlock: true,
      isMatch: (_attributes, blocks) => blocks.length > 0 && supportedContent(blocks) && lockCount(select('core/block-editor').getBlocks()) === 0,
      // WordPress's Group transform uses this hook for mixed block types.
      // Cloning preserves the complete subtree while avoiding duplicate client IDs.
      __experimentalConvert: blocks => createBlock(LOCK_BLOCK, {}, blocks.map(block => cloneBlock(block))),
    }],
    ungroup: (_attributes, blocks) => blocks,
  },
  edit: function ContentLockEdit({ attributes, setAttributes, clientId }) {
    const { count, content, canUnwrap } = useSelect(store => {
      const editor = store('core/block-editor');
      return { count: lockCount(editor.getBlocks()), content: editor.getBlocks(clientId), canUnwrap: editor.canRemoveBlocks([clientId]) };
    }, [clientId]);
    const { replaceBlocks, selectBlock } = useDispatch('core/block-editor');
    const { enableComplementaryArea } = useDispatch('core/interface');
    const openSettings = () => { selectBlock(clientId); enableComplementaryArea('core', 'edit-post/block'); };
    const state = useCampaignChoices();
    const value = attributes.optinId ?? '';
    const selected = state.data?.campaigns.find(item => item.id === value);
    const picker = <CampaignPickerFields value={value} onChange={optinId => setAttributes({ optinId })} state={state} />;
    return <div {...useBlockProps({ className: 'wconvert-lock-editor' })}>
      <InspectorControls>
        <PanelBody title={__('Content lock', 'wconvert')} initialOpen>
          {picker}
          <p>{__('Only content inside this section is locked.', 'wconvert')}</p>
        </PanelBody>
      </InspectorControls>
      <BlockControls group="other">
        <ToolbarButton disabled={!canUnwrap} onClick={() => replaceBlocks(clientId, content)}>{__('Remove lock, keep content', 'wconvert')}</ToolbarButton>
      </BlockControls>
      <div className="wconvert-lock-editor__boundary"><strong>{__('Content lock starts', 'wconvert')}</strong><span>{selected?.name ?? (value ? __('Campaign needs attention', 'wconvert') : __('Choose a Campaign', 'wconvert'))}</span></div>
      {!value ? <Button variant="secondary" onClick={openSettings}>{__('Choose Campaign', 'wconvert')}</Button> : <CampaignStatus value={value} state={state} />}
      {count > 1 && <Notice status="warning" isDismissible={false}>{__('Use one Content lock region per page. Additional regions stay readable. Remove extra locks while keeping their content.', 'wconvert')}</Notice>}
      {!supportedContent(content) && <Notice status="warning" isDismissible={false}>{__('This region includes unsupported blocks. Keep forms, media embeds and complex layouts outside the lock.', 'wconvert')}</Notice>}
      <InnerBlocks allowedBlocks={ALLOWED_BLOCKS} template={[["core/paragraph", { placeholder: __('Write or paste the content to reveal…', 'wconvert') }]]} />
      <div className="wconvert-lock-editor__boundary wconvert-lock-editor__end">{__('Content lock ends', 'wconvert')}</div>
    </div>;
  },
  save: () => <InnerBlocks.Content />,
});
