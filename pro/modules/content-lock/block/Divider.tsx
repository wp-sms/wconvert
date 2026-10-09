import { getBlockType, registerBlockType, serialize } from '@wordpress/blocks';
import { BlockControls, InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { Button, Notice, PanelBody, ToolbarButton } from '@wordpress/components';
import { useSelect, useDispatch } from '@wordpress/data';
import { __, sprintf, _n } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import { CampaignPickerFields, CampaignStatus, boundaryLabel, useCampaignChoices } from './CampaignPicker';
import { ALLOWED_BLOCKS, DIVIDER_BLOCK, LOCK_BLOCK, lockCount, supportedContent } from './selection';

registerBlockType(DIVIDER_BLOCK, {
  icon: 'minus',
  edit: function Divider({ attributes, setAttributes, clientId }) {
    const { blocks, canRemove } = useSelect(store => {
      const editor = store('core/block-editor');
      return { blocks: editor.getBlocks(), canRemove: editor.canRemoveBlocks([clientId]) };
    }, [clientId]);
    const { removeBlocks, selectBlock } = useDispatch('core/block-editor');
    const { enableComplementaryArea } = useDispatch('core/interface');
    const [focusRequested, setFocusRequested] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(true);
    const openSettings = () => { setSettingsOpen(true); setFocusRequested(true); selectBlock(clientId); enableComplementaryArea('core', 'edit-post/block'); };
    const state = useCampaignChoices();
    const value = attributes.optinId ?? '';
    const index = blocks.findIndex(block => block.clientId === clientId);
    const remaining = index < 0 ? [] : blocks.slice(index + 1);
    const html = serialize(remaining).replace(/<!--[\s\S]*?-->/g, '');
    const hasContent = /<img\b/i.test(html) || html.replace(/<[^>]*>/g, '').replace(/&(?:nbsp|#160|#xA0);/gi, '').trim() !== '';
    const article = serialize(blocks);
    const pagination = article.includes('<!--nextpage-->') || article.includes('<!--more');
    const hasSection = (items: typeof blocks): boolean => items.some(block => block.name === LOCK_BLOCK || hasSection(block.innerBlocks));
    const unsupported = remaining.find(block => !supportedContent([block], ALLOWED_BLOCKS, true));
    const problem = index < 0
      ? __('Move this divider into the main article. Content stays public inside Groups, Columns or patterns.', 'wconvert')
      : hasSection(blocks) || article.includes('[wconvert_content_lock')
        ? __('This article already has a content lock section. Remove one lock. The divider is inactive.', 'wconvert')
        : lockCount(blocks) > 1
          ? __('Keep one divider per article. Until extras are removed, content stays public.', 'wconvert')
          : pagination
            ? __('Remove Page Break and More blocks to use this divider. Content stays public.', 'wconvert')
            : unsupported
              ? sprintf(__('The %s block below is not supported here. Move it above the divider. Content stays public.', 'wconvert'), getBlockType(unsupported.name)?.title ?? unsupported.name)
              : /<(?:form|iframe|script|video|audio|object|embed)\b|\[\/?[a-zA-Z]/i.test(html)
                ? __('Content below includes an embed or shortcode. Move it above the divider. The remainder stays public.', 'wconvert')
              : null;
    const picker = <CampaignPickerFields value={value} onChange={optinId => setAttributes({ optinId })} state={state} focusRequested={focusRequested} onFocusHandled={() => setFocusRequested(false)} />;
    return <div {...useBlockProps({ className: 'wconvert-lock-divider' })}>
      <InspectorControls><PanelBody title={__('Lock from here', 'wconvert')} opened={settingsOpen} onToggle={setSettingsOpen}>
        {picker}
        <p className="wconvert-lock-settings__hint">{__('Locks to the end of this article, including new content. For a section with public content after it, use the WConvert content lock block.', 'wconvert')}</p>
      </PanelBody></InspectorControls>
      <BlockControls group="other"><ToolbarButton disabled={!canRemove} onClick={() => removeBlocks([clientId])}>{__('Remove divider, keep content', 'wconvert')}</ToolbarButton></BlockControls>
      <div className="wconvert-lock-editor__boundary"><strong>{__('Content lock starts here', 'wconvert')}</strong><span>{boundaryLabel(value, state, __('Not set up', 'wconvert'))}</span></div>
      <p className="wconvert-lock-divider__scope">{__('Everything below, to the end of this article.', 'wconvert')}</p>
      {!value ? <Button variant="secondary" onClick={openSettings}>{__('Choose campaign', 'wconvert')}</Button> : <CampaignStatus value={value} state={state} />}
      {problem ? <Notice status={hasContent ? 'warning' : 'info'} isDismissible={false}>{problem}{unsupported && <Button variant="secondary" onClick={() => selectBlock(unsupported.clientId)}>{__('Find unsupported block', 'wconvert')}</Button>}</Notice>
        : <span className="wconvert-lock-divider__count">{!hasContent ? __('Add content below to lock it.', 'wconvert') : sprintf(_n('%d block below', '%d blocks below', remaining.length, 'wconvert'), remaining.length)}</span>}
    </div>;
  },
  save: () => null,
});
